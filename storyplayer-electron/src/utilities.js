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
}

const readFileData = (filePath) => {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        return JSON.parse(fileBuffer);
    } catch (error) {
        console.log(error)
        return {};
    }
}

const getStory = () => {
    console.log('checking storues');
    if(checkStoriesExists()) {
        const files = fs.readdirSync(STORIES_PATH);
        if(files) {
            console.log('files', files);
            const firstStoryPath = path.join(STORIES_PATH, files[0]);
            return readFileData(firstStoryPath);
        }
    };
}

module.exports = {
    DOCUMENTS_PATH,
    STORIES_PATH,
    justCreatedDirectory,
    createStoriesDirectory,
    readFileData,
    getStory
};
