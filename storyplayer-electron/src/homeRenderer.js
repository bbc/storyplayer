const { ipcRenderer } = require('electron');


/**
 * Creates the button for the story using the name and the directory the story is in
 * @param {Object} storyName 
 */
const generateButton = (storyName) => {
    const button = document.createElement('button');
    button.onclick = () => ipcRenderer.send('get-story', storyName.dirName);
    button.classList.add('story-button');
    button.textContent = storyName.name;
    return button;
};

/**
 * Returns back an array of storyName objects to generate buttons for
 * @param {Array} data 
 */
const generateButtons = (data) => {
    const home = document.getElementById('story-selector-container');
    const storySelector = document.createElement('div');
    storySelector.classList.add('story-selectors')
    data.forEach(async (storyName) => {
        storySelector.appendChild(generateButton(storyName))
    });
    home.appendChild(storySelector);
};


ipcRenderer.on('list-stories', (event, data) => {
    generateButtons(data)
});

