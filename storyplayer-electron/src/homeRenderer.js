const { ipcRenderer } = require('electron');



/**
 * Creates the button for the story using the name and the directory the story is in
 * @param {Object} storyName 
 */
const generateButton = (storyName) => {
    const option = document.createElement('option');
    option.value = storyName.dirName;
    // option.classList.add('story-button');
    option.textContent = storyName.name;
    return option;
};

/**
 * Returns back an array of storyName objects to generate buttons for
 * @param {Array} data 
 */
const generateButtons = (data) => {
    const home = document.getElementById('story-selector-container');
    const storySelector = document.createElement('select');
    storySelector.onchange = () => ipcRenderer.send('get-story', storySelector.value);
    storySelector.classList.add('story-selector')
    data.forEach(async (storyName) => {
        storySelector.appendChild(generateButton(storyName))
    });
    home.appendChild(storySelector);
};


ipcRenderer.on('list-stories', (event, data) => {
    generateButtons(data)
});

