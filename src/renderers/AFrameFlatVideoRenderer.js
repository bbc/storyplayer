// @flow
import AFrameRenderer from './AFrameRenderer';
import Player, { PlayerEvents } from '../Player';
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import AnalyticEvents from '../AnalyticEvents';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';
import { MEDIA_TYPES } from '../playoutEngines/BasePlayoutEngine';
import logger from '../logger';

const ORIENTATION_POLL_INTERVAL = 2000;

export default class AFrameFlatVideoRenderer extends BaseRenderer {
    _fetchMedia: MediaFetcher;

    _endedEventListener: Function;
    _outTimeEventListener: Function;
    _playEventListener: Function;
    _pauseEventListener: Function;
    _handlePlayPauseButtonClicked: Function;
    _setOrientationVariable: Function;
    _orientationWatcher: ?IntervalID;

    _videoDivId: string;
    _videoAssetElement: HTMLVideoElement;
    _initialRotation: string;
    _videoTypeString: string;
    _sceneElements: Array<HTMLElement>;
    _ambisonic: string;

    _lastSetTime: number;
    _inTime: number;
    _outTime: number;
    _setOutTime: Function;
    _setInTime: Function;

    _hasEnded: boolean;
    _started: boolean;
    _rendered: boolean;

    _afr: typeof AFrameRenderer;

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
        this._handlePlayPauseButtonClicked = this._handlePlayPauseButtonClicked.bind(this);
        this._outTimeEventListener = this._outTimeEventListener.bind(this);
        this._setOrientationVariable = this._setOrientationVariable.bind(this);
        this._orientationWatcher = null;

        this._playoutEngine.queuePlayout(this._rendererId, {
            type: MEDIA_TYPES.FOREGROUND_AV,
        });

        this._setInTime = this._setInTime.bind(this);
        this._setOutTime = this._setOutTime.bind(this);
        this._inTime = 0;
        this._outTime = -1;
        this._lastSetTime = 0;

        // this is what we refer to
        this._videoDivId = `flatvideo-${this._rendererId}`;

        this._rendered = false;

        this.collectElementsToRender();
    }

    _endedEventListener() {
        logger.info('flat video in 360 ended');
        if (!this._hasEnded) {
            this._hasEnded = true;
            this._player.getLinkChoiceElement().style.visibility = 'visible';
            super.complete();
        }
    }

    _outTimeEventListener() {
        const videoElement = this._playoutEngine.getMediaElement(this._rendererId);
        if (videoElement) {
            if (this._outTime > 0 && videoElement.currentTime >= this._outTime) {
                videoElement.pause();
                this._endedEventListener();
            }
        }
    }

    start() {
        super.start();
        logger.info(`Started: ${this._representation.id}`);
        if (this._rendered) {
            this._startFlatVideo();
        }
        this.setCurrentTime(this._lastSetTime);
        this._hasEnded = false;
        this._started = true;
    }

    collectElementsToRender() {
        // set video source
        if (this._representation.asset_collections.foreground_id) {
            this._fetchAssetCollection(this._representation.asset_collections.foreground_id)
                .then((fg) => {
                    if (fg.assets.av_src) {
                        // get meta
                        if (fg.meta && fg.meta.romper && fg.meta.romper.in) {
                            this._setInTime(parseFloat(fg.meta.romper.in));
                        }
                        if (fg.meta && fg.meta.romper && fg.meta.romper.out) {
                            this._setOutTime(parseFloat(fg.meta.romper.out));
                        }
                        this._fetchMedia(fg.assets.av_src)
                            .then((mediaUrl) => {
                                let appendedUrl = mediaUrl;
                                if (this._inTime > 0 || this._outTime > 0) {
                                    let mediaFragment = `#t=${this._inTime}`;
                                    if (this._outTime > 0) {
                                        mediaFragment = `${mediaFragment},${this._outTime}`;
                                    }
                                    appendedUrl = `${mediaUrl}${mediaFragment}`;
                                }
                                this._buildAframeVideoScene(appendedUrl);
                            })
                            .catch((err) => {
                                logger.error(err, 'Video not found');
                            });
                    }
                });
        }
    }

    _buildAframeVideoScene(mediaUrl: string) {
        if (this._destroyed) {
            logger.warn('trying to populate video element that has been destroyed');
            return;
        }

        this._playoutEngine.queuePlayout(this._rendererId, {
            url: mediaUrl,
        });

        const videoElements = [];

        // test how we might add other aFrame components specified in DM
        if (this._representation.meta
            && this._representation.meta.romper
            && this._representation.meta.romper.aframe
            && this._representation.meta.romper.aframe.extras) {
            videoElements.push(AFrameRenderer
                .buildAframeComponents(this._representation.meta.romper.aframe.extras));
        }

        this._playoutEngine.getMediaElement(this._rendererId).id = this._videoDivId;
        AFrameRenderer.addAsset(this._playoutEngine.getMediaElement(this._rendererId));

        // get components for video
        // these are the bits that would need to be replaced for each scene
        const monoElements = this._getVideoComponents();
        this._sceneElements = videoElements.concat(monoElements);

        // all done - start playing if start has been called
        // if not, we're ready
        this._rendered = true;
        if (this._started) {
            this._startFlatVideo();
        }
    }

    // return components needed to render flat video in 360
    _getVideoComponents(): Array<HTMLElement> {
        logger.info('360 rendering mono');

        const flatVideo = document.createElement('a-video');
        flatVideo.setAttribute('src', `#${this._videoDivId}`);
        const width = 8;
        flatVideo.setAttribute('width', `${width}`);
        flatVideo.setAttribute('height', `${width * (9 / 16)}`);
        flatVideo.setAttribute('position', '0 1 -5');

        // sky
        const sky = document.createElement('a-sky');
        sky.setAttribute('color', '#6EBAA7');

        return [flatVideo, sky];
    }

    _startFlatVideo() {
        // add elements
        this._sceneElements.forEach(el => AFrameRenderer.addElementToScene(el));

        // make sure AFrame is in romper target
        AFrameRenderer.addAFrameToRenderTarget(this._target, this._player, this._analytics);

        this._player.on(
            PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED,
            this._handlePlayPauseButtonClicked,
        );

        // poll for direction of view, and save as variable
        this._orientationWatcher = setInterval(
            this._setOrientationVariable,
            ORIENTATION_POLL_INTERVAL,
        );

        const cameraContainer = document.getElementById('romper-camera-entity');
        if (cameraContainer) {
            cameraContainer.setAttribute('rotation', '0 0 0');
        }

        // automatically move on at video end
        this._playoutEngine.on(this._rendererId, 'ended', this._endedEventListener);
        this._playoutEngine.on(this._rendererId, 'timeupdate', this._outTimeEventListener);
        this._playoutEngine.setPlayoutActive(this._rendererId);

        AFrameRenderer.setControlBarPosition(0);

        // show aFrame content
        AFrameRenderer.setSceneHidden(false);
    }

    _setOrientationVariable(): void {
        const orientation = AFrameRenderer.getOrientation();
        this._controller.setVariables({
            _aframe_orientation_phi: orientation.phi,
            _aframe_orientation_theta: orientation.theta,
        });

        // and log analytics
        const logData = {
            type: AnalyticEvents.types.USER_ACTION,
            name: AnalyticEvents.names.VR_ORIENTATION_CHANGED,
            from: 'not_set',
            to: `${orientation.phi} ${orientation.theta}`,
        };
        this._analytics(logData);
    }

    _handlePlayPauseButtonClicked(): void {
        this.logUserInteraction(AnalyticEvents.names.PLAY_PAUSE_BUTTON_CLICKED);
        const videoElement = this._playoutEngine.getMediaElement(this._rendererId);
        if (videoElement) {
            if (videoElement.paused === true) {
                this.logRendererAction(AnalyticEvents.names.VIDEO_UNPAUSE);
            } else {
                this.logRendererAction(AnalyticEvents.names.VIDEO_PAUSE);
            }
            AFrameRenderer.togglePlayPause(videoElement.paused);
        }
    }

    getCurrentTime(): Object {
        let videoTime = this._playoutEngine.getCurrentTime(this._rendererId);
        if (videoTime === undefined) {
            videoTime = this._lastSetTime;
        } else {
            // convert to time into segment
            videoTime -= this._inTime;
        }
        const timeObject = {
            timeBased: true,
            currentTime: videoTime,
        };
        return timeObject;
    }

    // set how far into the segment this video should be (relative to in-point)
    setCurrentTime(time: number) {
        this._lastSetTime = time; // time into segment
        // convert to absolute time into video
        this._playoutEngine.setCurrentTime(this._rendererId, time + this._inTime);
    }

    _setInTime(time: number) {
        this._inTime = time;
    }

    _setOutTime(time: number) {
        this._outTime = time;
    }

    switchFrom() {
        this.end();
    }

    switchTo() {
        this.start();
    }

    // eslint-disable-next-line class-methods-use-this
    isVRViewable(): boolean {
        return true;
    }

    end() {
        // put video element back
        this._target.appendChild(this._playoutEngine.getMediaElement(this._rendererId));

        if (this._started) {
            this._player.getLinkChoiceElement().style.visibility = 'visible';
        }

        this._playoutEngine.setPlayoutInactive(this._rendererId);
        this._playoutEngine.off(this._rendererId, 'ended', this._endedEventListener);
        this._playoutEngine.off(this._rendererId, 'timeupdate', this._outTimeEventListener);
        this._player.removeListener(
            PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED,
            this._handlePlayPauseButtonClicked,
        );

        if (this._orientationWatcher) {
            clearInterval(this._orientationWatcher);
        }

        this._started = false;
        this._rendered = false;

        // AFrameRenderer._aFrameSceneElement.exitVR();
    }

    destroy() {
        this._playoutEngine.setPlayoutInactive(this._rendererId);
        this._playoutEngine.off(this._rendererId, 'ended', this._endedEventListener);
        this._playoutEngine.off(this._rendererId, 'timeupdate', this._outTimeEventListener);
        this._player.removeListener(
            PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED,
            this._handlePlayPauseButtonClicked,
        );
        super.destroy();
    }
}
