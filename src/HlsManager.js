// @flow

import Hls from 'hls.js';
import logger from './logger';

// Class wraps Hls giving it a unique id
export class HlsInstance {
    _hls: Object
    _id: number
    _eventList: Array<Object>
    _attached: boolean
    _lastSource: string
    _debug: boolean

    constructor(config: Object, idNum: number, debug: boolean = false) {
        this._hls = new Hls(config);
        this._id = idNum;
        this._eventList = [];
        this._debug = debug;
        if (this._debug) logger.info(`HLSInstance ${this._id}: Created`);
        this.on(Hls.Events.ERROR, this._errorHandler.bind(this));
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
        this._lastSource = src;
        this._hls.loadSource(src);
    }

    attachMedia(videoElement: HTMLVideoElement) {
        if (this._debug) logger.info(`HLSInstance ${this._id}: attachMedia`);
        this._hls.attachMedia(videoElement);
    }

    detachMedia() {
        if (this._debug) logger.info(`HLSInstance ${this._id}: detachMedia`);
        if (this._hls.media === null || this._hls.media === undefined) {
            logger.error(new Error(`HLSInstance ${this._id}: MEDIA NULL`));
            return;
        }
        this._hls.detachMedia();
    }

    on(event: string, callback: Function) {
        this._hls.on(event, callback);
        this._eventList.push({
            event,
            callback,
        });
    }

    destroy() {
        this._hls.destroy();
    }

    clearEvents() {
        if (this._debug) logger.info(`HLSInstance ${this._id}: clearEvents`);
        // Cleanup all events added to hls
        this._eventList.forEach((eventListObject) => {
            this._hls.off(eventListObject.event, eventListObject.callback);
        });
        this._eventList = [];
    }
}

export default class HlsManager {
    _hlsPool: Array<Object>
    _defaultConfig: Object
    _idTotal: number
    _debug: boolean

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

    static get Events() {
        return {
            MANIFEST_PARSED: Hls.Events.MANIFEST_PARSED,
        };
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
        const newHls = new HlsInstance(this._defaultConfig, this._idTotal, this._debug);

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

    static isSupported() {
        return Hls.isSupported();
    }
}
