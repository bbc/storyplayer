// @flow

import EventEmitter from 'events';
import AnalyticEvents from './AnalyticEvents';
import type { AnalyticsLogger, AnalyticEventName } from './AnalyticEvents';

import HlsManager from './HlsManager';

const PlayerEvents = [
    'VOLUME_CHANGED',
    'ICON_CLICKED',
    'REPRESENTATION_CLICKED',
    'BACK_BUTTON_CLICKED',
    'NEXT_BUTTON_CLICKED',
    'SCRUB_BAR_MOUSE_DOWN',
    'SCRUB_BAR_CHANGED',
    'SCRUB_BAR_MOUSE_UP',
    'PLAY_PAUSE_BUTTON_CLICKED',
    'SUBTITLES_BUTTON_CLICKED',
    'FULLSCREEN_BUTTON_CLICKED',
    'REPEAT_BUTTON_CLICKED',
].reduce((events, eventName) => {
    // eslint-disable-next-line no-param-reassign
    events[eventName] = eventName;
    return events;
}, {});

function createOverlay(name: string, logFunction: Function) {
    const overlay = document.createElement('div');
    overlay.classList.add('romper-overlay');
    overlay.classList.add(`romper-${name}-overlay`);
    overlay.classList.add('romper-inactive');
    overlay.onclick = (e) => {
        e.stopPropagation();
    };

    const deactivateOverlay = () => {
        if (!overlay.classList.contains('romper-inactive')) {
            logFunction('OVERLAY_DEACTIVATED', `${name} visible`, `${name} hidden`);
            overlay.classList.add('romper-inactive');
        }
    };

    const button = document.createElement('button');
    button.setAttribute('title', `${name.charAt(0).toUpperCase() + name.slice(1)} Button`);
    button.setAttribute('aria-label', `${name.charAt(0).toUpperCase() + name.slice(1)} Button`);
    button.classList.add('romper-button');
    button.classList.add(`romper-${name}-button`);
    button.classList.add('romper-inactive');
    button.onclick = () => {
        if (overlay.parentElement) {
            Array.prototype.slice
                .call(overlay.parentElement.querySelectorAll('.romper-overlay'))
                .filter(el => el !== overlay)
                .forEach(el => el.classList.add('romper-inactive'));
            if (overlay.classList.contains('romper-inactive')) {
                logFunction('OVERLAY_BUTTON_CLICKED', `${name} hidden`, `${name} visible`);
                button.classList.add('romper-button-selected');
            } else {
                logFunction('OVERLAY_BUTTON_CLICKED', `${name} visible`, `${name} hidden`);
                button.classList.remove('romper-button-selected');
            }
            overlay.classList.toggle('romper-inactive');
        }
    };
    const buttonIconDiv = document.createElement('div');
    buttonIconDiv.classList.add('romper-button-icon-div');
    buttonIconDiv.classList.add(`romper-${name}-button-icon-div`);
    button.appendChild(buttonIconDiv);

    const elements = {};
    const labels = {};

    const add = (id: string, el: HTMLElement, label?: string) => {
        elements[id] = el;
        if (label) {
            labels[label] = id;
        }
        el.classList.add('romper-control-unselected');
        overlay.appendChild(el);
        button.classList.remove('romper-inactive');
    };

    const get = (id: string) => elements[id];

    const getIdForLabel = (label: string) => {
        if (labels[label]) {
            return labels[label];
        }
        return null;
    };

    const remove = (id: string) => {
        if (elements[id]) {
            overlay.removeChild(elements[id]);
            delete elements[id];
            if (Object.keys(elements).length === 0) {
                button.classList.add('romper-inactive');
            }
        }
    };

    const setActive = (id: string) => {
        Object.keys(elements).forEach((key) => {
            if (key === id) {
                elements[key].classList.add('romper-control-selected');
                elements[key].classList.remove('romper-control-unselected');
            } else {
                elements[key].classList.add('romper-control-unselected');
                elements[key].classList.remove('romper-control-selected');
            }
        });
    };

    const addClass = (id: string, classname: string) => {
        Object.keys(elements).forEach((key) => {
            if (key === id) {
                elements[key].classList.add(classname);
            }
        });
    };

    const removeClass = (id: string, classname: string) => {
        Object.keys(elements).forEach((key) => {
            if (key === id) {
                elements[key].classList.remove(classname);
            }
        });
    };

    // Consider a set or select method.

    return {
        overlay,
        button,
        add,
        remove,
        get,
        setActive,
        addClass,
        removeClass,
        deactivateOverlay,
        getIdForLabel,
    };
}

class Player extends EventEmitter {
    _player: HTMLDivElement;
    _hlsManager: HlsManager;
    _backgroundLayer: HTMLDivElement;
    _mediaLayer: HTMLDivElement;
    _guiLayer: HTMLDivElement;
    backgroundTarget: HTMLDivElement;
    mediaTarget: HTMLDivElement;
    guiTarget: HTMLDivElement;
    showingSubtitles: boolean;
    _overlays: HTMLDivElement;
    _buttons: HTMLDivElement;
    _buttonsActivateArea: HTMLDivElement;
    _narrativeElementTransport: HTMLDivElement;
    _mediaTransport: HTMLDivElement;
    _repeatButton: HTMLButtonElement;
    _playPauseButton: HTMLButtonElement;
    _backButton: HTMLButtonElement;
    _nextButton: HTMLButtonElement;
    _subtitlesButton: HTMLButtonElement;
    _fullscreenButton: HTMLButtonElement;
    _volume: Object;
    _representation: Object;
    _icon: Object;
    _scrubBar: HTMLInputElement;
    _timeFeedback: HTMLDivElement;
    _currentTime: HTMLSpanElement;
    _totalTime: HTMLSpanElement;
    _analytics: AnalyticsLogger;
    _logUserInteraction: Function;
    _iOSVideoElement: HTMLVideoElement;
    _iOSAudioElement: HTMLAudioElement;

    constructor(target: HTMLElement, analytics: AnalyticsLogger) {
        super();

        this._iOSVideoElement = document.createElement('video');
        this._iOSVideoElement.className = 'romper-video-element';
        this._iOSVideoElement.autoplay = true;
        this._iOSVideoElement.crossOrigin = 'anonymous';
        this._iOSAudioElement = document.createElement('audio');

        this._hlsManager = new HlsManager(this._iOSVideoElement, this._iOSAudioElement);

        if (HlsManager.hlsJsIsSupported() === false) {
            const validateButton = document.createElement('button');
            validateButton.classList.add('ios-start-button');
            validateButton.innerHTML = 'Start';
            validateButton.onclick = () => {
                this._iOSAudioElement.play();
                this._iOSVideoElement.play();
            };
            target.appendChild(validateButton);
        }

        this.showingSubtitles = false;

        this._analytics = analytics;
        this._logUserInteraction = this._logUserInteraction.bind(this);


        this._player = document.createElement('div');
        this._player.classList.add('romper-player');

        this._backgroundLayer = document.createElement('div');
        this._backgroundLayer.classList.add('romper-background');

        this._mediaLayer = document.createElement('div');
        this._mediaLayer.classList.add('romper-media');

        this._guiLayer = document.createElement('div');
        this._guiLayer.classList.add('romper-gui');

        this._player.appendChild(this._backgroundLayer);
        this._player.appendChild(this._mediaLayer);
        this._player.appendChild(this._guiLayer);

        this._overlays = document.createElement('div');
        this._overlays.classList.add('romper-overlays');
        this._overlays.onclick = this._hideAllOverlays.bind(this);

        /*
                <narrativeElementTransport>
                    <previous, repeat, next />
                <buttons>
                    <scrub />
                    <lower section>
                        <play vol representations icons time sub FS>
                    </lowersection>
        */

        this._buttonsActivateArea = document.createElement('div');
        this._buttonsActivateArea.classList.add('romper-buttons-activate-area');


        this._buttons = document.createElement('div');
        this._buttons.classList.add('romper-buttons');

        this._buttonsActivateArea.onmouseenter = this._showRomperButtons.bind(this);
        this._buttons.onmouseleave = this._hideRomperButtons.bind(this);

        this._narrativeElementTransport = document.createElement('div');
        this._narrativeElementTransport.classList.add('romper-narrative-element-transport');

        this._backButton = document.createElement('button');
        this._backButton.classList.add('romper-button');
        this._backButton.classList.add('romper-back-button');
        this._backButton.setAttribute('title', 'Back Button');
        this._backButton.setAttribute('aria-label', 'Back Button');
        this._backButton.onclick = this._backButtonClicked.bind(this);
        const backButtonIconDiv = document.createElement('div');
        backButtonIconDiv.classList.add('romper-button-icon-div');
        backButtonIconDiv.classList.add('romper-subtitles-button-icon-div');
        this._backButton.appendChild(backButtonIconDiv);
        this._narrativeElementTransport.appendChild(this._backButton);

        this._repeatButton = document.createElement('button');
        this._repeatButton.classList.add('romper-button');
        this._repeatButton.classList.add('romper-repeat-button');
        this._repeatButton.classList.add('romper-inactive');
        this._repeatButton.setAttribute('title', 'Repeat Button');
        this._repeatButton.setAttribute('aria-label', 'Repeat Button');
        this._repeatButton.onclick = this._repeatButtonClicked.bind(this);
        const repeatButtonIconDiv = document.createElement('div');
        repeatButtonIconDiv.classList.add('romper-button-icon-div');
        repeatButtonIconDiv.classList.add('romper-subtitles-button-icon-div');
        this._repeatButton.appendChild(repeatButtonIconDiv);
        this._narrativeElementTransport.appendChild(this._repeatButton);

        this._nextButton = document.createElement('button');
        this._nextButton.classList.add('romper-button');
        this._nextButton.classList.add('romper-next-button');
        this._nextButton.setAttribute('title', 'Next Button');
        this._nextButton.setAttribute('aria-label', 'Next Button');
        this._nextButton.onclick = this._nextButtonClicked.bind(this);
        this._narrativeElementTransport.appendChild(this._nextButton);
        const nextButtonIconDiv = document.createElement('div');
        nextButtonIconDiv.classList.add('romper-button-icon-div');
        nextButtonIconDiv.classList.add('romper-subtitles-button-icon-div');
        this._nextButton.appendChild(nextButtonIconDiv);

        this._guiLayer.appendChild(this._overlays);
        this._guiLayer.appendChild(this._narrativeElementTransport);
        this._guiLayer.appendChild(this._buttons);
        this._guiLayer.appendChild(this._buttonsActivateArea);

        this._scrubBar = document.createElement('input');
        this._scrubBar.setAttribute('title', 'Scrub bar');
        this._scrubBar.setAttribute('aria-label', 'Scrub bar');
        this._scrubBar.type = 'range';
        this._scrubBar.value = '0';
        this._scrubBar.className = 'romper-scrub-bar';
        this._buttons.appendChild(this._scrubBar);


        this._mediaTransport = document.createElement('div');
        this._mediaTransport.classList.add('romper-media-transport');

        this._playPauseButton = document.createElement('button');
        this._playPauseButton.classList.add('romper-button');
        this._playPauseButton.classList.add('romper-play-button');
        this._playPauseButton.setAttribute('title', 'Play Pause Button');
        this._playPauseButton.setAttribute('aria-label', 'Play Pause Button');
        this._playPauseButton.onclick = this._playPauseButtonClicked.bind(this);
        const playPauseButtonIconDiv = document.createElement('div');
        playPauseButtonIconDiv.classList.add('romper-button-icon-div');
        playPauseButtonIconDiv.classList.add('romper-subtitles-button-icon-div');
        this._playPauseButton.appendChild(playPauseButtonIconDiv);
        this._mediaTransport.appendChild(this._playPauseButton);

        // Create the overlays.
        this._volume = createOverlay('volume', this._logUserInteraction);
        this._overlays.appendChild(this._volume.overlay);
        this._mediaTransport.appendChild(this._volume.button);

        this._representation = createOverlay('representation', this._logUserInteraction);
        this._overlays.appendChild(this._representation.overlay);
        this._mediaTransport.appendChild(this._representation.button);

        this._icon = createOverlay('icon', this._logUserInteraction);
        this._overlays.appendChild(this._icon.overlay);
        this._mediaTransport.appendChild(this._icon.button);

        this._timeFeedback = document.createElement('div');
        this._timeFeedback.classList.add('romper-timer');
        this._currentTime = document.createElement('span');
        this._currentTime.innerHTML = '0:00';
        this._totalTime = document.createElement('span');
        this._totalTime.innerHTML = '0:00';
        this._timeFeedback.appendChild(this._currentTime);
        const divider = document.createElement('span');
        divider.innerHTML = ' &#47; ';
        this._timeFeedback.appendChild(divider);
        this._timeFeedback.appendChild(this._totalTime);
        this._mediaTransport.appendChild(this._timeFeedback);

        this._subtitlesButton = document.createElement('button');
        this._subtitlesButton.classList.add('romper-button');
        this._subtitlesButton.setAttribute('title', 'Subtitles Button');
        this._subtitlesButton.setAttribute('aria-label', 'Subtitles Button');
        this._subtitlesButton.classList.add('romper-subtitles-button');
        this._subtitlesButton.onclick = this._subtitlesButtonClicked.bind(this);
        const subtitlesButtonIconDiv = document.createElement('div');
        subtitlesButtonIconDiv.classList.add('romper-button-icon-div');
        subtitlesButtonIconDiv.classList.add('romper-subtitles-button-icon-div');
        this._subtitlesButton.appendChild(subtitlesButtonIconDiv);
        this._mediaTransport.appendChild(this._subtitlesButton);

        this._fullscreenButton = document.createElement('button');
        this._fullscreenButton.classList.add('romper-button');
        this._fullscreenButton.classList.add('romper-fullscreen-button');
        this._fullscreenButton.setAttribute('title', 'Fullscreen Button');
        this._fullscreenButton.setAttribute('aria-label', 'Fullscreen Button');
        this._fullscreenButton.onclick = () => this._toggleFullScreen();
        const fullscreenButtonIconDiv = document.createElement('div');
        fullscreenButtonIconDiv.classList.add('romper-button-icon-div');
        fullscreenButtonIconDiv.classList.add('romper-subtitles-button-icon-div');
        this._fullscreenButton.appendChild(fullscreenButtonIconDiv);
        this._mediaTransport.appendChild(this._fullscreenButton);

        this._buttons.appendChild(this._mediaTransport);


        target.appendChild(this._player);

        // Expose the layers for external manipulation if needed.
        this.guiTarget = this._guiLayer;
        this.mediaTarget = this._mediaLayer;
        this.backgroundTarget = this._backgroundLayer;

        if (HlsManager.hlsJsIsSupported() !== true) {
            this.mediaTarget.appendChild(this._iOSVideoElement);
            this.backgroundTarget.appendChild(this._iOSAudioElement);
        }
    }

    _showRomperButtons() {
        this._buttons.classList.add('show');
        this._narrativeElementTransport.classList.add('show');
        this._buttonsActivateArea.classList.add('hide');
    }

    _hideRomperButtons() {
        this._buttons.classList.remove('show');
        this._narrativeElementTransport.classList.remove('show');
        this._buttonsActivateArea.classList.remove('hide');
    }


    _playPauseButtonClicked() {
        this.emit(PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED);
        this._logUserInteraction(AnalyticEvents.names.PLAY_PAUSE_BUTTON_CLICKED);
    }

    _repeatButtonClicked() {
        this.emit(PlayerEvents.REPEAT_BUTTON_CLICKED);
        this._logUserInteraction(AnalyticEvents.names.REPEAT_BUTTON_CLICKED);
    }

    _backButtonClicked() {
        this._hideAllOverlays();
        this.emit(PlayerEvents.BACK_BUTTON_CLICKED);
        this._logUserInteraction(AnalyticEvents.names.BACK_BUTTON_CLICKED);
    }

    _nextButtonClicked() {
        this._hideAllOverlays();
        this.emit(PlayerEvents.NEXT_BUTTON_CLICKED);
        this._logUserInteraction(AnalyticEvents.names.NEXT_BUTTON_CLICKED);
    }

    _hideAllOverlays() {
        if (this._representation) {
            this._representation.deactivateOverlay();
        }
        if (this._volume) {
            this._volume.deactivateOverlay();
        }
        if (this._icon) {
            this._icon.deactivateOverlay();
        }
    }

    _subtitlesButtonClicked() {
        this.showingSubtitles = !this.showingSubtitles;
        if (this.showingSubtitles) {
            this._subtitlesButton.classList.add('romper-button-selected');
        } else {
            this._subtitlesButton.classList.remove('romper-button-selected');
        }

        const showingSubtitlesIntToString = [
            'hidden',
            'showing',
        ];

        this.emit(PlayerEvents.SUBTITLES_BUTTON_CLICKED);
        // The + here converts bool to int
        this._logUserInteraction(
            AnalyticEvents.names.SUBTITLES_BUTTON_CLICKED,
            showingSubtitlesIntToString[+!this.showingSubtitles],
            showingSubtitlesIntToString[+this.showingSubtitles],
        );
    }

    _logUserInteraction(
        userEventName: AnalyticEventName,
        fromId: string = 'not_set',
        toId: string = 'not_set',
    ) {
        const logData = {
            type: AnalyticEvents.types.USER_ACTION,
            name: AnalyticEvents.names[userEventName],
            from: fromId == null ? 'not_set' : fromId,
            to: toId == null ? 'not_set' : toId,
        };
        this._analytics(logData);
    }

    setVolumeControlLevel(label: string, value: number) {
        const id = this._volume.getIdForLabel(label);
        const overlay = this._volume.get(id);
        if (overlay.childNodes[1]) {
            overlay.childNodes[1].value = value;
        }
        this.emit(PlayerEvents.VOLUME_CHANGED, { id, value, label });
    }

    addVolumeControl(id: string, label: string) {
        const volumeControl = document.createElement('div');
        volumeControl.classList.add('romper-volume-control');
        volumeControl.classList.add(`romper-volume-label-${label.toLowerCase()}`);

        const volumeLabel = document.createElement('div');
        volumeLabel.classList.add('romper-volume-label');
        volumeLabel.textContent = label;

        const volumeRange = document.createElement('input');
        volumeRange.type = 'range';
        volumeRange.min = '0';
        volumeRange.step = '0.01';
        volumeRange.max = '1';
        volumeRange.defaultValue = '1';
        volumeRange.classList.add('romper-volume-range');
        volumeRange.onchange = (event) => {
            const value = parseFloat(event.target.value);
            this.emit(PlayerEvents.VOLUME_CHANGED, { id, value, label });
            this._logUserInteraction(AnalyticEvents.names.VOLUME_CHANGED, null, event.target.value);
        };

        volumeControl.appendChild(volumeLabel);
        volumeControl.appendChild(volumeRange);

        this._volume.add(id, volumeControl, label);
    }

    removeVolumeControl(id: string) {
        this._volume.remove(id);
    }

    addRepresentationControl(id: string, src: string, label: string) {
        const representationControl = document.createElement('div');
        representationControl.classList.add('romper-representation-control');
        representationControl.setAttribute('title', label);
        representationControl.setAttribute('aria-label', label);

        const representationIcon = document.createElement('img');
        representationIcon.src = src;
        representationIcon.classList.add('romper-representation-icon');
        representationIcon.onclick = () => {
            this.emit(PlayerEvents.REPRESENTATION_CLICKED, { id });
            this._representation.deactivateOverlay();
            this._representation.setActive(id);
            this._logUserInteraction(AnalyticEvents.names.SWITCH_VIEW_BUTTON_CLICKED, null, id);
        };

        representationControl.appendChild(representationIcon);

        this._representation.add(id, representationControl);
    }

    activateRepresentationControl(id: string) {
        this._representation.removeClass(id, 'romper-control-disabled');
    }

    deactivateRepresentationControl(id: string) {
        this._representation.addClass(id, 'romper-control-disabled');
    }

    removeRepresentationControl(id: string) {
        this._representation.remove(id);
    }

    addIconControl(id: string, src: string, selected: boolean = false, representationName: string) {
        const iconControl = document.createElement('div');
        iconControl.classList.add('romper-icon-control');

        const icon = document.createElement('img');
        icon.src = src;
        icon.classList.add('romper-icon');
        icon.setAttribute('title', representationName);
        icon.setAttribute('aria-label', representationName);
        if (selected) {
            icon.classList.add('romper-selected');
        }
        icon.onclick = () => {
            this.emit(PlayerEvents.ICON_CLICKED, { id });
            this._icon.deactivateOverlay();
            this._logUserInteraction(AnalyticEvents.names.CHANGE_CHAPTER_BUTTON_CLICKED, null, id);
        };

        iconControl.appendChild(icon);

        this._icon.add(id, iconControl);
    }

    setIconControl(id: string, src: string, selected: boolean = false) {
        const iconControl = this._icon.get(id);

        if (iconControl) {
            if (selected) {
                iconControl.classList.remove('romper-control-unselected');
                iconControl.classList.add('romper-control-selected');
            } else {
                iconControl.classList.add('romper-control-unselected');
                iconControl.classList.remove('romper-control-selected');
            }
            const icon = iconControl.children[0];
            icon.src = src;
        }
    }

    setActiveRepresentationControl(id: string) {
        this._representation.setActive(id);
    }

    enterCompleteBehavourPhase() {
        this.disableScrubBar();
        this.disablePlayButton();
        this.showRepeatButton();
    }

    enterStartBehaviourPhase() {
        this.hideRepeatButton();
    }

    exitStartBehaviourPhase() {
        this.enablePlayButton();
        this.enableScrubBar();
    }

    enableScrubBar() {
        this._scrubBar.removeAttribute('disabled');
        this._scrubBar.classList.remove('romper-control-disabled');
    }

    disableScrubBar() {
        this._scrubBar.setAttribute('disabled', 'true');
        this._scrubBar.classList.add('romper-control-disabled');
    }

    disconnectScrubBar() {
        if (this._scrubBar) {
            const scrubBar = this._scrubBar;
            // Remove event listeners on scrub bar by cloning and replacing old scrubBar
            const newScrubBar = scrubBar.cloneNode(true);
            this._buttons.replaceChild(newScrubBar, scrubBar);
            this._scrubBar = newScrubBar;
        }
    }

    connectScrubBar(video: HTMLVideoElement) {
        const scrubBar = this._scrubBar;

        // update scrub bar position as video plays
        scrubBar.addEventListener('change', () => {
            // Calculate the new time
            const time = video.duration * (parseInt(scrubBar.value, 10) / 100);
            // Update the video time
            // eslint-disable-next-line no-param-reassign
            video.currentTime = time;
            this._logUserInteraction(AnalyticEvents.names.VIDEO_SCRUBBED, null, time.toString());
        });

        // allow clicking the scrub bar to seek to a video position
        scrubBar.addEventListener('click', (e: MouseEvent) => {
            const percent = e.offsetX / scrubBar.offsetWidth;
            // eslint-disable-next-line no-param-reassign
            video.currentTime = percent * video.duration;
        });

        // Pause the video when the slider handle is being dragged
        scrubBar.addEventListener('mousedown', () => {
            video.pause();
        });

        // Play the video when the slider handle is dropped
        scrubBar.addEventListener('mouseup', () => {
            video.play();
        });

        // Update the seek bar as the video plays
        video.addEventListener('timeupdate', () => {
            // Calculate the slider value
            const value = (100 / video.duration) * video.currentTime;

            // Update the slider value
            scrubBar.value = value.toString();
            // update timer feedback
            this._totalTime.innerHTML = Player._formatTime(video.duration);
            this._currentTime.innerHTML = Player._formatTime(video.currentTime);
        });
    }

    static _formatTime(time: number): string {
        let seconds = parseInt(time, 10);
        if (Number.isNaN(seconds)) {
            return '0:00';
        }
        const minutes = Math.floor(seconds / 60);
        seconds %= 60;
        seconds = seconds < 10 ? `0${seconds}` : seconds;
        return `${minutes}:${seconds}`;
    }

    disablePlayButton() {
        this._playPauseButton.classList.add('romper-control-disabled');
        this._playPauseButton.setAttribute('disabled', 'true');
    }

    hideRepeatButton() {
        this._repeatButton.classList.add('romper-inactive');
    }

    enablePlayButton() {
        this._playPauseButton.classList.remove('romper-control-disabled');
        this._playPauseButton.removeAttribute('disabled');
    }

    showRepeatButton() {
        this._repeatButton.classList.remove('romper-inactive');
    }

    removeIconControl(id: string) {
        this._icon.remove(id);
    }

    setPlaying(isPlaying: boolean) {
        if (isPlaying) {
            this._playPauseButton.classList.add('romper-pause-button');
            this._playPauseButton.classList.remove('romper-play-button');
        } else {
            this._playPauseButton.classList.add('romper-play-button');
            this._playPauseButton.classList.remove('romper-pause-button');
        }
    }

    setNextAvailable(isNextAvailable: boolean) {
        if (isNextAvailable) {
            this._nextButton.classList.remove('romper-inactive');
        } else {
            this._nextButton.classList.add('romper-inactive');
        }
    }

    setBackAvailable(isBackAvailable: boolean) {
        if (isBackAvailable) {
            this._backButton.classList.remove('romper-inactive');
        } else {
            this._backButton.classList.add('romper-inactive');
        }
    }

    _toggleFullScreen(): void {
        if (Player._isFullScreen()) {
            this._logUserInteraction(
                AnalyticEvents.names.FULLSCREEN_BUTTON_CLICKED,
                'fullscreen',
                'not-fullscreen',
            );
            this._buttons.classList.remove('romper-buttons-fullscreen');
            Player._exitFullScreen();
        } else {
            this._logUserInteraction(
                AnalyticEvents.names.FULLSCREEN_BUTTON_CLICKED,
                'not-fullscreen',
                'fullscreen',
            );
            this._buttons.classList.add('romper-buttons-fullscreen');
            this._enterFullScreen();
        }
    }

    static _isFullScreen() {
        let isFullScreen = false;
        if (document.fullscreenElement) {
            isFullScreen = (document.fullscreenElement != null);
        }
        if (document.webkitFullscreenElement) {
            isFullScreen = isFullScreen || (document.webkitFullscreenElement != null);
        }
        if (document.mozFullScreenElement) {
            isFullScreen = isFullScreen || (document.mozFullScreenElement != null);
        }
        if (document.msFullscreenElement) {
            isFullScreen = isFullScreen || (document.msFullscreenElement != null);
        }
        return isFullScreen;
    }

    _enterFullScreen() {
        if (this._player.requestFullscreen) {
            // @flowignore
            this._player.requestFullscreen();
        } else if (this._player.mozRequestFullScreen) {
            // @flowignore
            this._player.mozRequestFullScreen(); // Firefox
        } else if (this._player.webkitRequestFullscreen) {
            // @flowignore
            this._player.webkitRequestFullscreen(); // Chrome and Safari
        }
    }

    static _exitFullScreen() {
        // || document.webkitIsFullScreen);
        if (document.exitFullscreen) {
            // @flowignore
            document.exitFullscreen();
        } else if (document.mozCancelFullScreen) {
            // @flowignore
            document.mozCancelFullScreen(); // Firefox
        } else if (document.webkitExitFullscreen) {
            // @flowignore
            document.webkitExitFullscreen(); // Chrome and Safari
        } else if (document.msExitFullscreen) {
            // @flowignore
            document.msExitFullscreen(); // Chrome and Safari
        }
    }
}

export default Player;
export { PlayerEvents };
