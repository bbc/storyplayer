import ObjectDataResolver from "./resolvers/ObjectDataResolver"
import {
    Settings,
    ExperienceFetchers,
    AssetUrls,
} from "./types"
import Controller from "./Controller"
import StoryReasonerFactory from "./StoryReasonerFactory"
import RepresentationReasonerFactory from "./RepresentationReasoner"
import MediaFetcher from "./fetchers/MediaFetcher"
import logger from "./logger"
import {
    BrowserCapabilities,
    BrowserUserAgent,
    MediaFormats,
} from "./browserCapabilities"
import {getSetting, WEBVIEW_DEBUG_FLAG, UA_DEBUG_FLAG} from "./utils"

import pkg from "../package.json";

import noAssetSvg from "./assets/images/no-asset.svg";
import blackPng from "./assets/images/black.png"

import {
    REASONER_EVENTS,
    VARIABLE_EVENTS,
    ERROR_EVENTS,
    DOM_EVENTS,
} from "./Events"

// import css styles
import "./assets/styles/player.scss"
import "./assets/styles/smp.scss"

const PLAYER_VERSION = pkg.version;
const SCHEMA_VERSION = pkg.devDependencies["@bbc/object-based-media-schema"];

const DEFAULT_SETTINGS = {
    mediaFetcher: MediaFetcher({}),
    analyticsLogger: logdata => {
        if (
            logdata.to &&
            logdata.from &&
            logdata.current_narrative_element &&
            logdata.current_representation
        ) {
            // eslint-disable-next-line max-len
            logger.info(
                `ANALYTICS: ${logdata.type}, ${logdata.name}: ${logdata.from} - ${logdata.to}; NE: ${logdata.current_narrative_element}, Rep: ${logdata.current_representation}`,
            )
        } else {
            logger.info(`ANALYTICS: ${logdata.type}, ${logdata.name}`)
        }
    },
    privacyNotice: null,
    saveSession: false,
    handleKeys: true,
    noUi: false,
}

// Limited Debugging for iOS webviews
if (getSetting(WEBVIEW_DEBUG_FLAG)) {
    document.getElementById("debug-div").classList.add("debug-div-shown")

    /* eslint-disable */
    if (typeof console != "undefined")
        if (typeof console.log != "undefined") {
            console.log = console.log
        } else {
            console.log = function () {}
        }

    console.log = function (...args) {
        console.log(args)
        document.getElementById("debug-div").innerHTML +=
            "<p>" + args.join(" | ") + "</p>"
    }

    console.error = console.debug = console.info = console.log

    window.onerror = function myErrorHandler(errorMsg, url, lineNumber) {
        document.getElementById("debug-div").innerHTML +=
            "<p> ERROR 1: " + errorMsg + "</p>"
        return false
    }

    window.addEventListener("error", function (e) {
        document.getElementById("debug-div").innerHTML +=
            "<p> ERROR 2: " + e.error.message + "</p>"
        return false
    })
    window.addEventListener("unhandledrejection", function (e) {
        document.getElementById("debug-div").innerHTML +=
            "<p> ERROR 3: " + e.reason.message + "</p>"
    })
    /* eslint-enable */
}

if (getSetting(UA_DEBUG_FLAG)) {
    document.getElementById("debug-div").classList.add("debug-div-shown")
    document.getElementById("debug-div").innerHTML +=
        `<h3>Platform</h3>` +
        `<p>${window.navigator.platform}</p>` +
        `<h3>User-Agent</h3>` +
        `<p>${window.navigator.userAgent}</p>` +
        `<h3>HLS Support</h3>` +
        `${BrowserCapabilities.hlsSupport()}` +
        `<h3>Shaka Player Support</h3>` +
        `${BrowserCapabilities.shakaSupport()}` +
        `<h3>Dash Support</h3>` +
        `${BrowserCapabilities.dashSupport()}` +
        `<h3>Chosen Format</h3>` +
        `${MediaFormats.getFormat()}` +
        `<h3>Chosen Playout</h3>` +
        `${MediaFormats.getPlayoutEngine()}`
}

const Romper = (settings: Settings): Controller | null | undefined => {
    logger.info('StoryPlayer Version:', PLAYER_VERSION, 'Schema Version:', SCHEMA_VERSION);
    const mergedSettings = {...DEFAULT_SETTINGS, ...settings}

    if (!mergedSettings.dataResolver) {
        logger.info("No data resolver passed to romper - creating one")
        mergedSettings.dataResolver = ObjectDataResolver({})
    }

    const storyReasonerFactory = StoryReasonerFactory(
        mergedSettings.storyFetcher,
        mergedSettings.narrativeElementFetcher,
        mergedSettings.dataResolver,
    )
    const representationReasonerFactory = RepresentationReasonerFactory(
        mergedSettings.representationFetcher,
        mergedSettings.dataResolver,
    )
    const assetUrls: AssetUrls = {
        noAssetIconUrl: noAssetSvg,
        noBackgroundAssetUrl: blackPng,
    }
    const fetchers: ExperienceFetchers = {
        storyFetcher: mergedSettings.storyFetcher,
        narrativeElementFetcher: mergedSettings.narrativeElementFetcher,
        representationCollectionFetcher:
            mergedSettings.representationCollectionFetcher,
        representationFetcher: mergedSettings.representationFetcher,
        assetCollectionFetcher: mergedSettings.assetCollectionFetcher,
        mediaFetcher: mergedSettings.mediaFetcher,
    }
    return new Controller(
        mergedSettings.target,
        storyReasonerFactory,
        representationReasonerFactory,
        fetchers,
        mergedSettings.analyticsLogger,
        assetUrls,
        mergedSettings.privacyNotice,
        mergedSettings.saveSession,
        mergedSettings.handleKeys,
        mergedSettings.options,
    )
}

export default Romper;

export const RESOLVERS = {
    FROM_OBJECT: ObjectDataResolver,
};

export {
    BrowserUserAgent,
    BrowserCapabilities,
    ERROR_EVENTS,
    REASONER_EVENTS,
    VARIABLE_EVENTS,
    DOM_EVENTS,
}
