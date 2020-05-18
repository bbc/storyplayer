const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const util = require('util');
const { createDirectory }  = require('./utilities');
const logger = require('./logger');

const appDataPath = app.getPath('home');
const LOG_FOLDER = path.join(appDataPath, 'Storyplayer-analytics');

const LOG_FILE = path.join(LOG_FOLDER, 'analytics.txt')

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
