import Hls from "hls.js"
import {
    getSetting,
    OVERRIDE_PLAYOUT,
    OVERRIDE_PLAYOUT_FORMAT,
    inSMPWrapper,
} from "./utils"
import logger from "./logger"
import {PLAYOUT_ENGINES} from "./playoutEngines/playoutEngineConsts"
export const MEDIA_FORMAT = {
    DASH: "dash",
    HLS: "hls",
}
export class BrowserUserAgent {
    static facebookWebview() {
        const ua = window.navigator.userAgent

        if (
            ua.indexOf("FBAN") > -1 &&
            ua.indexOf("FBDV") > -1 &&
            ua.indexOf("FBSV") > -1
        ) {
            return true
        }

        return false
    }

    static iOS() {
        const iDevices = [
            "iPad Simulator",
            "iPhone Simulator",
            "iPod Simulator",
            "iPad",
            "iPhone",
            "iPod",
        ]

        if (navigator.platform) {
            while (iDevices.length) {
                if (navigator.platform === iDevices.pop()) {
                    return true
                }
            }
        }

        return false
    }

    static iPhone() {
        const iDevices = [
            "iPhone Simulator",
            "iPod Simulator",
            "iPhone",
            "iPod",
        ]

        if (navigator.platform) {
            while (iDevices.length) {
                if (navigator.platform === iDevices.pop()) {
                    return true
                }
            }
        }

        return false
    }

    static safari() {
        const ua = window.navigator.userAgent
        const macOS = "MacIntel"

        if (navigator.platform && navigator.platform === macOS) {
            // it is a mac running safari not running chrome
            return (
                ua.indexOf("Macintosh") > -1 &&
                ua.indexOf("Safari") > -1 &&
                ua.indexOf("Chrome") < 0
            )
        }

        if (this.iOS()) {
            return ua.indexOf("Safari") > 0
        }

        return false
    }

    static isSafariDesktop() {
        const safariCheck = // @ts-ignore
            !window.safari || // @ts-ignore
            (typeof safari !== "undefined" && window.safari.pushNotification)
        // fallback to user agent sniffing if we can't detect safari using this method
        return safariCheck.toString() === "[object SafariRemoteNotification]"
    }

    static ie() {
        const ua = window.navigator.userAgent
        const msie = ua.indexOf("MSIE ")

        if (msie > 0) {
            // IE 10 or older => return version number
            return parseInt(ua.substring(msie + 5, ua.indexOf(".", msie)), 10)
        }

        const trident = ua.indexOf("Trident/")

        if (trident > 0) {
            const rv = ua.indexOf("rv:")
            return parseInt(ua.substring(rv + 3, ua.indexOf(".", rv)), 10)
        }

        // other browser
        return false
    }

    static edge() {
        const ua = window.navigator.userAgent
        const edge = ua.indexOf("Edge/")

        if (edge > 0) {
            // Edge (IE 12+) => return version number
            return parseInt(ua.substring(edge + 5, ua.indexOf(".", edge)), 10)
        }

        // other browser
        return false
    }
}
export class BrowserCapabilities {
    static hlsSupported: boolean
    static dashSupported: boolean

    static hlsJsSupport() {
        return Hls.isSupported()
    }

    static hlsSupport() {
        if (BrowserCapabilities.hlsSupported !== undefined) {
            return BrowserCapabilities.hlsSupported
        }

        // HLS doesn't seem to work on IE or Edge :(
        if (BrowserUserAgent.edge() || BrowserUserAgent.ie()) {
            BrowserCapabilities.hlsSupported = false
            return false
        }

        if (BrowserCapabilities.hlsJsSupport()) {
            BrowserCapabilities.hlsSupported = true
            return true
        }

        const video = document.createElement("video")

        if (video.canPlayType("application/vnd.apple.mpegurl")) {
            BrowserCapabilities.hlsSupported = true
            return true
        }

        BrowserCapabilities.hlsSupported = false
        return false
    }

    static dashSupport() {
        if (BrowserCapabilities.dashSupported !== undefined) {
            return BrowserCapabilities.dashSupported
        }

        // Copied from https://github.com/Dash-Industry-Forum/dash.js/issues/2055
        // No official dashjs is supported function
        if ( // @ts-ignore
            typeof (window.MediaSource || window.WebKitMediaSource) ===
            "function"
        ) {
            BrowserCapabilities.dashSupported = true
            return true
        }

        BrowserCapabilities.dashSupported = false
        return false
    }
}
export class MediaFormats {
    /**
     * Gets the media format based on client capabilities
     * @returns {string} 'hls' or 'dash'
     */
    static getFormat() {
        const overrideFormat = getSetting(OVERRIDE_PLAYOUT_FORMAT)

        if (Object.values(MEDIA_FORMAT).includes(overrideFormat)) {
            logger.debug(
                `Overriding media selector format: , ${overrideFormat}`,
            )
            return overrideFormat
        }

        // desktop safari supports dash
        if (BrowserUserAgent.isSafariDesktop()) {
            logger.debug("getFormat: isSafariDesktop = True")
            return MEDIA_FORMAT.HLS
        }

        // iOS uses hls
        if (BrowserUserAgent.safari() && BrowserCapabilities.hlsSupport()) {
            logger.debug("getFormat: safari = True")
            return MEDIA_FORMAT.HLS
        }

        // otherwise we check for explicit hls or dash support
        if (BrowserCapabilities.dashSupport()) {
            logger.debug("getFormat: Dash Support = True")
            return MEDIA_FORMAT.DASH
        }

        if (BrowserCapabilities.hlsSupport()) {
            logger.debug("getFormat: HLS Support = True")
            return MEDIA_FORMAT.HLS
        }

        // if we can't support anything we return null
        return null
    }

    /**
     * Returns the playout engine to use based on the client capabilities
     * ios will only play back hls dom should play back either
     * @returns {string} 'ios' or 'dom'
     */
    static getPlayoutEngine(noSMP = false) {
        const overridePlayout = getSetting(OVERRIDE_PLAYOUT)

        if (
            overridePlayout &&
            Object.values(PLAYOUT_ENGINES).includes(overridePlayout)
        ) {
            logger.info("Overriding playout engine: ", overridePlayout)
            return overridePlayout
        }

        // smp wrapper
        if (inSMPWrapper() && noSMP === false) {
            return PLAYOUT_ENGINES.SMP_PLAYOUT
        }

        if (BrowserCapabilities.dashSupport()) {
            // safari desktop
            if (BrowserUserAgent.isSafariDesktop()) {
                // Safari Desktop
                logger.debug(
                    "getPlayoutEngine: DashSupport + isSafariDesktop = True",
                )
                return PLAYOUT_ENGINES.IOS_PLAYOUT
            }

            // safari other dash support (ipad?)
            if (BrowserUserAgent.safari()) {
                // Safari iOS
                logger.debug("getPlayoutEngine: DashSupport + safari = True")
                return PLAYOUT_ENGINES.IOS_PLAYOUT
            }

            // default for dash is DOM playout engine
            logger.debug("getPlayoutEngine: DashSupport + not safari = True")
            return PLAYOUT_ENGINES.DOM_SWITCH_PLAYOUT
        }

        // hls for ios devices
        if (BrowserCapabilities.hlsSupport()) {
            // Safari Mobile
            logger.debug("getPlayoutEngine: HlsSupport = True")
            return PLAYOUT_ENGINES.IOS_PLAYOUT
        }

        logger.debug("getPlayoutEngine: No DashSupport or HlsSupport")
        // default?
        return PLAYOUT_ENGINES.DOM_SWITCH_PLAYOUT
    }
}