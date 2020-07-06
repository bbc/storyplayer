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

    setPlayoutVisible(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if (rendererPlayoutObj) {
            const mediaElement = this._getMediaElement(rendererId)
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
        // eslint-disable-next-line max-len
        const foregroundId = this._player._currentRenderer._representation.asset_collections.foreground_id;
        if(checkAddDetailsOverride() && foregroundId) {
            this._player._currentRenderer._fetchAssetCollection(foregroundId).then(fg => {
                this._player.addAssetCollectionDetails(fg);
            });
        }
        if(this._media[rendererId].media.type === MEDIA_TYPES.FOREGROUND_A) {
            const mediaElement = this._getMediaElement(rendererId);
            if (mediaElement) {
                mediaElement.classList.add('romper-audio-element');
            }
        }
    }

    setPlayoutInactive(rendererId: string) {
        if (this._media[rendererId]) {
            this._media[rendererId].active = false;
        }

        if(this._media[rendererId].media.type === MEDIA_TYPES.FOREGROUND_A) {
            const mediaElement = this._getMediaElement(rendererId);
            if (mediaElement) {
                mediaElement.classList.remove('romper-audio-element');
            }
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

    playRenderer(rendererId: string) {

    }

    pauseRenderer(rendererId: string) {

    }

    getCurrentTime(rendererId: string) {
        const mediaElement = this._getMediaElement(rendererId);
        if (
            !mediaElement ||
            mediaElement.readyState < mediaElement.HAVE_CURRENT_DATA
        ) {
            return undefined;
        }
        return mediaElement.currentTime;
    }

    getDuration(rendererId: string) {
        const mediaElement = this._getMediaElement(rendererId);
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

    _getMediaElement(rendererId: string): ?HTMLMediaElement {
        return undefined;
    }

    getMediaElementFor360(rendererId: string): ?HTMLMediaElement {
        return this._getMediaElement(rendererId)
    }

    // TODO: Check for uses where element is passed
    setLoopAttribute(rendererId: string, loop: ?boolean, element: ?HTMLMediaElement) {
        const mediaElement = element || this._getMediaElement(rendererId);
        if (mediaElement) {
            if(loop) {
                mediaElement.loop = true;
            }
            else {
                mediaElement.removeAttribute('loop');
            }
        }
    }

    removeLoopAttribute(rendererId: string) {
        const mediaElement = this._getMediaElement(rendererId);
        if (mediaElement) {
            mediaElement.removeAttribute('loop');
        }
    }

    checkIsLooping(rendererId: string) {
        const mediaElement = this._getMediaElement(rendererId);
        return mediaElement && mediaElement.hasAttribute('loop');
    }

    applyStyle(rendererId: string, key: string, value: string) {
        const mediaElement = this._getMediaElement(rendererId);
        if (mediaElement) {
            mediaElement.style[key] = value;
        }
    }

    clearStyle(rendererId: string, key: string) {
        const mediaElement = this._getMediaElement(rendererId);
        if (mediaElement) {
            mediaElement.style[key] = '';
        }
    }

    setVolume(rendererId: string, volume: number) {
        const mediaElement = this._getMediaElement(rendererId);
        if (mediaElement) {
            mediaElement.volume = volume;
        }
    }

    getVolume(rendererId: string, volume: number) {
        const mediaElement = this._getMediaElement(rendererId);
        if (mediaElement) {
            return mediaElement.volume;
        }
        return -1
    }
}
