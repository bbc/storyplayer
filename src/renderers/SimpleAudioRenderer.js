// @flow

import Player, { PlayerEvents } from '../Player';
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import AnalyticEvents from '../AnalyticEvents';
import type { AnalyticsLogger } from '../AnalyticEvents';

import { MEDIA_TYPES } from '../playoutEngines/BasePlayoutEngine';

// import MediaManager from '../MediaManager';
// import MediaInstance from '../MediaInstance';

import logger from '../logger';

export type HTMLTrackElement = HTMLElement & {
    kind: string,
    label: string,
    srclang: string,
    src: string,
    mode: string,
    default: boolean,
}

export default class SimpleAudioRenderer extends BaseRenderer {
    _fetchMedia: MediaFetcher;
    _audioTrack: HTMLTrackElement;
    _handlePlayPauseButtonClicked: Function;

    _lastSetTime: number

    _endedEventListener: Function;

    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        player: Player,
        analytics: AnalyticsLogger,
    ) {
        super(representation, assetCollectionFetcher, fetchMedia, player, analytics);
        this._handlePlayPauseButtonClicked = this._handlePlayPauseButtonClicked.bind(this);

        this._endedEventListener = this._endedEventListener.bind(this);

        this.renderAudioElement();

        this._lastSetTime = 0;

        this._playoutEngine.queuePlayout(this._rendererId, {
            type: MEDIA_TYPES.FOREGROUND_AV,
        });
    }

    _endedEventListener() {
        super.complete();
    }

    start() {
        super.start();
        this._playoutEngine.setPlayoutActive(this._rendererId);

        logger.info(`Started: ${this._representation.id}`);

        this.setCurrentTime(0);

        // automatically move on at audio end
        this._playoutEngine.on(this._rendererId, 'ended', this._endedEventListener);

        const player = this._player;

        player.on(
            PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED,
            this._handlePlayPauseButtonClicked,
        );
    }

    end() {
        this._playoutEngine.setPlayoutInactive(this._rendererId);

        logger.info(`Ended: ${this._representation.id}`);

        this._playoutEngine.off(this._rendererId, 'ended', this._endedEventListener);

        try {
            this._clearBehaviourElements();
        } catch (e) {
            //
        }

        const player = this._player;
        player.removeListener(
            PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED,
            this._handlePlayPauseButtonClicked,
        );
    }

    renderAudioElement() {
        // set audio source
        if (this._representation.asset_collections.foreground_id) {
            this._fetchAssetCollection(this._representation.asset_collections.foreground_id)
                .then((fg) => {
                    if (fg.assets.audio_src) {
                        this._fetchMedia(fg.assets.audio_src)
                            .then((mediaUrl) => {
                                this.populateAudioElement(mediaUrl);
                            })
                            .catch((err) => {
                                logger.error(err, 'audio not found');
                            });
                    }
                    if (fg.assets.sub_src) {
                        this._fetchMedia(fg.assets.sub_src)
                            .then((mediaUrl) => {
                                this.populateAudioSubs(mediaUrl);
                            })
                            .catch((err) => {
                                logger.error(err, 'Subs not found');
                                // this._subtitlesExist = false;
                            });
                    } else {
                        // this._subtitlesExist = false;
                    }
                });
        }
    }

    populateAudioElement(mediaUrl: string) {
        if (this._destroyed) {
            logger.warn('trying to populate audio element that has been destroyed');
        } else {
            this._playoutEngine.queuePlayout(this._rendererId, {
                url: mediaUrl,
            });
        }
    }

    // eslint-disable-next-line
    populateAudioSubs(mediaUrl: string) {
        if (this._destroyed) {
            logger.warn('trying to populate audio element that has been destroyed');
        } else {
            this._playoutEngine.queuePlayout(this._rendererId, {
                subs_url: mediaUrl,
            });
        }
    }

    _handlePlayPauseButtonClicked(): void {
        const audioElement = this._playoutEngine.getMediaElement(this._rendererId);
        if (audioElement) {
            if (audioElement.paused === true) {
                this.logRendererAction(AnalyticEvents.names.VIDEO_UNPAUSE);
            } else {
                this.logRendererAction(AnalyticEvents.names.VIDEO_PAUSE);
            }
        }
    }

    getCurrentTime(): Object {
        let videoTime = this._playoutEngine.getCurrentTime(this._rendererId);
        if (videoTime === undefined) {
            videoTime = this._lastSetTime;
        }
        const timeObject = {
            timeBased: true,
            currentTime: videoTime,
        };
        return timeObject;
    }

    setCurrentTime(time: number) {
        this._lastSetTime = time;
        this._playoutEngine.setCurrentTime(this._rendererId, time);
    }

    switchFrom() {
        this.end();
    }

    switchTo() {
        this.start();
    }

    destroy() {
        this.end();

        this._playoutEngine.unqueuePlayout(this._rendererId);

        super.destroy();
    }
}
