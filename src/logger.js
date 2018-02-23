// @flow

import { createLogger, stdSerializers } from 'browser-bunyan';
import ConsoleFormattedStream from './logger/logger_formatter';

module.exports = createLogger({
    name: 'romper',
    streams: [
        {
            level: 'info',
            stream: new ConsoleFormattedStream({ logByLevel: true }),
        },
    ],
    serializers: stdSerializers,
    src: true,
});
