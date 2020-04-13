const { app } = require('electron');
const fs = require('fs');
const path = require('path');


const DOCUMENTS_PATH = app.getPath('documents');

const justCreatedDirectory = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        return true;
    }
    return false;
};

const STORIES_PATH = path.join(DOCUMENTS_PATH, 'storyplayer');

const createStoriesDirectory = () => {
    if(justCreatedDirectory(STORIES_PATH)) {
        console.log('created assets folder');
    }
    return STORIES_PATH;
};

const checkStoriesExists = () => {
    return fs.existsSync(STORIES_PATH);
};


const replaceRelativePath = (fileBuffer) => {
    try {
        const experience = JSON.parse(fileBuffer);
        experience.asset_collections = experience.asset_collections.map(asset => {
            const newAsset = asset;
            newAsset.assets = Object.keys(asset.assets).reduce((acc, key) => {
                acc[key] = acc[key].replace('$$', path.join(STORIES_PATH));
                return acc;
            }, {});
            return newAsset;
        });
        return experience;
    } catch (error) {
        console.log(error);
        return {};
    }
};

const readFileData = (filePath, replaceFlag = true) => {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        if(replaceFlag) {
            return replaceRelativePath(fileBuffer);
        }
        return JSON.parse(fileBuffer);
    } catch (error) {
        console.log(error)
        return {};
    }
};

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
