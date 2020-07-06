// @flow
import Player from '../Player';
import BaseRenderer from './BaseRenderer';
import Controller from '../Controller';
import logger from '../logger';


export default class TimedMediaRenderer extends BaseRenderer {
    _fetchMedia: MediaFetcher;

    _applyBlurBehaviour: Function;

    _endedEventListener: Function;

    _inTime: number;

    _outTime: number;

    _outTimeEventListener: Function;

    _seekEventHandler: Function;

    _testEndStallTimeout: TimeoutID;

    _shouldShowScrubBar: boolean;

    _hasEnded: boolean;

    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        player: Player,
        analytics: AnalyticsLogger,
        controller: Controller,
    ) {
        super(
            representation,
            assetCollectionFetcher,
            fetchMedia,
            player,
            analytics,
            controller,
        );
        this._endedEventListener = this._endedEventListener.bind(this);
        this._outTimeEventListener = this._outTimeEventListener.bind(this);
        this._seekEventHandler = this._seekEventHandler.bind(this);
        
        this._shouldShowScrubBar = true;
    }

    _endedEventListener() {
        this._timer.pause();
        if (!this._hasEnded) {
            super.complete();
        }
    }

    _seekEventHandler() {
        super.seekEventHandler(this._inTime);
    }

    _outTimeEventListener() {
        const { duration } = this.getCurrentTime();
        let { currentTime } = this.getCurrentTime();
        const playheadTime = this._playoutEngine.getCurrentTime(this._rendererId);
        if (!this.checkIsLooping()) {
            // if not looping use video time to allow for buffering delays
            currentTime = playheadTime - this._inTime;
            // and sync timer
            this._timer.setTime(currentTime);
        } else if (this._outTime) {
            // if looping, use timer
            // if looping with in/out points, need to manually re-initiate loop
            if (playheadTime >= this._outTime) {
                this._playoutEngine.setCurrentTime(this._rendererId, this._inTime);
                this._playoutEngine.playRenderer(this._rendererId);
            }
        }
        // have we reached the end?
        // either timer past specified duration (for looping) 
        // or video time past out time
        if (currentTime > duration) {
            this._playoutEngine.pauseRenderer(this._rendererId);
            this._endedEventListener();
        }
        if (currentTime > (duration - 1)) {
            const nowTime = currentTime;
            if (this._playoutEngine.isPlaying() && !this._testEndStallTimeout) {
                this._testEndStallTimeout = setTimeout(() => {
                    const time = this._playoutEngine.getCurrentTime(this._rendererId);
                    if (time && !this._hasEnded) {
                        // eslint-disable-next-line max-len
                        logger.info(`Checked video end for stall, run for 2s at ${nowTime}, reached ${time}`);
                        if (time >= nowTime && time <= nowTime + 1.9) {
                            logger.warn('Video end checker failed stall test');
                            clearTimeout(this._testEndStallTimeout);
                            // one more loop check
                            if(this.checkIsLooping()) {
                                this.setCurrentTime(this._inTime);
                            } else {
                                // otherwise carry on to next element
                                this._endedEventListener();
                            }
                        }
                    }
                }, 2000);

            }
        }
    }

    // given the forground asset collection, determine whether or not 
    // scrub bar should be shown
    _testShowScrubBar(foregroundAssetCollection) {
        if (!foregroundAssetCollection.loop) {
            // non-looping - enable
            this._shouldShowScrubBar = true;
        } else if (this._representation.duration
            && this._representation.duration > 0) {
            // looping but with duration - enable
            this._shouldShowScrubBar = true;
        } else {
            // looping with no duration - disable
            this._shouldShowScrubBar = false;
        }
    }

    start() {
        super.start();
        this._hasEnded = false;
        // set timer to sync mode until really ready
        this._timer.setSyncing(true);
        const setStartToInTime = () => {
            if (this._playoutEngine.getCurrentTime(this._rendererId) < this._inTime) {
                logger.warn('video not synced to in time, resetting');
                this.setCurrentTime(0);
            }
            this._timer.setSyncing(false);
            this._playoutEngine.off(this._rendererId, 'playing', setStartToInTime);
        };
        this._playoutEngine.on(this._rendererId, 'playing', setStartToInTime);
        // automatically move on at video end
        this._playoutEngine.on(this._rendererId, 'ended', this._endedEventListener);
        this._playoutEngine.on(this._rendererId, 'timeupdate', this._outTimeEventListener);
        this._playoutEngine.on(this._rendererId, 'seeked', this._seekEventHandler);
        this._playoutEngine.setPlayoutActive(this._rendererId);
        logger.info(`Started: ${this._representation.id}`);

        // // set time to last set time (relative to click start)
        this._player.enablePlayButton();

        // show/hide scrub bar
        if (this._shouldShowScrubBar) {
            this._player.enableScrubBar();
        } else {
            this._player.disableScrubBar();
        }
    }

    end() {
        const needToEnd = super.end();
        if (!needToEnd) return false;

        logger.info(`Ended: ${this._representation.id}`);
        this._hasEnded = true;
        this._playoutEngine.setPlayoutInactive(this._rendererId);
        this._playoutEngine.off(this._rendererId, 'ended', this._endedEventListener);
        this._playoutEngine.off(this._rendererId, 'timeupdate', this._outTimeEventListener);
        this._playoutEngine.off(this._rendererId, 'seeked', this._seekEventHandler);

        return true;
    }

    destroy() {
        const needToDestroy = super.destroy();
        if(!needToDestroy) return false;

        this._playoutEngine.unqueuePlayout(this._rendererId);
        return true;
    }
}
