// @flow
/* eslint-disable class-methods-use-this */
/* eslint-disable no-unused-vars */

import Player from '../Player';

export default class BasePlayoutEngine {
    _player: Player
    _media: Object
    _permissionToPlay: boolean;

    constructor(player: Player) {
        this._player = player;
        this._media = {};
        this._permissionToPlay = false;
    }

    setPermissionToPlay() {
        this._permissionToPlay = true;
    }

    queuePlayout(rendererId, mediaObj) {
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

    unqueuePlayout(rendererId) {
        if (this._media[rendererId]) {
            delete this._media[rendererId];
        }
    }

    setPlayoutActive(rendererId) {
        if (this._media[rendererId]) {
            this._media[rendererId].active = true;
        }
    }

    setPlayoutInactive(rendererId) {
        if (this._media[rendererId]) {
            this._media[rendererId].active = false;
        }
    }

    play() {

    }

    pause() {

    }

    getCurrentTime(rendererId) {
        return undefined;
    }


    setCurrentTime(rendererId, time) {
        return false;
    }


    on(rendererId: string, event: string, callback: Function) {
        return undefined;
    }

    off(rendererId: string, event: string, callback: Function) {
        return undefined;
    }

    getMediaElement(rendererId) {
        return undefined;
    }
}
