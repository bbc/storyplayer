const { ipcRenderer } = require('electron');

/** 
 * Generates a single html option element using the story dir as value
 * @param {Object} storyName 
 */
const generateOption = (storyName) => {
    const option = document.createElement('option');
    option.setAttribute('value', storyName.dirName);
    option.textContent = storyName.name;
    return option;
};

/**
 * Returns an html select element with a placeholder option
 * and an option for each story in data
 * @param {Array} data
 * @fires get-story with {storyDirectory, schemaVersion, playerVersion }
 */
const generateDropdown = (data) => {
    const home = document.getElementById('story-selector-container');
    const storySelector = document.createElement('div');
    storySelector.classList.add('story-selectors');
    const dropdown = document.createElement('select');
    storySelector.appendChild(dropdown);
    const placeholder = document.createElement('option');
    placeholder.setAttribute('value', '');
    placeholder.textContent = 'Select a story';
    placeholder.disabled = true;
    placeholder.selected = true;
    dropdown.appendChild(placeholder);
    data.forEach(async (storyName) => {
        dropdown.appendChild(generateOption(storyName))
    });
    dropdown.onchange = () => ipcRenderer.send('get-story', {
        storyDirectory: dropdown.value,
        schemaVersion: window.schemaVersion,
        playerVersion: window.playerVersion
    });
    home.appendChild(storySelector);
};

ipcRenderer.on('list-stories', (event, data) => {
    generateDropdown(data);
});

