// @flow

import Hls from 'hls.js';
import logger from './logger';
import HlsInstance from './HlsInstance';

export default class HlsManager {
    _hlsPool: Array<Object>
    _defaultConfig: Object
    _activeConfig: Object
    _inactiveConfig: Object
    _idTotal: number
    _iOSVideoElement: HTMLVideoElement
    _iOSAudioElement: HTMLAudioElement
    _debug: boolean
    _getPermissionToPlay: Function
    _permissionToPlay: boolean
    _audioContext: AudioContext
    static _hlsjsSupported: boolean
    static _hlsSupported: boolean

    constructor(
        iOSVideoElement: HTMLVideoElement,
        iOSAudioElement: HTMLAudioElement,
        debug: boolean = false,
    ) {
        this._hlsPool = [];
        this._iOSVideoElement = iOSVideoElement;
        this._iOSAudioElement = iOSAudioElement;
        this._debug = debug;
        this._defaultConfig = {
            startFragPrefetch: true,
            startLevel: 3,
            debug: false,
        };
        this._activeConfig = {
            maxBufferLength: 30,
            maxMaxBufferLength: 600,
        };
        this._inactiveConfig = {
            maxBufferLength: 2,
            maxMaxBufferLength: 4,
        };
        this._idTotal = 0;
        this._permissionToPlay = false;

        this._audioContext = new (window.AudioContext || window.webkitAudioContext)();

        this._getPermissionToPlay = this._getPermissionToPlay.bind(this);
    }

    _getPermissionToPlay() {
        return this._permissionToPlay;
    }

    getHls(type: string): HlsInstance {
        let newHls;
        if (type === 'video') {
            newHls = new HlsInstance(
                this._getPermissionToPlay,
                this._defaultConfig,
                this._activeConfig,
                this._inactiveConfig,
                this._idTotal,
                HlsManager._hlsjsSupported,
                this._iOSVideoElement,
                this._audioContext,
                this._debug,
            );
        } else if (type === 'audio') {
            newHls = new HlsInstance(
                this._getPermissionToPlay,
                this._defaultConfig,
                this._activeConfig,
                this._inactiveConfig,
                this._idTotal,
                HlsManager._hlsjsSupported,
                this._iOSAudioElement,
                this._audioContext,
                this._debug,
            );
        } else {
            logger.fatal('invalid hls type');
            throw new Error('invalid hls type');
        }

        this._idTotal += 1;
        this._hlsPool.push({
            hlsInstance: newHls,
            type,
            active: true,
        });
        if (this._debug) {
            logger.info('New HLS Instance Created. ' +
            `Total HLS Instances: ${this._hlsPool.length}.`);
        }
        return newHls;
    }


    returnHls(hls: HlsInstance) {
        hls.clearEvents();
        hls.detachMedia();
        hls.destroy();

        const id = hls.getId();
        this._hlsPool.forEach((HlsPoolObject, index: number) => {
            if (HlsPoolObject.hlsInstance.getId() === id) {
                this._hlsPool.splice(index, 1);
                if (this._debug) {
                    logger.info('HLS Returned to Pool. ' +
                    `Total HLS Instances: ${this._hlsPool.length}.`);
                }
            }
        });
    }

    setPermissionToPlay(value: boolean) {
        this._permissionToPlay = value;
    }

    static get Events() {
        if (HlsManager._hlsjsSupported) {
            // Using HLS.js
            return {
                MANIFEST_PARSED: Hls.Events.MANIFEST_PARSED,
            };
        }
        // Using Video Element
        return {
            MANIFEST_PARSED: 'canplay',
        };
    }

    static hlsJsIsSupported() {
        if (HlsManager._hlsjsSupported !== undefined) {
            return HlsManager._hlsjsSupported;
        }
        if (Hls.isSupported()) {
            logger.info('HLS.js being used');
            HlsManager._hlsSupported = true;
            HlsManager._hlsjsSupported = true;
            return true;
        }
        const video = document.createElement('video');
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            logger.info('HLS.js not being used');
            HlsManager._hlsSupported = true;
            HlsManager._hlsjsSupported = false;
            return false;
        }
        HlsManager._hlsSupported = false;
        HlsManager._hlsjsSupported = false;
        return false;
    }

    static isSupported() {
        if (HlsManager._hlsSupported !== undefined) {
            return HlsManager._hlsSupported;
        }
        if (Hls.isSupported()) {
            logger.info('HLS.js being used');
            HlsManager._hlsSupported = true;
            HlsManager._hlsjsSupported = true;
            return true;
        }
        const video = document.createElement('video');
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            logger.info('HLS.js not being used');
            HlsManager._hlsSupported = true;
            HlsManager._hlsjsSupported = false;
            return true;
        }
        HlsManager._hlsSupported = false;
        return false;
    }
}
