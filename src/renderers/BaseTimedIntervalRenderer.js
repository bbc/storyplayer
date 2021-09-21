import BaseRenderer from './BaseRenderer';
import logger from '../logger';


const TIMER_INTERVAL = 10;
const FADE_STEP_LENGTH = 20; // time between steps for fades

const FADE_IN_TIME = 2000; // default fade in time for audio in ms (if not specced in behaviour)
const FADE_IN = "urn:x-object-based-media:representation-behaviour:fadein/v1.0";
const FADE_OUT = "urn:x-object-based-media:representation-behaviour:fadeout/v1.0";

export default class TimedMediaRenderer extends BaseRenderer {
    constructor(
        representation,
        assetCollectionFetcher,
        fetchMedia,
        player,
        analytics,
        controller,
    ) {
        super(
            representation,
            assetCollectionFetcher,
            fetchMedia,
            player,
            analytics,
            controller,
        );

        this._start = 0;
        this._current = this._start;
        this._ms = TIMER_INTERVAL;
        this._interval = null;
    }

    getCurrentTime() {
        const duration = this.getDuration();
        const currentTime = this._current;

        return {
            duration,
            currentTime,
            timeBased: duration !== Infinity,
            remainingTime: duration - currentTime,
        };
    }

    setCurrentTime(time) {
        // Calculate bounded time w.r.t. what was requested.
        const { duration } = this.getCurrentTime();
        let targetTime = time;
        targetTime = Math.max(0, targetTime);
        targetTime = Math.min(targetTime, duration);

        const choiceTime = this.getChoiceTime();
        if (choiceTime >= 0 && choiceTime < targetTime) {
            targetTime = choiceTime;
        }

        // Ensure that targetTime is valid.
        if (targetTime === Infinity || Number.isNaN(targetTime)) {
            logger.warn(`Ignoring setCurrentTime (${time} for ${targetTime}).`);
            return;
        }

        this._current = targetTime;
    }

    _applyFadeInBehaviour(behaviour, callback) {
        const overlayImageElement = this._createFadeOverlay(behaviour);
        overlayImageElement.style.opacity = 1;
        this._setupVisualFade();
        callback();
    }

    _applyFadeOutBehaviour(behaviour, callback) {
        const overlayImageElement = this._createFadeOverlay(behaviour);
        overlayImageElement.style.opacity = 0;
        this._setupVisualFade();
        callback();
    }

    // setup a fade monitor, if there isn't one already
    _setupVisualFade() {
        logger.info(`Fading colour for renderer ${this._rendererId}`);
        if (this._visualFadeInterval) return;

        logger.info('Initiating colour fade listener');
        this._visualFadeInterval = setInterval(
            () => this._calculateVisualFadeStatus(),
            FADE_STEP_LENGTH,
        );
    }

    _calculateVisualFadeStatus() {
        const { currentTime } = this.getCurrentTime();
        const currentFadeBehaviours = this._representation.behaviours?.during
            .filter(b => {
                return b.behaviour.type === FADE_OUT
                || b.behaviour.type === FADE_IN;
            }).filter(b => {
                const duration = b.behaviour.duration || FADE_IN_TIME;
                return currentTime > b.start_time && currentTime < (b.start_time + duration);
            });

        currentFadeBehaviours.forEach(b => {
            const { id, duration, type } = b.behaviour;
            const proportion = (currentTime - b.start_time) / duration;
            const element = document.getElementById(id);
            if (type === FADE_IN) {
                element.style.opacity = 1 - proportion;
            }
            if (type === FADE_OUT) {
                element.style.opacity = proportion;
            }    
        });

        const previousFadeBehaviours = this._representation.behaviours?.during
            .filter(b => {
                return b.behaviour.type === FADE_OUT
                || b.behaviour.type === FADE_IN;
            }).filter(b => {
                const duration = b.behaviour.duration || FADE_IN_TIME;
                return currentTime > (b.start_time + duration);
            });

        previousFadeBehaviours.forEach(b => {
            const { id, type } = b.behaviour;
            const element = document.getElementById(id);
            if (type === FADE_IN) {
                element.style.opacity = 0;
            }
            if (type === FADE_OUT) {
                element.style.opacity = 1;
            }    
        });
    }

    start() {
        super.start();
        this._current = 0;
        if (this._playoutEngine.isPlaying()) {
            this.play();
        }
    }

    play() {
        clearInterval(this._interval);
        this._interval = setInterval(() => {
            this._current += this._ms / 1000;
        }, this._ms);
    }

    pause() {
        clearInterval(this._interval);
    }

    end() {
        const shouldEnd = super.end();
        if (shouldEnd) {
            if (this._visualFadeInterval) {
                clearInterval(this._visualFadeInterval);
                this._visualFadeInterval = undefined;
            }
            this.pause();
        }
        return shouldEnd;
    }
}
