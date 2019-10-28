// @flow

import Hls from 'hls.js';
import { getOverrideFormat } from './utils';
import logger from './logger';

export class BrowserUserAgent {
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
                if (navigator.platform === iDevices.pop()) {
                    return true;
                }
            }
        }

        return false;
    }

    static iPhone() {
        const iDevices = ['iPhone Simulator', 'iPod Simulator', 'iPhone', 'iPod'];
        if (navigator.platform) {
            while (iDevices.length) {
                if (navigator.platform === iDevices.pop()) {
                    return true;
                }
            }
        }
        return false;
    }

    static desktopSafari() {
        const ua = window.navigator.userAgent;
        const macOS = 'MacIntel';
        if (navigator.platform && navigator.platform === macOS) {
            return ua.indexOf('Macintosh') > 0 && ua.indexOf('Safari') > 0;
        }
        return false;
    }

    static ie() {
        const ua = window.navigator.userAgent;

        const msie = ua.indexOf('MSIE ');
        if (msie > 0) {
            // IE 10 or older => return version number
            return parseInt(
                ua.substring(msie + 5, ua.indexOf('.', msie)),
                10,
            );
        }

        const trident = ua.indexOf('Trident/');
        if (trident > 0) {
            const rv = ua.indexOf('rv:');
            return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
        }

        // other browser
        return false;
    }

    static edge() {
        const ua = window.navigator.userAgent;

        const edge = ua.indexOf('Edge/');
        if (edge > 0) {
            // Edge (IE 12+) => return version number
            return parseInt(
                ua.substring(edge + 5, ua.indexOf('.', edge)),
                10,
            );
        }

        // other browser
        return false;
    }
}

export class BrowserCapabilities {
    static hlsSupported: boolean

    static dashSupported: boolean

    static hlsSupport() {
        if (BrowserCapabilities.hlsSupported !== undefined) {
            return BrowserCapabilities.hlsSupported;
        }
        // HLS doesn't seem to work on IE or Edge :(
        if (BrowserUserAgent.edge() || BrowserUserAgent.ie()) {
            BrowserCapabilities.hlsSupported = false;
            return false;
        }
        if (Hls.isSupported()) {
            BrowserCapabilities.hlsSupported = true;
            return true;
        }
        const video = document.createElement('video');
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            BrowserCapabilities.hlsSupported = true;
            return true;
        }
        BrowserCapabilities.hlsSupported = false;
        return false;
    }

    static dashSupport() {
        if (BrowserCapabilities.dashSupported !== undefined) {
            return BrowserCapabilities.dashSupported;
        }
        // Copied from https://github.com/Dash-Industry-Forum/dash.js/issues/2055
        // No official dashjs is supported function
        if (typeof (window.MediaSource || window.WebKitMediaSource) === 'function') {
            BrowserCapabilities.dashSupported = true;
            return true;
        }
        BrowserCapabilities.dashSupported = false;
        return false;
    }
}

export class MediaFormats { 

    static getFormat() {
        const overrideFormat = getOverrideFormat();
        if(overrideFormat) {
            logger.info(`Overriding media selector format: , ${overrideFormat}`)
            return overrideFormat;
        }
        // desktop safari is special
        if (BrowserUserAgent.desktopSafari() && BrowserCapabilities.hlsSupport()) {
            return 'hls';
        }
        // otherwise we check for explicit hls or dash support
        if (BrowserCapabilities.dashSupport()) {
            return 'dash';
        }
        if (BrowserCapabilities.hlsSupport()) {
            return 'hls';
        }
        // if we can't support anything we return null
        return null;
    }
}
