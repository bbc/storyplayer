// @flow
/* eslint-disable class-methods-use-this */
import BasePlayoutEngine, { MEDIA_TYPES } from './BasePlayoutEngine';
import MediaManager from './srcSwitchPlayoutEngine/MediaManager';
import Player, { PlayerEvents } from '../Player';
import { BrowserUserAgent } from '../browserCapabilities';
import logger from '../logger';

// NOTE: This playout engine uses MediaManager and MediaInstance classes which are not very well
//       written and a bit messy.

export default class SrcSwitchPlayoutEngine extends BasePlayoutEngine {
    _foregroundMediaElement: HTMLVideoElement

    _backgroundMediaElement: HTMLAudioElement

    _mediaManager: MediaManager

    _playing: boolean;

    _subtitlesShowing: boolean;

    _handlePlayPauseButtonClicked: Function

    _handleSubtitlesClicked: Function

    _handleVolumeClicked: Function

    _showHideSubtitles: Function

    _queueSubtitleAttach: Function

    constructor(player: Player, debugPlayout: boolean) {
        super(player, debugPlayout);
        this._foregroundMediaElement = document.createElement('video');
        this._foregroundMediaElement.className = 'romper-video-element';
        this._foregroundMediaElement.crossOrigin = 'anonymous';

        this._backgroundMediaElement = document.createElement('audio');
        this._backgroundMediaElement.className = 'romper-audio-element';
        this._backgroundMediaElement.crossOrigin = 'anonymous';

        // Permission to play not granted on iOS without the autplay tag
        if (BrowserUserAgent.iOS()) {
            this._foregroundMediaElement.autoplay = true;
            this._backgroundMediaElement.autoplay = true;
            this._foregroundMediaElement.setAttribute("disablePictureInPicture", "true");
            this._foregroundMediaElement.setAttribute("playsinline", "true");
            this._foregroundMediaElement.setAttribute("webkit-playsinline", "true");
            this._foregroundMediaElement.setAttribute("controls", "false");
            this._backgroundMediaElement.setAttribute("disablePictureInPicture", "true");
            this._backgroundMediaElement.setAttribute("playsinline", "true");
            this._backgroundMediaElement.setAttribute("webkit-playsinline", "true");
            this._backgroundMediaElement.setAttribute("controls", "false");
        }

        this._player.mediaTarget.appendChild(this._foregroundMediaElement);
        this._player.backgroundTarget.appendChild(this._backgroundMediaElement);

        this._playing = false;
        this._subtitlesShowing = false;

        this._mediaManager = new MediaManager(
            this._foregroundMediaElement,
            this._backgroundMediaElement,
            this._debugPlayout,
        );

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

    setPermissionToPlay(value: boolean) {
        this._backgroundMediaElement.play();
        this._foregroundMediaElement.play();
        this._backgroundMediaElement.pause();
        this._foregroundMediaElement.pause();

        this._mediaManager.setPermissionToPlay(value);
        super.setPermissionToPlay(value);
    }

    // mediaObj = {
    //    type: "foreground_av" || "background_av" ,
    //    url: [URL],
    //    subs_url: [URL],
    // }
    queuePlayout(rendererId: string, mediaObj: Object) {
        super.queuePlayout(rendererId, mediaObj);
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj.mediaInstance) {
            if (rendererPlayoutObj.media.type === MEDIA_TYPES.FOREGROUND_AV) {
                rendererPlayoutObj.mediaInstance =
                    this._mediaManager.getMediaInstance('foreground');
                const videoElement = document.createElement('video');
                videoElement.className = 'romper-video-element romper-media-element-queued';
                videoElement.crossOrigin = 'anonymous';
                rendererPlayoutObj.mediaInstance.attachMedia(videoElement);
            } else if (rendererPlayoutObj.media.type === MEDIA_TYPES.FOREGROUND_A) {
                rendererPlayoutObj.mediaInstance =
                    this._mediaManager.getMediaInstance('foreground');
                const videoElement = document.createElement('video');
                videoElement.className = 'romper-audio-element romper-media-element-queued';
                videoElement.crossOrigin = 'anonymous';
                rendererPlayoutObj.mediaInstance.attachMedia(videoElement);
            } else {
                rendererPlayoutObj.mediaInstance =
                    this._mediaManager.getMediaInstance('background');
                const audioElement = document.createElement('audio');
                audioElement.className = 'romper-audio-element romper-media-element-queued';
                audioElement.crossOrigin = 'anonymous';
                rendererPlayoutObj.mediaInstance.attachMedia(audioElement);
            }
        }
        if (mediaObj.url) {
            rendererPlayoutObj.mediaInstance.loadSource(mediaObj.url);
        }
        if (mediaObj.subs_url) {
            this._player.enableSubtitlesControl();
            if (rendererPlayoutObj.active) {
                this._queueSubtitleAttach(rendererId);
            }
        }
        if (rendererPlayoutObj.active && this._playing) {
            this.play();
            if (
                rendererPlayoutObj.media && rendererPlayoutObj.media.type &&
                rendererPlayoutObj.media.type === MEDIA_TYPES.FOREGROUND_AV &&
                rendererPlayoutObj.mediaInstance
            ) {
                const videoElement = rendererPlayoutObj.mediaInstance.getMediaElement();
                this._player.disconnectScrubBar();
                this.connectScrubBar(rendererId, videoElement);
            }
        }
    }

    unqueuePlayout(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj) {
            return;
        }
        this._cleanUpSubtitles(rendererId);
        this._mediaManager.returnMediaInstance(rendererPlayoutObj.mediaInstance);
        super.unqueuePlayout(rendererId);
    }

    setPlayoutActive(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj) {
            return;
        }
        if (!rendererPlayoutObj.active) {
            rendererPlayoutObj.mediaInstance.start();
            super.setPlayoutActive(rendererId);
            if (this._playing && rendererPlayoutObj.media && rendererPlayoutObj.media.url) {
                this.play();
            }
            if (rendererPlayoutObj.media && rendererPlayoutObj.media.subs_url) {
                this._queueSubtitleAttach(rendererId);
                this._player.enableSubtitlesControl();
            }
            if (rendererPlayoutObj.media && rendererPlayoutObj.media.type) {
                if (rendererPlayoutObj.media.type === MEDIA_TYPES.FOREGROUND_AV) {
                    this._player.addVolumeControl(rendererId, 'Foreground');
                    if (rendererPlayoutObj.mediaInstance) {
                        const videoElement = rendererPlayoutObj.mediaInstance.getMediaElement();
                        this._player.disconnectScrubBar();
                        this.connectScrubBar(rendererId, videoElement);
                    }
                } else {
                    this._player.addVolumeControl(rendererId, 'Background');
                }
            }
            if(rendererPlayoutObj.queuedEvents && rendererPlayoutObj.queuedEvents.length > 0) {
                logger.info(`Applying queued events for ${rendererId}`)
                const videoElement = rendererPlayoutObj.mediaInstance.getMediaElement();
                rendererPlayoutObj.queuedEvents.forEach((qe) => {
                    videoElement.addEventListener(qe.event, qe.callback)
                })
                rendererPlayoutObj.queuedEvents = []
            }
        }
    }

    setPlayoutInactive(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj) {
            return;
        }
        if (rendererPlayoutObj.active) {
            this._cleanUpSubtitles(rendererId);
            this._player.disableSubtitlesControl();
            rendererPlayoutObj.mediaInstance.pause();
            super.setPlayoutInactive(rendererId);
            this._player.removeVolumeControl(rendererId);
        }
    }

    // nothing to do here - only one media element that is always visible
    // eslint-disable-next-line no-unused-vars
    setPlayoutVisible(rendererId: string) { }

    play() {
        this._playing = true;
        this._hasStarted = true;
        this._player.setPlaying(true);
        Object.keys(this._media)
            .filter(key => this._media[key].active)
            .forEach((key) => {
                this._media[key].mediaInstance.play();
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
                this._media[key].mediaInstance.pause();
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
                this._media[key].mediaInstance.pause();
            });
    }

    playBackgrounds() {
        Object.keys(this._media)
            .filter((key) => {
                if (this._media[key].media) {
                    if (this._media[key].media.type === MEDIA_TYPES.BACKGROUND_A
                        && this._media[key].active) {
                        return true;
                    }
                }
                return false;
            })
            .forEach((key) => {
                this._media[key].mediaInstance.play();
            });
    }

    getCurrentTime(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj || !rendererPlayoutObj.mediaInstance) {
            return undefined;
        }
        const videoElement = rendererPlayoutObj.mediaInstance.getMediaElement();
        if (
            !videoElement ||
            videoElement.readyState < videoElement.HAVE_CURRENT_DATA
        ) {
            return undefined;
        }
        return videoElement.currentTime;
    }

    currentTimeTimeout(rendererId: string, time: number, attempts: number = 0) {
        if(attempts > 20) {
            return;
        }
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj || !rendererPlayoutObj.mediaInstance) {
            return;
        }
        const videoElement = rendererPlayoutObj.mediaInstance.getMediaElement();
        if(Math.abs(videoElement.currentTime - time) > 0.5 ) {
            videoElement.currentTime = time;
            setTimeout(() => this.currentTimeTimeout(rendererId, time, attempts + 1), 100)
        }
    }

    setCurrentTime(rendererId: string, time: number) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj || !rendererPlayoutObj.mediaInstance) {
            return false;
        }
        const videoElement = rendererPlayoutObj.mediaInstance.getMediaElement();
        if (videoElement.readyState >= videoElement.HAVE_CURRENT_DATA) {
            // Hack for iOS to get it to stop seeking to zero after setting currentTime
            // eslint-disable-next-line
            // https://stackoverflow.com/questions/18266437/html5-video-currenttime-not-setting-properly-on-iphone
            videoElement.currentTime = time;
            this.currentTimeTimeout(rendererId, time);
        } else if (videoElement.src.indexOf('m3u8') !== -1) {
            rendererPlayoutObj.mediaInstance.on(MediaManager.Events.MANIFEST_PARSED, () => {
                videoElement.currentTime = time;
                this.currentTimeTimeout(rendererId, time);
            });
        } else {
            let setTime = false;
            videoElement.addEventListener('loadeddata', () => {
                if (!setTime) {
                    videoElement.currentTime = time;
                    this.currentTimeTimeout(rendererId, time);
                    setTime = true;
                }
            });
            videoElement.addEventListener('timeupdate', () => {
                if (!setTime) {
                    videoElement.currentTime = time;
                    this.currentTimeTimeout(rendererId, time);
                    setTime = true;
                }
            });
        }
        return true;
    }

    on(rendererId: string, event: string, callback: Function) {
        const rendererPlayoutObj = this._media[rendererId];
        if (rendererPlayoutObj && rendererPlayoutObj.mediaInstance) {
            const videoElement = rendererPlayoutObj.mediaInstance.getMediaElement();
            if (rendererPlayoutObj.active) {
                // This renderer is using the on screen video element
                // so add event listener directly
                videoElement.addEventListener(event, callback);
            } else {
                // This renderer is not using the on screen video element
                // so add event listener to the queue so it can be applied in
                // setPlayoutActive
                if(!rendererPlayoutObj.queuedEvents) {
                    rendererPlayoutObj.queuedEvents = []
                }
                rendererPlayoutObj.queuedEvents.push({
                    event,
                    callback,
                })
            }
        }
    }

    off(rendererId: string, event: string, callback: Function) {
        const rendererPlayoutObj = this._media[rendererId];
        if (rendererPlayoutObj && rendererPlayoutObj.mediaInstance) {
            const videoElement = rendererPlayoutObj.mediaInstance.getMediaElement();
            if (rendererPlayoutObj.active) {
                // This renderer is using the on screen video element
                // so remove event listener
                videoElement.removeEventListener(event, callback);
            } else if(rendererPlayoutObj.queuedEvents) {
                // This renderer is not using the on screen video element
                // so remove event listener from queue
                const index = rendererPlayoutObj.queuedEvents
                    .findIndex((qe) => qe.event === event && qe.callback === callback)
                if(index !== -1) {
                    rendererPlayoutObj.queuedEvents.splice(index, 1);
                }
            }
        }
    }

    getMediaElement(rendererId: string): HTMLMediaElement {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj || !rendererPlayoutObj.mediaInstance) {
            return document.createElement('video');
        }
        return rendererPlayoutObj.mediaInstance.getMediaElement();
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
            .filter(key => this._media[key].active)
            .forEach((key) => {
                this._showHideSubtitles(key);
            });
    }

    _handleVolumeClicked(event: Object): void {
        const rendererPlayoutObj = this._media[event.id];
        if (rendererPlayoutObj && rendererPlayoutObj.mediaInstance) {
            rendererPlayoutObj.mediaInstance.setVolume(event.value);
        }
    }

    _queueSubtitleAttach(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj) {
            return;
        }

        const videoElement = rendererPlayoutObj.mediaInstance.getMediaElement();
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
        const videoElement = rendererPlayoutObj.mediaInstance.getMediaElement();
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
        if (rendererPlayoutObj.active) {
            const videoElement = rendererPlayoutObj.mediaInstance.getMediaElement();
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
}
