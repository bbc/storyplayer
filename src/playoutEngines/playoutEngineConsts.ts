import logger from "../logger"
export const PLAYOUT_ENGINES = {
    DOM_SWITCH_PLAYOUT: "dom",
    IOS_PLAYOUT: "ios",
    SMP_PLAYOUT: "smp",
}
export const allShakaEvents = [
    "abrstatuschanged",
    "adaptation",
    "buffering",
    "drmsessionupdate",
    "emsg",
    "error",
    "expirationupdated",
    "largegap",
    "loading",
    "manifestparsed",
    "onstatechange",
    "onstateidle",
    "streaming",
    "textchanged",
    "texttrackvisibility",
    "timelineregionadded",
    "timelineregionenter",
    "timelineregionexit",
    "trackschanged",
    "unloading",
    "variantchanged",
    "retry",
    "caststatuschanged",
]
const MediaTypesArray = ["HLS", "DASH", "OTHER"]
export const MediaTypes: Record<string, "HLS" | "DASH" | "OTHER"> =
MediaTypesArray.reduce((mediaTypes, mediaType) => {
    // eslint-disable-next-line no-param-reassign
    mediaTypes[mediaType] = mediaType
    return mediaTypes
}, {})

/**
 * casts the src as a URL then checks the path name ends with .mpd | .m3u8
 * @param {string} src
 */
export const getMediaType = (src: string): "DASH" | "HLS" | "OTHER" => {
    try {
        const url = new URL(src)

        if (url.pathname.endsWith(".m3u8")) {
            return MediaTypes.HLS
        }

        if (url.pathname.endsWith(".mpd")) {
            return MediaTypes.DASH
        }
    } catch (err) {
        logger.error(err, `${src} is not a valid url`)
    }

    return MediaTypes.OTHER
}
