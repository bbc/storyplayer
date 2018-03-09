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
    _activeConfig: Object
    _inactiveConfig: Object
    _permissionToPlay: Function
    _audioContext: AudioContext
    _mediaSource: MediaElementAudioSourceNode
    _gainNode: GainNode

    constructor(
        permissionToPlay: Function,
        defaultConfig: Object,
        activeConfig: Object,
        inactiveConfig: Object,
        idNum: number,
        useHlsJs: boolean,
        iOSElement: HTMLMediaElement,
        audioContext: AudioContext,
        debug: boolean = false,
    ) {
        this._eventList = [];
        this._permissionToPlay = permissionToPlay;
        this._id = idNum;
        this._useHlsJs = false;// useHlsJs;
        this._iOSElement = iOSElement;
        this._audioContext = audioContext;
        this._debug = debug;

        this._activeConfig = activeConfig;
        this._inactiveConfig = inactiveConfig;

        const config = Object.assign({}, defaultConfig, inactiveConfig);
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
        if (this._permissionToPlay()) {
            const promise = this._mediaElement.play();
            if (promise !== undefined) {
                promise.then(() => {}).catch((error) => {
                    logger.warn(error, 'Not got permission to play');
                    // Auto-play was prevented
                });
            }
        } else {
            logger.info('Not got permission to play');
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

    start() {
        this._mediaElement = this._iOSElement;
        if (this._useHlsJs) {
            this._hls.detachMedia();
            this._hls.attachMedia(this._mediaElement);
            this._hls.config = Object.assign({}, this._hls.config, this._activeConfig);
        } else {
            if (this._mediaSrc && this._mediaSrc !== '') {
                this.loadSource(this._mediaSrc);
            }
            this._mediaSource = this._audioContext.createMediaElementSource(this._mediaElement);
            this._gainNode = this._audioContext.createGain();
            this._mediaSource.connect(this._gainNode);
            this._gainNode.connect(this._audioContext.destination);
        }
    }

    end() {
        this._hls.detachMedia();
        this._mediaSrc = '';
        if (this._useHlsJs) {
            this._hls.config = Object.assign({}, this._hls.config, this._inactiveConfig);
        } else {
            this._gainNode.disconnect();
            this._mediaSource.disconnect();
            this._mediaElement.src = '';
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
                this._mediaElement.src = this._mediaSrc;
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
                return;
            }
            this._hls.detachMedia();
        }
    }

    on(event: string, callback: Function) {
        if (this._useHlsJs) {
            this._hls.on(event, callback);
        } else {
            this._iOSElement.addEventListener(event, callback);
        }
        this._eventList.push({
            event,
            callback,
        });
    }

    off(event: string, callback: Function) {
        if (this._useHlsJs) {
            this._hls.off(event, callback);
        } else {
            this._iOSElement.removeEventListener(event, callback);
        }
        let index = -1;
        this._eventList.forEach((eventObj, eventInd) => {
            if (eventObj.event === event && eventObj.callback === callback) {
                index = eventInd;
            }
        });
        if (index > -1) {
            this._eventList.splice(index, 1);
        }
    }

    setVolume(volume: number) {
        if (this._useHlsJs) {
            this._mediaElement.volume = volume;
        } else {
            this._gainNode.gain.value = volume;
            this._mediaElement.volume = volume;
        }
    }

    // [TODO]
    getVolume() {
        if (this._useHlsJs) {
            return this._mediaElement.volume;
        }
        return 1;
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
