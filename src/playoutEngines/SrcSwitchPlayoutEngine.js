// @flow
/* eslint-disable class-methods-use-this */
import BasePlayoutEngine, { MEDIA_TYPES } from './BasePlayoutEngine';
import MediaManager from './srcSwitchPlayoutEngine/MediaManager';
import Player, { PlayerEvents } from '../Player';
import { BrowserUserAgent } from '../browserCapabilities';

// NOTE: This playout engine uses MediaManager and MediaInstance classes which are not very well
//       written and a bit messy.

export default class SrcSwitchPlayoutEngine extends BasePlayoutEngine {
    _foregroundMediaElement: HTMLMediaElement
    _backgroundMediaElement: HTMLMediaElement

    _mediaManager: MediaManager

    _playing: boolean;
    _subtitlesShowing: boolean;

    constructor(player: Player) {
        super(player);
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
        }

        this._player.mediaTarget.appendChild(this._foregroundMediaElement);
        this._player.backgroundTarget.appendChild(this._backgroundMediaElement);

        this._playing = false;
        this._subtitlesShowing = false;

        this._mediaManager = new MediaManager(
            this._foregroundMediaElement,
            this._backgroundMediaElement,
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

    setPermissionToPlay(value) {
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
    queuePlayout(rendererId, mediaObj) {
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
            this._queueSubtitleAttach(rendererId);
            this._player.enableSubtitlesControl();
        }
        if (rendererPlayoutObj.active && this._playing) {
            this.play();
        }
    }

    unqueuePlayout(rendererId) {
        const rendererPlayoutObj = this._media[rendererId];
        this._mediaManager.returnMediaInstance(rendererPlayoutObj.mediaInstance);
        super.unqueuePlayout(rendererId);
    }

    setPlayoutActive(rendererId) {
        const rendererPlayoutObj = this._media[rendererId];
        rendererPlayoutObj.mediaInstance.start();
        super.setPlayoutActive(rendererId);
        if (this._playing && rendererPlayoutObj.media && rendererPlayoutObj.media.url) {
            this.play();
        }
        if (rendererPlayoutObj.media && rendererPlayoutObj.media.subs_url) {
            this._player.enableSubtitlesControl();
        }
        if (rendererPlayoutObj.media && rendererPlayoutObj.media.type) {
            if (rendererPlayoutObj.media.type === MEDIA_TYPES.FOREGROUND_AV) {
                this._player.addVolumeControl(rendererId, 'Foreground');
                if (rendererPlayoutObj.mediaInstance) {
                    const videoElement = rendererPlayoutObj.mediaInstance.getMediaElement();
                    this._player.connectScrubBar(videoElement);
                }
            } else {
                this._player.addVolumeControl(rendererId, 'Background');
            }
        }
    }

    setPlayoutInactive(rendererId) {
        const rendererPlayoutObj = this._media[rendererId];
        this._cleanUpSubtitles(rendererId);
        this._player.disableSubtitlesControl();
        rendererPlayoutObj.mediaInstance.pause();
        rendererPlayoutObj.mediaInstance.end();
        super.setPlayoutInactive(rendererId);
        this._player.removeVolumeControl(rendererId);
        if (rendererPlayoutObj.media.type === MEDIA_TYPES.FOREGROUND_AV) {
            this._player.disconnectScrubBar();
        }
    }

    play() {
        this._playing = true;
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
            .filter(key => this._media[key].media.type === MEDIA_TYPES.FOREGROUND_AV)
            .forEach((key) => {
                this._media[key].mediaInstance.pause();
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

    setCurrentTime(rendererId: string, time: number) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj || !rendererPlayoutObj.mediaInstance) {
            return false;
        }
        const videoElement = rendererPlayoutObj.mediaInstance.getMediaElement();
        if (videoElement.readyState >= videoElement.HAVE_CURRENT_DATA) {
            videoElement.currentTime = time;
        } else if (videoElement.src.indexOf('m3u8') !== -1) {
            this._mediaInstance.on(MediaManager.Events.MANIFEST_PARSED, () => {
                videoElement.currentTime = time;
            });
        } else {
            videoElement.addEventListener('loadeddata', () => {
                videoElement.currentTime = time;
            });
        }
        return true;
    }

    on(rendererId: string, event: string, callback: Function) {
        const rendererPlayoutObj = this._media[rendererId];
        if (rendererPlayoutObj && rendererPlayoutObj.mediaInstance) {
            const videoElement = rendererPlayoutObj.mediaInstance.getMediaElement();
            videoElement.addEventListener(event, callback);
        }
    }

    off(rendererId: string, event: string, callback: Function) {
        const rendererPlayoutObj = this._media[rendererId];
        if (rendererPlayoutObj && rendererPlayoutObj.mediaInstance) {
            const videoElement = rendererPlayoutObj.mediaInstance.getMediaElement();
            videoElement.removeEventListener(event, callback);
        }
    }

    getMediaElement(rendererId) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj || !rendererPlayoutObj.mediaInstance) {
            return undefined;
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

    _queueSubtitleAttach(rendererId) {
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

    _cleanUpSubtitles(rendererId) {
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

    _showHideSubtitles(rendererId) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj) {
            return;
        }

        this._cleanUpSubtitles(rendererId);
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
