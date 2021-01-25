import BaseRenderer from './BaseRenderer';
import logger from '../logger';


const TIMER_INTERVAL = 10;

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
            this.pause();
        }
        return shouldEnd;
    }
}
