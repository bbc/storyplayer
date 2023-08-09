import * as THREE from "three"
import Player from "../gui/Player"
import ThreeJSDriver from "./ThreeJSDriver"
import BaseTimedIntervalRenderer from "./BaseTimedIntervalRenderer"
import {
    Representation,
    AssetCollectionFetcher,
    MediaFetcher,
} from "../types"
import type {AnalyticsLogger} from "../AnalyticEvents"
import Controller from "../Controller"
import logger from "../logger"
import {RENDERER_PHASES} from "./BaseRenderer"
export default class ThreeJsImageRenderer extends BaseTimedIntervalRenderer {
    _fetchMedia: MediaFetcher
    _duration: number
    _imageMesh: THREE.Mesh
    _disablePlayButton: () => void
    _enablePlayButton: () => void
    _disableScrubBar: () => void
    _enableScrubBar: () => void
    _threeJSDriver: ThreeJSDriver

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
        )

        this._disablePlayButton = () => {
            this._player.disablePlayButton()
        }

        this._enablePlayButton = () => {
            this._player.enablePlayButton()
        }

        this._disableScrubBar = () => {
            this._player.disableScrubBar()
        }

        this._enableScrubBar = () => {
            this._player.enableScrubBar()
        }

        this._threeJSDriver = new ThreeJSDriver(
            this._controller,
            this._player.mediaTarget,
            this._player.getOverlayElement(),
        )
    }

    async init() {
        try {
            await this._preloadImage()
            await this._preloadBehaviourAssets()

            this._setPhase(RENDERER_PHASES.CONSTRUCTED)
        } catch (e) {
            logger.error(e, "Could not construct 360 image renderer")
        }
    }

    start() {
        const ready = super.start()
        if (!ready) return false
        const duration = this.getDuration()

        this._playoutEngine.startNonAVPlayout(this._rendererId, duration)

        this._threeJSDriver.init()

        this._threeJSDriver.addToScene(this._imageMesh)

        if (duration === Infinity) {
            logger.info(
                `360 image representation ${this._representation.id} persistent`,
            )

            this._disablePlayButton()

            this._disableScrubBar()

            this._setPhase(RENDERER_PHASES.MEDIA_FINISHED)
        } else if (duration === 0) {
            logger.warn(
                `360 image representation ${this._representation.id} has zero duration`,
            )
            this.complete()
        } else {
            // eslint-disable-next-line max-len
            logger.info(
                `360 image representation ${this._representation.id} timed for ${duration}s, starting now`,
            )

            this._player.showSeekButtons()

            this._enableScrubBar()

            this.addTimeEventListener(
                `${this._rendererId}-complete`,
                duration,
                () => {
                    // eslint-disable-next-line max-len
                    logger.info(
                        `360 image representation ${this._representation.id} completed time`,
                    )
                    this.complete()
                },
            )
        }

        return true
    }

    end() {
        const needToEnd = super.end()

        if (needToEnd) {
            this._threeJSDriver.destroy()

            this._setPhase(RENDERER_PHASES.ENDED)
        }

        return needToEnd
    }

    async _preloadImage() {
        // set image source
        if (this._representation.asset_collections.foreground_id) {
            const fg = await this._fetchAssetCollection(
                this._representation.asset_collections.foreground_id,
            )

            if (fg.assets.image_src) {
                try {
                    const { url: mediaUrl } = await this._fetchMedia(
                        fg.assets.image_src,
                        {
                            includeCredentials: true,
                        },
                    )
                    this._imageMesh = ThreeJSDriver.loadImage(mediaUrl)
                } catch (err) {
                    throw new Error(
                        "Could not resolve media source for 360 image",
                    )
                }
            } else {
                throw new Error(
                    "No image source for 360 image asset collectoin",
                )
            }
        }
    }
}
