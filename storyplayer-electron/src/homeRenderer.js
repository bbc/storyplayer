const { ipcRenderer } = require('electron');
const logger = require('./logger')
const { displayErrorMessage, replaceTitle, resetStoryPlayer } = require('./mainRenderer');

ipcRenderer.send('list-stories');


const generateButton = async (storyName) => {
    const button = document.createElement('button');
    button.setAttribute('type', 'button')
    button.onclick = async () => {
        const data = await ipcRenderer.send('get-story', storyName.dirName);
        logger.info(data);
        if (!data || data.error !== undefined) {
            displayErrorMessage(data)
        } else {
            const firstStory = data.stories[0];
            replaceTitle(firstStory);
            resetStoryPlayer(data);
        }
    }
    button.textContent = storyName.name;
    console.log(button);
    return button;
};


const generateButtons = (data) => {
    const home = document.getElementById('home');
    data.forEach(async (storyName) => {
        const button = await generateButton(storyName);
        console.log(button);
        home.appendChild(button)
    })
};


ipcRenderer.on('list-stories-reply', (event, data) => {
    console.log(data)
    generateButtons(data)
});

