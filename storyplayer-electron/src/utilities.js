const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const util = require('util');


const readFile = util.promisify(fs.readFile);
const readDir = util.promisify(fs.readdir);
const hasAccess = util.promisify(fs.stat);
const mkdir = util.promisify(fs.mkdir);

const DOCUMENTS_PATH = app.getPath('documents');

const JSON_PATTERN = /\.[json]+$/i;

const UUID_PATTERN = /([a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}){1}/

// Tells fs to read an utf-8 file.
const FILE_READ_OPTIONS = {
    encoding: 'utf-8',
    withFileTypes: true,
};

const FILE_TYPES = {
    withFileTypes: true
};

// helper to check we have created a directory.
const justCreatedDirectory = async (dirPath) => {
    const dirExists = await hasAccess(dirPath);
    if (!dirExists) {
        await mkdir(dirPath, { recursive: true });
        return true;
    }
    return false;
};


const isJSON = (fileEnt) => fileEnt.isFile() && fileEnt.name.match(JSON_PATTERN);


// the path to the stories is in the users documents
const STORIES_PATH = path.join(DOCUMENTS_PATH, 'storyplayer');

// create the stories directory if we havent
const createStoriesDirectory = () => {
    if (justCreatedDirectory(STORIES_PATH)) {
        console.log('created assets folder');
    }
    return STORIES_PATH;
};

// check the stories path exists
const checkStoriesExists = async () => {
    const storiesDir = await hasAccess(STORIES_PATH);
    return storiesDir;
};

const getExperienceId = experience => {
    return experience.stories && experience.stories[0].id || 'noId';
}

// prepend path if we need to.
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


// read the story file or error and return an empty object
const readFileData = async (filePath, resolvePaths = false) => {
    try {
        const fileBuffer = await readFile(filePath, FILE_READ_OPTIONS);
        const experience = JSON.parse(fileBuffer);
        // resolve the paths to the media
        if(resolvePaths) {
            return resolveAssetPaths(experience);
        }
        return experience;
    } catch (error) {
        console.log(error);
        throw new Error(`Could not read file from ${filePath}`);
    }
};

// get all the experience directories we have
const fetchExperienceDirs = async () =>  { 
    const experienceDirs = await readDir(STORIES_PATH, FILE_TYPES);
    return experienceDirs.filter(dir => dir.isDirectory());
}   

// fetch the data model for that experience
const fetchDataModel = async (filePath, resolvePaths) => {
    const storyDirectory = await readDir(filePath, FILE_TYPES);
    const dataModelFile = storyDirectory.find(isJSON);
    if(dataModelFile) {
        const dataModel = await readFileData(path.join(filePath, dataModelFile.name), resolvePaths);
        return dataModel;
    }
    return null;
}


// fetch the story from the storyplayer folder
// should these be grouped by the storyid?
// todo first pass, check we have a folder and check that it matches a uuid and then
// get the name, that is the experience id
const getStory = async (directoryName) => {
    try {
        const dataModel = await fetchDataModel(path.join(STORIES_PATH, directoryName), true);
        return dataModel;
        throw new Error('Could not load story');
    } catch (err) {
        console.log(err);
        return { error: err.message }
    }
};

const getStoryName = async (storyDir) => {
    const dataModel = await fetchDataModel(storyDir, false);
    return dataModel.stories[0].name || 'unknown';
};

const listStories = async () => {
    try {
        if(checkStoriesExists()) {
            // list directories
            const storiesDirs = await fetchExperienceDirs();
            if(storiesDirs && storiesDirs.length > 0) {
                const storyNames = storiesDirs.map(async (dir) => {
                    const filePath = path.join(STORIES_PATH, dir.name);
                    const storyName = await getStoryName(filePath);
                    return {name: storyName, dirName: dir.name};
                });
                return Promise.all(storyNames);
            }
        }
    } catch (error) {
        console.log(error);
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
