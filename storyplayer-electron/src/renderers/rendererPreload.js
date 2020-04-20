require('./mainRenderer');
require('./homeRenderer');
const { showHomePage } = require('./mainRenderer');

const pageDidLoad = () => {

    const homeButton = document.getElementById("home-button")
    if(homeButton) {
        homeButton.addEventListener("click", showHomePage); 
    }

    const documentsElement = document.getElementById('documents-folder');

    if(documentsElement) {
        if(process.platform === 'darwin') {
            documentsElement.textContent = 'Home Documents folder, usually this is in your home or user folder.';
        } else if(process.platform === 'win32') {
            documentsElement.textContent = 'My Documents folder, usually this is in your user folder.';
        }
        else {
            documentsElement.textContent = 'Home Documents folder, usually this is in your user profile folder.';
        }
    }
};



document.addEventListener('DOMContentLoaded',pageDidLoad);