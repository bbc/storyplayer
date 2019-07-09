// @flow
/* eslint-disable class-methods-use-this */
/* eslint-disable no-unused-vars */

import Player from '../Player';

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

    setTimings(rendererId: string, timings: Object) {
        if (this._media[rendererId]) {
            this._media[rendererId].timings = timings;
            if (this._media[rendererId].awaiting_times) {
                this.connectScrubBar(rendererId, this.getMediaElement(rendererId));
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
            this.getMediaElement(rendererId).classList.remove('romper-media-element-queued');
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

    getMediaElement(rendererId: string): HTMLMediaElement {
        return document.createElement('video');
    }
}
