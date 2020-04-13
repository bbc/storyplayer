const { app } = require('electron');
const fs = require('fs');
const path = require('path');


const DOCUMENTS_PATH = app.getPath('documents');

// helper to check we have created a directory.
const justCreatedDirectory = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        return true;
    }
    return false;
};

// the path to the stories is in the users documents
const STORIES_PATH = path.join(DOCUMENTS_PATH, 'storyplayer');

// create the stories directory if we havent
const createStoriesDirectory = () => {
    if(justCreatedDirectory(STORIES_PATH)) {
        console.log('created assets folder');
    }
    return STORIES_PATH;
};

// check the stories path exists
const checkStoriesExists = () => {
    return fs.existsSync(STORIES_PATH);
};

const getExperienceId = experience => {
    return experience.stories[0].id || 'noId';
}
 
// replace $$ in any asset collection with the relative path to the asset
// we don't necessarily want to do this permanently so we only do it for the story instance on demand
// this should allow the electron renderer render that path to the asset.
const replaceRelativePath = (experience) => {
    try {
        const newExperience = experience;
        newExperience.asset_collections = experience.asset_collections.map(asset => {
            const newAsset = asset;
            const { assets } = asset;
            newAsset.assets = Object.keys(assets).reduce((acc, key) => {
                acc[key] = acc[key].replace('$$', path.join(STORIES_PATH, ));
                return acc;
            }, assets);
            return newAsset;
        });
        return newExperience;
    } catch (error) {
        console.log(error);
        return {};
    }
};


// read the story file or error and return an empty object
const readFileData = (filePath) => {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const experience = JSON.parse(fileBuffer);
        // // todo if we want to replace the path, probably put something in the meta for the first story?
        // if(replaceFlag) {
        //     return replaceRelativePath(experience);
        // }
        return experience;
    } catch (error) {
        console.log(error)
        return {};
    }
};


// fetch the story from the storyplayer folder
// should these be grouped by the storyid?
const getStory = () => {
    if(checkStoriesExists()) {
        const files = fs.readdirSync(STORIES_PATH);
        if(files) {
            const firstStoryPath = path.join(STORIES_PATH, files[0]);
            return readFileData(firstStoryPath);
        }
    };
    return {};
};

module.exports = {
    DOCUMENTS_PATH,
    STORIES_PATH,
    justCreatedDirectory,
    createStoriesDirectory,
    readFileData,
    getStory
};
