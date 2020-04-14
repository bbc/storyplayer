const { app } = require('electron');
const fs = require('fs');
const path = require('path');


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
const justCreatedDirectory = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, {
            recursive: true
        });
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
const checkStoriesExists = () => {
    return fs.existsSync(STORIES_PATH);
};

const getExperienceId = experience => {
    return experience.stories && experience.stories[0].id || 'noId';
}

// replace $$ in any asset collection with the relative path to the asset
// we don't necessarily want to do this permanently so we only do it for the story instance on demand
// this should allow the electron renderer render that path to the asset.
const replaceRelativePath = (experience) => {
    const newExperience = experience;
    const experienceId = getExperienceId(experience);
    newExperience.asset_collections = experience.asset_collections.map(asset => {
        const newAsset = asset;
        const { assets } = asset;
        newAsset.assets = Object.keys(assets).reduce((acc, key) => {
            acc[key] = acc[key].replace('$$', path.join(STORIES_PATH, experienceId));
            return acc;
        }, assets);
        return newAsset;
    });
    return newExperience;
};


// read the story file or error and return an empty object
const readFileData = (filePath) => {
    try {
        const fileBuffer = fs.readFileSync(filePath, FILE_READ_OPTIONS);
        const experience = JSON.parse(fileBuffer);
        // todo if we want to replace the path, probably put something in the meta for the first story?
        if (true) {
            return replaceRelativePath(experience);
        }
        return experience;
    } catch (error) {
        console.log(error);
        throw new Error(`Could not read file from ${filePath}`);
    }
};

// get all the experience directories we have
const fetchExperienceDirs = () => fs.readdirSync(STORIES_PATH, FILE_TYPES)
    .filter(dir => dir.isDirectory() && dir.name.match(UUID_PATTERN));

// fetch the data model for that experience
const fetchDataModel = dirName => fs.readdirSync(path.join(STORIES_PATH, dirName), FILE_TYPES)
    .filter(fileEnt => fileEnt.isFile() && fileEnt.name.match(JSON_PATTERN));


// fetch the story from the storyplayer folder
// should these be grouped by the storyid?
// todo first pass, check we have a folder and check that it matches a uuid and then
// get the name, that is the experience id
const getStory = () => {
    try {
        if (checkStoriesExists()) {
            const directories = fetchExperienceDirs();
            if (directories && directories.length > 1 ) {
                console.log(directories)
                const dirName = directories[0].name;
                const [dataModel] = fetchDataModel(dirName);
                if (dataModel) {
                    console.log(dataModel)
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
