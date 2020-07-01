// @flow
/* eslint-disable class-methods-use-this */
/* eslint-disable no-unused-vars */
import Player from '../Player';
import { checkAddDetailsOverride } from '../utils';
import logger from '../logger';
import { MediaFormats } from '../browserCapabilities'
import { PLAYOUT_ENGINES } from './playoutEngineConsts'
import BasePlayoutEngine, { MEDIA_TYPES } from './BasePlayoutEngine';
import DOMSwitchPlayoutEngine from './DOMSwitchPlayoutEngine';
import IOSPlayoutEngine from './iOSPlayoutEngine';

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
    }

    setPermissionToPlay(value: boolean) {
        this._secondaryPlayoutEngine.setPermissionToPlay(value)
        super.setPermissionToPlay(value)
    }

    queuePlayout(rendererId: string, mediaObj: Object) {
        if(mediaObj.type === MEDIA_TYPES.BACKGROUND_A) {
            // Handle with Secondary Playout
            this._secondaryPlayoutEngine.queuePlayout(rendererId, mediaObj)
            return
        }
        // TODO: Handle case where subtitles come after url

        // TODO: Get MediaFetcher to not resolve pids
        super.queuePlayout(rendererId, mediaObj);
        if("loop" in this._media[rendererId].media && this._media[rendererId].media.loop) {
            logger.warn("SMP doesn't support Looping yet!")
        }

        if("url" in this._media[rendererId].media) {
            const { url } = this._media[rendererId].media
            let playlistItem = {}
            if("subs_url" in this._media[rendererId].media) {
                // TODO: EBU-TT-D Only!
                playlistItem.captionsUrl = this._media[rendererId].media.subs_url;
            }
            let kind = "programme"
            if(mediaObj.type === MEDIA_TYPES.FOREGROUND_A) {
                kind = "audio"
            }
            if (url.indexOf('http') !== 0) {
                playlistItem = {
                    versionID: url,
                    kind,
                }
            } else if(url.indexOf('.mpd') !== -1) {
                playlistItem = {
                    href:[{"url":url,"format":"dash"}],
                    kind,
                }
            } else {
                playlistItem = {
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
            logger.info(`SMP-SP Readying: ${rendererId}`)
            this._smpPlayerInterface.readyPlaylist(playlist)
            logger.info(`SMP-SP Preload: ${rendererId}`)
            this._smpPlayerInterface.preloadFromCollection(rendererId)
        }

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
            return this._secondaryPlayoutEngine.setPlayoutVisible(rendererId)
        }
        return super.setPlayoutVisible(rendererId)
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
            this._secondaryPlayoutEngine.setPlayoutVisible(rendererId)
        }
        if("url" in rendererPlayoutObj.media && this._permissionToPlay) {
            this._smpPlayerInterface.loadPlaylistFromCollection(rendererId, true)
            if (!rendererPlayoutObj.active) {
                logger.info(`Applying queued events for ${rendererId}`)
                rendererPlayoutObj.queuedEvents.forEach((qe) => {
                    this._smpPlayerInterface.addEventListener(qe.event, qe.callback)
                })
                rendererPlayoutObj.queuedEvents = []
            }
            super.setPlayoutActive(rendererId)
            logger.info(`SMP-SP Load: ${rendererId}`)
        } else {
            setTimeout(() => {this.setPlayoutActive(rendererId)}, 100)
        }

    }

    setPlayoutInactive(rendererId: string) {
        // TODO
        const rendererPlayoutObj = this._media[rendererId];
        if(!rendererPlayoutObj) {
            return this._secondaryPlayoutEngine.setPlayoutVisible(rendererId)
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
        this._smpPlayerInterface.setTime(time);
        return true;
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

    getMediaElement(rendererId: string): ?HTMLMediaElement {
        return document.createElement('video');
    }

    setLoopAttribute(rendererId: string, loop: ?boolean, element: ?HTMLMediaElement) {
        return false
    }

    removeLoopAttribute(rendererId: string) {
        return false
    }

    checkIsLooping(rendererId: string) {
        return false
    }
}

// // Proxy through any unimplementd functions to playout engine
// const getSMPPlayOutEngine = (player: Player, debugPlayout: boolean) => {
//     const playoutEngine = new SMPPlayoutEngine(player, debugPlayout);
//     const playoutEngineProxied = new Proxy(playoutEngine, {
//         get(target, name, receiver) {
//             if (name in target.__proto__) { // assume methods live on the prototype
//                 return function(...args) {
//                     target._secondaryPlayoutEngine[name](...args)
//                     console.log(`Using Proxied Function: ${name}`)
//                 };
//             }
//             return target[name];
//
//         }
//     })
//     return playoutEngineProxied
// }

export default SMPPlayoutEngine;
