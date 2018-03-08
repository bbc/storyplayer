class BrowserUserAgent {
    static iOS() {
        const iDevices = [
            'iPad Simulator',
            'iPhone Simulator',
            'iPod Simulator',
            'iPad',
            'iPhone',
            'iPod',
        ];

        if (navigator.platform) {
            while (iDevices.length) {
                if (navigator.platform === iDevices.pop()) { return true; }
            }
        }

        return false;
    }
}

export default BrowserUserAgent;
