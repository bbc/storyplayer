// @flow

import EventEmitter from 'events';
import logger from './logger';

const TIMER_INTERVAL = 10;

export default class TimeManager extends EventEmitter {

    _timedEvents: { [key: string]: Object };

    _timeElapsed: number;

    _paused: boolean;

    _timer: ?IntervalID;

    _syncing: boolean;

    _debug: boolean;

    constructor() {
        super();
        this._timedEvents = {};
        this._paused = false;
        this._syncing = false;
        this._debug = false;
    }

    start() {
        if (this._debug) logger.info('timer start');
        this.clear();
        
        this._timer = setInterval(() => {
            if (!(this._paused || this._syncing)) {
                this._timeElapsed += TIMER_INTERVAL/1000;
                this._testForEvents();
            }
            if (this._debug && this._timeElapsed > 0 && this._timeElapsed % 200 === 0) {
                logger.info('timer', this._timeElapsed);
            }
        }, TIMER_INTERVAL);

    }

    _testForEvents() {
        Object.keys(this._timedEvents).forEach((timeEventId) => {
            const { 
                startTime,
                startCallback,
                isRunning,
                endTime,
                clearCallback,
            } = this._timedEvents[timeEventId];
            // handle starting event
            if (this._timeElapsed >= startTime && this._timeElapsed < endTime
                && !isRunning){
                logger.info(`timer running timed event ${timeEventId}`);
                startCallback();
                this._timedEvents[timeEventId].isRunning = true;
            }
            // handle clearing event
            if ((this._timeElapsed <= startTime || this._timeElapsed > endTime)
                && isRunning) {
                try {
                    if (clearCallback) clearCallback();
                } catch (err) {
                    logger.info(`couldn't clear up behaviour ${timeEventId}`);
                }
                this._timedEvents[timeEventId].isRunning = false;
            }
        });
    }

    // set the timer to pause while it syncs, or restart when done
    setSyncing(syncing: boolean) {
        if (syncing) {
            if (this._debug) logger.info('timer set syncing');
            this._syncing = true;
        } else {
            if (this._debug) logger.info('timer set not syncing');
            this._syncing = false;
        }
    }

    // is the timer waiting while it syncs with media?
    isSyncing() {
        return this._syncing;
    }

    pause() {
        if (this._debug) logger.info('timer pause');
        if(!this._paused) {
            this._paused = true;
        }
    }

    resume() {
        if (this._debug) logger.info('timer resume');
        if(this._paused) {
            this._paused = false;
        }
    }

    clear() {
        if (this._debug) logger.info('timer clear');
        if (this._timer) { 
            clearInterval(this._timer);
        }

        this._timeElapsed = 0;
        this._timedEvents = {};
        this._paused = false;
    }

    setTime(newTime: number) {
        if (this._debug) {
            logger.info(`timer set to ${newTime}, current timer is ${this._timeElapsed}`);
        }
        this._timeElapsed = newTime;
        this._testForEvents();
    }

    getTime() {
        return this._timeElapsed;
    }

    addTimeEventListener(
        listenerId: string,
        startTime: number,
        startCallback: Function,
        endTime: ?number = Infinity,
        clearCallback: ?Function,
    ) {
        if (this._debug) logger.info(`timer: Added event for ${startTime}`);
        this._timedEvents[listenerId] = { 
            startTime,
            endTime,
            startCallback,
            isRunning: false,
            clearCallback,
        };
    }

    deleteTimeEventListener(listenerId: string) {
        if (listenerId in this._timedEvents) {
            delete this._timedEvents[listenerId];
        }
    }

}
