// @flow
/* eslint-disable class-methods-use-this */
/* eslint-disable no-unused-vars */

import Player from '../Player';
import { checkAddDetailsOverride } from '../utils';

export const MEDIA_TYPES = {
    FOREGROUND_AV: 'foreground_av',
    FOREGROUND_A: 'foreground_a',
    BACKGROUND_A: 'background_a',
};

export default class BasePlayoutEngine {
    _player: Player

    _debugPlayout: boolean;

    _media: Object

    _permissionToPlay: boolean;

    _hasStarted: boolean;

    seekEventHandler: Function;

    constructor(player: Player, debugPlayout: boolean) {
        this._player = player;
        this._media = {};
        this._permissionToPlay = false;
        this._hasStarted = false;
        this._debugPlayout = debugPlayout;

        if(this._debugPlayout) {
            window.playoutMedia = this._media;
            window.playout = this;
        }
        this.seekEventHandler = this.seekEventHandler.bind(this);
    }

    setPermissionToPlay(value: boolean) {
        this._permissionToPlay = value;
    }

    queuePlayout(rendererId: string, mediaObj: Object) {
        if (!this._media[rendererId]) {
            this._media[rendererId] = {
                active: false,
            };
        }
        if (this._media[rendererId].media) {
            this._media[rendererId].media = Object.assign(this._media[rendererId].media, mediaObj);
        } else {
            this._media[rendererId].media = mediaObj;
        }
    }

    unqueuePlayout(rendererId: string) {
        if (this._media[rendererId]) {
            delete this._media[rendererId];
        }
    }

    setTimings(rendererId: string, timings: Object) {
        if (this._media[rendererId]) {
            this._media[rendererId].timings = timings;
            if (this._media[rendererId].awaiting_times) {
                const mediaElement = this.getMediaElement(rendererId)
                if(mediaElement) {
                    this.connectScrubBar(rendererId, mediaElement);
                }
            }
        }
    }

    connectScrubBar(rendererId: string, mediaElement: HTMLMediaElement) {
        if (this._media[rendererId]) {
            const mediaObj = this._media[rendererId];
            if (mediaObj.timings) {
                this._player.connectScrubBar(mediaElement, mediaObj.timings);
                mediaObj.awaiting_times = false;
            } else {
                mediaObj.awaiting_times = true;
            }
        }
    }

    setPlayoutVisible(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if (rendererPlayoutObj) {
            const mediaElement = this.getMediaElement(rendererId)
            if(mediaElement) {
                mediaElement.classList.remove('romper-media-element-queued');
            }
        }
    }

    getPlayoutActive(rendererId: string): boolean {
        if (this._media[rendererId]) {
            return this._media[rendererId].active;
        }
        return false;
    }

    setPlayoutActive(rendererId: string) {
        if (this._media[rendererId]) {
            this._media[rendererId].active = true;
        }
        if(checkAddDetailsOverride() && this._player._currentRenderer._representation.asset_collections.foreground_id) {
            const id = this._player._currentRenderer._representation.asset_collections.foreground_id;
            this._player._currentRenderer._fetchAssetCollection(id).then(fg => {
                this._player.addAssetCollectionDetails(fg);
            });
        }
    }

    setPlayoutInactive(rendererId: string) {
        if (this._media[rendererId]) {
            this._media[rendererId].active = false;
        }
    }

    play() {

    }

    pause() {

    }

    isPlaying(): boolean {
        return false;
    }

    hasStarted(): boolean {
        return this._hasStarted;
    }

    pauseBackgrounds() {

    }

    playBackgrounds() {

    }

    getCurrentTime(rendererId: string) {
        const mediaElement = this.getMediaElement(rendererId);
        if (
            !mediaElement ||
            mediaElement.readyState < mediaElement.HAVE_CURRENT_DATA
        ) {
            return undefined;
        }
        return mediaElement.currentTime;
    }

    getDuration(rendererId: string) {
        const mediaElement = this.getMediaElement(rendererId);
        if (
            !mediaElement ||
            mediaElement.readyState < mediaElement.HAVE_CURRENT_DATA
        ) {
            return undefined;
        }
        return mediaElement.duration;
    }

    setCurrentTime(rendererId: string, time: number) {
        return false;
    }


    on(rendererId: string, event: string, callback: Function) {
        return undefined;
    }

    off(rendererId: string, event: string, callback: Function) {
        return undefined;
    }

    getMediaElement(rendererId: string): ?HTMLMediaElement {
        return undefined;
    }

    setLoopAttribute(rendererId: string, loop: ?boolean, element: ?HTMLMediaElement) {
        const mediaElement = element || this.getMediaElement(rendererId);
        if (mediaElement) {
            if(loop) {
                mediaElement.loop = true;
                this.on(rendererId, 'seeked', this.seekEventHandler);
            }
            else {
                mediaElement.removeAttribute('loop');
                // this.off(rendererId, 'seeked', this.seekEventHandler);
            }
        }
    }

    removeLoopAttribute(rendererId: string) {
        const mediaElement = this.getMediaElement(rendererId);
        if (mediaElement) {
            mediaElement.removeAttribute('loop');
            // this.off(rendererId, 'seeked', this.seekEventHandler);
        }
    }

    seekEventHandler(rendererId: string) {
        const currentTime = this.getCurrentTime(rendererId);
        if (currentTime !== undefined && currentTime <= 0.002) {
            console.log('Looped');
        }
    }

    checkIsLooping(rendererId: string) {
        const mediaElement = this.getMediaElement(rendererId);
        return mediaElement && mediaElement.hasAttribute('loop');
    }
}
