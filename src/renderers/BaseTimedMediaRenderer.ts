import BaseRenderer, {RENDERER_PHASES} from "./BaseRenderer"
import logger from "../logger"
import {MediaFormats} from "../browserCapabilities"
import {MEDIA_TYPES} from "../playoutEngines/BasePlayoutEngine"
import {VIDEO, AUDIO} from "../utils"
import iOSPlayoutEngine from "../playoutEngines/iOSPlayoutEngine"
const FADE_IN_TIME = 2000 // default fade in time for audio in ms (if not specced in behaviour)

const FADE_STEP_LENGTH = 20 // time between steps for fades

const FADE_AUDIO_IN =
    "urn:x-object-based-media:representation-behaviour:fadeaudioin/v1.0"
const FADE_AUDIO_OUT =
    "urn:x-object-based-media:representation-behaviour:fadeaudioout/v1.0"
const FADE_IN = "urn:x-object-based-media:representation-behaviour:fadein/v1.0"
const FADE_OUT =
    "urn:x-object-based-media:representation-behaviour:fadeout/v1.0"
export default class BaseTimedMediaRenderer extends BaseRenderer {

    _inTime: number
    _outTime: number
    _latchedMediaTime: number
    _accumulatedMediaTime: number
    _stalledMediaTime: number
    _inspectMediaPlaybackTime: number
    _shouldShowScrubBar: boolean
    _inspectMediaPlaybackInterval: ReturnType<typeof setInterval>
    _audioFadeInterval: ReturnType<typeof setInterval>
    _visualFadeInterval: ReturnType<typeof setInterval>

    constructor(
        representation,
        assetCollectionFetcher,
        fetchMedia,
        player,
        analytics,
        controller,
    ) {
        super(
            representation,
            assetCollectionFetcher,
            fetchMedia,
            player,
            analytics,
            controller,
        )
        this._inTime = 0
        this._outTime = undefined
        // During loading (intial load or chunk load after a seek) the player
        // reports underfined as it's current time. We latch the previous
        // returned currentTime and return that rather than undefined.
        this._latchedMediaTime = undefined
        this._accumulatedMediaTime = 0
        this._stalledMediaTime = 0
        this._inspectMediaPlaybackTime = 10
        this._inspectMediaPlayback = this._inspectMediaPlayback.bind(this)
        this._shouldShowScrubBar = true
    }

    getIsLooping() {
        return this._playoutEngine.checkIsLooping(this._rendererId)
    }

    getDuration() {
        let duration = super.getDuration()

        if (duration === Infinity) {
            if (this._outTime >= 0) {
                duration = this._outTime
            } else if (!this.getIsLooping()) {
                duration =
                    this._playoutEngine.getDuration(this._rendererId) ??
                    duration
            }

            duration -= this._inTime
        }

        return duration
    }

    getCurrentTime() {
        const duration = this.getDuration()
        const currentTime = this.getIsLooping()
            ? this._accumulatedMediaTime
            : this._latchedMediaTime - this._inTime
        return {
            duration,
            currentTime,
            timeBased: duration !== Infinity,
            remainingTime: duration - currentTime,
        }
    }

    setCurrentTime(time) {
        // Calculate bounded time w.r.t. what was requested.
        const {duration} = this.getCurrentTime()
        // Duration of an HTMLMediaElement is not always reported accurately;
        // and if we seek past the actual duration, behaviour is undefined, so
        // instead seek to the duration minus guard time.
        let targetTime = time
        targetTime = Math.min(targetTime, duration - 0.01)
        targetTime = Math.max(0, targetTime)
        const choiceTime = this.getChoiceTime()

        if (choiceTime >= 0 && choiceTime < targetTime) {
            targetTime = choiceTime
        }

        // Account for trimmed video.
        targetTime += this._inTime

        // Ensure that targetTime is valid.
        if (targetTime === Infinity || Number.isNaN(targetTime)) {
            logger.warn(`Ignoring setCurrentTime (${time} for ${targetTime}).`)
            return
        }

        this._playoutEngine.setCurrentTime(this._rendererId, targetTime)
    }

    _inspectMediaPlayback() {
        const duration = this.getDuration()
        const isLooping = this.getIsLooping()

        const isPlaying = this._playoutEngine.isPlaying()

        const oldTime = this._latchedMediaTime
        this._latchedMediaTime =
            this._playoutEngine.getCurrentTime(this._rendererId) ??
            this._latchedMediaTime
        const diffTime = this._latchedMediaTime - oldTime
        if (diffTime > 0) this._accumulatedMediaTime += diffTime

        // Transcoded media _may_ cause stalls close to the reported end of the
        // media. No ended value is set on the media element. The only way to
        // detect this is to check if the media element play head is not moving
        // while the playout engine believes it is.
        const mediaDuration = this._playoutEngine.getDuration(this._rendererId)

        if (
            this._latchedMediaTime > mediaDuration - 1 &&
            diffTime === 0 &&
            isPlaying
        ) {
            this._stalledMediaTime += this._inspectMediaPlaybackTime / 1000
        } else {
            this._stalledMediaTime = 0
        }

        const isEnded =
            this._playoutEngine.checkIsEnded(this._rendererId) ||
            this._latchedMediaTime > this._outTime ||
            this._stalledMediaTime > 2

        if (isLooping && isEnded) {
            this.setCurrentTime(0)
            this.play()
        }

        if (
            ((!isLooping && isEnded) ||
                (isLooping && this._accumulatedMediaTime >= duration)) &&
            !this.inVariablePanel // wait until variable panel completed
        ) {
            // Some players fallback to first frame--force showing ending frame.
            this._playoutEngine.setCurrentTime(this._rendererId, duration - 0.1)

            // Seeking past end on some players will cause end to trigger even
            // when paused. Cycle Play-Pause for consistent player state.
            if (!isPlaying) {
                this._playoutEngine.play()

                this._playoutEngine.pause()
            } else {
                clearInterval(this._inspectMediaPlaybackInterval)

                this._setPhase(RENDERER_PHASES.MEDIA_FINISHED)

                super.complete()
            }
        }
    }

    async _queueMedia(mediaObjOverride, assetKey) {
        if (this._representation.asset_collections.foreground_id) {
            const fg = await this._fetchAssetCollection(
                this._representation.asset_collections.foreground_id,
            )

            this._testShowScrubBar(fg)

            if (fg.meta && fg.meta.romper && fg.meta.romper.in) {
                this._inTime = parseFloat(fg.meta.romper.in)
            }

            if (fg.meta && fg.meta.romper && fg.meta.romper.out) {
                this._outTime = parseFloat(fg.meta.romper.out)
            }

            if (fg.assets[assetKey]) {
                const mediaObj = {
                    type: undefined,
                    loop: fg.loop,
                    id: fg.id,
                    inTime: this._inTime,
                    outTime: this._outTime,
                    ...mediaObjOverride,
                }
                let mediaType

                switch (mediaObj.type) {
                    case MEDIA_TYPES.FOREGROUND_AV:
                        mediaType = VIDEO
                        break

                    case MEDIA_TYPES.FOREGROUND_A:
                        mediaType = AUDIO
                        break

                    default:
                        throw new Error("Invalid MDIA_TYPE")
                }

                const options = {
                    mediaFormat: MediaFormats.getFormat(),
                    mediaType,
                    includeCredentials: true,
                }
                const { url : mediaUrl, subsUrl } = await this._fetchMedia(
                    fg.assets[assetKey],
                    options,
                );

                if (subsUrl) {
                    mediaObj.subs_url = subsUrl
                }

                if (this._destroyed) {
                    logger.warn(
                        "trying to populate video element that has been destroyed",
                    )
                } else {
                    mediaObj.url = mediaUrl
                    await this._playoutEngine.queuePlayout(
                        this._rendererId,
                        mediaObj,
                    )
                }
            } else {
                throw new Error("No av source for video")
            }
        } else {
            throw new Error("No foreground asset id for video")
        }
    }

    // given the forground asset collection, determine whether or not
    // scrub bar should be shown
    _testShowScrubBar(foregroundAssetCollection) {
        if (!foregroundAssetCollection.loop) {
            // non-looping - enable
            this._shouldShowScrubBar = true
        } else if (
            this._representation.duration &&
            this._representation.duration > 0
        ) {
            // looping but with duration - enable
            this._shouldShowScrubBar = true
        } else {
            // looping with no duration - disable
            this._shouldShowScrubBar = false
        }
    }

    _applyFadeAudioOutBehaviour(behaviour, callback) {
        const {duration} = behaviour
        logger.info(
            `fading out audio for ${this._rendererId} over ${duration}s`,
        )

        this._setupAudioFade()

        callback()
    }

    _applyFadeAudioInBehaviour(behaviour, callback) {
        const {duration} = behaviour
        logger.info(`fading in audio for ${this._rendererId} over ${duration}s`)

        this._setupAudioFade()

        callback()
    }

    // setup a fade monitor, if there isn't one already
    _setupAudioFade() {
        // if we're on ios and using SMP then we have to clear the background
        if (this._playoutEngine instanceof iOSPlayoutEngine) {
            logger.warn(`cannot fade`)
            return
        }

        logger.info(`Fading foreground audio for renderer ${this._rendererId}`)
        if (this._audioFadeInterval) return
        logger.info("Initiating audio fade listener")
        this._audioFadeInterval = setInterval(
            () => this._calculateAudioFadeStatus(),
            FADE_STEP_LENGTH,
        )
    }

    _calculateAudioFadeStatus() {
        const {currentTime} = this.getCurrentTime()

        const currentVolume = this._playoutEngine.getVolume(this._rendererId)

        const currentFadeBehaviour = this._representation.behaviours?.during
            .filter(b => {
                return (
                    b.behaviour.type === FADE_AUDIO_OUT ||
                    b.behaviour.type === FADE_AUDIO_IN
                )
            })
            .find(b => {
                const duration = b.behaviour.duration || FADE_IN_TIME
                return (
                    currentTime > b.start_time &&
                    currentTime < b.start_time + duration
                )
            })
        const previousFadeBehaviours = this._representation.behaviours?.during
            .filter(b => {
                return (
                    b.behaviour.type === FADE_AUDIO_OUT ||
                    b.behaviour.type === FADE_AUDIO_IN
                )
            })
            .filter(b => currentTime > b.start_time)
            .sort((a, b) => b.start_time - a.start_time)
        const lastFadeBehaviour = previousFadeBehaviours[0]

        if (!currentFadeBehaviour) {
            let desiredVolume

            if (lastFadeBehaviour?.behaviour.type === FADE_AUDIO_OUT) {
                desiredVolume = lastFadeBehaviour.behaviour.targetVolume
            } else {
                desiredVolume = this._player.userSetForegroundVolume
            }

            if (currentVolume !== desiredVolume) {
                this._playoutEngine.setVolume(this._rendererId, desiredVolume)
            }

            return
        }

        const {type, duration} = currentFadeBehaviour.behaviour
        const proportion =
            (currentTime - currentFadeBehaviour.start_time) / duration

        if (type === FADE_AUDIO_IN) {
            const {startVolume} = currentFadeBehaviour.behaviour
            const volume =
                startVolume +
                proportion *
                    (this._player.userSetForegroundVolume - startVolume)

            this._playoutEngine.setVolume(this._rendererId, volume)
        }

        if (type === FADE_AUDIO_OUT) {
            const {targetVolume} = currentFadeBehaviour.behaviour
            const volume =
                this._player.userSetForegroundVolume -
                proportion *
                    (this._player.userSetForegroundVolume - targetVolume)

            this._playoutEngine.setVolume(this._rendererId, volume)
        }
    }

    _applyFadeInBehaviour(behaviour, callback) {
        const overlayImageElement = this._createFadeOverlay(behaviour)

        overlayImageElement.style.opacity = '1'

        this._setupVisualFade()

        callback()
    }

    _applyFadeOutBehaviour(behaviour, callback) {
        const overlayImageElement = this._createFadeOverlay(behaviour)

        overlayImageElement.style.opacity = '0'

        this._setupVisualFade()

        callback()
    }

    // setup a fade monitor, if there isn't one already
    _setupVisualFade() {
        logger.info(`Fading colour for renderer ${this._rendererId}`)
        if (this._visualFadeInterval) return
        logger.info("Initiating colour fade listener")
        this._visualFadeInterval = setInterval(
            () => this._calculateVisualFadeStatus(),
            FADE_STEP_LENGTH,
        )
    }

    _calculateVisualFadeStatus() {
        const {currentTime} = this.getCurrentTime()
        const currentFadeBehaviours = this._representation.behaviours?.during
            .filter(b => {
                return (
                    b.behaviour.type === FADE_OUT ||
                    b.behaviour.type === FADE_IN
                )
            })
            .filter(b => {
                const duration = b.behaviour.duration || FADE_IN_TIME
                return (
                    currentTime > b.start_time &&
                    currentTime < b.start_time + duration
                )
            })
        currentFadeBehaviours.forEach(b => {
            const {id, duration, type} = b.behaviour
            const proportion = (currentTime - b.start_time) / duration
            const element = document.getElementById(id)

            if (type === FADE_IN) {
                element.style.opacity = `1 - ${proportion}`
            }

            if (type === FADE_OUT) {
                element.style.opacity = `${proportion}`
            }
        })
        const previousFadeBehaviours = this._representation.behaviours?.during
            .filter(b => {
                return (
                    b.behaviour.type === FADE_OUT ||
                    b.behaviour.type === FADE_IN
                )
            })
            .filter(b => {
                const duration = b.behaviour.duration || FADE_IN_TIME
                return currentTime > b.start_time + duration
            })
        previousFadeBehaviours.forEach(b => {
            const {id, type} = b.behaviour
            const element = document.getElementById(id)

            if (type === FADE_IN) {
                element.style.opacity = '0'
            }

            if (type === FADE_OUT) {
                element.style.opacity = '1'
            }
        })
    }

    start() {
        const ready = super.start()
        if (!ready) return false

        this._playoutEngine.setPlayoutActive(this._rendererId)

        clearInterval(this._inspectMediaPlaybackInterval)
        this._inspectMediaPlaybackInterval = setInterval(
            this._inspectMediaPlayback,
            this._inspectMediaPlaybackTime,
        )
        logger.info(`Started: ${this._representation.id}`)

        // // set time to last set time (relative to click start)
        this._player.enablePlayButton()

        this._player.showSeekButtons()

        // show/hide scrub bar
        if (this._shouldShowScrubBar) {
            this._player.enableScrubBar()
        } else {
            this._player.disableScrubBar()
        }

        return true
    }

    play() {
        this._playoutEngine.play()
    }

    pause() {
        this._playoutEngine.pause()
    }

    end() {
        const needToEnd = super.end()
        if (!needToEnd) return false

        if (this._audioFadeInterval) {
            clearInterval(this._audioFadeInterval)
            this._audioFadeInterval = undefined
        }

        if (this._visualFadeInterval) {
            clearInterval(this._visualFadeInterval)
            this._visualFadeInterval = undefined
        }

        clearInterval(this._inspectMediaPlaybackInterval)
        this._latchedMediaTime = undefined
        this._accumulatedMediaTime = 0
        this._stalledMediaTime = 0
        this.setCurrentTime(0)

        this._playoutEngine.setVolume(
            this._rendererId,
            this._player.userSetForegroundVolume,
        )

        logger.info(`Ended: ${this._representation.id}`)

        this._playoutEngine.setPlayoutInactive(this._rendererId)

        return true
    }

    destroy() {
        const needToDestroy = super.destroy()

        if (needToDestroy) {
            this._playoutEngine.unqueuePlayout(this._rendererId)
        }

        return needToDestroy
    }
}
