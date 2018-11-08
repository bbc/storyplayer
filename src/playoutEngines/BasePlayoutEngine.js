// @flow
/* eslint-disable class-methods-use-this */
/* eslint-disable no-unused-vars */

import Player from '../Player';

export const MEDIA_TYPES = {
    FOREGROUND_AV: 'foreground_av',
    BACKGROUND_A: 'background_a',
};

export default class BasePlayoutEngine {
    _player: Player
    _media: Object
    _permissionToPlay: boolean;

    constructor(player: Player) {
        this._player = player;
        this._media = {};
        this._permissionToPlay = false;
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

    fadeInBackgroundAudio(endererId: string) {

    }

    play() {

    }

    pause() {

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

    getMediaElement(rendererId: string) {
        return undefined;
    }
}
