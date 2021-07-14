// @flow
import { SLIDER_CLASS } from '../utils';
import BaseRenderer from '../renderers/BaseRenderer';
import AnalyticEvents from '../AnalyticEvents';
import BaseScrubBar from './BaseScrubBar';

class ScrubBar extends BaseScrubBar {

    _scrubBar: HTMLInputElement;

    _scrubbedEventTimeout: TimeoutID;

    _scrubTimePoller: ?IntervalID;

    constructor(logUserInteraction: Function) {
        super(logUserInteraction);
        this._createScrubBar();
    }

    _createScrubBar(): HTMLInputElement {
        const scrubBar = document.createElement('input');
        scrubBar.setAttribute('title', 'Seek bar');
        scrubBar.setAttribute('tabindex', '2');
        scrubBar.setAttribute('aria-label', 'Seek bar');
        scrubBar.setAttribute('data-required-controls', 'false');
        scrubBar.type = 'range';
        scrubBar.id = 'scrub-bar';
        scrubBar.value = '0';
        scrubBar.className = 'romper-scrub-bar';
        scrubBar.classList.add(SLIDER_CLASS);
        this._scrubBar = scrubBar;
    }

    getScrubBarElement(): HTMLInputElement {
        return this._scrubBar;
    }

    hide() {
        this._scrubBar.style.display = 'none';
    }

    show() {
        this._scrubBar.style.display = 'block';
    }

    enable() {
        this._scrubBar.removeAttribute('disabled');
        this._scrubBar.classList.remove('romper-control-disabled');
    }

    disable() {
        this._scrubBar.setAttribute('disabled', 'true');
        this._scrubBar.classList.add('romper-control-disabled');
    }

    disconnect(parentDiv: ?HTMLDivElement) {
        if (this._scrubBar) {
            const scrubBar = this._scrubBar;
            // Remove event listeners on scrub bar by cloning and replacing old scrubBar
            const newScrubBar = scrubBar.cloneNode(true);
            if (parentDiv) parentDiv.replaceChild(newScrubBar, scrubBar);
            this._scrubBar = newScrubBar;
        }
        if (this._scrubTimePoller) {
            clearInterval(this._scrubTimePoller);
            this._scrubTimePoller = null;
        }
    }

    connect(renderer: BaseRenderer) {
        const scrubBar = this._scrubBar;

        // Update scrubbar position as media plays and when manipulated by user.
        // TODO: Using scrubBar.oninput stop/pause the player whilst scrubbing.
        scrubBar.addEventListener('change', () => {
            const { currentTime, duration } = renderer.getCurrentTime();
            const seekTime = duration * (parseInt(scrubBar.value, 10) / 100);
            renderer.setCurrentTime(seekTime);

            if (this._scrubbedEventTimeout) {
                clearTimeout(this._scrubbedEventTimeout);
            }
            this._scrubbedEventTimeout = setTimeout(() => {
                this._logUserInteraction(
                    AnalyticEvents.names.VIDEO_SCRUBBED,
                    currentTime.toString(),
                    seekTime.toString(),
                );
            }, 1000);
        });

        let isDragging = false;
        scrubBar.addEventListener('mousedown', () => { isDragging = true; });
        scrubBar.addEventListener('mouseup', () => { isDragging = false; });

        // Update the seek bar as the media plays.
        clearInterval(this._scrubTimePoller);
        this._scrubTimePoller = setInterval(
            () => {
                // Only update the slider value if not manipulated by user.
                if (!isDragging) {
                    const { currentTime, duration } = renderer.getCurrentTime();
                    const value = ((100 / duration) * currentTime);
                    scrubBar.value = value.toString();
                }
            },
            50,
        );
    }
}

export default ScrubBar;
