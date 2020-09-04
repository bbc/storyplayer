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

        let isSyncing = false; // do we need to wait for everything to sync?

        const scrubBarSeek = (time) => {
            const { currentTime } = renderer.getCurrentTime();
            const currentTimeString = currentTime.toString()
            isSyncing = true;
            renderer.setCurrentTime(time);

            // Don't spam analtics with lots of changes
            // Wait 1 second after scrub bar stops changing before sending analytics
            if (this._scrubbedEventTimeout) {
                clearTimeout(this._scrubbedEventTimeout);
            }
            this._scrubbedEventTimeout = setTimeout(() => {
                this._logUserInteraction(
                    AnalyticEvents.names.VIDEO_SCRUBBED,
                    currentTimeString,
                    time.toString(),
                );
            }, 1000);
        }

        const scrubBarChangeFunc = () => {
            // Calculate the new time
            const { duration } = renderer.getCurrentTime();
            const time = duration * (parseInt(scrubBar.value, 10) / 100);
            scrubBarSeek(time)
        };

        // update scrub bar position as media plays
        // TODO: Using scrubBar.oninput we should stop player whilst scrub is
        // held
        scrubBar.onchange = scrubBarChangeFunc;

        // allow clicking the scrub bar to seek to a media position
        scrubBar.addEventListener('click', (e: MouseEvent) => {
            const percent = e.offsetX / scrubBar.offsetWidth;
            const { duration } = renderer.getCurrentTime();
            // Update the media time
            const newTime = percent * duration;
            scrubBarSeek(newTime)
        });

        let isDragging = false;
        // Pause the media when the slider handle is being dragged
        scrubBar.addEventListener('mousedown', () => {
            isDragging = true;
        });

        // Play the media when the slider handle is dropped (if it was previously playing)
        scrubBar.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // clear any existing polling
        if (this._scrubTimePoller) clearInterval(this._scrubTimePoller);

        // Update the seek bar as the media plays
        this._scrubTimePoller = setInterval(
            () => {
                const { currentTime, duration, timersSyncing } = renderer.getCurrentTime();
                const value = ((100 / duration) * currentTime);
                // Update the slider value
                if (!(isDragging || isSyncing)) {
                    scrubBar.value = value.toString();
                }
                if (isSyncing && !timersSyncing) {
                    isSyncing = false;
                }
            },
            200,
        );
    }
}

export default ScrubBar;
