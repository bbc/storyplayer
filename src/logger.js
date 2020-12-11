// @flow

import { createLogger, stdSerializers } from 'browser-bunyan';
import ConsoleFormattedStream from './logger/logger_formatter';

// Example Logging Usage
// import logger from './logger'
// logger.warn('Logging a generic string');
// logger.warn(
//    { obj: {myObject: 1243} },
//    'Logging a generic string and also an object to go with it. Note the object must be under' +
//    ' the obj key in an object passed to the logger. Follows the bunyan logging API: ' +
//    'https://github.com/philmander/browser-bunyan#log-method-api'
// );

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
