// @flow

import Player from '../gui/Player';
import ThreeJsBaseRenderer from './ThreeJsBaseRenderer';
import { RENDERER_PHASES } from './BaseRenderer';

import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';
import { MEDIA_TYPES, SUPPORT_FLAGS } from '../playoutEngines/BasePlayoutEngine';
import logger from '../logger';
import { MediaFormats } from '../browserCapabilities';
import { VIDEO } from '../utils';

const THREE = require('three');

export default class ThreeJsVideoRenderer extends ThreeJsBaseRenderer {
    _fetchMedia: MediaFetcher;

    _endedEventListener: Function;

    _hasEnded: boolean;

    _outTimeEventListener: Function;

    _playEventListener: Function;

    _pauseEventListener: Function;

    _handlePlayPauseButtonClicked: Function;

    _lastSetTime: number;

    _inTime: number;

    _outTime: number;

    _setOutTime: Function;

    _setInTime: Function;

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

        this._hasEnded = false;
        this._endedEventListener = this._endedEventListener.bind(this);
        this._handlePlayPauseButtonClicked = this._handlePlayPauseButtonClicked.bind(this);
        this._outTimeEventListener = this._outTimeEventListener.bind(this);

        this._setInTime = this._setInTime.bind(this);
        this._setOutTime = this._setOutTime.bind(this);
        this._inTime = 0;
        this._outTime = -1;
        this._lastSetTime = 0;
    }

    async init() {
        try {
            if(!this._playoutEngine.supports(SUPPORT_FLAGS.SUPPORTS_360)) {
                throw new Error("Playout Engine does not support 360")
            }
            await this._queueVideoElement();
            this._setPhase(RENDERER_PHASES.CONSTRUCTED);
        }
        catch(e) {
            logger.error(e, 'could not initiate 360 video renderer');
        }
    }

    async _queueVideoElement() {
        if (this._representation.asset_collections.foreground_id) {
            const fg = await this._fetchAssetCollection(
                this._representation.asset_collections.foreground_id,
            );
            if (fg.meta && fg.meta.romper && fg.meta.romper.in) {
                this._setInTime(parseFloat(fg.meta.romper.in));
            }
            if (fg.meta && fg.meta.romper && fg.meta.romper.out) {
                this._setOutTime(parseFloat(fg.meta.romper.out));
            }
            if (fg.assets.av_src) {
                const mediaObj = {
                    type: MEDIA_TYPES.FOREGROUND_AV,
                    playPauseHandler: this._handlePlayPauseButtonClicked,
                    loop: fg.loop,
                    id: fg.id,
                    inTime: this._inTime,
                }
                const options = { mediaFormat: MediaFormats.getFormat(), mediaType: VIDEO };
                const mediaUrl = await this._fetchMedia(fg.assets.av_src, options);
                if (fg.assets.sub_src) {
                    const subsUrl = await this._fetchMedia(fg.assets.sub_src);
                    mediaObj.subs_url = subsUrl
                }
                let appendedUrl = mediaUrl;
                if (this._inTime > 0 || this._outTime > 0) {
                    let mediaFragment = `#t=${this._inTime}`;
                    if (this._outTime > 0) {
                        mediaFragment = `${mediaFragment},${this._outTime}`;
                    }
                    appendedUrl = `${mediaUrl}${mediaFragment}`;
                }
                if (this.phase !== RENDERER_PHASES.CONSTRUCTING) {
                    logger.warn('trying to populate video element at the wrong time');
                } else {
                    mediaObj.url = appendedUrl
                    this._playoutEngine.queuePlayout(this._rendererId, mediaObj);
                }
            } else {
                throw new Error('No av source for video');
            }
        } else {
            throw new Error('No foreground asset id for video');
        }
    }


    _endedEventListener() {
        logger.info('360 video ended');
        if (!this._hasEnded) {
            this._hasEnded = true;
            super.complete();
        }
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
        } else if (this._outTime > 0) {
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
    }

    start() {
        super.start();
        this._setPhase(RENDERER_PHASES.MAIN);
        this._startThreeSixtyVideo();
        this.setCurrentTime(this._lastSetTime);
        this._player.enablePlayButton();
        this._player.enableScrubBar();
    }

    _startThreeSixtyVideo() {
        const videoElement = this._playoutEngine.getMediaElementFor360(this._rendererId);
        const texture = new THREE.VideoTexture(videoElement);
        const material = new THREE.MeshBasicMaterial({ map: texture });

        const geometry = new THREE.SphereBufferGeometry(500, 60, 40);
        // invert the geometry on the x-axis so that all of the faces point inward
        geometry.scale(-1, 1, 1);

        const mesh = new THREE.Mesh(geometry, material);
        this._scene.add(mesh);

        // automatically move on at video end
        this._playoutEngine.on(this._rendererId, 'ended', this._endedEventListener);
        this._playoutEngine.on(this._rendererId, 'timeupdate', this._outTimeEventListener);

        this._playoutEngine.setPlayoutActive(this._rendererId);
        if(videoElement) {
            videoElement.style.visibility = 'hidden';
        }
        this._animate();
    }

    // set how far into the segment this video should be (relative to in-point)
    setCurrentTime(time: number) {
        let targetTime = time;
        const choiceTime = this.getChoiceTime();
        if (choiceTime >= 0 && choiceTime < time) {
            targetTime = choiceTime;
        }
        // convert to absolute time into video
        this._lastSetTime = targetTime; // time into segment
        this._playoutEngine.setCurrentTime(this._rendererId, targetTime + this._inTime);
        this._timer.setTime(targetTime);
    }

    _setInTime(time: number) {
        this._inTime = time;
    }

    _setOutTime(time: number) {
        this._outTime = time;
    }

    switchFrom() {
        this._playoutEngine.setPlayoutInactive(this._rendererId);
    }

    switchTo() {
        if (this._started) {
            this._playoutEngine.setPlayoutActive(this._rendererId);
        } else {
            this.start();
        }
    }

    end() {
        const needToEnd = super.end();
        if (!needToEnd) return false;

        this._setPhase(RENDERER_PHASES.ENDED);
        this._hasEnded = true;
        this._playoutEngine.setPlayoutInactive(this._rendererId);
        this._playoutEngine.off(this._rendererId, 'ended', this._endedEventListener);
        this._playoutEngine.off(this._rendererId, 'timeupdate', this._outTimeEventListener);
        return true;
    }

    destroy() {
        const needToDestroy = super.destroy();
        if(!needToDestroy) return false;
        
        this._setPhase(RENDERER_PHASES.DESTROYED);
        return true;
    }
}
