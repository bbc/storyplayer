// @flow

import Hls from 'hls.js';
import logger from './logger';

// Class wraps Hls.js but also provides failover for browsers not supporting Hls.js:

// hls.js is not supported on platforms that do not have Media Source Extensions (MSE) enabled.
// When the browser has built-in HLS support (check using `canPlayType`), we can provide an HLS
// manifest (i.e. .m3u8 URL) directly to the video element throught the `src` property.
// This is using the built-in support of the plain video element, without using hls.js.
export class HlsInstance {
    _hls: Object
    _videoElement: ?HTMLVideoElement
    _id: number
    _eventList: Array<Object>
    _attached: boolean
    _debug: boolean
    _useHlsJs: boolean

    constructor(config: Object, idNum: number, useHlsJs: boolean, debug: boolean = false) {
        this._id = idNum;
        this._eventList = [];
        this._debug = debug;
        this._useHlsJs = useHlsJs;
        if (this._useHlsJs) {
            this._hls = new Hls(config);
            this.on(Hls.Events.ERROR, this._errorHandler.bind(this));
        }
        if (this._debug) logger.info(`HLSInstance ${this._id}: Created`);
    }

    _errorHandler(event: Object, data: Object) {
        if (data.fatal) {
            switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
                // try to recover network error
                logger.warn('fatal network error encountered, try to recover');
                this._hls.startLoad();
                break;
            case Hls.ErrorTypes.MEDIA_ERROR:
                logger.warn('fatal media error encountered, try to recover');
                this._hls.recoverMediaError();
                break;
            default:
                logger.fatal('fatal media error, cannot recover');
                // cannot recover
                this._hls.destroy();
                break;
            }
        }
    }

    getId(): number {
        return this._id;
    }

    // Copy existing Hls methods
    loadSource(src: string) {
        if (this._debug) logger.info(`HLSInstance ${this._id}: loadSource`);
        if (this._useHlsJs) {
            // Using HLS.js
            this._hls.loadSource(src);
        } else {
            // Using Video Element
            // eslint-disable-next-line no-lonely-if
            if (this._videoElement) {
                this._videoElement.src = src;
                this._videoElement.addEventListener('canplay', () => {
                    this._videoElement.play();
                });
            } else {
                logger.warn('No Video Element to set src of');
            }
        }
    }

    attachMedia(videoElement: HTMLVideoElement) {
        if (this._debug) logger.info(`HLSInstance ${this._id}: attachMedia`);
        if (this._useHlsJs) {
            // Using HLS.js
            this._hls.attachMedia(videoElement);
        } else {
            // Using Video Element
            this._videoElement = videoElement;
        }
    }

    detachMedia() {
        if (this._debug) logger.info(`HLSInstance ${this._id}: detachMedia`);
        if (this._useHlsJs) {
            // Using HLS.js
            if (this._hls.media === null || this._hls.media === undefined) {
                logger.error(new Error(`HLSInstance ${this._id}: MEDIA NULL`));
                return;
            }
            this._hls.detachMedia();
        } else {
            // Using Video Element
            this._videoElement = undefined;
        }
    }

    on(event: string, callback: Function) {
        this._hls.on(event, callback);
        this._eventList.push({
            event,
            callback,
        });
    }

    off(event: string, callback: Function) {
        this._hls.off(event, callback);
    }

    destroy() {
        if (this._debug) logger.info(`HLSInstance ${this._id}: destroy`);
        if (this._useHlsJs) {
            // Using HLS.js
            this._hls.destroy();
        } else {
            // Using Video Element
        }
    }

    clearEvents() {
        if (this._debug) logger.info(`HLSInstance ${this._id}: clearEvents`);
        // Cleanup all events added to hls
        this._eventList.forEach((eventListObject) => {
            this.off(eventListObject.event, eventListObject.callback);
        });
        this._eventList = [];
    }
}

export default class HlsManager {
    _hlsPool: Array<Object>
    _defaultConfig: Object
    _idTotal: number
    _debug: boolean
    static _hlsjsSupported: boolean
    static _hlsSupported: boolean

    constructor(debug: boolean = false) {
        this._debug = debug;
        this._hlsPool = [];
        this._defaultConfig = {
            startFragPrefetch: true,
            startLevel: 3,
            debug: false,
        };
        this._idTotal = 0;
    }

    getHls(): HlsInstance {
        let useExistingPoolIndex = -1;
        this._hlsPool.some((HlsPoolObject, index: number) => {
            if (HlsPoolObject.active === false) {
                useExistingPoolIndex = index;
                return true;
            }
            return false;
        });
        let activePools = 0;
        this._hlsPool.forEach((HlsPoolObject) => {
            if (HlsPoolObject.active) {
                activePools += 1;
            }
        });

        // Use existing pool instance
        if (useExistingPoolIndex !== -1) {
            logger.info('HLS Taken from Pool. ' +
                `Total HLS Instances: ${this._hlsPool.length}. Active: ${activePools + 1}`);
            this._hlsPool[useExistingPoolIndex].active = true;
            return this._hlsPool[useExistingPoolIndex].hlsInstance;
        }
        // Create new pool instance
        const newHls = new HlsInstance(
            this._defaultConfig,
            this._idTotal,
            HlsManager._hlsjsSupported,
            this._debug,
        );

        this._idTotal += 1;
        this._hlsPool.push({
            hlsInstance: newHls,
            active: true,
        });
        logger.info('New HLS Instance Created. ' +
            `Total HLS Instances: ${this._hlsPool.length}. Active: ${activePools + 1}`);
        return newHls;
    }


    returnHls(hls: HlsInstance) {
        hls.clearEvents();
        hls.detachMedia();
        hls.destroy();

        let activePools = 0;
        this._hlsPool.forEach((HlsPoolObject) => {
            if (HlsPoolObject.active) {
                activePools += 1;
            }
        });

        const id = hls.getId();
        this._hlsPool.forEach((HlsPoolObject, index: number) => {
            if (HlsPoolObject.hlsInstance.getId() === id) {
                this._hlsPool.splice(index, 1);
                logger.info('HLS Returned to Pool. ' +
                    `Total HLS Instances: ${this._hlsPool.length - 1}. Active: ${activePools - 1}`);
            }
        });
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
