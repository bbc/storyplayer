import Player from "../gui/Player"
import BackgroundRenderer from "./BackgroundRenderer"
import {RENDERER_PHASES} from "./BaseRenderer"
import { AssetCollection, MediaFetcher } from "../types"
import {MediaFormats} from "../browserCapabilities"
import {MEDIA_TYPES} from "../playoutEngines/BasePlayoutEngine"
import logger from "../logger"
import {AUDIO, LOOPING_AUDIO_AC_TYPE} from "../utils"
import SMPPlayoutEngine from "../playoutEngines/SMPPlayoutEngine"
import iOSPlayoutEngine from "../playoutEngines/iOSPlayoutEngine"
const FADE_IN_TIME = 2000 // fade in time for audio in ms

const HARD_FADE_OUT_TIME = 500 // fade out in ms - will overrun into next NE

const FADE_STEP_LENGTH = 20 // time between steps for fades

export default class BackgroundAudioRenderer extends BackgroundRenderer {
    _target: HTMLDivElement
    _volFadeInterval: ReturnType<typeof setInterval> | null | undefined
    // fade in interval
    _fadeIntervalId: ReturnType<typeof setInterval> | null | undefined
    // fade out interval
    _fadePaused: boolean
    _fadedOut: boolean

    constructor(
        assetCollection: AssetCollection,
        mediaFetcher: MediaFetcher,
        player: Player,
    ) {
        super(assetCollection, mediaFetcher, player)
        this._target = this._player.backgroundTarget
    }

    async init() {
        await this._renderBackgroundAudio()

        this._setPhase(RENDERER_PHASES.CONSTRUCTED)
    }

    start() {
        const readyToStart = super.start()
        if (!readyToStart || this.phase === RENDERER_PHASES.BG_FADE_IN)
            return false

        this._setPhase(RENDERER_PHASES.BG_FADE_IN)

        this._fadePaused = false

        if (!this._playoutEngine.getPlayoutActive(this._rendererId)) {
            this._playoutEngine.setPlayoutActive(this._rendererId)

            logger.info(
                `Starting new background audio ${this._getDescriptionString()}`,
            )
        } else {
            logger.info(
                `Continuing background audio ${this._getDescriptionString()}`,
            )
        }

        if (
            this._assetCollection &&
            this._assetCollection.asset_collection_type ===
                LOOPING_AUDIO_AC_TYPE
        ) {
            this._playoutEngine.setLoopAttribute(this._rendererId, true)
        }

        this._playoutEngine.setVolume(this._rendererId, 0)

        this._volFadeInterval = setInterval(() => {
            const volume = this._playoutEngine.getVolume(this._rendererId)

            if (
                volume >= 1 - FADE_STEP_LENGTH / FADE_IN_TIME &&
                this._volFadeInterval
            ) {
                clearInterval(this._volFadeInterval)
                this._volFadeInterval = null

                this._setPhase(RENDERER_PHASES.MAIN)
            } else if (!this._fadePaused) {
                const newVolume = volume + FADE_STEP_LENGTH / FADE_IN_TIME

                this._playoutEngine.setVolume(this._rendererId, newVolume)
            }
        }, FADE_STEP_LENGTH)
        return true
    }

    _getDescriptionString(): string {
        return this._assetCollection.name
    }

    end(): boolean {
        const shouldEnd = super.end()
        if (!shouldEnd || this.phase === RENDERER_PHASES.BG_FADE_OUT)
            return false

        this._setPhase(RENDERER_PHASES.BG_FADE_OUT)

        this._player.removeVolumeControl(this._rendererId)

        this.fadeOut(HARD_FADE_OUT_TIME / 1000)
        return true
    }

    cancelFade() {
        if (this._fadeIntervalId) {
            clearInterval(this._fadeIntervalId)
            this._fadeIntervalId = null
        }
    }

    pauseFade() {
        this._fadePaused = true
    }

    resumeFade() {
        this._fadePaused = false
    }

    iosHardFade() {
        this._playoutEngine.removeBackgrounds(this._rendererId)
    }

    needsHardFade() {
        return (
            this._playoutEngine instanceof SMPPlayoutEngine &&
            this._playoutEngine._secondaryPlayoutEngine &&
            this._playoutEngine._secondaryPlayoutEngine instanceof
                iOSPlayoutEngine
        )
    }

    // start fading out the volume, over given duration (seconds)
    fadeOut(duration: number) {
        logger.info(
            `Fading out background audio ${this._getDescriptionString()}`,
        )

        // if we're on ios and using SMP then we have to clear the background
        if (this.needsHardFade()) {
            this.iosHardFade()
            return
        }

        // clear fade in
        if (this._volFadeInterval) {
            clearInterval(this._volFadeInterval)
            this._volFadeInterval = null
        }

        if (!this._fadeIntervalId) {
            const interval = (duration * 1000) / FADE_STEP_LENGTH // number of steps

            this._fadeIntervalId = setInterval(() => {
                const volume = this._playoutEngine.getVolume(this._rendererId)

                if (
                    volume >= 1 / interval &&
                    this._fadeIntervalId &&
                    this.phase === RENDERER_PHASES.BG_FADE_OUT
                ) {
                    if (!this._fadePaused) {
                        const newVolume = volume - 1 / interval

                        this._playoutEngine.setVolume(
                            this._rendererId,
                            newVolume,
                        )
                    }
                } else if (this._fadeIntervalId) {
                    this._playoutEngine.setVolume(this._rendererId, 0)

                    clearInterval(this._fadeIntervalId)
                    this._fadeIntervalId = null

                    this._playoutEngine.setPlayoutInactive(this._rendererId)

                    this._setPhase(RENDERER_PHASES.ENDED)
                }
            }, FADE_STEP_LENGTH)
        }
    }

    async _renderBackgroundAudio() {
        if (this._assetCollection && this._assetCollection.assets.audio_src) {
            const { url: mediaUrl } = await this._fetchMedia(
                this._assetCollection.assets.audio_src,
                {
                    mediaFormat: MediaFormats.getFormat(),
                    mediaType: AUDIO,
                    returnPid: false,
                    includeCredentials: true,
                },
            )

            if (this.phase !== RENDERER_PHASES.CONSTRUCTING) {
                logger.warn(
                    "trying to populate audio element that has been destroyed",
                )
            } else {
                this._playoutEngine.queuePlayout(this._rendererId, {
                    id: this._assetCollection.id,
                    type: MEDIA_TYPES.BACKGROUND_A,
                    url: mediaUrl,
                    loop: this._assetCollection.loop,
                })
            }
        }
    }

    destroy(): boolean {
        // this will start end (if not already done) and move to BG_FADE_OUT or ENDED phase
        const shouldDestroy = super.destroy()
        if (!shouldDestroy) return false

        // if ended already, just destroy
        if (this.phase === RENDERER_PHASES.ENDED) {
            this._playoutEngine.unqueuePlayout(this._rendererId)
        } else {
            // allow time for end fade to take place
            setTimeout(() => {
                this._playoutEngine.unqueuePlayout(this._rendererId)

                this._setPhase(RENDERER_PHASES.DESTROYED)
            }, HARD_FADE_OUT_TIME)
        }

        return true
    }
}
