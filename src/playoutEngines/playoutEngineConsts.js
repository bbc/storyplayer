// @flow 

import logger from '../logger';


export const PLAYOUT_ENGINES = {
    DOM_SWITCH_PLAYOUT: 'dom',
    IOS_PLAYOUT: 'ios',
    SMP_PLAYOUT: 'smp'
};

export const allHlsEvents = [
    "MEDIA_ATTACHING",
    "MEDIA_ATTACHED",
    "MEDIA_DETACHING",
    "MEDIA_DETACHED",
    "BUFFER_RESET",
    "BUFFER_CODECS",
    "BUFFER_CREATED",
    "BUFFER_APPENDING",
    "BUFFER_APPENDED",
    "BUFFER_EOS",
    "BUFFER_FLUSHING",
    "BUFFER_FLUSHED",
    "MANIFEST_LOADING",
    "MANIFEST_LOADED",
    "MANIFEST_PARSED",
    "LEVEL_SWITCHING",
    "LEVEL_SWITCHED",
    "LEVEL_LOADING",
    "LEVEL_LOADED",
    "LEVEL_UPDATED",
    "LEVEL_PTS_UPDATED",
    "AUDIO_TRACKS_UPDATED",
    "AUDIO_TRACK_SWITCHING",
    "AUDIO_TRACK_SWITCHED",
    "AUDIO_TRACK_LOADING",
    "AUDIO_TRACK_LOADED",
    "INIT_PTS_FOUND",
    "FRAG_LOADING",
    "FRAG_LOAD_PROGRESS",
    "FRAG_LOAD_EMERGENCY_ABORTED",
    "FRAG_LOADED",
    "FRAG_DECRYPTED",
    "FRAG_PARSING_INIT_SEGMENT",
    "FRAG_PARSING_USERDATA",
    "FRAG_PARSING_METADATA",
    "FRAG_PARSING_DATA",
    "FRAG_PARSED",
    "FRAG_BUFFERED",
    "FRAG_CHANGED",
    "FPS_DROP",
    "FPS_DROP_LEVEL_CAPPING",
    "ERROR",
    "DESTROYING",
    "KEY_LOADING",
    "KEY_LOADED",
    "STREAM_STATE_TRANSITION"
];

export const allDashEvents = [
    "CAN_PLAY",
    "PLAYBACK_PAUSED",
    "PLAYBACK_TIME_UPDATED",
    "PLAYBACK_PLAYING",
    "PLAYBACK_ENDED",
    "PLAYBACK_ERROR",
    "PLAYBACK_STALLED",
    "PLAYBACK_WAITING",
    "PLAYBACK_NOT_ALLOWED",
    "PLAYBACK_RATE_CHANGED",
    "PLAYBACK_SEEK_ASKED",
    "PLAYBACK_SEEKED",
    "PLAYBACK_SEEKING",
    "PLAYBACK_STARTED",
    "ERROR",
    "STREAM_INITIALIZED",
    "SOURCE_INITIALIZED",
    "STREAM_TEARDOWN_COMPLETE"
];

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
    "caststatuschanged"
];

const MediaTypesArray = [
    'HLS',
    'DASH',
    'OTHER',
];

export const MediaTypes = MediaTypesArray.reduce((mediaTypes, mediaType) => {
    // eslint-disable-next-line no-param-reassign
    mediaTypes[mediaType] = mediaType;
    return mediaTypes;
}, {});


/**
 * casts the src as a URL then checks the path name ends with .mpd | .m3u8
 * @param {string} src
 */
export const getMediaType = (src: string): 'DASH' | 'HLS' | 'OTHER' => {
    try {
        const url = new URL(src);
        if (url.pathname.endsWith('.m3u8')) {
            return MediaTypes.HLS;
        } if (url.pathname.endsWith('.mpd')) {
            return MediaTypes.DASH;
        }
    } catch (err) {
        logger.error(err, `${src} is not a valid url`);
    }
    return MediaTypes.OTHER;
};
