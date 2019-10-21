// @flow

import EventEmitter from 'events';
import logger from './logger';

const TIMER_INTERVAL = 100;

export default class TimeManager extends EventEmitter {

    _duration: number;

    _timedEvents: { [key: string]: Object };

    _timeElapsed: number;

    _paused: boolean;

    _timer: ?IntervalID;

    constructor() {
        super();
        this._timedEvents = {};
        this._paused = false;
    }

    start(duration: number = Infinity) {
        this.clear();
        this._duration = duration;
        
        this._timer = setInterval(() => {
            if (!this._paused) {
                this._timeElapsed += TIMER_INTERVAL/1000;
                Object.keys(this._timedEvents).forEach((timeEventId) => {
                    const { time, callback } = this._timedEvents[timeEventId];
                    if (this._timeElapsed >= time){
                        delete this._timedEvents[timeEventId];
                        logger.info(`timer running timed event ${timeEventId}`);
                        callback();
                    }
                });
            }
        }, TIMER_INTERVAL);

    }

    pause() {
        this._paused = true;
    }

    resume() {
        this._paused = false;
    }

    setPause(paused: boolean) {
        this._paused = paused;
    }

    clear() {
        if (this._timer) { 
            clearInterval(this._timer);
        }

        this._duration = Infinity;
        this._timeElapsed = 0;
        this._timedEvents = {};
        this._paused = false;
    }

    setTime(newTime: number) {
        this._timeElapsed = newTime;
    }

    getTime() {
        return this._timeElapsed;
    }

    addTimeEventListener(listenerId: string, time: number, callback: Function) {
        this._timedEvents[listenerId] = { time, callback };
    }

    deleteTimeEventListener(listenerId: string) {
        if (listenerId in this._timedEvents) {
            delete this._timedEvents[listenerId];
        }
    }

}
