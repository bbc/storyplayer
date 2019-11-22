// @flow
/* eslint-disable class-methods-use-this */
import BasePlayoutEngine, { MEDIA_TYPES } from './BasePlayoutEngine';
import MediaManager from './srcSwitchPlayoutEngine/MediaManager';
import Player, { PlayerEvents } from '../Player';
import logger from '../logger';

export default class iOSPlayoutEngine extends BasePlayoutEngine {
    _foregroundMediaElement: HTMLVideoElement

    _backgroundMediaElement: HTMLAudioElement

    _mediaManager: MediaManager

    _playing: boolean;

    _subtitlesShowing: boolean;

    _handlePlayPauseButtonClicked: Function;

    _handleSubtitlesClicked: Function;

    _handleVolumeClicked: Function;

    _toggleMute: Function;

    _showHideSubtitles: Function;

    _queueSubtitleAttach: Function;

    constructor(player: Player, debugPlayout: boolean) {
        super(player, debugPlayout);
        this._foregroundMediaElement = document.createElement('video');
        this._foregroundMediaElement.className = 'romper-video-element';
        this._foregroundMediaElement.crossOrigin = 'anonymous';

        this._backgroundMediaElement = document.createElement('audio');
        this._backgroundMediaElement.className = 'romper-audio-element';
        this._backgroundMediaElement.crossOrigin = 'anonymous';

        // Permission to play not granted on iOS without the autplay tag
        this._foregroundMediaElement.autoplay = true;
        this._backgroundMediaElement.autoplay = true;

        // disable ios controls too, we use our own
        this._foregroundMediaElement.removeAttribute("controls");
        this._backgroundMediaElement.removeAttribute("controls");

        // Needed to stop iOS automatically making video fullscreen on phone iOS devices
        this._foregroundMediaElement.setAttribute("playsinline", "true");
        this._backgroundMediaElement.setAttribute("playsinline", "true");
        this._foregroundMediaElement.setAttribute("webkit-playsinline", "true");
        this._backgroundMediaElement.setAttribute("webkit-playsinline", "true");

        // This doesn't work but maybe it will in the future to stop PIP being available
        this._foregroundMediaElement.setAttribute("disablePictureInPicture", "true");
        this._backgroundMediaElement.setAttribute("disablePictureInPicture", "true");

        this._player.mediaTarget.appendChild(this._foregroundMediaElement);
        this._player.backgroundTarget.appendChild(this._backgroundMediaElement);

        this._playing = false;
        this._subtitlesShowing = false;

        this._handlePlayPauseButtonClicked = this._handlePlayPauseButtonClicked.bind(this);
        this._handleSubtitlesClicked = this._handleSubtitlesClicked.bind(this);
        this._handleVolumeClicked = this._handleVolumeClicked.bind(this);
        this._toggleMute = this._toggleMute.bind(this);
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

        this._player.on(PlayerEvents.VOLUME_MUTE_TOGGLE, this._toggleMute);
    }

    setPermissionToPlay(value: boolean) {
        this._backgroundMediaElement.play();
        this._foregroundMediaElement.play();
        this._backgroundMediaElement.pause();
        this._foregroundMediaElement.pause();

        super.setPermissionToPlay(value);
    }

    attachEverythingToActive(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        const mediaObj = this._media[rendererId].media
        if (mediaObj) {
            if (mediaObj.type) {
                let mediaElement: HTMLMediaElement;
                if (mediaObj.type === MEDIA_TYPES.FOREGROUND_AV) {
                    mediaElement = this._foregroundMediaElement;
                    if (mediaObj.url) {
                        mediaElement.src = mediaObj.url;
                    }
                    this._player.addVolumeControl(rendererId, 'Foreground');
                } else if(mediaObj.type === MEDIA_TYPES.BACKGROUND_A) {
                    mediaElement = this._backgroundMediaElement
                    if (mediaObj.url) {
                        mediaElement.src = mediaObj.url;
                        mediaElement.play()
                    }
                    this._player.addVolumeControl(rendererId, 'Background');
                }
                if (rendererPlayoutObj.queuedEvents && rendererPlayoutObj.queuedEvents.length > 0) {
                    logger.info(`Applying queued events for ${rendererId}`)
                    rendererPlayoutObj.queuedEvents.forEach((qe) => {
                        mediaElement.addEventListener(qe.event, qe.callback)
                    })
                    rendererPlayoutObj.queuedEvents = []
                }
                if (mediaObj.loop) {
                    super.setLoopAttribute(rendererId, mediaObj.loop, mediaElement);
                }
            }
            if (mediaObj.subs_url) {
                this._player.enableSubtitlesControl();
                this._queueSubtitleAttach(rendererId);
            }
            if (mediaObj.id) {
                this._foregroundMediaElement.id = mediaObj.id;
            }
            if (mediaObj.inTime) {
                this._foregroundMediaElement.currentTime = mediaObj.inTime;
            }
            if (mediaObj.url && this._playing) {
               this.play();
            }
        }
    }

    removeEverythingFromActive(rendererId: string) {
        this._player.removeVolumeControl(rendererId);
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj) {
            return;
        }
        const mediaObject = rendererPlayoutObj.media;
        // check do we pause the foreground or background element
        if (mediaObject.type === MEDIA_TYPES.FOREGROUND_AV) {
            this._cleanUpSubtitles(rendererId);
            this._player.disableSubtitlesControl();
            const mediaElement = this._foregroundMediaElement
            if (mediaObject.url && mediaObject.url === mediaElement.src) {
                this._foregroundMediaElement.pause();
            }
        } else if(mediaObject.type === MEDIA_TYPES.BACKGROUND_A) {
            const mediaElement = this._backgroundMediaElement
            if (mediaObject.url && mediaObject.url === mediaElement.src) {
                this._backgroundMediaElement.pause();
            }
        }
    }

    // mediaObj = {
    //    type: "foreground_av" || "background_av" ,
    //    url: URL,
    //    subs_url: URL,
    // }
    queuePlayout(rendererId: string, mediaObj: Object) {
        super.queuePlayout(rendererId, mediaObj);
        const rendererPlayoutObj = this._media[rendererId];
        if (rendererPlayoutObj.active) {
            this.attachEverythingToActive(rendererId)
        }
    }

    unqueuePlayout(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj) {
            return;
        }
        super.unqueuePlayout(rendererId);
    }

    setPlayoutActive(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj) {
            return;
        }
        if (!rendererPlayoutObj.active) {
            this.attachEverythingToActive(rendererId)
        }
        super.setPlayoutActive(rendererId);
    }

    setPlayoutInactive(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj) {
            return;
        }
        if (rendererPlayoutObj.active) {
            this.removeEverythingFromActive(rendererId)
        }
        super.setPlayoutInactive(rendererId);
        super.removeLoopAttribute(rendererId);
    }

    // nothing to do here - only one media element that is always visible
    // eslint-disable-next-line no-unused-vars
    setPlayoutVisible(rendererId: string) {}

    play() {
        this._playing = true;
        this._hasStarted = true;
        this._player.setPlaying(true);
        this._foregroundMediaElement.play()
    }

    pause() {
        this._playing = false;
        this._player.setPlaying(false);
        this._foregroundMediaElement.pause()
    }

    isPlaying(): boolean {
        return this._playing;
    }

    pauseBackgrounds() {
        this._backgroundMediaElement.pause()
    }

    playBackgrounds() {
        this._backgroundMediaElement.play()
    }

    getCurrentTime(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj) {
            return undefined;
        }
        if (!rendererPlayoutObj.active) {
            return 0;
        }
        const mediaElement = this.getMediaElement(rendererId);
        if (
            !mediaElement ||
            mediaElement.readyState < mediaElement.HAVE_CURRENT_DATA
        ) {
            return undefined;
        }
        return mediaElement.currentTime;
    }

    setCurrentTime(rendererId: string, time: number) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj) {
            return false;
        }
        const mediaElement = this.getMediaElement(rendererId);
        if (!mediaElement) {
            return false;
        }

        if (mediaElement.readyState >= mediaElement.HAVE_CURRENT_DATA) {
            // Hack for iOS to get it to stop seeking to zero after setting currentTime
            // eslint-disable-next-line
            // https://stackoverflow.com/questions/18266437/html5-video-currenttime-not-setting-properly-on-iphone
            mediaElement.currentTime = time;
            const canPlayEventHandler = () => {
                mediaElement.currentTime = time;
                mediaElement.removeEventListener("canplay", canPlayEventHandler)
                mediaElement.removeEventListener("loadeddata", canPlayEventHandler)
            }
            mediaElement.addEventListener("canplay", canPlayEventHandler)
            mediaElement.addEventListener("loadeddata", canPlayEventHandler)
            return true;
        }
        return false;
    }

    on(rendererId: string, event: string, callback: Function) {
        const rendererPlayoutObj = this._media[rendererId];
        if (rendererPlayoutObj) {
            const oldCallback = callback;
            if (event === "ended") {
                // Hack for iOS calling ended when video hasn't actually ended
                // eslint-disable-next-line no-param-reassign
                callback = (e) => {
                    if (e !== undefined) {
                        if (!e.target.duration) {
                            logger.info(`Received ended event with no duration. ` +
                                `Assuming event is invalid`)
                            return
                        }
                    }
                    oldCallback(e)
                }
                rendererPlayoutObj._endedCallback = callback
            }
            const mediaElement = this.getMediaElement(rendererId);
            if (mediaElement && rendererPlayoutObj.active) {
                // This renderer is using the on screen video element
                // so add event listener directly
                mediaElement.addEventListener(event, callback);
            } else {
                // This renderer is not using the on screen video element
                // so add event listener to the queue so it can be applied in
                // setPlayoutActive
                if (!rendererPlayoutObj.queuedEvents) {
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

        if (rendererPlayoutObj) {
            if (event === "ended" && rendererPlayoutObj._endedCallback) {
                // eslint-disable-next-line no-param-reassign
                callback = rendererPlayoutObj._endedCallback;
            }
            const mediaElement = this.getMediaElement(rendererId);
            if (mediaElement && rendererPlayoutObj.active) {
                mediaElement.removeEventListener(event, callback);
            } else if (rendererPlayoutObj.queuedEvents) {
                // This renderer is not using the on screen video element
                // so remove event listener from queue
                const index = rendererPlayoutObj.queuedEvents
                    .findIndex((qe) => qe.event === event && qe.callback === callback)
                if (index !== -1) {
                    rendererPlayoutObj.queuedEvents.splice(index, 1);
                }
            }
        }
    }

    getMediaElement(rendererId: string): ? HTMLMediaElement {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj || !rendererPlayoutObj.media || !rendererPlayoutObj.media.type) {
            return undefined;
        }
        if (!rendererPlayoutObj.active) {
            return undefined;
        }
        let mediaElement;
        if (rendererPlayoutObj.media.type === MEDIA_TYPES.FOREGROUND_AV) {
            mediaElement = this._foregroundMediaElement
        } else {
            mediaElement = this._backgroundMediaElement
        }
        return mediaElement;
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
                if (this._media[key].media && this._media[key].media.playPauseHandler) {
                    this._media[key].media.playPauseHandler()
                }
            })
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
        if (rendererPlayoutObj) {
            const mediaElement = this.getMediaElement(event.id);
            if (mediaElement) {
                mediaElement.volume = event.value;
            }
        }
    }

    _toggleMute(event: Object) {
        const rendererPlayoutObj = this._media[event.id];
        if (rendererPlayoutObj) {
            const mediaElement = this.getMediaElement(event.id);
            if (mediaElement) {
                mediaElement.muted = event.muted;
            }
        }
    }

    _queueSubtitleAttach(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj) {
            return;
        }

        const mediaElement = this.getMediaElement(rendererId);
        if (mediaElement) {
            mediaElement.addEventListener('loadedmetadata', () => {
                this._showHideSubtitles(rendererId);
            });
        } else {
            setTimeout(() => {
                this._queueSubtitleAttach(rendererId);
            }, 1000);
        }
    }

    _cleanUpSubtitles(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId];
        if (!rendererPlayoutObj) {
            return;
        }
        const mediaElement = this.getMediaElement(rendererId);
        if (!mediaElement) {
            return;
        }
        if (rendererPlayoutObj.mediaSubsTrack) {
            rendererPlayoutObj.mediaSubsTrack.mode = 'hidden';
            if (mediaElement.textTracks[0]) {
                mediaElement.textTracks[0].mode = 'hidden';
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
            const mediaElement = this.getMediaElement(rendererId);
            if (!mediaElement) {
                return;
            }
            if (rendererPlayoutObj.media.subs_url && this._subtitlesShowing) {
                rendererPlayoutObj.mediaSubsTrack =
                    ((document.createElement('track'): any): HTMLTrackElement);
                rendererPlayoutObj.mediaSubsTrack.kind = 'captions';
                rendererPlayoutObj.mediaSubsTrack.label = 'English';
                rendererPlayoutObj.mediaSubsTrack.srclang = 'en';
                rendererPlayoutObj.mediaSubsTrack.src = rendererPlayoutObj.media.subs_url;
                rendererPlayoutObj.mediaSubsTrack.default = false;
                mediaElement.appendChild(rendererPlayoutObj.mediaSubsTrack);

                // Show Subtitles.
                rendererPlayoutObj.mediaSubsTrack.mode = 'showing';

                if (mediaElement.textTracks[0]) {
                    mediaElement.textTracks[0].mode = 'showing';
                }
            }
        }
    }
}
