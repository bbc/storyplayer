// @flow
/* eslint-disable class-methods-use-this */
import Hls from 'hls.js';
import dashjs from 'dashjs';
import BasePlayoutEngine, { MEDIA_TYPES } from './BasePlayoutEngine';
import Player, { PlayerEvents } from '../Player';
import logger from '../logger';

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
    } else if (src.indexOf('.mpd') !== -1) {
        return MediaTypes.DASH;
    }
    return MediaTypes.OTHER;
};

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

    constructor(player: Player) {
        super(player);


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
                debug: false,
            },
        };
        this._inactiveConfig = {
            hls: {
                maxBufferLength: 2,
                maxMaxBufferLength: 4,
                startFragPrefetch: true,
                startLevel: 3,
                debug: false,
            },
        };

        this._playing = false;
        this._subtitlesShowing = false;

        this._handlePlayPauseButtonClicked = this._handlePlayPauseButtonClicked.bind(this);
        this._handleSubtitlesClicked = this._handleSubtitlesClicked.bind(this);
        this._handleVolumeClicked = this._handleVolumeClicked.bind(this);
        this._showHideSubtitles = this._showHideSubtitles.bind(this);
        this._queueSubtitleAttach = this._queueSubtitleAttach.bind(this);

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
                videoElement.className = 'romper-video-element romper-media-element-queued';
                videoElement.crossOrigin = 'anonymous';
                rendererPlayoutObj.mediaElement = videoElement;
                this._player.mediaTarget.appendChild(rendererPlayoutObj.mediaElement);
            } else if (rendererPlayoutObj.media.type === MEDIA_TYPES.FOREGROUND_A) {
                const videoElement = document.createElement('video');
                videoElement.className = 'romper-audio-element romper-media-element-queued';
                videoElement.crossOrigin = 'anonymous';
                rendererPlayoutObj.mediaElement = videoElement;
                this._player.mediaTarget.appendChild(rendererPlayoutObj.mediaElement);
            } else {
                const audioElement = document.createElement('audio');
                audioElement.className = 'romper-audio-element romper-media-element-queued';
                audioElement.crossOrigin = 'anonymous';
                rendererPlayoutObj.mediaElement = audioElement;
                this._player.backgroundTarget.appendChild(rendererPlayoutObj.mediaElement);
            }
        }
        if (mediaObj.url) {
            this._loadMedia(rendererId);
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
            } else {
                // Using Video Element
                rendererPlayoutObj.mediaElement.src = url;
            }
            break;
        case MediaTypes.DASH:
            rendererPlayoutObj._dashjs = dashjs.MediaPlayer().create();
            rendererPlayoutObj._dashjs.initialize(rendererPlayoutObj.mediaElement, url, false);
            rendererPlayoutObj._dashjs.getDebug().setLogToBrowserConsole(false);
            break;
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
                    rendererPlayoutObj._hls.destroy();
                }
                break;
            case MediaTypes.OTHER:
                break;
            case MediaTypes.DASH:
                rendererPlayoutObj._dashjs.reset();
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
        if (!rendererPlayoutObj) {
            return;
        }
        if (!rendererPlayoutObj.active) {
            if (rendererPlayoutObj.mediaType) {
                switch (rendererPlayoutObj.mediaType) {
                case MediaTypes.HLS:
                    if (this._useHlsJs) {
                        // Using HLS.js
                        rendererPlayoutObj._hls.config = Object.assign(
                            {},
                            rendererPlayoutObj._hls.config,
                            this._activeConfig.hls,
                        );
                    }
                    break;
                case MediaTypes.DASH:
                    break;
                case MediaTypes.OTHER:
                    break;
                default:
                    logger.error('Cannot handle this mediaType (loadSource)');
                }
            }

            super.setPlayoutActive(rendererId);
            rendererPlayoutObj.mediaElement.classList.remove('romper-media-element-queued');

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
                    if (rendererPlayoutObj.mediaElement) {
                        const videoElement = rendererPlayoutObj.mediaElement;
                        this._player.disconnectScrubBar();
                        this._player.connectScrubBar(videoElement);
                    }
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
                        rendererPlayoutObj._hls.config = Object.assign(
                            {},
                            rendererPlayoutObj._hls.config,
                            this._inactiveConfig.hls,
                        );
                    }
                    break;
                case MediaTypes.DASH:
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

    _play(rendererId: string) {
        const { mediaElement } = this._media[rendererId];
        const promise = mediaElement.play();
        if (promise !== undefined) {
            promise.then(() => {}).catch((error) => {
                logger.warn(error, 'Not got permission to play');
                // Auto-play was prevented
            });
        }
    }

    play() {
        this._playing = true;
        this._player.setPlaying(true);
        Object.keys(this._media)
            .filter(key => this._media[key].active)
            .forEach((key) => {
                const { mediaElement } = this._media[key];
                const playCallback = () => {
                    mediaElement.removeEventListener(
                        'loadeddata',
                        playCallback,
                    );
                    this._play(key);
                };
                if (!mediaElement) {
                    setTimeout(() => { this._play(key); }, 500);
                } else if (mediaElement.readyState >= mediaElement.HAVE_CURRENT_DATA) {
                    this._play(key);
                } else {
                    mediaElement.addEventListener(
                        'loadeddata',
                        playCallback,
                    );
                }
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
                this._media[key].mediaElement.pause();
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
                this._media[key].mediaElement.pause();
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
                const { mediaElement } = this._media[key];
                const playCallback = () => {
                    mediaElement.removeEventListener(
                        'loadeddata',
                        playCallback,
                    );
                    this._play(key);
                };
                if (!mediaElement) {
                    setTimeout(() => { this._play(key); }, 500);
                } else if (mediaElement.readyState >= mediaElement.HAVE_CURRENT_DATA) {
                    this._play(key);
                } else {
                    mediaElement.addEventListener(
                        'loadeddata',
                        playCallback,
                    );
                }
            });
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

    getMediaElement(rendererId: string): HTMLMediaElement {
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
