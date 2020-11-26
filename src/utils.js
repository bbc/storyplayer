import logger from './logger';
import { 
    InternalVariableNames,
    getTodaysDay, 
    getSegmentOfDay,
} from './InternalVariables';

// @flow

export const proxyWrapper = (text, classInstance) => {
    const handler = {
        get (getTarget, getProp) {
            // eslint-disable-next-line func-names
            return function() {
                /* eslint-disable prefer-rest-params */
                try {
                    logger.info( `(C) ${text} call: ${getProp} (${arguments.length})` );
                } catch {
                    logger.info( `(C) ${text} call: ${getProp} logger failed`)
                }
                try {
                    logger.info( `(C+A) ${text} call: ${getProp}`, ...arguments );
                } catch {
                    logger.info( `(C+A) ${text} call: ${getProp} logger failed`)
                }
                // eslint-disable-next-line prefer-spread
                const ret = getTarget[ getProp ].apply( getTarget, arguments );
                try {
                    logger.info( `(C+R) ${text} call: ${getProp}`, ret );
                } catch {
                    logger.info( `(C+R) ${text} call: ${getProp} logger failed`)
                }
                try {
                    logger.info( `(C+A+R) ${text} call: ${getProp}`, ...arguments, ret );
                } catch {
                    logger.info( `(C+A+R) ${text} call: ${getProp} logger failed`)
                }
                /* eslint-enable prefer-rest-params */

                return ret
            }
        },
    };
    return new Proxy(classInstance, handler);
}

/**
 * Are we in the SMP iframe or not
 */
export const inSMPWrapper = () => {
    if (window.publicApi && window.playerInterface) {
        return true;
    }
    return false
}

/**
 * Returns the SMP interface
 */
export const getSMPInterface = () => {
    return window.playerInterface;
}

export const ADD_DETAILS_FLAG = "addDetails"
export const DEBUG_PLAYOUT_FLAG = "debugPlayout"
export const FACEBOOK_BLOCK_FLAG = "overrideWebView"
export const WEBVIEW_DEBUG_FLAG = "debugWebview"
export const UA_DEBUG_FLAG = "debugUA"
export const DISABLE_LOOKAHEAD_FLAG = "disableLookahead"

export const OVERRIDE_PLAYOUT = "overrideEngine"
export const OVERRIDE_PLAYOUT_FORMAT = "overrideFormat"
export const SHAKA_DEBUG_LEVEL = "debugShaka"
export const OVERRIDE_ACTIVE_BUFFERING = "overrideActiveBuffering"
export const OVERRIDE_INACTIVE_BUFFERING = "overrideInactiveBuffering"

export const getSetting = (settingName) => {
    let settingValue;
    if(inSMPWrapper()) {
        settingValue = new URLSearchParams(
            window.playerInterface.datastore.get("queryString")
        ).get(settingName);
    } else {
        settingValue = new URLSearchParams(window.location.search).get(settingName);
    }

    switch(settingName) {
    case ADD_DETAILS_FLAG:
    case DEBUG_PLAYOUT_FLAG:
    case FACEBOOK_BLOCK_FLAG:
    case WEBVIEW_DEBUG_FLAG:
    case UA_DEBUG_FLAG:
    case DISABLE_LOOKAHEAD_FLAG:
        return (settingValue === 'true');
    default:
        return settingValue
    }
}

export const getCurrentUrl = () => {
    return window.location.href
}

export const getVariableOverrides = () => {
    const varNames = new URLSearchParams(window.location.search).getAll('varName');
    const varVals = new URLSearchParams(window.location.search).getAll('varVal');
    if(varNames.length !== varVals.length) {
        logger.info(`Query Parameter variable failed - number of name and value does not match`);
        return []
    }
    if(varNames.length === 0) {
        return []
    }
    const varArray = varNames.map((name, index) => [name, varVals[index]])
    return varArray
}

export const copySelection = (e: Object) => {
    e.target.select();
    document.execCommand('copy');
    e.target.focus();
}

// eslint-disable-next-line class-methods-use-this
export const addDetail = (key: string, name: ? string, id : ? string) => {
    const detail = document.createElement('div');
    detail.className= 'detail'
    detail.innerText = `${key}: ${name || ''}`;
    const detailId = document.createElement('input');
    detailId.value = `${id || ''}`;
    detailId.readOnly = true;
    detailId.className = 'detail-input';
    detailId.onclick = copySelection;
    detail.appendChild(detailId);
    return detail;
};

export const scrollToTop = () => {
    window.setTimeout(() => {
        window.scrollTo(0, 0);
        if (
            document.getElementsByClassName('taster-offsite-panel').length > 0 &&
            document.getElementsByClassName('taster-offsite-panel')[0].scrollIntoView
        ) {
            document.getElementsByClassName('taster-offsite-panel')[0].scrollIntoView();
        } else if (
            document.getElementsByClassName('offsite-panel').length > 0 &&
            document.getElementsByClassName('offsite-panel')[0].scrollIntoView
        ) {
            document.getElementsByClassName('offsite-panel')[0].scrollIntoView();
        }
    }, 100);
};

export const SLIDER_CLASS = 'slider-input';

export const VIDEO = 'video';
export const AUDIO = 'audio';

// eslint-disable-next-line max-len
export const LOOPING_AUDIO_AC_TYPE = 'urn:x-object-based-media:asset-collection-types:looping-audio/v1.0';

export const preventEventDefault = (event: Event) => {
    // if the event doesn't come from the scrub bar we suppress the touch moves
    if(event && event.target && event.target.classList) {
        if(!event.target.classList.includes(SLIDER_CLASS)) {
            event.preventDefault();
        }
    }
};

/**
 * Adds an event handler to the event called
 * @param {Function} callback callback to execute on the event
 * @param {string} touchEvent Event to attach listener to
 */
export const handleButtonTouchEvent = (callback: Function, touchEvent: (Event | TouchEvent )) => {
    return (event: Object) => {
        if(getSetting(DEBUG_PLAYOUT_FLAG)) {
            logger.info('Event Captured:', event);
            logger.info('Touch Event Captured:', touchEvent);
        }
        // handle multiple touch points?
        if(event.touches !== undefined && event.touches && event.touches.length > 1) {
            return;
        }
        // Stop propagation of touch event.
        event.stopPropagation();
        // Stop click events on tablets being fired off for this touch.
        event.preventDefault();
        // Call action for this event
        callback();
    };
};

/**
 * returns a number to a desired precision using exponential notation
 * @param {*} number number to round
 * @param {*} decimalPlaces precision to round to
 */
export const precisionRound = (number: number, decimalPlaces: number) => {
    return Number(`${Math.round(`${number}e${decimalPlaces}`)}e-${decimalPlaces}`);
}


/**
 * Is the left greater than the right numbers to a precision of 2dp.
 * @param {*} left left hand number to cpmpare
 * @param {*} right right hand number to compare
 */
export const leftGreaterThanRight = (left, right) => {
    return precisionRound(left, 2) > precisionRound(right, 2);
};

/**
 * replaces the escaped variables so we can display them onscreen
 * returns a Promise that resolves to a string
 * @param {string} textContent text to replace 
 * @param {string} controller the controller 
 */
export const replaceEscapedVariables = (textContent, controller) => {
    const varRefs = textContent.match(/\$\{(.*?)\}/g);
    if (!varRefs) {
        return Promise.resolve(textContent);
    }
    return controller.getVariableState().then((vState) => {
        const getVal = (vName) => {
            if (vName === InternalVariableNames.DAY_OF_WEEK) {
                return getTodaysDay();
            }
            if (vName === InternalVariableNames.PORTION_OF_DAY) {
                return getSegmentOfDay();
            }
            if (vState[vName]) {
                /* eslint-disable camelcase */
                const { variable_type, value } = vState[vName];
                switch(variable_type) {
                case 'number':
                    return value.toString();
                case 'boolean':
                    return value ? 'yes' : 'no';
                case 'list':
                case 'string':
                default:
                    return encodeURI(value);
                }
                /* eslint-enable camelcase */
            }
            return '';
        };
        const replacedText = textContent.replace(/\$\{(.*?)\}/g, (m ,c) => getVal(c));
        return replacedText;
    });
};

/**
 * Gets a list of which controls need to be hidden on this element, in this story
 * @param {Object} ne object
 * @param {Object} story object
 */
export const getControlHideList = (ne, story) => {
    let hideList = [];
    if (ne && ne.meta.storyplayer
        && ne.meta.storyplayer.hide_controls) {
        hideList = hideList.concat([...ne.meta.storyplayer.hide_controls]);
    }
    if (story && story.meta.storyplayer
        && story.meta.storyplayer.hide_controls) {
        hideList = hideList.concat([...story.meta.storyplayer.hide_controls]);
    }
    return hideList
};