// @flow
/* eslint-disable class-methods-use-this */
import Hls from 'hls.js';
import shaka from 'shaka-player';
import BasePlayoutEngine, { MEDIA_TYPES, SUPPORT_FLAGS } from './BasePlayoutEngine';
import Player, { PlayerEvents } from '../gui/Player';
import logger, { isDebug } from '../logger';

import { allHlsEvents, allShakaEvents, getMediaType, MediaTypes} from './playoutEngineConsts'
import { SHAKA_EVENTS } from '../Events';
import {
    getSetting,
    SHAKA_DEBUG_LEVEL,
    OVERRIDE_ACTIVE_BUFFERING,
    OVERRIDE_INACTIVE_BUFFERING,
} from '../utils';



const DEBUG_BUFFER_CHECK_TIME = 1000
const HLS_BUFFER_CHECK_TIME = 2000
const HLS_BUFFER_ERROR_MARGIN = 0.1
const SHAKKA_BANDWIDTH_CHECK_TIME = 1000

export default class DOMSwitchPlayoutEngine extends BasePlayoutEngine {
    _playing: boolean;

    _subtitlesShowing: boolean;

    _useHlsJs: boolean;

    _activeConfig: Object;

    _inactiveConfig: Object;

    _handlePlayPauseButtonClicked: Function

    _handleSubtitlesClicked: Function

    _handleVolumeClicked: Function

    _showHideSubtitles: Function

    _queueSubtitleAttach: Function

    _printActiveMSEBuffers: Function

    _activePlayer: Object;

    _estimatedBandwidth: number;

    constructor(player: Player) {
        super(player);

        if(isDebug()) {
            this._printActiveMSEBuffers()
        }

        if (Hls.isSupported()) {
            logger.info('HLS.js being used');
            this._useHlsJs = true;
        } else {
            this._useHlsJs = false;
        }

        this._activeConfig = {
            hls: {
                maxBufferLength: 30,
                maxMaxBufferLength: 600,
                startFragPrefetch: true,
                startLevel: 3,
                debug: isDebug(),
            },
            dash: {
                bufferingGoal: 10,
            }
        };

        const activeBufferingOverride = getSetting(OVERRIDE_ACTIVE_BUFFERING);
        if (activeBufferingOverride) {
            logger.info(`activeBufferingOverride: ${activeBufferingOverride}`)
            this._activeConfig.dash.bufferingGoal = parseInt(activeBufferingOverride, 10)
        }

        this._inactiveConfig = {
            hls: {
                maxBufferLength: 2,
                maxMaxBufferLength: 4,
                startFragPrefetch: true,
                startLevel: 3,
                debug: isDebug(),
            },
            dash: {
                bufferingGoal: 2,
            }
        };

        // bits/second (Set to 1gbps connection to get highest adaptation)
        this._estimatedBandwidth = 1000000000

        const inactiveBufferingOverride = getSetting(OVERRIDE_INACTIVE_BUFFERING);
        if (inactiveBufferingOverride) {
            logger.info(`inactiveBufferingOverride: ${inactiveBufferingOverride}`)
            this._inactiveConfig.dash.bufferingGoal = parseInt(inactiveBufferingOverride, 10)
        }

        // Shaka Logs only in shaka debug. Minified Shaka doesn't do logging
        const shakaDebugLevel = getSetting(SHAKA_DEBUG_LEVEL);
        if (shaka.log && isDebug() && shakaDebugLevel) {
            if (shakaDebugLevel === 'vv') {
                shaka.log.setLevel(shaka.log.Level.V2);
            } else if (shakaDebugLevel === 'v') {
                shaka.log.setLevel(shaka.log.Level.V1);
            } else if (shakaDebugLevel === 'debug') {
                shaka.log.setLevel(shaka.log.Level.DEBUG);
            } else if (shakaDebugLevel === 'info') {
                shaka.log.setLevel(shaka.log.Level.INFO);
            }
        }
        shaka.polyfill.installAll();


        this._playing = false;
        this._subtitlesShowing = false;

        this._handlePlayPauseButtonClicked = this._handlePlayPauseButtonClicked.bind(this);
        this._handleSubtitlesClicked = this._handleSubtitlesClicked.bind(this);
        this._handleVolumeClicked = this._handleVolumeClicked.bind(this);
        this._toggleMute = this._toggleMute.bind(this);
        this._showHideSubtitles = this._showHideSubtitles.bind(this);
        this._queueSubtitleAttach = this._queueSubtitleAttach.bind(this);
        this._printActiveMSEBuffers = this._printActiveMSEBuffers.bind(this);

        this._player.on(
            PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED,
            this._handlePlayPauseButtonClicked,
        );

        this._player.on(
            PlayerEvents.SUBTITLES_BUTTON_CLICKED,
            this._handleSubtitlesClicked,
        );

        this._player.on(
            PlayerEvents.VOLUME_CHANGED,
            this._handleVolumeClicked,
        );

        this._player.on(PlayerEvents.VOLUME_MUTE_TOGGLE, this._toggleMute);
    }

    supports(feature) {
        switch(feature) {
        case SUPPORT_FLAGS.SUPPORTS_360:
            return true
        default:
            return super.supports(feature)
        }
    }

    _shakaUpdateBandwidth(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if(!rendererPlayoutObj) {
            return
        }
        if(rendererPlayoutObj._shaka) {
            const newBandwidth = rendererPlayoutObj._shaka.getStats().estimatedBandwidth;
            if(newBandwidth) {
                this._estimatedBandwidth = newBandwidth
                // eslint-disable-next-line no-console
                logger.debug(
                    "DASH Shaka Bandwidth Update: ",
                    this._estimatedBandwidth.toFixed(2),
                    " ",
                    (this._estimatedBandwidth/1000000).toFixed(2)
                )
            }
        }
    }

    _ShakaAdaptationHandler(rendererId: string) {
        return () => {
            const rendererPlayoutObj = this._media[rendererId];
            if (!rendererPlayoutObj) {
                return;
            }
            this._shakaUpdateBandwidth(rendererId)
        }
    }

    _shakaCheckBandwidth(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if(!rendererPlayoutObj) {
            return
        }
        this._shakaUpdateBandwidth(rendererId)
        rendererPlayoutObj._shakaCheckBandwidthTimeout
            = setTimeout(() => {this._shakaCheckBandwidth(rendererId)}, SHAKKA_BANDWIDTH_CHECK_TIME)
    }

    _hlsCheckBuffers(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if(rendererPlayoutObj && rendererPlayoutObj.mediaElement) {
            const videoElement = rendererPlayoutObj.mediaElement;
            const bufferRanges = videoElement.buffered.length;
            const { currentTime } = videoElement;
            let i;
            let validPlayback = false
            const log = []
            if(bufferRanges > 0) {
                for (i = 0; i < bufferRanges; i+=1) {
                    const start = videoElement.buffered.start(i)
                    const end = videoElement.buffered.end(i)
                    if(
                        currentTime > start - HLS_BUFFER_ERROR_MARGIN &&
                        currentTime < end + HLS_BUFFER_ERROR_MARGIN
                    ) {
                        validPlayback = true
                    }
                    log.push(`HLS Buffers: ${i} `
                      + `${start}-${end} (CurrentTime: ${currentTime})`)
                }

                if(validPlayback !== true) {
                    logger.warn("HLS Buffers bad, reset level")
                    log.forEach((logItem) => {
                        logger.warn(logItem)
                    })
                    // Below causes the video buffer to be cleared and hlsjs then
                    // repopulates the buffer solving weird issues.
                    // eslint-disable-next-line no-self-assign
                    rendererPlayoutObj._hls.currentLevel = rendererPlayoutObj._hls.currentLevel
                }
            }
        }
        rendererPlayoutObj._hlsCheckBufferTimeout
            = setTimeout(() => {this._hlsCheckBuffers(rendererId)}, HLS_BUFFER_CHECK_TIME)
    }

    _printActiveMSEBuffers() {
        if(this._activePlayer && this._activePlayer.mediaElement) {
            const videoElement = this._activePlayer.mediaElement;
            const bufferRanges = videoElement.buffered.length;
            const { currentTime } = videoElement;
            let i;
            let validPlayback = false
            for (i = 0; i < bufferRanges; i+=1) {
                const start = videoElement.buffered.start(i)
                const end = videoElement.buffered.end(i)
                // eslint-disable-next-line no-console
                logger.debug(`BUFFER: Buffer Range ${i}: `
                  + `${start} - `
                  + `${end}`)
                if(currentTime > start && currentTime < end) {
                    validPlayback = true
                }
            }
            switch (this._activePlayer.mediaType) {
            case MediaTypes.DASH: {
                const activeReps = this._activePlayer._shaka.getVariantTracks()
                const activeRep = activeReps.find((representation) => representation.active)
                if(this._activePlayer._shakaRep !== `${activeRep.width}x${activeRep.height}`) {
                    this._activePlayer._shakaRep = `${activeRep.width}x${activeRep.height}`
                    // eslint-disable-next-line no-console
                    logger.debug(
                        `Active DASH shaka is using representation: `
                        + `${activeRep.width}x${activeRep.height}`
                    )
                }
                break;
            }
            case MediaTypes.HLS:
                break;
            default:
                logger.error('Cannot handle this mediaType (_printActiveMSEBuffers)');
            }

            // eslint-disable-next-line no-console
            logger.debug(`BUFFER: Current Time: ${currentTime}`)
            if(validPlayback !== true) {
                // eslint-disable-next-line no-console
                logger.debug("BUFFER WARNING: current playback time outside of buffered range")
            }
            // eslint-disable-next-line no-console
            logger.debug("BUFFER ---------")
        }
        setTimeout(() => {this._printActiveMSEBuffers()}, DEBUG_BUFFER_CHECK_TIME)
    }

    // mediaObj = {
    //    type: "foreground_av" || "background_av" ,
    //    url: [URL],
    //    sub_url: [URL],
    // }
    queuePlayout(rendererId: string, mediaObj: Object) {
        super.queuePlayout(rendererId, mediaObj);
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj.mediaElement) {
            if (rendererPlayoutObj.media.type === MEDIA_TYPES.FOREGROUND_AV) {
                const videoElement = document.createElement('video');
                videoElement.setAttribute('tabindex', '-1');
                videoElement.className = 'romper-video-element romper-media-element-queued';
                videoElement.crossOrigin = 'anonymous';
                rendererPlayoutObj.mediaElement = videoElement;
                this._player.mediaTarget.appendChild(rendererPlayoutObj.mediaElement);
            } else if (rendererPlayoutObj.media.type === MEDIA_TYPES.FOREGROUND_A) {
                const videoElement = document.createElement('video');
                videoElement.className = 'romper-audio-element romper-media-element-queued';
                videoElement.crossOrigin = 'anonymous';
                videoElement.setAttribute('tabindex', '-1');
                rendererPlayoutObj.mediaElement = videoElement;
                this._player.mediaTarget.appendChild(rendererPlayoutObj.mediaElement);
            } else {
                const audioElement = document.createElement('audio');
                audioElement.className = 'romper-audio-element romper-media-element-queued';
                audioElement.setAttribute('tabindex', '-1');
                audioElement.crossOrigin = 'anonymous';
                rendererPlayoutObj.mediaElement = audioElement;
                this._player.backgroundTarget.appendChild(rendererPlayoutObj.mediaElement);
            }
        }
        if (mediaObj.url) {
            this._loadMedia(rendererId);
        }
        if(mediaObj.id) {
            rendererPlayoutObj.mediaElement.id =  mediaObj.id;
        }
        if(mediaObj.loop) {
            super.setLoopAttribute(rendererId, mediaObj.loop);
        }
        if (mediaObj.inTime) {
            rendererPlayoutObj.mediaElement.currentTime = mediaObj.inTime;
        }

        if (mediaObj.subs_url) {
            this._queueSubtitleAttach(rendererId);
            this._player.enableSubtitlesControl();
        }
        if (rendererPlayoutObj.active && this._playing) {
            this.play();
        }
    }

    _loadMedia(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj) {
            return;
        }

        const { url } = rendererPlayoutObj.media;
        rendererPlayoutObj.mediaType = getMediaType(url);

        switch (rendererPlayoutObj.mediaType) {
        case MediaTypes.HLS:
            if (this._useHlsJs) {
                // Using HLS.js
                rendererPlayoutObj._hls = new Hls(this._inactiveConfig.hls);
                rendererPlayoutObj._hls.loadSource(url);
                rendererPlayoutObj._hls.attachMedia(rendererPlayoutObj.mediaElement);
                this._hlsCheckBuffers(rendererId)
            } else {
                // Using Video Element
                rendererPlayoutObj.mediaElement.src = url;
            }
            break;
        case MediaTypes.DASH: {
            rendererPlayoutObj._shaka = new shaka.Player(rendererPlayoutObj.mediaElement);
            rendererPlayoutObj._shaka.configure(
                'streaming.bufferingGoal',
                this._inactiveConfig.dash.bufferingGoal
            );
            rendererPlayoutObj._shaka.configure(
                'abr.defaultBandwidthEstimate',
                this._estimatedBandwidth
            );
            rendererPlayoutObj._shaka.configure(
                'abr.bandwidthDowngradeTarget',
                0.90
            );
            rendererPlayoutObj._shaka.configure(
                'abr.bandwidthUpgradeTarget',
                0.80
            );
            rendererPlayoutObj._shaka.load(url)
                .then(() => {
                    logger.info(`Loaded ${url}`);
                })
                .catch((err) => {
                    logger.fatal(`Could not load manifest ${url}`, err)
                })
            break;
        }
        case MediaTypes.OTHER:
            rendererPlayoutObj.mediaElement.src = url;
            break;
        default:
            logger.error('Cannot handle this mediaType (loadSource)');
        }
    }

    unqueuePlayout(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj) {
            return;
        }
        if (rendererPlayoutObj.mediaType) {
            switch (rendererPlayoutObj.mediaType) {
            case MediaTypes.HLS:
                if (this._useHlsJs) {
                    if(rendererPlayoutObj._hlsCheckBufferTimeout) {
                        clearTimeout(rendererPlayoutObj._hlsCheckBufferTimeout)
                    }
                    rendererPlayoutObj._hls.destroy();
                }
                break;
            case MediaTypes.OTHER:
                break;
            case MediaTypes.DASH:
                rendererPlayoutObj._shaka.unload();
                rendererPlayoutObj._shaka.destroy();
                break;
            default:
                logger.error('Cannot handle this mediaType (unqueuePlayout)');
            }
        }
        if (rendererPlayoutObj.media.type === MEDIA_TYPES.FOREGROUND_AV ||
            rendererPlayoutObj.media.type === MEDIA_TYPES.FOREGROUND_A
        ) {
            this._player.mediaTarget.removeChild(rendererPlayoutObj.mediaElement);
        } else {
            this._player.backgroundTarget.removeChild(rendererPlayoutObj.mediaElement);
        }
        super.unqueuePlayout(rendererId);
    }

    setPlayoutActive(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if (this._media[rendererId] && this._media[rendererId].error === true) {
            this._player._showErrorLayer()
        }
        if (!rendererPlayoutObj) {
            return;
        }
        if (!rendererPlayoutObj.active) {
            if (rendererPlayoutObj.mediaType) {
                switch (rendererPlayoutObj.mediaType) {
                case MediaTypes.HLS:
                    if (this._useHlsJs) {
                        // Using HLS.js
                        rendererPlayoutObj._hls.config = {

                            ...rendererPlayoutObj._hls.config,
                            ...this._activeConfig.hls,
                        };
                        allHlsEvents.forEach((e) => {
                            rendererPlayoutObj._hls.on(
                                Hls.Events[e], (ev) => {
                                    // eslint-disable-next-line no-console
                                    logger.debug("HLS EVENT: ", ev)
                                }
                            );

                        })


                    }
                    break;
                case MediaTypes.DASH: {
                    rendererPlayoutObj._shaka.configure(
                        'streaming.bufferingGoal',
                        this._activeConfig.dash.bufferingGoal
                    );
                    rendererPlayoutObj._shaka.configure(
                        'streaming.rebufferingGoal',
                        5
                    );

                    // Check bandwidth calculations and update the initial estimated
                    // bandwidth of new videos
                    this._shakaCheckBandwidth(rendererId)
                    rendererPlayoutObj._shakaAdaptationHandler
                        = this._ShakaAdaptationHandler(rendererId);
                    rendererPlayoutObj._shaka.addEventListener(
                        'adaptation',
                        rendererPlayoutObj._shakaAdaptationHandler
                    );

                    // error handler
                    // bufferiug errors
                    rendererPlayoutObj._shaka.addEventListener(
                        'buffering', (e) => {
                            if(rendererPlayoutObj._shaka.isBuffering()) {
                                this._player.showBufferingLayer();
                            }
                            if(!e.buffering) {
                                this._player.removeBufferingLayer();
                            }
                        }
                    );

                    // generic error
                    // eslint-disable-next-line max-len
                    // if the error code is 1001 and http status is 404we can't find the segement so ignore the error as we shouldn't ever get in this situation.
                    rendererPlayoutObj._shaka.addEventListener(
                        SHAKA_EVENTS.error, (e) => {
                            if(e.detail && e.detail.data) {
                                if(e.detail.code === 1001 && e.detail.data[1] === 404) {
                                    logger.info('404 error failed to fetch media')
                                    return;
                                }
                                this._player._showErrorLayer();
                            }
                        }
                    );

                    // resuming all good
                    rendererPlayoutObj._shaka.addEventListener(
                        'adaptation', this._player._removeErrorLayer
                    );
                    rendererPlayoutObj._shaka.addEventListener(
                        'adaptation', this._player.removeBufferingLayer
                    );


                    allShakaEvents.forEach((e) => {
                        rendererPlayoutObj._shaka.addEventListener(
                            e,
                            (ev) => {
                                // eslint-disable-next-line no-console
                                logger.debug("DASH SHAKA EVENT: ", ev)
                            }
                        )
                    });

                    break;
                }
                case MediaTypes.OTHER:
                    break;
                default:
                    logger.error('Cannot handle this mediaType (loadSource)');
                }
            }

            super.setPlayoutActive(rendererId);
            rendererPlayoutObj.mediaElement.classList.remove('romper-media-element-queued');

            if(isDebug()) {
                this._activePlayer = rendererPlayoutObj;
                window.activePlayer = rendererPlayoutObj;
            }

            if (this._playing && rendererPlayoutObj.media && rendererPlayoutObj.media.url) {
                this.play();
            }
            if (rendererPlayoutObj.media && rendererPlayoutObj.media.subs_src) {
                this._showHideSubtitles(rendererId);
                this._player.enableSubtitlesControl();
            }
            if (rendererPlayoutObj.media && rendererPlayoutObj.media.type) {
                if (rendererPlayoutObj.media.type === MEDIA_TYPES.FOREGROUND_AV ||
                    rendererPlayoutObj.media.type === MEDIA_TYPES.FOREGROUND_A
                ) {
                    this._player.addVolumeControl(rendererId, 'Foreground');
                } else {
                    this._player.addVolumeControl(rendererId, 'Background');
                }
            }
        }
    }

    setPlayoutInactive(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj) {
            return;
        }
        if (rendererPlayoutObj.active) {
            if (rendererPlayoutObj.mediaType) {
                switch (rendererPlayoutObj.mediaType) {
                case MediaTypes.HLS:
                    if (this._useHlsJs) {
                        // Using HLS.js
                        rendererPlayoutObj._hls.config = {

                            ...rendererPlayoutObj._hls.config,
                            ...this._inactiveConfig.hls,
                        };
                        // remove the event listeners
                    }
                    break;
                case MediaTypes.DASH:
                    rendererPlayoutObj._shaka.configure(
                        'streaming.bufferingGoal',
                        this._inactiveConfig.dash.bufferingGoal
                    );

                    // Remove bandwidth calculations timeout and adaptation handler
                    rendererPlayoutObj._shaka.removeEventListener(
                        'adaptation',
                        rendererPlayoutObj._shakaAdaptationHandler
                    )
                    if(rendererPlayoutObj._shakaCheckBandwidthTimeout) {
                        clearTimeout(rendererPlayoutObj._shakaCheckBandwidthTimeout)
                    }

                    // remove the event listeners
                    rendererPlayoutObj._shaka.removeEventListener(SHAKA_EVENTS.error,
                        this._player._showErrorLayer);
                    rendererPlayoutObj._shaka.removeEventListener(SHAKA_EVENTS.buffering,
                        this._player.showBufferingLayer);
                    rendererPlayoutObj._shaka.removeEventListener(SHAKA_EVENTS.adaptation,
                        this._player.removeBufferingLayer);
                    rendererPlayoutObj._shaka.removeEventListener(SHAKA_EVENTS.adaptation,
                        this._player._removeErrorLayer);

                    break;
                case MediaTypes.OTHER:
                    break;
                default:
                    logger.error('Cannot handle this mediaType (setPlayoutInactive)');
                }
            }
            this._player.disableSubtitlesControl();
            rendererPlayoutObj.mediaElement.pause();
            rendererPlayoutObj.mediaElement.classList.add('romper-media-element-queued');
            super.setPlayoutInactive(rendererId);
            this._player.removeVolumeControl(rendererId);
        }
    }

    play() {
        this._playing = true;
        this._hasStarted = true;
        this._player.setPlaying(true);
        Object.keys(this._media)
            .filter(key => this._media[key].active)
            .forEach((key) => {
                this.playRenderer(key)
            });
    }

    pause() {
        this._playing = false;
        this._player.setPlaying(false);
        Object.keys(this._media)
            .filter((key) => {
                if (this._media[key].media) {
                    if (this._media[key].media.type === MEDIA_TYPES.FOREGROUND_AV ||
                        this._media[key].media.type === MEDIA_TYPES.FOREGROUND_A
                    ) {
                        return true;
                    }
                }
                return false;
            })
            .forEach((key) => {
                this.pauseRenderer(key)
            });
    }

    isPlaying(): boolean {
        return this._playing;
    }

    pauseBackgrounds() {
        Object.keys(this._media)
            .filter((key) => {
                if (this._media[key].media) {
                    if (this._media[key].media.type === MEDIA_TYPES.BACKGROUND_A) {
                        return true;
                    }
                }
                return false;
            })
            .forEach((key) => {
                this.pauseRenderer(key)
            });
    }

    playBackgrounds() {
        Object.keys(this._media)
            .filter((key) => {
                if (this._media[key].media) {
                    if (this._media[key].media.type === MEDIA_TYPES.BACKGROUND_A) {
                        return this._media[key].active;
                    }
                }
                return false;
            })
            .forEach((key) => {
                this.playRenderer(key)
            });
    }

    playRenderer(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj || !rendererPlayoutObj.mediaElement) {
            return;
        }
        const {mediaElement} = rendererPlayoutObj;
        const play = () => {
            const promise = mediaElement.play();
            if (promise !== undefined) {
                promise.then(() => {}).catch((error) => {
                    logger.warn(error, 'DOMSwitchPlayotEngine Not got permission to play');
                    // Auto-play was prevented
                });
            }
        }
        if (!mediaElement) {
            setTimeout(() => { play(); }, 500);
        } else if (mediaElement.readyState >= mediaElement.HAVE_CURRENT_DATA) {
            play();
        } else {
            // loadeddata event seems not to be reliable
            // this hack avoids it
            const timeoutId = setInterval(() => {
                mediaElement.play()
                    .then(() => {
                        clearInterval(timeoutId);
                    })
                    .catch((error) => {
                        // eslint-disable-next-line max-len
                        logger.warn(error, ' DOMSwitchPlayoutEngine set Timer Not got permission to play');
                        // Auto-play was prevented
                        clearInterval(timeoutId);
                    });
            }, 100);
        }
    }

    pauseRenderer(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj || !rendererPlayoutObj.mediaElement) {
            return;
        }
        const {mediaElement} = rendererPlayoutObj;
        mediaElement.pause()
    }

    getCurrentTime(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj || !rendererPlayoutObj.mediaElement) {
            return undefined;
        }
        const videoElement = rendererPlayoutObj.mediaElement;
        if (
            !videoElement ||
            videoElement.readyState < videoElement.HAVE_CURRENT_DATA
        ) {
            return undefined;
        }
        return videoElement.currentTime;
    }

    getDuration(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj || !rendererPlayoutObj.mediaElement) {
            return undefined;
        }
        const mediaElement = this._getMediaElement(rendererId);
        if (
            !mediaElement ||
            mediaElement.readyState < mediaElement.HAVE_CURRENT_DATA
        ) {
            return undefined;
        }
        return mediaElement.duration;
    }

    setCurrentTime(rendererId: string, time: number) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj || !rendererPlayoutObj.mediaElement) {
            return false;
        }
        const videoElement = rendererPlayoutObj.mediaElement;
        if (videoElement.readyState >= videoElement.HAVE_CURRENT_DATA) {
            videoElement.currentTime = time;
        } else {
            let setTime = false;
            videoElement.addEventListener('loadeddata', () => {
                if (!setTime) {
                    videoElement.currentTime = time;
                    setTime = true;
                }
            });
            videoElement.addEventListener('timeupdate', () => {
                if (!setTime) {
                    videoElement.currentTime = time;
                    setTime = true;
                }
            });
        }
        return true;
    }

    on(rendererId: string, event: string, callback: Function) {
        const rendererPlayoutObj = this._media[rendererId];
        if (rendererPlayoutObj && rendererPlayoutObj.mediaElement) {
            const videoElement = rendererPlayoutObj.mediaElement;
            videoElement.addEventListener(event, callback);
        }
    }

    off(rendererId: string, event: string, callback: Function) {
        const rendererPlayoutObj = this._media[rendererId];
        if (rendererPlayoutObj && rendererPlayoutObj.mediaElement) {
            const videoElement = rendererPlayoutObj.mediaElement;
            videoElement.removeEventListener(event, callback);
        }
    }

    _getMediaElement(rendererId: string): ?HTMLMediaElement {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj || !rendererPlayoutObj.mediaElement) {
            return document.createElement('video');
        }
        return rendererPlayoutObj.mediaElement;
    }

    _handlePlayPauseButtonClicked(): void {
        if (this._playing === false) {
            this.play();
        } else {
            this.pause();
        }
        Object.keys(this._media)
            .filter(key => this._media[key].active)
            .forEach((key) => {
                if(this._media[key].media && this._media[key].media.playPauseHandler){
                    this._media[key].media.playPauseHandler()
                }
            })
    }

    _handleSubtitlesClicked(): void {
        this._subtitlesShowing = !this._subtitlesShowing;
        Object.keys(this._media)
            .filter((key) => {
                if (this._media[key].media) {
                    if (this._media[key].media.type === MEDIA_TYPES.FOREGROUND_AV ||
                        this._media[key].media.type === MEDIA_TYPES.FOREGROUND_A
                    ) {
                        return true;
                    }
                }
                return false;
            })
            .forEach((key) => {
                this._showHideSubtitles(key);
            });
    }

    _handleVolumeClicked(event: Object): void {
        const rendererPlayoutObj = this._media[event.id];
        if (rendererPlayoutObj && rendererPlayoutObj.mediaElement) {
            rendererPlayoutObj.mediaElement.volume = event.value;
        }
    }

    _toggleMute(event: Object) {
        const rendererPlayoutObj = this._media[event.id];
        if (rendererPlayoutObj && rendererPlayoutObj.mediaElement) {
            rendererPlayoutObj.mediaElement.muted = event.muted;
        }
    }

    _queueSubtitleAttach(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj) {
            return;
        }

        const videoElement = rendererPlayoutObj.mediaElement;
        if (videoElement) {
            videoElement.addEventListener('loadedmetadata', () => {
                this._showHideSubtitles(rendererId);
            });
        } else {
            setTimeout(() => { this._queueSubtitleAttach(rendererId); }, 1000);
        }
    }

    _cleanUpSubtitles(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj) {
            return;
        }

        const videoElement = rendererPlayoutObj.mediaElement;
        if (rendererPlayoutObj.mediaSubsTrack) {
            rendererPlayoutObj.mediaSubsTrack.mode = 'hidden';
            if (videoElement.textTracks[0]) {
                videoElement.textTracks[0].mode = 'hidden';
            }
            const videoTrackParent = rendererPlayoutObj.mediaSubsTrack.parentNode;
            if (videoTrackParent) {
                videoTrackParent.removeChild(rendererPlayoutObj.mediaSubsTrack);
            }
        }
    }

    _showHideSubtitles(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj) {
            return;
        }

        this._cleanUpSubtitles(rendererId);
        const videoElement = rendererPlayoutObj.mediaElement;
        if (rendererPlayoutObj.media.subs_url && this._subtitlesShowing) {
            rendererPlayoutObj.mediaSubsTrack =
                ((document.createElement('track'): any): HTMLTrackElement);
            rendererPlayoutObj.mediaSubsTrack.kind = 'captions';
            rendererPlayoutObj.mediaSubsTrack.label = 'English';
            rendererPlayoutObj.mediaSubsTrack.srclang = 'en';
            rendererPlayoutObj.mediaSubsTrack.src = rendererPlayoutObj.media.subs_url;
            rendererPlayoutObj.mediaSubsTrack.default = false;
            videoElement.appendChild(rendererPlayoutObj.mediaSubsTrack);

            // Show Subtitles.
            rendererPlayoutObj.mediaSubsTrack.mode = 'showing';

            if (videoElement.textTracks[0]) {
                videoElement.textTracks[0].mode = 'showing';
            }
        }
    }
}
