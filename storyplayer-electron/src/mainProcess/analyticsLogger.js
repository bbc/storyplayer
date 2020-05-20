
const fs = require('fs');
const util = require('util');
const logger = require('electron-log');
const { createDirectory }  = require('./utilities');
const { LOG_FILE, LOG_FOLDER } = require('./paths');


const openFile = util.promisify(fs.open);

const createAnalyticsLogFile = async () => {

    await createDirectory(LOG_FOLDER);
    await openFile(LOG_FILE, 'a')
};

const logToFile = (logData) => {
    try {
        const fStream = fs.createWriteStream(LOG_FILE, {
            flags: 'a'
        });
        const logStream = JSON.stringify(logData);
        fStream.write(logStream);
        fStream.end('\n');
    } catch (error) {
        logger.error('error', error);
    }
};


module.exports = {
    createAnalyticsLogFile,
    logToFile,
};
