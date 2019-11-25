// @flow

export const checkAddDetailsOverride = () => {
    const override = new URLSearchParams(window.location.search).get('addDetails');
    return (override === 'true');
};

export const fetchOverridePlayout = () => {
    return new URLSearchParams(window.location.search).get('overridePlayout');
};

export const checkDebugPlayout = () => {
    const override = new URLSearchParams(window.location.search).get('debugPlayout');
    return (override === 'true');
};

export const fetchShakaDebugLevel = () => {
    return new URLSearchParams(window.location.search).get('shakaDebugLevel');
};

export const fetchActiveBufferingOverride = () => {
    return new URLSearchParams(window.location.search).get('activeBufferingOverride')
};

export const fetchInactiveBufferingOverride = () => {
    return new URLSearchParams(window.location.search).get('inactiveBufferingOverride')
};

export const checkDisableLookahead = () => {
    const disableLookahead = new URLSearchParams(window.location.search).get('disableLookahead');
    return (disableLookahead === 'true');;
};

export const checkOverrideFormat = (format: ?string) => {
    return format && (format === 'hls' || format === 'dash');
}

export const getOverrideFormat =() => { 
    const overrideFormat = new URLSearchParams(window.location.search).get('overridePlayoutFormat');
    return checkOverrideFormat(overrideFormat) ? overrideFormat : null;
};

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

export const preventEventDefault = (event: Event) => {
    // if the event doesn't come from the scrub bar we suppress the touch moves
    if(event && event.target && event.target.classList) {
        if(!event.target.classList.includes(SLIDER_CLASS)) {
            event.preventDefault();
        }
    }
};

export const handleButtonTouchEvent = (callback: Function) => {
    return (event: Object) => {
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