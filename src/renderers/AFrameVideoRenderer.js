// @flow
import AFRAME from 'aframe';

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

export default class AFrameVideoRenderer extends BaseRenderer {
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

        this._ambisonic = '';
        this._initialRotation = '0 0 0';
        this._videoTypeString = '360_mono';

        // this is what we refer to
        this._videoDivId = `threesixtyvideo-${this._rendererId}`;

        this._rendered = false;

        this._collectElementsToRender();
    }

    _endedEventListener() {
        logger.info('360 video ended');
        if (!this._hasEnded) {
            this._hasEnded = true;
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
            this._startThreeSixtyVideo();
        } else {
            this._collectElementsToRender();
        }
        this.setCurrentTime(this._lastSetTime);
        this._hasEnded = false;
        this._started = true;
    }

    _collectElementsToRender() {
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
                        if (fg.assets.video_format) {
                            // mono/stereo, vertical/horizontal split
                            this._videoTypeString = fg.assets.video_format;
                        }
                        if (fg.meta && fg.meta.romper && fg.meta.romper.rotation) {
                            // starting rotation
                            this._initialRotation = fg.meta.romper.rotation;
                        }
                        if (fg.assets.audio_format) {
                            this._ambisonic = fg.assets.audio_format;
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

        // identify video type and set parameters
        // now build bits specific for video/type
        const videoType = { // defaults
            coverage: 'full',
            stereo: false,
            split: 'horizontal',
            mode: 'full',
        };

        if (this._ambisonic !== '') {
            logger.info(`${this._ambisonic} ambisonic audio`);
            const audio = document.createElement('a-entity');
            audio.setAttribute('src', this._videoDivId);
            audio.setAttribute('ambiOrder', this._ambisonic);
            audio.setAttribute('spatialaudio', '');
            videoElements.push(audio);
        }

        // parse video type from string
        if (this._videoTypeString.includes('180')) videoType.coverage = 'half';
        if (this._videoTypeString.includes('STEREO')) videoType.stereo = true;
        if (this._videoTypeString.includes('VERTICAL')) videoType.split = 'vertical';

        // get components for video depending on type
        // these are the bits that would need to be replaced for each scene
        if (videoType.stereo) {
            const stereoElements = this._getStereoComponents(videoType);
            this._sceneElements = videoElements.concat(stereoElements);
        } else {
            const monoElements = this._getMonoComponents();
            this._sceneElements = videoElements.concat(monoElements);
        }

        // all done - start playing if start has been called
        // if not, we're ready
        this._rendered = true;
        if (this._started) {
            this._startThreeSixtyVideo();
        }
    }

    // return components needed to render mono 360 video
    _getMonoComponents(): Array<HTMLElement> {
        logger.info('360 rendering mono');
        const sphereMono = document.createElement('a-entity');
        sphereMono.setAttribute('class', 'videospheres');
        sphereMono.setAttribute(
            'geometry',
            'primitive:sphere; radius:100; segmentsWidth: 64; segmentsHeight:64',
        );
        sphereMono.setAttribute('scale', '-1 1 1');
        AFRAME.utils.entity.setComponentProperty(sphereMono, 'material', {
            shader: 'flat',
            src: `#${this._videoDivId}`,
            side: 'back',
        });
        return [sphereMono];
    }

    // return components needed to render stereo 360 video
    _getStereoComponents(videoType: Object): Array<HTMLElement> {
        logger.info('360 rendering stereo');

        const sphereL = document.createElement('a-entity');
        sphereL.setAttribute('class', 'videospheres');
        sphereL.setAttribute(
            'geometry',
            'primitive:sphere; radius:100; segmentsWidth: 64; segmentsHeight:64',
        );
        AFRAME.utils.entity.setComponentProperty(sphereL, 'material', {
            shader: 'flat',
            src: `#${this._videoDivId}`,
            side: 'back',
        });
        sphereL.setAttribute('scale', '-1 1 1');

        // Sync rotation with 'camera landing rotation'
        AFRAME.utils.entity.setComponentProperty(sphereL, 'rotation', { x: 0, y: 0, z: 0 });
        AFRAME.utils.entity.setComponentProperty(
            sphereL,
            'stereo',
            { eye: 'left', mode: videoType.mode, split: videoType.split },
        );

        const sphereR = document.createElement('a-entity');
        sphereR.setAttribute('class', 'videospheres');
        sphereR.setAttribute(
            'geometry',
            'primitive:sphere; radius:100; segmentsWidth: 64; segmentsHeight:64',
        );
        AFRAME.utils.entity.setComponentProperty(sphereR, 'material', {
            shader: 'flat',
            src: `#${this._videoDivId}`,
            side: 'back',
        });
        sphereR.setAttribute('scale', '-1 1 1');

        AFRAME.utils.entity.setComponentProperty(
            sphereR,
            'stereo',
            { eye: 'right', mode: videoType.mode, split: videoType.split },
        );

        return [sphereL, sphereR];
    }

    _startThreeSixtyVideo() {
        // add elements
        this._sceneElements.forEach(el => AFrameRenderer.addElementToScene(el));

        // make sure AFrame is in romper target
        AFrameRenderer.addAFrameToRenderTarget(this._target, this._analytics);

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
            cameraContainer.setAttribute('rotation', this._initialRotation);
        }

        // place the control bar to match initial rotation
        const angles = this._initialRotation.split(' ');
        AFrameRenderer.setControlBarPosition(-parseInt(angles[1], 10));

        // automatically move on at video end
        this._playoutEngine.on(this._rendererId, 'ended', this._endedEventListener);
        this._playoutEngine.on(this._rendererId, 'timeupdate', this._outTimeEventListener);
        this._playoutEngine.setPlayoutActive(this._rendererId);

        // show aFrame content
        AFrameRenderer.setSceneHidden(false);
    }

    _setOrientationVariable(): void {
        const orientation = AFrameRenderer.getOrientation();
        this._controller.setVariables({
            romper_aframe_orientation_phi: orientation.phi,
            romper_aframe_orientation_theta: orientation.theta,
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
