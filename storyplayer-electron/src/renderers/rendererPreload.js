require('./mainRenderer');
require('./homeRenderer');
const { showHomePage, reloadWindow } = require('./mainRenderer');

const pageDidLoad = () => {

    const homeButton = document.getElementById("home-button")
    if(homeButton) {
        homeButton.addEventListener("click", showHomePage); 
    }

    const reloadWindowButton = document.getElementById('reload-button') 
    if(reloadWindowButton) {
        reloadWindowButton.addEventListener("click", reloadWindow);
    }

    const documentsElement = document.getElementById('documents-folder');

    if(documentsElement) {
        if(process.platform === 'darwin') {
            documentsElement.textContent = 'Home/Documents folder.';
        } else if(process.platform === 'win32') {
            documentsElement.textContent = 'My Documents folder, which is usually inside your User folder.';
        }
        else {
            documentsElement.textContent = 'Home/Documents folder.';
        }
    }
};



document.addEventListener('DOMContentLoaded',pageDidLoad);