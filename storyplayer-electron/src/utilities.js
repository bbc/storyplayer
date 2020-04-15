const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const util = require('util');
const logger = require('./logger');


const readFile = util.promisify(fs.readFile);
const readDir = util.promisify(fs.readdir);
const hasAccess = util.promisify(fs.stat);
const mkdir = util.promisify(fs.mkdir);

// Path to documents folder
const DOCUMENTS_PATH = app.getPath('documents');

// the path to the stories is in the users documents
const STORIES_PATH = path.join(DOCUMENTS_PATH, 'storyplayer');

const JSON_PATTERN = /\.[json]+$/i;

// filter all files that are of the type json
const isJSON = (fileEnt) => fileEnt.isFile() && fileEnt.name.match(JSON_PATTERN);

// Tells fs to read an utf-8 file.
const FILE_READ_OPTIONS = {
    encoding: 'utf-8',
    withFileTypes: true,
};

// Returns back the filetypes/directories
const FILE_TYPES = {
    withFileTypes: true
};

/**
 * Helper to check we haven't made a directory and makes it if we have not.
 * @param {string} dirPath Directory to check/create
 */
const justCreatedDirectory = async (dirPath) => {
    const dirExists = await hasAccess(dirPath);
    if (!dirExists) {
        await mkdir(dirPath, { recursive: true });
        return true;
    }
    return false;
};


/**
 * Creates the storyplayer directory
 */
const createStoriesDirectory = () => {
    if (justCreatedDirectory(STORIES_PATH)) {
        logger.info('created assets folder');
    }
    return STORIES_PATH;
};

/**
 * Checks whether the storyplayer directory exists and we have access.
 */
const checkStoriesExists = async () => {
    const storiesDir = await hasAccess(STORIES_PATH);
    return storiesDir;
};

/**
 * Returns back the experience Id.
 * @param {*} experience Experience data model
 */
const getExperienceId = experience => {
    return experience.stories && experience.stories[0].id || 'noId';
}

/**
 * Resolved the relative paths to the media with absolute paths
 * @param {Object} experience Experience Data model.
 */
const resolveAssetPaths = (experience) => {
    const newExperience = experience;
    const experienceId = getExperienceId(experience);
    newExperience.asset_collections = experience.asset_collections.map(asset => {
        const newAsset = asset;
        const { assets } = asset;
        newAsset.assets = Object.keys(assets).reduce((acc, key) => {
            if(acc[key].startsWith('./')) {
                acc[key] = path.join(STORIES_PATH, experienceId, acc[key]);
            }
            return acc;
        }, assets);
        return newAsset;
    });
    return newExperience;
};


/**
 * Reads the data model json and attempts to parse it then returns back that object.
 * @param {*} filePath Path to the data model
 */
const readFileData = async (filePath) => {
    try {
        const fileBuffer = await readFile(filePath, FILE_READ_OPTIONS);
        return JSON.parse(fileBuffer);
    } catch (error) {
        logger.error(error);
        throw new Error(`Could not read file from ${filePath}`);
    }
};


/**
 * Fetches all the directories in the 'storyplayer' directory
 */
const fetchExperienceDirs = async () =>  { 
    const experienceDirs = await readDir(STORIES_PATH, FILE_TYPES);
    return experienceDirs.filter(dir => dir.isDirectory());
}   

// fetch the data model for that experience
/**
 * 
 * @param {string} directoryPath this is the path to the directory for the data model
 * @param {boolean} resolvePaths do we resolve the paths to the media or not
 */
const fetchDataModel = async (directoryPath, resolvePaths) => {
    const storyDirectory = await readDir(directoryPath, FILE_TYPES);
    const dataModelFile = storyDirectory.find(isJSON);
    if(dataModelFile) {
        const dataModel = await readFileData(path.join(directoryPath, dataModelFile.name));
        if(resolvePaths) {
            return resolveAssetPaths(dataModel);
        }
        return dataModel;
    }
    return null;
}


/**
 * Fetches the story data model JSON from the directory
 * @param {string} directoryName name of the directory containing the story data model and media
 */
const getStory = async (directoryName) => {
    try {
        const dataModel = await fetchDataModel(path.join(STORIES_PATH, directoryName), true);
        return dataModel;
    } catch (err) {
        logger.error(err);
        return { error: err.message }
    }
};


/**
 * Gets the name of the story from the data model
 * @param {*} storyDir Directory the story are to be found in
 */
const getStoryName = async (storyDir) => {
    const dataModel = await fetchDataModel(path.join(STORIES_PATH, storyDir), false);
    return dataModel.stories[0].name || 'unknown';
};

/**
 * Lists all the stories in the 'storyplayer' directory
 */
// eslint-disable-next-line consistent-return
const listStories = async () => {
    try {
        if(checkStoriesExists()) {
            // list directories
            const storiesDirs = await fetchExperienceDirs();
            if(storiesDirs && storiesDirs.length > 0) {
                const storyNames = storiesDirs.map(async (dir) => {
                    const storyName = await getStoryName(dir.name);
                    return {name: storyName, dirName: dir.name};
                });
                return Promise.all(storyNames);
            }
        }
        throw new Error('No Stories');
    } catch (error) {
        logger.error(error);
        return Promise.reject(error);
    }
}

module.exports = {
    DOCUMENTS_PATH,
    STORIES_PATH,
    justCreatedDirectory,
    createStoriesDirectory,
    readFileData,
    getStory,
    listStories,
};
