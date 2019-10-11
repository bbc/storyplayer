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
export const copySelection = (e) => {
    e.target.select();
    document.execCommand('copy');
    e.target.focus();
}
