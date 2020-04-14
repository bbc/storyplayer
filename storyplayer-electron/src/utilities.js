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
const readFileData = async (filePath) => {
    try {
        const fileBuffer = await readFile(filePath, FILE_READ_OPTIONS);
        const experience = JSON.parse(fileBuffer);
        // resolve the paths to the media
        return resolveAssetPaths(experience);
    } catch (error) {
        console.log(error);
        throw new Error(`Could not read file from ${filePath}`);
    }
};

// get all the experience directories we have
const fetchExperienceDirs = async () =>  { 
    const experienceDirs = await readDir(STORIES_PATH, FILE_TYPES);
    return experienceDirs.filter(dir => dir.isDirectory() && dir.name.match(UUID_PATTERN));
}   

// fetch the data model for that experience
const fetchDataModel = async (dirName) => {
    const filePath = path.join(STORIES_PATH, dirName);
    const dataModel = await readDir(filePath, FILE_TYPES);
    return dataModel.filter(fileEnt => fileEnt.isFile() && fileEnt.name.match(JSON_PATTERN));
}


// fetch the story from the storyplayer folder
// should these be grouped by the storyid?
// todo first pass, check we have a folder and check that it matches a uuid and then
// get the name, that is the experience id
const getStory = async () => {
    try {
        if (checkStoriesExists()) {
            const directories = await fetchExperienceDirs();
            if (directories && directories.length > 0 ) {
                const dirName = directories[0].name;
                const [dataModel] = await fetchDataModel(dirName);
                if (dataModel) {
                    const firstStoryPath = path.join(STORIES_PATH, dirName, dataModel.name);
                    return readFileData(firstStoryPath);
                }
            }
        } 
        throw new Error('Could not load story');
    } catch (err) {
        console.log(err);
        return { error: err.message }
    }
};

module.exports = {
    DOCUMENTS_PATH,
    STORIES_PATH,
    justCreatedDirectory,
    createStoriesDirectory,
    readFileData,
    getStory
};
