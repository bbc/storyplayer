const { ipcRenderer } = require('electron');



/**
 * Creates the button for the story using the name and the directory the story is in
 * @param {Object} storyName 
 */
const generateButton = (storyName) => {
    const button = document.createElement('button');
    button.setAttribute('type', 'button')
    button.onclick = () => ipcRenderer.send('get-story', storyName.dirName);
    button.textContent = storyName.name;
    return button;
};

/**
 * Returns back an array of storyName objects to generate buttons for
 * @param {Array} data 
 */
const generateButtons = (data) => {
    const home = document.getElementById('home');
    data.forEach(async (storyName) => {
        home.appendChild(generateButton(storyName))
    })
};


ipcRenderer.on('list-stories', (event, data) => {
    generateButtons(data)
});

