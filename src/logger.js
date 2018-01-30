// @flow

import { createLogger, ConsoleFormattedStream, stdSerializers } from 'browser-bunyan';

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
