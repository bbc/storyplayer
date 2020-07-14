// @flow
/* eslint-disable class-methods-use-this */
/* eslint-disable no-unused-vars */
import uuid from 'uuid/v4'
import Player from '../Player';
import logger from '../logger';
import { MediaFormats } from '../browserCapabilities'
import { PLAYOUT_ENGINES } from './playoutEngineConsts'
import BasePlayoutEngine, { MEDIA_TYPES, SUPPORT_FLAGS } from './BasePlayoutEngine';
import DOMSwitchPlayoutEngine from './DOMSwitchPlayoutEngine';
import IOSPlayoutEngine from './iOSPlayoutEngine';


// let queueOnce = false

class SMPPlayoutEngine extends BasePlayoutEngine {
    _secondaryPlayoutEngine: BasePlayoutEngine

    _playing: boolean;

    _smpPlayerInterface: Object

    constructor(player: Player, debugPlayout: boolean) {
        super(player, debugPlayout);

        // Get Playout Engine to use for BackgroundAudio
        const playoutToUse = MediaFormats.getPlayoutEngine(true);

        logger.info('SMP: Using backup playout engine: ', playoutToUse);

        this._smpPlayerInterface = window.playerInterface;

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

        // TODO: Hook in buttons into playback
        // Probably should be moved into Player (or a file called from Player)
        this._smpPlayerInterface.addEventListener("previousRequested", () => {
            console.log("SMP PREVIOUS")
            this._player._backButtonClicked.bind(this._player)();
        })

        this._smpPlayerInterface.addEventListener("nextRequested", () => {
            console.log("SMP NEXT")
            this._player._nextButtonClicked.bind(this._player)();
        })
    }

    supports(feature) {
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

        // Example of changing button status
        // TODO: Interval buttons should be shown only for video
        // TODO: Enable buttons should be enabled/disabled based on lookahead/previous
        // ISSUE: includeBackIntervalButton, includeForwardIntervalButton don't seem to toggle buttons
        // NOTE: This cannot be called in constructor
        this._smpPlayerInterface.updateUiConfig({
            controls:{
                includeBackIntervalButton: false,
                includeForwardIntervalButton: false,
                alwaysEnablePreviousButton: true,
                alwaysEnableNextButton: true,
            }
        })

        const controlBar = document.querySelector('.p_playerControlBarHolder');
        const button = document.createElement('button');
        button.classList.add("p_button")
        button.classList.add("p_controlBarButton")
        button.classList.add("chapterButton")
        button.setAttribute("role", "button")
        button.setAttribute("aria-live", "polite")
        button.setAttribute("aria-label", "Toggle Chapter Menu")
        button.innerHTML = '<span class="p_hiddenElement" aria-hidden="true">Toggle Chapter Menu</span><div class="p_iconHolder"><svg focusable="false" viewBox="0 0 44 44" class="p_svg  p_padlock"><use xlink:href="#fullscreen-enter"></use></svg></div>'
        controlBar.appendChild(button)
        // <button class="p_button p_controlBarButton p_fullscreenButton" role="button" aria-live="polite" aria-label="Enter full screen" title="Enter full screen"><span class="p_hiddenElement" aria-hidden="true">Enter full screen</span><div class="p_iconHolder"><svg focusable="false" viewBox="0 0 44 44" class="p_svg  p_fullscreen-enterIcon"><use xlink:href="#fullscreen-enter"></use></svg></div></button>
        // const _nicontrolBar = document.querySelector('.p_controlBarFiller');
        // const _nipluginButton = document.createElement('div');
        // _nipluginButton.innerHTML = '<input type="range" min="1" max="100" value="100" class="_nislider" id="niSlider" name="nislider">';
        // _nipluginButton.className = 'plugin_button';
        // _nicontrolBar.appendChild(_nipluginButton);
        //


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
        if("loop" in this._media[rendererId].media && this._media[rendererId].media.loop) {
            logger.warn("SMP doesn't support Looping yet!")
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
            config: {
                // XXX ondemandwebcast data probably needed later, for now
                // switching it off
                ondemandWebcastData:false,
                webcastData: {},
                autoplay: true,
                startTime : this._inTime
            },
            playlist: {
                id: rendererId,
                items:[playlistItem]
            }
        }
        logger.info(`SMP-SP readyPlaylist: ${rendererId}`)
        this._smpPlayerInterface.readyPlaylist(playlist)
        logger.info(`SMP-SP preloadFromCollection: ${rendererId}`)
        this._smpPlayerInterface.preloadFromCollection(rendererId)

        // // TODO: Set next as actual next renderer
        // if(!queueOnce) {
        //     this._smpPlayerInterface.queuePlaylist({
        //         playlist,
        //         options: { preloadImmediately: true }
        //     });
        //     queueOnce = true
        // }
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
        }

        this._smpPlayerInterface.loadPlaylistFromCollection(rendererId, this._permissionToPlay)
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

    startNonAVPlayout() {
        const playlist = {
            // id: `${uuid()}`,
            items: [{
                fake: true,
                vpid: `fakeitem`,
                duration: 100
            }]
        }

        const config = {
            // XXX ondemandwebcast data probably needed later, for now
            // switching it off
            ondemandWebcastData:false,
            webcastData: {},
            autoplay: false,
            startTime : this._inTime
        }
        logger.info(`SMP-SP loadPlaylist (Fake)`)
        this._smpPlayerInterface.loadPlaylist(playlist, config);

        const playerInterface = this._smpPlayerInterface

        let timer;
        let time = 0;
        const td = function() {
            if (time++>2000) {
                playerInterface.dispatchEvent( { type:"ended",fake:true,fakeEnded:true } );
                time = 0;
            } else {
                playerInterface.dispatchEvent( { type:"timeupdate",override:true,time: time/20,duration:100});
                clearTimeout(timer);
                timer = setTimeout(td,50);
            }
        }
        playerInterface.addEventListener("seekRequested", function(e){
            time=e.time;
            td();
        });
        playerInterface.addEventListener("pauseRequested", function(){
            clearTimeout(timer)
        });
        const play = function(){
            const mi=playerInterface.currentItem;
            if (mi) {
                if (mi.fake) {
                    playerInterface.dispatchEvent( {type:"playing",fake:true});
                    timer = setTimeout(td,1000);
                }
            }
        }
        playerInterface.addEventListener("mediaItemInfoChanged", play);
        playerInterface.addEventListener("playRequested", play);
    }

    stopNonAVPlayout() {

    }

    setPlayoutInactive(rendererId: string) {
        // TODO
        const rendererPlayoutObj = this._media[rendererId];
        if(!rendererPlayoutObj) {
            return this._secondaryPlayoutEngine.setPlayoutInactive(rendererId)
        }

        // TODO: Clear SMP Player for case when we go from SMP to Image renderer
        return super.setPlayoutInactive(rendererId)
    }

    play() {
        this._playing = true;
        this._hasStarted = true;
        this._secondaryPlayoutEngine.play();
        this._smpPlayerInterface.play();
        super.play()
    }

    pause() {
        this._playing = false;
        this._secondaryPlayoutEngine.pause();
        this._smpPlayerInterface.pause();
        super.pause()
    }

    isPlaying(): boolean {
        return this._playing;
    }

    hasStarted(): boolean {
        return super.hasStarted()
    }

    pauseBackgrounds() {
        this._secondaryPlayoutEngine.pauseBackgrounds()
    }

    playBackgrounds() {
        this._secondaryPlayoutEngine.playBackgrounds()
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
        return 0;

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

    setLoopAttribute(rendererId: string, loop: ?boolean, element: ?HTMLMediaElement) {
        return false
    }

    checkIsLooping(rendererId: string) {
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
