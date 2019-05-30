// @flow

import Hls from 'hls.js';
import shaka from 'shaka-player';
import logger from '../../logger';

const MediaTypesArray = [
    'HLS',
    'DASH',
    'OTHER',
];

const MediaTypes = {};
MediaTypesArray.forEach((name) => { MediaTypes[name] = name; });

const getMediaType = (src: string) => {
    if (src.indexOf('.m3u8') !== -1) {
        return MediaTypes.HLS;
    } if (src.indexOf('.mpd') !== -1) {
        return MediaTypes.DASH;
    }
    return MediaTypes.OTHER;
};

// Class wraps Hls.js but also provides failover for browsers not supporting Hls.js:

// hls.js is not supported on platforms that do not have Media Source Extensions (MSE) enabled.
// When the browser has built-in HLS support (check using `canPlayType`), we can provide an HLS
// manifest (i.e. .m3u8 URL) directly to the video element throught the `src` property.
// This is using the built-in support of the plain video element, without using hls.js.
export default class HlsInstance {
    _hls: Object

    _shaka: Object

    _mountedMediaElement: HTMLMediaElement

    _id: number

    _eventList: Array<Object>

    _attached: boolean

    _debug: boolean

    _useHlsJs: boolean

    _mediaSrc: string

    _mediaType: string

    _mediaElement: HTMLMediaElement

    _activeConfig: Object

    _inactiveConfig: Object

    _permissionToPlay: Function

    _sourceLoaded: boolean

    _loadSourceQueue: Array<Function>

    _playCallback: Function

    constructor(
        permissionToPlay: Function,
        activeConfig: Object,
        inactiveConfig: Object,
        idNum: number,
        useHlsJs: boolean,
        iOSElement: HTMLMediaElement,
        debug: boolean = false,
    ) {
        this._eventList = [];
        this._permissionToPlay = permissionToPlay;
        this._sourceLoaded = false;
        this._id = idNum;
        this._useHlsJs = useHlsJs;
        this._mountedMediaElement = iOSElement;
        this._debug = debug;

        this._activeConfig = activeConfig;
        this._inactiveConfig = inactiveConfig;

        // Any commands that arrive before source is loaded are queued for execution afterwards
        this._loadSourceQueue = [];

        this._playCallback = this._playCallback.bind(this);

        if (this._debug) logger.info(`MediaInstance ${this._id}: Created`);
    }

    _hlsErrorHandler(event: Object, data: Object) {
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

    _playCallback() {
        this._mediaElement.removeEventListener(
            'loadeddata',
            this._playCallback,
        );
        this._play();
    }

    _play() {
        const promise = this._mediaElement.play();
        if (promise !== undefined) {
            promise.then(() => {}).catch((error) => {
                logger.warn(error, 'Not got permission to play');
                // Auto-play was prevented
            });
        }
    }

    play() {
        if (this._sourceLoaded) {
            if (this._permissionToPlay()) {
                if (this._mediaElement) {
                    if (this._mediaElement.readyState >= this._mediaElement.HAVE_CURRENT_DATA) {
                        this._play();
                    } else {
                        this._mediaElement.addEventListener(
                            'loadeddata',
                            this._playCallback,
                        );
                    }
                } else {
                    logger.warn('Trying to play without a HTMLMediaElement');
                }
            } else {
                logger.info('Not got permission to play');
            }
        } else {
            logger.info('Queued method: play');
            this._loadSourceQueue.push(() => this.play());
        }
    }

    pause() {
        if (this._sourceLoaded) {
            if (this._mediaElement) {
                const promise = this._mediaElement.pause();
                if (promise !== undefined) {
                    promise.then(() => {}).catch((error) => {
                        logger.warn(error, 'Not got permission to pause');
                        // Auto-play was prevented
                    });
                }
            } else {
                logger.warn('Trying to pause without a HTMLMediaElement');
            }
        } else {
            logger.info('Queued method: pause');
            this._loadSourceQueue.push(() => this.pause());
        }
    }

    start() {
        this._mediaElement = this._mountedMediaElement;
        if (this._sourceLoaded) {
            switch (this._mediaType) {
            case MediaTypes.HLS:
                if (this._useHlsJs) {
                    // Using HLS.js
                    this.detachMedia();
                    this.attachMedia(this._mediaElement);
                    this._hls.config = Object.assign({}, this._hls.config, this._activeConfig.hls);
                } else {
                    // Using Video Element
                    this.loadSource(this._mediaSrc);
                }
                break;
            case MediaTypes.DASH:
                this.attachMedia(this._mediaElement);
                break;
            case MediaTypes.OTHER:
                this.loadSource(this._mediaSrc);
                this.play();
                break;
            default:
                logger.error('Cannot handle this mediaType (loadSource)');
            }
        } else {
            logger.info('Queued method: start');
            this._loadSourceQueue.push(() => this.start());
        }
    }

    end() {
        if (this._sourceLoaded) {
            switch (this._mediaType) {
            case MediaTypes.HLS:
                if (this._useHlsJs) {
                    // Using HLS.js
                    this.detachMedia();
                    // eslint-disable-next-line max-len
                    this._hls.config = Object.assign({}, this._hls.config, this._inactiveConfig.hls);
                }
                break;
            case MediaTypes.DASH:
                this.detachMedia();
                break;
            case MediaTypes.OTHER:
                this.detachMedia();
                break;
            default:
                logger.error('Cannot handle this mediaType (loadSource)');
            }
            this._mediaSrc = '';
        } else {
            logger.info('Queued method: end');
            this._loadSourceQueue.push(() => this.end());
        }
    }

    loadSource(src: string) {
        if (this._debug) logger.info(`MediaInstance ${this._id}: loadSource`);

        this._mediaSrc = src;
        this._mediaType = getMediaType(this._mediaSrc);

        switch (this._mediaType) {
        case MediaTypes.HLS:
            if (this._useHlsJs) {
                // Using HLS.js
                this._hls = new Hls(this._inactiveConfig.hls);
                this.on(Hls.Events.ERROR, this._hlsErrorHandler.bind(this));
                this._hls.loadSource(this._mediaSrc);
                if (this._mediaElement) {
                    this._hls.attachMedia(this._mediaElement);
                }
            } else {
                // Using Video Element
                this._mediaElement.src = this._mediaSrc;
            }
            break;
        case MediaTypes.DASH:
            this._shaka = new shaka.Player(this._mediaElement);
            this._shaka.load(this._mediaSrc).then(() => {
                logger.info(`Loaded ${this._mediaSrc}`);
            })
                .catch((err) => {
                    logger.fatal(`Could not load manifest ${this._mediaSrc}`, err)
                })
            break;
        case MediaTypes.OTHER:
            this._mediaElement.src = this._mediaSrc;
            // this.play();
            break;
        default:
            logger.error('Cannot handle this mediaType (loadSource)');
        }

        if (this._mediaSrc && this._mediaSrc !== '') {
            this._sourceLoaded = true;
            // Run methods which couldn't execute as source wasn't loaded
            while (this._loadSourceQueue.length > 0) {
                const queuedFunction = this._loadSourceQueue.pop();
                queuedFunction();
            }
        } else {
            logger.warn('Media source is null or empty string');
        }
    }

    attachMedia(element: HTMLMediaElement) {
        if (this._debug) logger.info(`MediaInstance ${this._id}: attachMedia`);
        this._mediaElement = element;
        if (this._sourceLoaded) {
            switch (this._mediaType) {
            case MediaTypes.HLS:
                if (this._useHlsJs) {
                    this._hls.attachMedia(element);
                }
                break;
            case MediaTypes.DASH:
                try {
                    this._shaka.attach(element);
                } catch (err) {
                    logger.warning(err, 'attachMedia Failed');
                }
                break;
            case MediaTypes.OTHER:
                break;
            default:
                logger.error('Cannot handle this mediaType (attachMedia)');
            }
        } else {
            logger.info('Attaching HTMLMediaElement before loadSource');
        }
    }

    detachMedia() {
        if (this._debug) logger.info(`MediaInstance ${this._id}: detachMedia`);
        if (this._sourceLoaded) {
            switch (this._mediaType) {
            case MediaTypes.HLS:
                if (this._useHlsJs) {
                    if (this._hls.media === null || this._hls.media === undefined) {
                        return;
                    }
                    this._hls.detachMedia();
                }
                break;
            case MediaTypes.DASH:
                this._shaka.unload();
                break;
            case MediaTypes.OTHER:
                if (this._mountedMediaElement &&
                    this._mountedMediaElement.src === this._mediaSrc) {
                    this._mountedMediaElement.src = '';
                }
                break;
            default:
                logger.error('Cannot handle this mediaType (attachMedia)');
            }
        } else {
            logger.info('Detaching HTMLMediaElement before loadSource');
        }
    }

    on(event: string, callback: Function) {
        if (this._sourceLoaded) {
            switch (this._mediaType) {
            case MediaTypes.HLS:
                if (this._useHlsJs) {
                    this._hls.on(event, callback);
                } else {
                    this._mediaElement.addEventListener(event, callback);
                }
                break;
            case MediaTypes.OTHER:
                this._mediaElement.addEventListener(event, callback);
                break;
            default:
                logger.error('Cannot handle this mediaType (attachMedia)');
            }
            this._eventList.push({
                event,
                callback,
            });
        } else {
            logger.info('Queued method: on');
            this._loadSourceQueue.push(() => this.on(event, callback));
        }
    }

    off(event: string, callback: Function) {
        if (this._sourceLoaded) {
            switch (this._mediaType) {
            case MediaTypes.HLS:
                if (this._useHlsJs) {
                    this._hls.off(event, callback);
                } else {
                    this._mediaElement.removeEventListener(event, callback);
                }
                break;
            case MediaTypes.OTHER:
                this._mediaElement.removeEventListener(event, callback);
                break;
            default:
                logger.error('Cannot handle this mediaType (attachMedia)');
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
        } else {
            logger.info('Queued method: off');
            this._loadSourceQueue.push(() => this.off(event, callback));
        }
    }

    setVolume(volume: number) {
        this._mediaElement.volume = volume;
    }

    getVolume() {
        return this._mediaElement.volume;
    }

    destroy() {
        if (this._debug) logger.info(`MediaInstance ${this._id}: destroy`);

        if (this._sourceLoaded) {
            switch (this._mediaType) {
            case MediaTypes.HLS:
                if (this._useHlsJs) {
                    this._hls.destroy();
                }
                break;
            case MediaTypes.OTHER:
                break;
            case MediaTypes.DASH:
                this._shaka.unload();
                this._shaka.destroy();
                break;
            default:
                logger.error('Cannot handle this mediaType (attachMedia)');
            }
        } else {
            logger.info('Destroying before loadSource');
        }
    }

    clearEvents() {
        if (this._debug) logger.info(`MediaInstance ${this._id}: clearEvents`);
        // Cleanup all events added to hls
        this._eventList.forEach((eventListObject) => {
            this.off(eventListObject.event, eventListObject.callback);
        });
        this._eventList = [];
    }
}
