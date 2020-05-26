const { app } = require('electron');
const path = require('path');

// Path to documents folder
const DOCUMENTS_PATH = app.getPath('documents');
// users hme directory
const APP_DATA_PATH = app.getPath('home');

// the path to the stories is in the users documents
const STORIES_PATH = path.join(DOCUMENTS_PATH, 'storyplayer');

// where do we log analytics
const LOG_FOLDER = path.join(APP_DATA_PATH, 'Storyplayer-analytics');

// what is the analytics file called
const LOG_FILE = path.join(LOG_FOLDER, 'analytics.txt');

module.exports = {
    DOCUMENTS_PATH,
    APP_DATA_PATH,
    STORIES_PATH,
    LOG_FOLDER,
    LOG_FILE
};
