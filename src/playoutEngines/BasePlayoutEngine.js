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
    _media: Object
    _permissionToPlay: boolean;
    _hasStarted: boolean;

    constructor(player: Player) {
        this._player = player;
        this._media = {};
        this._permissionToPlay = false;
        this._hasStarted = false;
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
        rendererPlayoutObj.mediaElement.classList.remove('romper-media-element-queued');
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
        return undefined;
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
