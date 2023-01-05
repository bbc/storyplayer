/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */

import Player from "../gui/Player"
import {isDebug} from "../logger"
export const MEDIA_TYPES = {
    FOREGROUND_AV: "foreground_av",
    FOREGROUND_A: "foreground_a",
    BACKGROUND_A: "background_a",
}
export const SUPPORT_FLAGS = {
    SUPPORTS_360: "supports_360",
}
export default class BasePlayoutEngine {
    _player: Player
    _media: Record<string, any>
    _permissionToPlay: boolean
    _hasStarted: boolean
    _isHandlingNonAV: boolean

    constructor(player: Player) {
        this._player = player
        this._media = {}
        this._permissionToPlay = false
        this._hasStarted = false
        this._isHandlingNonAV = false

        if (isDebug()) {
            // @ts-ignore
            window.playoutMedia = this._media
            // @ts-ignore
            window.playout = this
        }
    }

    supports(feature) {
        switch (feature) {
            case SUPPORT_FLAGS.SUPPORTS_360:
                return false

            default:
                return false
        }
    }

    setPermissionToPlay(value: boolean, startNow?: boolean) {
        this._permissionToPlay = value
    }

    resetPlayoutEngine() {}

    queuePlayout(rendererId: string, mediaObj: Record<string, any>) {
        if (!this._media[rendererId]) {
            this._media[rendererId] = {
                active: false,
            }
        }

        if (this._media[rendererId].media) {
            this._media[rendererId].media = Object.assign(
                this._media[rendererId].media,
                mediaObj,
            )
        } else {
            this._media[rendererId].media = mediaObj
        }
    }

    unqueuePlayout(rendererId: string) {
        if (this._media[rendererId]) {
            delete this._media[rendererId]
        }
    }

    setPlayoutVisible(rendererId: string) {
        const rendererPlayoutObj = this._media[rendererId]

        if (rendererPlayoutObj) {
            const mediaElement = this._getMediaElement(rendererId)

            if (mediaElement) {
                mediaElement.classList.remove("romper-media-element-queued")
            }
        }
    }

    getPlayoutActive(rendererId: string): boolean {
        if (this._media[rendererId]) {
            return this._media[rendererId].active
        }

        return false
    }

    setPlayoutActive(rendererId: string) {
        if (this._media[rendererId]) {
            this._media[rendererId].active = true
        }

        const isLooping = this._media[rendererId].media.loop === true
        this.setLoopAttribute(rendererId, isLooping)

        if (this._media[rendererId].media.type === MEDIA_TYPES.FOREGROUND_A) {
            const mediaElement = this._getMediaElement(rendererId)

            if (mediaElement) {
                mediaElement.classList.add("romper-audio-element")
            }
        }
    }

    setPlayoutInactive(rendererId: string) {
        if (this._media[rendererId]) {
            this._media[rendererId].active = false
        }

        this.setLoopAttribute(rendererId, false)

        if (this._media[rendererId].media.type === MEDIA_TYPES.FOREGROUND_A) {
            const mediaElement = this._getMediaElement(rendererId)

            if (mediaElement) {
                mediaElement.classList.remove("romper-audio-element")
            }
        }
    }

    startNonAVPlayout(rendererId?: string, duration?: number) {
        this._isHandlingNonAV = true
    }

    stopNonAVPlayout(rendererId?: string) {
        this._isHandlingNonAV = false
    }

    isPlayingNonAV() {
        return this._isHandlingNonAV
    }

    play() {}

    pause() {}

    isPlaying(): boolean {
        return false
    }

    hasStarted(): boolean {
        return this._hasStarted
    }

    pauseBackgrounds() {}

    removeBackgrounds(rendererId: string) {}

    playBackgrounds() {}

    playRenderer(rendererId: string) {}

    pauseRenderer(rendererId: string) {}

    getCurrentTime(rendererId: string) {
        const mediaElement = this._getMediaElement(rendererId)

        if (
            !mediaElement ||
            mediaElement.readyState < mediaElement.HAVE_CURRENT_DATA
        ) {
            return undefined
        }

        return mediaElement.currentTime
    }

    getDuration(rendererId: string) {
        const mediaElement = this._getMediaElement(rendererId)

        if (
            !mediaElement ||
            mediaElement.readyState < mediaElement.HAVE_CURRENT_DATA
        ) {
            return undefined
        }

        return mediaElement.duration
    }

    setCurrentTime(rendererId: string, time: number) {
        return false
    }

    on(
        rendererId: string,
        event: string,
        callback: (...args: Array<any>) => any,
    ) {
        throw new Error("on method should be overriden")
    }

    off(
        rendererId: string,
        event: string,
        callback: (...args: Array<any>) => any,
    ) {
        throw new Error("off method should be overriden")
    }

    _getMediaElement(rendererId: string): HTMLMediaElement | null | undefined {
        throw new Error("getMediaElement method should be overriden")
    }

    getMediaElementFor360(
        rendererId: string,
    ): HTMLMediaElement | null | undefined {
        return this._getMediaElement(rendererId)
    }

    setLoopAttribute(rendererId: string, loop: boolean | null | undefined) {
        const mediaElement = this._getMediaElement(rendererId)

        if (mediaElement) {
            if (loop) {
                mediaElement.loop = true
            } else {
                mediaElement.removeAttribute("loop")
            }
        }
    }

    checkIsLooping(rendererId: string) {
        const mediaElement = this._getMediaElement(rendererId)

        return mediaElement && mediaElement.hasAttribute("loop")
    }

    checkIsEnded(rendererId: string) {
        const mediaElement = this._getMediaElement(rendererId)

        return mediaElement && mediaElement.ended
    }

    applyStyle(rendererId: string, key: string, value: string) {
        const mediaElement = this._getMediaElement(rendererId)

        if (mediaElement) {
            mediaElement.style[key] = value
        }
    }

    clearStyle(rendererId: string, key: string) {
        const mediaElement = this._getMediaElement(rendererId)

        if (mediaElement) {
            mediaElement.style[key] = ""
        }
    }

    setAllVolume(volume: number) {
        Object.keys(this._media).forEach(key => {
            this.setVolume(key, volume)
        })
    }

    setVolume(rendererId: string, volume: number) {
        const mediaElement = this._getMediaElement(rendererId)

        if (mediaElement) {
            mediaElement.volume = volume
        }
    }

    getVolume(rendererId: string) {
        const mediaElement = this._getMediaElement(rendererId)

        if (mediaElement) {
            return mediaElement.volume
        }

        return -1
    }
}