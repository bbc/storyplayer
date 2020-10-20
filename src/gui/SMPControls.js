// @flow
import BaseControls from './BaseControls';
import Overlay from './Overlay';
import { ButtonEvents } from './Buttons';
import { getSMPInterface } from '../utils'
import BasePlayoutEngine from '../playoutEngines/BasePlayoutEngine';
import logger from '../logger';
import AnalyticEvents from '../AnalyticEvents';

/* eslint-disable class-methods-use-this */

const SHOW_CHAPTER_BUTTON = false

class SMPControls extends BaseControls {

    _logUserInteraction: Function;

    _smpPlayerInterface: Object;

    _backButton: boolean;

    _nextButton: boolean;

    _controlsEnabled: boolean;

    _containerDiv: HTMLDivElement;

    _chapterButton: HTMLButtonElement;

    _uiUpdateQueue: Array<Object>;

    _uiUpdateQueueTimer: Number;

    _scrubTimePoller: ?IntervalID;

    _playoutEngine: BasePlayoutEngine;

    constructor(
        logUserInteraction: Function,
        volumeOverlay: Overlay,
        chapterOverlay: Overlay,
        switchableOverlay: Overlay,
        playoutEngine: BasePlayoutEngine,
    ) {
        super(logUserInteraction, volumeOverlay, chapterOverlay, switchableOverlay);

        this._playoutEngine = playoutEngine;

        this._smpPlayerInterface = getSMPInterface();

        // Previous Button
        this._smpPlayerInterface.addEventListener("previousRequested", () => {
            this.emit(ButtonEvents.BACK_BUTTON_CLICKED);
        })

        // Next Button
        this._smpPlayerInterface.addEventListener("nextRequested", () => {
            this.emit(ButtonEvents.NEXT_BUTTON_CLICKED)
        })

        this._setupAnalytics();

        // Controls enabled by default
        this._controlsEnabled = true

        this._containerDiv = document.createElement('div');
        this._containerDiv.classList.add('romper-buttons-smp');
        this._containerDiv.classList.add('show');

        if(SHOW_CHAPTER_BUTTON) {
            // Setup Chapter Overlay and attach Custom SMP button to it
            this._containerDiv.appendChild(chapterOverlay.getOverlay());
            this._createChapterButton()
            chapterOverlay.useCustomButton(this._chapterButton)
        }

        this._uiUpdateQueue = []

        // TODO: get this back in when we have approved design
        // this._createFbMixSlider()

        this._setDefaultSMPControlsConfig()

        // Set SMP Audio Bar to have extra width to contain our new control
        this._smpPlayerInterface.updateUiConfig({
            controls:{
                extraVolumeWidth:170
            }
        })
    }

    /**
     * Sets up the analytics logging so we listen to what the SMP
     * controls are doing and report to our system.
     *
     * Currently lacks RendererActions:
     *  - VIDEO_PAUSE and VIDEO_UNPAUSE
     *  - BUTTONS_ACTIVATED and BUTTONS_DEACTIVATED
     */
    _setupAnalytics() {
        /* eslint-disable max-len */
        this._smpPlayerInterface.addEventListener("SonarUserActionEvent", (e) => {
            switch(e.controlId) {
            case('back_interval_button'): {
                let seekBackFrom = 'not_set';
                let seekBackTo = 'not_set';
                if (e.labels) {
                    const { beforeTime, afterTime } = e.labels;
                    if (beforeTime !== undefined) { seekBackFrom = beforeTime }
                    if (afterTime !== undefined) { seekBackTo = afterTime }
                }
                this._logUserInteraction(
                    AnalyticEvents.names.SEEK_BACKWARD_BUTTON_CLICKED,
                    `${seekBackFrom}`,
                    `${seekBackTo}`,
                );
                break;
            }
            case('forward_interval_button'): {
                let seekFrom = 'not_set';
                let seekTo = 'not_set';
                if (e.labels) {
                    const { beforeTime, afterTime } = e.labels;
                    if (beforeTime !== undefined) { seekFrom = beforeTime }
                    if (afterTime !== undefined) { seekTo = afterTime }
                }
                this._logUserInteraction(
                    AnalyticEvents.names.SEEK_FORWARD_BUTTON_CLICKED,
                    `${seekFrom}`,
                    `${seekTo}`,
                );
                break;
            }
            case('seek_bar'): {
                let scrubFrom = 'not_set';
                let scrubTo = 'not_set';
                if (e.labels) {
                    /* eslint-disable camelcase */
                    const { before_seek_time, seek_time } = e.labels;
                    if (before_seek_time !== undefined) { scrubFrom = before_seek_time }
                    if (seek_time !== undefined) { scrubTo = seek_time }
                    /* eslint-enable camelcase */
                }
                this._logUserInteraction(
                    AnalyticEvents.names.VIDEO_SCRUBBED,
                    `${scrubFrom}`,
                    `${scrubTo}`,
                );
                break;
            }
            case('pause'):
                this._logUserInteraction(AnalyticEvents.names.PLAY_PAUSE_BUTTON_CLICKED, 'play' , 'pause');
                break;
            case('play'):
                this._logUserInteraction(AnalyticEvents.names.PLAY_PAUSE_BUTTON_CLICKED, 'pause', 'play');
                break;
            case('mute'):
                this._logUserInteraction(AnalyticEvents.names.VOLUME_MUTE_TOGGLED, 'not_set', 'default: true');
                break;
            case('unmute'):
                this._logUserInteraction(AnalyticEvents.names.VOLUME_MUTE_TOGGLED, 'not_set', 'default: false');
                break;
            case('volume_slider'):
                this._logUserInteraction(AnalyticEvents.names.VOLUME_CHANGED, '', `default: ${e.labels.volume}`);
                break;
            case('enter_picture_in_picture_mode'):
                this._logUserInteraction(AnalyticEvents.names.PIP_MODE_CHANGED, 'normal', 'pip');
                break;
            case('exit_picture_in_picture_mode'):
                this._logUserInteraction(AnalyticEvents.names.PIP_MODE_CHANGED, 'pip', 'normal');
                break;
            case('enter_full_screen'):
                this._logUserInteraction(AnalyticEvents.names.FULLSCREEN_BUTTON_CLICKED, 'not-fullscreen', 'fullscreen');
                break;
            case('exit_full_screen'):
                this._logUserInteraction(AnalyticEvents.names.FULLSCREEN_BUTTON_CLICKED, 'fullscreen', 'not-fullscreen');
                break;
            case('previous_button'):
                this._logUserInteraction(AnalyticEvents.names.BACK_BUTTON_CLICKED);
                break;
            case('next_button'):
                this._logUserInteraction(AnalyticEvents.names.NEXT_BUTTON_CLICKED);
                break;
            case('subtitles_on'):
                this._logUserInteraction(AnalyticEvents.names.SUBTITLES_BUTTON_CLICKED, 'off', 'on');
                break;
            case('subtitles_off'):
                this._logUserInteraction(AnalyticEvents.names.SUBTITLES_BUTTON_CLICKED, 'on', 'off');
                break;
            default:
                break;
            }
        })
        /* eslint-enable max-len */
    }

    _uiUpdate(controlsConfig) {
        this._uiUpdateQueue.push(controlsConfig)
        this._processUiUpdateQueue()
    }

    _processUiUpdateQueue() {
        if(this._uiUpdateQueueTimer) {
            clearTimeout(this._uiUpdateQueueTimer)
            this._uiUpdateQueueTimer = null;
        }
        if(this._smpPlayerInterface.playlist === null) {
            this._uiUpdateQueueTimer = setTimeout(() => {this._processUiUpdateQueue()}, 1000)
            return
        }

        // Apply all UI config changes in one go by combining settings
        const controlsConfig = this._uiUpdateQueue.reduce((combinedConfig, nextValue) => {
            return {
                ...combinedConfig,
                ...nextValue,
            }
        }, {})
        this._uiUpdateQueue = []

        this._smpPlayerInterface.updateUiConfig({
            controls: controlsConfig
        })
    }

    _setDefaultSMPControlsConfig() {
        // Setup Default Controls Settings
        this._uiUpdate({
            enabled: true,
            spaceControlsPlayback: true,
            availableOnMediaEnded: true,
            includeNextButton: true,
            includePreviousButton: true,
            alwaysEnablePreviousButton: false,
            alwaysEnableNextButton: false,
        })
    }

    _createFbMixSlider() {
        const controlBar = document.querySelector('.p_volumeControls');

        const fbMixSliderLabel = document.createElement('div');
        fbMixSliderLabel.classList.add("audioMixSliderLabel")
        fbMixSliderLabel.innerHTML = "Default Mix"
        controlBar.appendChild(fbMixSliderLabel)

        const fbMixSlider = document.createElement('input');
        fbMixSlider.classList.add("audioMixSlider")

        fbMixSlider.type = 'range';
        fbMixSlider.min = 0;
        fbMixSlider.max = 1;
        fbMixSlider.value = 1;
        fbMixSlider.step = 0.1;
        fbMixSlider.addEventListener("change", (e) => {
            const sliderValue = parseFloat(e.target.value)
            this._playoutEngine.setFbMix(sliderValue)
        })

        fbMixSlider.addEventListener("input", (e) => {
            const sliderValue = parseFloat(e.target.value)
            this._playoutEngine.setFbMix(sliderValue)
            const label = document.querySelector('.audioMixSliderLabel')
            if(sliderValue <= 0.5) {
                label.innerHTML = "Accessible Mix"
            } else if(sliderValue > 0.5 && sliderValue < 0.75) {
                label.innerHTML = "Enhanced Mix"
            } else if(sliderValue >= 0.75) {
                label.innerHTML = "Default Mix"
            } else {
                logger.warn("Invalid mix slider value: ")
            }
        })

        controlBar.appendChild(fbMixSlider)

    }

    _createChapterButton() {
        const controlBar = document.querySelector('.mediaContainer');
        const chapterButton = document.createElement('button');
        chapterButton.classList.add("p_button")
        chapterButton.classList.add("p_controlBarButton")
        chapterButton.classList.add("chapterButton")
        chapterButton.classList.add("romper-inactive")
        chapterButton.setAttribute("role", "button")
        chapterButton.setAttribute("aria-live", "polite")
        chapterButton.setAttribute("aria-label", "Toggle Chapter Menu")
        chapterButton.onmouseover = () => {
            chapterButton.classList.add("p_buttonHover")
        }
        chapterButton.onmouseout = () => {
            chapterButton.classList.remove("p_buttonHover")
        }
        chapterButton.innerHTML = '<span class="p_hiddenElement" aria-hidden="true">Toggle Chapter Menu</span><div class="p_iconHolder"><svg xmlns="http://www.w3.org/2000/svg" class="p_svg chapterIcon" focusable="false" viewBox="0 0 60 60"><title>chapters</title><rect x="8" width="24" height="8"/><rect x="16" y="12" width="16" height="8"/><rect x="8" y="24" width="24" height="8"/><polygon points="0 23 12 16 0 9 0 23"/></svg></div>'
        controlBar.appendChild(chapterButton)

        this._chapterButton = chapterButton;
    }

    /* getters */

    // get the whole lot organised in a DIV
    getControls(): HTMLDivElement {
        return this._containerDiv
    }

    // get a div that activates the buttons
    getActivator(): HTMLDivElement { }

    // are the controls showing
    getShowing(): boolean {
        return true
    }

    /* exposing functionality to change how buttons look/feel */
    disableControls() {
        if(this._controlsEnabled !== false) {
            this._uiUpdate({
                enabled: false,
            })
            this._controlsEnabled = false
        }
    }

    enableControls() {
        if(this._controlsEnabled !== true) {
            this._uiUpdate({
                enabled: true,
            })
            this._controlsEnabled = true
        }
    }

    // eslint-disable-next-line class-methods-use-this
    showControls() {
        // Activating of SMP handled by SMP. No need to manually show/hide controls
    }

    // eslint-disable-next-line class-methods-use-this
    hideControls() {
        // Activating of SMP handled by SMP. No need to manually show/hide controls
    }

    setControlsActive() {
        // Handled by SMP
    }

    setControlsInactive() {
        // called when restarting an experience and throwing up new splash screen
        // and play button
        // TODO: need to test properly
        this.disableControls();
    }

    setFullscreenOn() { }

    setFullscreenOff() { }

    hideScrubBar() {
        // Not used, might be required for hideSeekButtons in player
    }

    showScrubBar() {
        // Called from showSeekButtons in player
    }

    enableScrubBar() {
        if(this._scrubEnabled !== true) {
            this._uiUpdate({
                mode: "default",
            })
            this._scrubEnabled = true
        }
    }

    disableScrubBar() {
        if(this._scrubEnabled !== false) {
            this._uiUpdate({
                mode: "controls",
            })
            this._scrubEnabled = false
        }
    }

    connectScrubBar(renderer: BaseRenderer) {
        // clear any existing polling
        if (this._scrubTimePoller) clearInterval(this._scrubTimePoller);

        // Update the seek bar as the media plays
        this._scrubTimePoller = setInterval(
            () => {
                const { currentTime } = renderer.getCurrentTime();
                this._playoutEngine.setNonAVPlayoutTime(renderer._rendererId, currentTime);
            },
            200,
        );

        this._smpPlayerInterface.addEventListener("seekRequested", (event) => {
            const { currentTime, duration } = renderer.getCurrentTime();
            let seekTo = event.time;
            // Hack as SMP doesn't have time whilst playing fake item so detect is
            // seek is due to scrub or +/- 20s buttons
            if(seekTo === this._playoutEngine.getCurrentTime(renderer._rendererId) + 20) {
                seekTo = Math.min(currentTime + 20, duration);
            } else if(seekTo === 0 && this._playoutEngine.getCurrentTime(renderer._rendererId) <= 20) {
                seekTo = Math.max(currentTime - 20, 0);
            }
            renderer.setCurrentTime(seekTo);
        })
    }

    disconnectScrubBar() {
        // clear any existing polling
        if (this._scrubTimePoller) clearInterval(this._scrubTimePoller);
    }

    setTransportControlsActive() { }

    setTransportControlsInactive() { }

    showSeekButtons() {
        // TODO: Where is hideSeekButtons?!
    }

    enablePlayButton() {
        // Hack: SMP may change element id at anytime which is why it's in a
        // catch statement
        try {
            document.getElementById("p_audioui_playpause").removeAttribute('disabled');
        } catch (error) {
            logger.warn("Cannot find play button: ", error)
        }
    }

    disablePlayButton() {
        // Hack: SMP may change element id at anytime which is why it's in a
        // catch statement
        try {
            document.getElementById("p_audioui_playpause").setAttribute('disabled', 'true');
        } catch (error) {
            logger.warn("Cannot find play button: ", error)
        }
    }

    setPlaying(){ }

    setNextAvailable(isNextAvailable: boolean) {
        if(this._nextEnabled !== isNextAvailable) {
            this._uiUpdate({
                alwaysEnableNextButton: isNextAvailable,
            })
            this._nextEnabled = isNextAvailable
        }

    }

    setBackAvailable(isBackAvailable: boolean) {
        if(this._backButton !== isBackAvailable) {
            this._uiUpdate({
                alwaysEnablePreviousButton: isBackAvailable,
            })
            this._backButton = isBackAvailable;
        }
    }

    // eslint-disable-next-line class-methods-use-this
    enableSubtitlesButton() {
        // SMP Handles Subtitles & Subtitles Button
    }

    // eslint-disable-next-line class-methods-use-this
    disableSubtitlesButton() {
        // SMP Handles Subtitles & Subtitles Button
    }

    // choices are showing on screen - shift the subtitles up
    setSubtitlesAboveElement(behaviourElement) { 
        const choiceHeight = behaviourElement.offsetHeight;
        const playerHeight =  this._playoutEngine._smpPlayerInterface.container.offsetHeight;
        const maxSubsY = playerHeight - choiceHeight;
        getSMPInterface().updateUiConfig({
            subtitles: {
                yOffset: maxSubsY,
            }
        });
    }

    // choices have been cleared - return the subtitles to normal
    resetSubtitleHeight() {
        getSMPInterface().updateUiConfig({
            subtitles: { yOffset:  NaN },
        });
    }
}

export default SMPControls;
