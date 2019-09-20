export const checkAddDetailsOverride = () => {
    const override = new URLSearchParams(window.location.search).get('addDetails');
    const retObj = (override === 'true');
    console.log('OVERRIDE', retObj)
    return retObj;
};

export const fetchOverridePlayout = () => {
    return new URLSearchParams(window.location.search).get('overridePlayout');
};

export const checkDebugPlayout = () => {
    const override = new URLSearchParams(window.location.search).get('debugPlayout');
    const retObj = (override === 'true');
    console.log('OVERRIDE', retObj)
    return retObj;
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
    const retObj = (disableLookahead === 'true');
    console.log('OVERRIDE', retObj)
    return retObj;
}
