import {
    createLogger,
    stdSerializers,
    INFO,
    TRACE,
    DEBUG,
    WARN,
    ERROR,
    FATAL,
    ConsoleFormattedStream,
} from "browser-bunyan"
import {DEBUG_PLAYOUT_FLAG, getSetting} from "./utils"
const DEFAULT_CSS = {
    levels: {
        trace: "color: DeepPink",
        debug: "color: GoldenRod",
        info: "color: DarkTurquoise",
        warn: "color: Blue",
        error: "color: Crimson",
        fatal: "color: White",
    },
    def: "color: DimGray",
    msg: "color: SteelBlue",
    src: "color: DimGray; font-style: italic; font-size: 0.9em",
}
const DEFAULT_SETTINGS = {
    css: DEFAULT_CSS,
    logByLevel: true,
}

const getLogLevel = () => {
    const logLevel = getSetting(DEBUG_PLAYOUT_FLAG)

    switch (logLevel) {
        case "trace":
            return TRACE

        case "debug":
            return DEBUG

        case "info":
            return INFO

        case "warn":
            return WARN

        case "error":
            return ERROR

        case "fatal":
            return FATAL

        default:
            return INFO
    }
}

const logger = createLogger({
    name: "storyplayer",
    streams: [
        {
            level: getLogLevel(),
            stream: new ConsoleFormattedStream(DEFAULT_SETTINGS),
        },
    ],
    serializers: stdSerializers,
    src: getLogLevel() < INFO,
})
export const isDebug = () => logger.level() < INFO
export default logger