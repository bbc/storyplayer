// @flow

import Hls from 'hls.js';
import logger from './logger';

// Class wraps Hls.js but also provides failover for browsers not supporting Hls.js:

// hls.js is not supported on platforms that do not have Media Source Extensions (MSE) enabled.
// When the browser has built-in HLS support (check using `canPlayType`), we can provide an HLS
// manifest (i.e. .m3u8 URL) directly to the video element throught the `src` property.
// This is using the built-in support of the plain video element, without using hls.js.
export default class HlsInstance {
    _hls: Object
    _iOSElement: HTMLMediaElement
    _id: number
    _eventList: Array<Object>
    _attached: boolean
    _debug: boolean
    _useHlsJs: boolean
    _mediaSrc: string
    _mediaElement: HTMLMediaElement

    constructor(
        config: Object,
        idNum: number,
        useHlsJs: boolean,
        iOSElement: HTMLMediaElement,
        debug: boolean = false,
    ) {
        this._eventList = [];
        this._id = idNum;
        this._useHlsJs = useHlsJs;
        this._iOSElement = iOSElement;
        this._debug = debug;


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

    getMediaElement(): HTMLMediaElement {
        return this._mediaElement;
    }

    play() {
        const promise = this._mediaElement.play();
        if (promise !== undefined) {
            promise.then(() => {}).catch((error) => {
                logger.warn(error, 'Not got permission to play');
                // Auto-play was prevented
            });
        }
    }

    pause() {
        const promise = this._mediaElement.pause();
        if (promise !== undefined) {
            promise.then(() => {}).catch((error) => {
                logger.warn(error, 'Not got permission to pause');
                // Auto-play was prevented
            });
        }
    }

    start(target: HTMLDivElement) {
        if (this._useHlsJs) {
            target.appendChild(this._mediaElement);
        } else {
            this._mediaElement = this._iOSElement;
            if (this._mediaSrc && this._mediaSrc !== '') {
                this.loadSource(this._mediaSrc);
            }
        }
    }

    end(target: HTMLDivElement) {
        this._mediaSrc = '';
        if (this._useHlsJs) {
            target.removeChild(this._mediaElement);
        }
    }

    // Copy existing Hls methods
    loadSource(src: string) {
        if (this._debug) logger.info(`HLSInstance ${this._id}: loadSource`);

        this._mediaSrc = src;
        if (this._mediaSrc.indexOf('.m3u8') !== -1) {
            if (this._useHlsJs) {
                // Using HLS.js
                this._hls.loadSource(this._mediaSrc);
            } else {
                // Using Video Element
                // eslint-disable-next-line no-lonely-if
                this._mediaElement.src = src;
            }
        } else {
            this._mediaElement.setAttribute('src', this._mediaSrc);
        }
    }

    attachMedia(element: HTMLMediaElement) {
        if (this._useHlsJs) {
            this._hls.attachMedia(element);
        }
        this._mediaElement = element;
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
        }
    }

    on(event: string, callback: Function) {
        if (this._useHlsJs) {
            this._hls.on(event, callback);
            this._eventList.push({
                event,
                callback,
            });
        } else {
            this._iOSElement.addEventListener(event, callback);
        }
    }

    off(event: string, callback: Function) {
        if (this._useHlsJs) {
            this._hls.off(event, callback);
        } else {
            this._iOSElement.removeEventListener(event, callback);
        }
    }

    destroy() {
        if (this._debug) logger.info(`HLSInstance ${this._id}: destroy`);
        if (this._useHlsJs) {
            // Using HLS.js
            this._hls.destroy();
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
