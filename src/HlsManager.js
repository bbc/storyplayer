// @flow

// @flowignore
import uuidv4 from 'uuid/v4';
import Hls from 'hls.js';
import logger from './logger';

// Class wraps Hls giving it a unique id
export class HlsInstance {
    _hls: Object
    _id: string
    _eventList: Array<Object>
    _attached: boolean

    constructor(config: Object) {
        this._hls = new Hls(config);
        this._id = uuidv4();
        this._eventList = [];
        this._attached = false;
    }

    getId(): string {
        return this._id;
    }

    getAttached(): boolean {
        return this._attached;
    }

    // Copy existing Hls methods
    loadSource(src: string) {
        this._hls.loadSource(src);
    }

    attachMedia(videoElement: HTMLVideoElement) {
        this._hls.attachMedia(videoElement);
        this._attached = true;
    }

    detachMedia() {
        this._hls.detachMedia();
        this._attached = false;
    }

    on(event: string, callback: Function) {
        this._hls.on(event, callback);
        this._eventList.push({
            event,
            callback,
        });
    }

    flush() {
        const bufferController = this._hls.coreComponents[4];
        bufferController.doFlush();
    }

    clearEvents() {
        this._eventList.forEach((eventListObject) => {
            this._hls.off(eventListObject.event, eventListObject.callback);
        });
    }
}

export default class HlsManager {
    _hlsPool: Array<Object>
    _defaultConfig: Object

    constructor() {
        this._hlsPool = [];
        this._defaultConfig = {
            startFragPrefetch: true,
            startLevel: 3,
            debug: false,
        };
    }

    getHlsFromPool(): HlsInstance {
        let useExistingPoolIndex = -1;
        this._hlsPool.some((HlsPoolObject, index: number) => {
            if (HlsPoolObject.active === false) {
                useExistingPoolIndex = index;
                return true;
            }
            return false;
        });

        // Use existing pool instance
        if (useExistingPoolIndex !== -1) {
            logger.info(`HLS Taken from Pool. Total HLS Instances: ${this._hlsPool.length}`);
            this._hlsPool[useExistingPoolIndex].active = true;
            return this._hlsPool[useExistingPoolIndex].hlsInstance;
        }
        // Create new pool instance
        const newHls = new HlsInstance(this._defaultConfig);
        this._hlsPool.push({
            hlsInstance: newHls,
            active: true,
        });
        logger.info(`New HLS Created. Total HLS Instances: ${this._hlsPool.length}`);
        return newHls;
    }


    returnHlsToPool(hls: HlsInstance) {
        hls.clearEvents();
        hls.flush();

        // if (hls.getAttached() === false) {
        //     const _videoElement = document.createElement('video');
        //     hls.attachMedia(_videoElement);
        // }

        hls.detachMedia();

        const id = hls.getId();
        this._hlsPool.forEach((HlsPoolObject, index: number) => {
            if (HlsPoolObject.hlsInstance.getId() === id) {
                this._hlsPool[index].active = false;
                logger.info(`HLS Returned to Pool. Total HLS Instances: ${this._hlsPool.length}`);
            }
        });
    }

    // eslint-disable-next-line class-methods-use-this
    isSupported() {
        return Hls.isSupported();
    }
}
