const { ipcRenderer } = require('electron');
const logger = require('./logger')
const { displayErrorMessage, replaceTitle, resetStoryPlayer } = require('./mainRenderer');

// ipcRenderer.send('list-stories');


const generateButton = (storyName) => {
    const button = document.createElement('button');
    button.setAttribute('type', 'button')
    button.onclick = () => {
        ipcRenderer.send('get-story', storyName.dirName);
    }
    button.textContent = storyName.name;
    return button;
};


const generateButtons = (data) => {
    const home = document.getElementById('home');
    data.forEach(async (storyName) => {
        home.appendChild(generateButton(storyName))
    })
};


ipcRenderer.on('list-stories', (event, data) => {
    console.log(data)
    generateButtons(data)
});

