// @flow
/* eslint-disable class-methods-use-this */
/* eslint-disable no-unused-vars */
import uuid from 'uuid/v4'
import EventEmitter from 'events';
import Player from '../gui/Player';
import logger from '../logger';
import { MediaFormats } from '../browserCapabilities'
import { PLAYOUT_ENGINES } from './playoutEngineConsts'
import BasePlayoutEngine, { MEDIA_TYPES, SUPPORT_FLAGS } from './BasePlayoutEngine';
import DOMSwitchPlayoutEngine from './DOMSwitchPlayoutEngine';
import IOSPlayoutEngine from './iOSPlayoutEngine';
import { getSMPInterface } from '../utils'

class SMPPlayoutEngine extends BasePlayoutEngine {
    _secondaryPlayoutEngine: BasePlayoutEngine

    _playing: boolean;

    _smpPlayerInterface: Object

    _fakeItemRendererId: ?string

    _fakeItemDuration: number

    _fakeItemLoaded: boolean

    _fakeEventEmitter: Object

    constructor(player: Player, debugPlayout: boolean) {
        super(player, debugPlayout);

        // Get Playout Engine to use for BackgroundAudio
        const playoutToUse = MediaFormats.getPlayoutEngine(true);

        logger.info('SMP: Using backup playout engine: ', playoutToUse);

        this._smpPlayerInterface = getSMPInterface();

        switch (playoutToUse) {
        case PLAYOUT_ENGINES.DOM_SWITCH_PLAYOUT:
            // Use shiny source switching engine.... smooth.
            this._secondaryPlayoutEngine = new DOMSwitchPlayoutEngine(player, debugPlayout);
            break;
        case PLAYOUT_ENGINES.IOS_PLAYOUT:
            // Refactored iOS playout engine
            this._secondaryPlayoutEngine = new IOSPlayoutEngine(player, debugPlayout);
            break;
        default:
            logger.fatal('Invalid Playout Engine');
            throw new Error('Invalid Playout Engine');
        }

        this._smpPlayerInterface.addEventListener("pause", (event) => {
            // Hack to update playing status from SMP
            if(!event.ended && event.paused) {
                this.pause(false)
            }
        })

        // Play Button
        this._smpPlayerInterface.addEventListener("play", () => {
            // Hack to update playing status from SMP
            this.play(false)
        })

        this._fakeItemRendererId = null
        this._fakeItemDuration = -1
        this._fakeItemLoaded = false
        this._fakeEventEmitter = new EventEmitter();

        this._smpPlayerInterface.addEventListener("play", (e) => {
            this._fakeEventEmitter.emit("play", e)
        });
        this._smpPlayerInterface.addEventListener("pause", (e) => {
            this._fakeEventEmitter.emit("pause", e)
        });
        this._smpPlayerInterface.addEventListener("volumechange", (e) => {
            let { volume } = e
            if(e.muted) {
                volume = 0
            }
            this._secondaryPlayoutEngine.setAllVolume(volume)
        });

        this._smpFakePlay = this._smpFakePlay.bind(this);
        this._smpFakePause = this._smpFakePause.bind(this);
        this._smpFakeLoad = this._smpFakeLoad.bind(this);
    }

    supports(feature: string) {
        switch(feature) {
        case SUPPORT_FLAGS.SUPPORTS_360:
            return false
        default:
            return false
        }
    }

    setPermissionToPlay(value: boolean) {
        this._secondaryPlayoutEngine.setPermissionToPlay(value)
        super.setPermissionToPlay(value)

        // TODO: first active playout is not set to autoplay so we have to
        // manually start it here. We will need to test this on iOS as I'd
        // expect it to not work correctly
        this.play()
    }

    queuePlayout(rendererId: string, mediaObj: Object) {
        if(mediaObj.type === MEDIA_TYPES.BACKGROUND_A) {
            // Handle with Secondary Playout
            this._secondaryPlayoutEngine.queuePlayout(rendererId, mediaObj)
            return
        }

        // TODO: Get MediaFetcher to not resolve pids
        super.queuePlayout(rendererId, mediaObj);

        const options = {
            loop: false,
        };
        if("loop" in this._media[rendererId].media && this._media[rendererId].media.loop) {
            this.setLoopAttribute(rendererId, true);
            options.loop = true;
        }

        const { url } = this._media[rendererId].media
        let playlistItem = {}
        // Check if we have subtitles and that they are EBU-TT-D and not WebVTT
        if(
            "subs_url" in this._media[rendererId].media &&
            this._media[rendererId].media.subs_url.substr(-4) === ".xml"
        ) {

            playlistItem.captionsUrl = this._media[rendererId].media.subs_url;
        }
        let kind = "programme"
        if(mediaObj.type === MEDIA_TYPES.FOREGROUND_A) {
            kind = "audio"
        }
        if (url.indexOf('http') !== 0) {
            playlistItem = {
                ...playlistItem,
                versionID: url,
                kind,
            }
        } else if(url.indexOf('.mpd') !== -1) {
            playlistItem = {
                ...playlistItem,
                href:[{"url":url,"format":"dash"}],
                kind,
            }
        } else {
            playlistItem = {
                ...playlistItem,
                href:url,
                kind,
            };
        }

        const playlist = {
            summary: rendererId,
            options,
            config: {
                // XXX ondemandwebcast data probably needed later, for now
                // switching it off
                ondemandWebcastData:false,
                webcastData: {},
                autoplay: true,
                startTime : this._inTime,
            },
            playlist: {
                id: rendererId,
                items:[playlistItem]
            }
        }

        const dataStore = this._smpPlayerInterface.datastore;
        const baseUrl = dataStore.get("baseUrl");
        const includeCredentials = dataStore.get("includeCredentials") === true

        if(url.indexOf(baseUrl) === 0 && includeCredentials) {
            playlist.options.useCredentials = "MPD,InitializationSegment,MediaSegment"
        } else {
            playlist.options.useCredentials = "none"
        }

        logger.info(`SMP-SP readyPlaylist: ${rendererId}`)
        this._smpPlayerInterface.readyPlaylist(playlist)
        logger.info(`SMP-SP preloadFromCollection: ${rendererId}`)
        this._smpPlayerInterface.preloadFromCollection(rendererId)
    }

    unqueuePlayout(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if(!rendererPlayoutObj) {
            return this._secondaryPlayoutEngine.unqueuePlayout(rendererId)
        }
        return super.unqueuePlayout(rendererId)
    }

    setPlayoutVisible(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if(!rendererPlayoutObj) {
            this._secondaryPlayoutEngine.setPlayoutVisible(rendererId)
        }
    }

    getPlayoutActive(rendererId: string): boolean {
        const rendererPlayoutObj = this._media[rendererId];
        if(!rendererPlayoutObj) {
            return this._secondaryPlayoutEngine.getPlayoutActive(rendererId)
        }
        return super.getPlayoutActive(rendererId)
    }

    setPlayoutActive(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if(!rendererPlayoutObj) {
            this._secondaryPlayoutEngine.setPlayoutActive(rendererId)
            return
        }

        if(this._permissionToPlay) {
            // If permission to play granted then autostart playlist and
            // then pause if we are not currently playing
            this._smpPlayerInterface.loadPlaylistFromCollection(rendererId, true);
            if(!this._playing) {
                const pauseFunction = () => {
                    this._smpPlayerInterface.removeEventListener("playing", pauseFunction)
                    this._smpPlayerInterface.pause()
                }
                this._smpPlayerInterface.addEventListener("playing", pauseFunction)
            }
        } else {
            // If permission to play not granted then just load playlist without
            // playing
            this._smpPlayerInterface.loadPlaylistFromCollection(rendererId, false);
        }
        if (!rendererPlayoutObj.active) {
            logger.info(`Applying queued events for ${rendererId}`)
            rendererPlayoutObj.queuedEvents.forEach((qe) => {
                this._smpPlayerInterface.addEventListener(qe.event, qe.callback)
            })
            rendererPlayoutObj.queuedEvents = []
        }
        super.setPlayoutActive(rendererId)
        logger.info(`SMP-SP setPlayoutActive: ${rendererId}`)
    }

    _smpFakePlay() {
        const mi = this._smpPlayerInterface.currentItem;
        if (mi && mi.fake) {
            this._smpPlayerInterface.dispatchEvent({
                type: "playing",
                fake: true
            });
            if(this._fakeItemLoaded === false) {
                // This is playRequested event when playlist is first queued. We
                // don't want to emit play or change the playout engine playing
                // status for this first event
                this._fakeItemLoaded = true
            } else {
                this._fakeEventEmitter.emit("play")
                this.play(false)
            }
        }
    }

    _smpFakePause() {
        const mi = this._smpPlayerInterface.currentItem;
        if (mi && mi.fake) {
            this._fakeEventEmitter.emit("pause")
            this._smpPlayerInterface.dispatchEvent({
                type: "pause",
                fake: true
            });
            this.pause(false)
        }
    }

    _smpFakeLoad() {
        // Event called after the first playRequested event is sent. This is the
        // only valid place to dispatch the pause event to get the play/pause
        // button to change
        if(!this._playing) {
            this._smpPlayerInterface.dispatchEvent({
                type: "pause",
                fake: true
            });
        }
    }

    setNonAVPlayoutTime(rendererId, time) {
        if(
            rendererId === this._fakeItemRendererId &&
            this._fakeItemDuration > 0
        ) {
            this._smpPlayerInterface.dispatchEvent({
                type: "timeupdate",
                override: true,
                time,
                duration: this._fakeItemDuration
            })
        }
    }

    startNonAVPlayout(rendererId, duration = 0) {
        this._fakeItemRendererId = rendererId
        this._fakeItemDuration = duration
        this._fakeItemLoaded = false;

        const playlist = {
            id: `${uuid()}`,
            items: [{
                fake: true,
                vpid: `fakeitem`,
                duration: this._fakeItemDuration,
            }]
        }

        const config = {
            // XXX ondemandwebcast data probably needed later, for now
            // switching it off
            ondemandWebcastData:false,
            webcastData: {},
            autoplay: true
        }
        logger.info(`SMP-SP loadPlaylist (Fake)`)
        this._smpPlayerInterface.loadPlaylist(playlist, config);

        // Turn off SMP loading wheel
        this._smpPlayerInterface.updateUiConfig({
            buffer: {
                enabled: false
            }
        })

        this._smpPlayerInterface.addEventListener("playRequested", this._smpFakePlay);
        this._smpPlayerInterface.addEventListener("pauseRequested", this._smpFakePause);
        this._smpPlayerInterface.addEventListener("mediaItemInfoChanged", this._smpFakeLoad)
    }

    stopNonAVPlayout(rendererId: ?string) {
        // If stop comes after another nonav renderer has started, ignore
        if(rendererId === this._fakeItemRendererId) {
            this._fakeItemRendererId = null;
            this._fakeItemDuration = -1;
            this._smpPlayerInterface.removeEventListener("playRequested", this._smpFakePlay);
            this._smpPlayerInterface.removeEventListener("pauseRequested", this._smpFakePause);
            this._smpPlayerInterface.removeEventListener("mediaItemInfoChanged", this._smpFakeLoad)

            // Restore SMP loading wheel
            this._smpPlayerInterface.updateUiConfig({
                buffer: {
                    enabled: true
                }
            })
        }
    }

    setPlayoutInactive(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if(!rendererPlayoutObj) {
            return this._secondaryPlayoutEngine.setPlayoutInactive(rendererId)
        }

        return super.setPlayoutInactive(rendererId)
    }

    play(changeSMP = true) {
        this._playing = true;
        this._hasStarted = true;
        this.playBackgrounds();
        if(changeSMP) {
            this._smpPlayerInterface.play();
        }
        super.play()
    }

    /**
     * Pauses the player and backgrounds
     * @param {boolean} changeSMP do we change the SMP player state or not
     */
    pause(changeSMP: boolean = true) {
        this._playing = false;
        this.pauseBackgrounds();
        if(changeSMP) {
            this._smpPlayerInterface.pause();
        }
        super.pause()
    }

    isPlaying(): boolean {
        return this._playing;
    }

    hasStarted(): boolean {
        return super.hasStarted()
    }

    pauseBackgrounds() {
        this._secondaryPlayoutEngine.pauseBackgrounds();
    }

    playBackgrounds() {
        this._secondaryPlayoutEngine.playBackgrounds();
    }

    getCurrentTime(rendererId: string) {
        // TODO: May not account for in/out points
        const rendererPlayoutObj = this._media[rendererId];
        if(!rendererPlayoutObj) {
            return this._secondaryPlayoutEngine.getCurrentTime(rendererId)
        }
        if(rendererPlayoutObj.active) {
            return this._smpPlayerInterface.currentTime;
        }
        return undefined;

    }

    getDuration(rendererId: string) {
        // TODO: May not account for in/out points
        const rendererPlayoutObj = this._media[rendererId];
        if(!rendererPlayoutObj) {
            return this._secondaryPlayoutEngine.getDuration(rendererId)
        }
        if(rendererPlayoutObj.active) {
            return this._smpPlayerInterface.duration
        }
        logger.warn("Cannot get duration of non active")
        return 0
    }

    setCurrentTime(rendererId: string, time: number) {
        const rendererPlayoutObj = this._media[rendererId];
        if(!rendererPlayoutObj) {
            return this._secondaryPlayoutEngine.setCurrentTime(rendererId, time)
        }
        if(rendererPlayoutObj.active) {
            this._smpPlayerInterface.currentTime = time;
            return true
        }
        logger.warn("Cannot set duration of non active")
        return false;
    }


    on(rendererId: string, event: string, callback: Function) {
        // TODO: This is a horrible hack as non av don't exist in the playout engine
        // yet
        if(event === "play" || event === "pause") {
            this._fakeEventEmitter.addListener(event, callback)
            return false
        }
        const rendererPlayoutObj = this._media[rendererId];
        if(!rendererPlayoutObj) {
            return this._secondaryPlayoutEngine.on(rendererId, event, callback)
        }
        if (rendererPlayoutObj.active) {
            // This renderer is using the on screen video element
            // so add event listener directly
            this._smpPlayerInterface.addEventListener(event, callback);
        } else {
            // This renderer is not using the on screen video element
            // so add event listener to the queue so it can be applied in
            // setPlayoutActive
            if (!rendererPlayoutObj.queuedEvents) {
                rendererPlayoutObj.queuedEvents = []
            }
            rendererPlayoutObj.queuedEvents.push({
                event,
                callback,
            })
        }
        return false
    }

    off(rendererId: string, event: string, callback: Function) {
        if(event === "play" || event === "pause") {
            this._fakeEventEmitter.removeListener(event, callback)
            return false
        }
        const rendererPlayoutObj = this._media[rendererId];
        if(!rendererPlayoutObj) {
            return this._secondaryPlayoutEngine.off(rendererId, event, callback)
        }
        if (rendererPlayoutObj.active) {
            this._smpPlayerInterface.removeEventListener(event, callback);
        } else if (rendererPlayoutObj.queuedEvents) {
            // This renderer is not using the on screen video element
            // so remove event listener from queue
            const index = rendererPlayoutObj.queuedEvents
                .findIndex((qe) => qe.event === event && qe.callback === callback)
            if (index !== -1) {
                rendererPlayoutObj.queuedEvents.splice(index, 1);
            }
        }
        return false
    }

    _getMediaElement(rendererId: string): ?HTMLMediaElement {
        throw new Error("SMP RenderEngine doesn't allow access to HTML Media Element");
    }

    setLoopAttribute(rendererId: string, loop: ?boolean) {
        const mediaObject = this._media[rendererId];
        if (mediaObject) {
            if (loop) {
                mediaObject.loop = true;
            }
            else {
                mediaObject.loop = false;
            }
        }
    }

    checkIsLooping(rendererId: string) {
        if (this._media[rendererId] && 'loop' in this._media[rendererId]) {
            return this._media[rendererId].loop;
        }
        return false
    }

    applyStyle(rendererId: string, key: string, value: string) {
        // TODO: The below may help with styling
        // this._smpPlayerInterface.requestVideoElement(true)
        throw new Error("SMP RenderEngine doesn't allow setting style");
    }

    clearStyle(rendererId: string, key: string) {
    }

    setVolume(rendererId: string, volume: number) {
        const rendererPlayoutObj = this._media[rendererId];
        if(!rendererPlayoutObj) {
            this._secondaryPlayoutEngine.setVolume(rendererId, volume)
            return
        }
        if(rendererPlayoutObj.active) {
            this._smpPlayerInterface.volume = volume
        }
    }

    getVolume(rendererId: string, volume: number) {
        const rendererPlayoutObj = this._media[rendererId];
        if(!rendererPlayoutObj) {
            return this._secondaryPlayoutEngine.getVolume(rendererId)
        }
        if(rendererPlayoutObj.active) {
            return this._smpPlayerInterface.volume
        }
        return 1
    }
}

export default SMPPlayoutEngine;
