// @flow
import Player from '../gui/Player';
import { RENDERER_PHASES } from './BaseRenderer';
import ThreeJSDriver from './ThreeJSDriver';
import BaseTimedMedialRenderer from './BaseTimedMediaRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';
import { MEDIA_TYPES, SUPPORT_FLAGS } from '../playoutEngines/BasePlayoutEngine';
import logger from '../logger';

export default class ThreeJsVideoRenderer extends BaseTimedMedialRenderer {
    _handlePlayPauseButtonClicked: Function;

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

        this._handlePlayPauseButtonClicked = this._handlePlayPauseButtonClicked.bind(this);

        this._threeJSDriver = new ThreeJSDriver(
            this._controller,
            this._player.mediaTarget,
            this._player.getOverlayElement(),
        );
    }

    async init() {
        try {
            if(!this._playoutEngine.supports(SUPPORT_FLAGS.SUPPORTS_360)) {
                throw new Error("Playout Engine does not support 360")
            }
            await this._queueMedia({ type: MEDIA_TYPES.FOREGROUND_AV }, "av_src")
            this._setPhase(RENDERER_PHASES.CONSTRUCTED);
        }
        catch(e) {
            logger.error(e, 'could not initiate 360 video renderer');
        }
    }

    start() {
        super.start();
        this._setPhase(RENDERER_PHASES.MAIN);
        this._threeJSDriver.init();
        this._startThreeSixtyVideo();
        this._playoutEngine.setPlayoutActive(this._rendererId);
        this._player.enablePlayButton();
        this._player.enableScrubBar();
        this._player.showSeekButtons();
    }

    _startThreeSixtyVideo() {
        const videoElement = this._playoutEngine.getMediaElementFor360(this._rendererId);
        if(videoElement) {
            videoElement.style.visibility = 'hidden';
        }
        const videoMesh = ThreeJSDriver.loadVideo(videoElement);
        this._threeJSDriver.addToScene(videoMesh);
    }

    switchFrom() {
        this._playoutEngine.setPlayoutInactive(this._rendererId);
    }

    switchTo() {
        this._playoutEngine.setPlayoutActive(this._rendererId);
    }

    end() {
        const needToEnd = super.end();
        if (needToEnd) {
            this._threeJSDriver.destroy();
            this._setPhase(RENDERER_PHASES.ENDED);
        }
        return needToEnd;
    }
}
