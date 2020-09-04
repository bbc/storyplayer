// @flow

import { TRACE, DEBUG, INFO, WARN, ERROR, FATAL, nameFromLevel } from 'browser-bunyan';

const DEFAULT_CSS = {
    levels: {
        trace: 'color: DeepPink',
        debug: 'color: GoldenRod',
        info: 'color: DarkTurquoise',
        warn: 'color: Green',
        error: 'color: Crimson',
        fatal: 'color: Black',
    },
    def: 'color: DimGray',
    msg: 'color: SteelBlue',
    src: 'color: DimGray; font-style: italic; font-size: 0.9em',
};

const DEFAULT_SETTINGS = {
    css: DEFAULT_CSS,
    logByLevel: false,
};

export type ConsoleFormattedStreamOptions = {
    logByLevel?: boolean,
    css?: Object,
}

export default class ConsoleFormattedStream {
    logByLevel: boolean;

    css: Object;

    constructor(settings: ConsoleFormattedStreamOptions) {
        const mergedSettings = { ...DEFAULT_SETTINGS, ...settings};

        this.logByLevel = mergedSettings.logByLevel;
        this.css = mergedSettings.css;
    }

    write(rec: Object) {
        let levelCss;
        let consoleMethod;
        const defaultCss = this.css.def;
        const msgCss = this.css.msg;
        const srcCss = this.css.src;

        const loggerName = rec.childName ? `${rec.name}/${rec.childName}` : rec.name;

        // get level name and pad start with spacs
        let levelName = nameFromLevel[rec.level];
        const formattedLevelName = (Array(6 - levelName.length).join(' ') + levelName)
            .toUpperCase();

        if (this.logByLevel) {
            if (rec.level === TRACE) {
                levelName = 'debug';
            } else if (rec.level === FATAL) {
                levelName = 'error';
            }
            // eslint-disable-next-line max-len, no-console
            consoleMethod = typeof console[levelName] === 'function' ? console[levelName] : console.log;
        } else {
            // eslint-disable-next-line no-console
            consoleMethod = console.log;
        }

        if (rec.level < DEBUG) {
            levelCss = this.css.levels.trace;
        } else if (rec.level < INFO) {
            levelCss = this.css.levels.debug;
        } else if (rec.level < WARN) {
            levelCss = this.css.levels.info;
        } else if (rec.level < ERROR) {
            levelCss = this.css.levels.warn;
        } else if (rec.level < FATAL) {
            levelCss = this.css.levels.error;
        } else {
            levelCss = this.css.levels.fatal;
        }

        // eslint-disable-next-line
        const padZeros = (number, len) => Array((len + 1) - (`${number}`).length).join('0') + number;

        const logArgs = [];
        // [time] level: loggerName: msg src?
        logArgs.push(`[%s:%s:%s:%s] %c%s%c: %s: %c%s ${rec.src ? '%c%s' : ''}`);
        logArgs.push(padZeros(rec.time.getHours(), 2));
        logArgs.push(padZeros(rec.time.getMinutes(), 2));
        logArgs.push(padZeros(rec.time.getSeconds(), 2));
        logArgs.push(padZeros(rec.time.getMilliseconds(), 4));
        logArgs.push(levelCss);
        logArgs.push(formattedLevelName);
        logArgs.push(defaultCss);
        logArgs.push(loggerName);
        logArgs.push(msgCss);
        logArgs.push(rec.msg);
        if (rec.src) {
            logArgs.push(srcCss);
            logArgs.push(rec.src);
        }

        consoleMethod.apply(console, logArgs);
        if (rec.err && rec.err.message) {
            consoleMethod.call(console, '%c%s', levelCss, rec.err.message);
        }
        if (rec.err && rec.err.stack) {
            consoleMethod.call(console, '%c%s', levelCss, rec.err.stack);
        }
        if (rec.obj) {
            consoleMethod.call(console, rec.obj);
        }
    }

    static getDefaultCss() {
        return DEFAULT_CSS;
    }
}
