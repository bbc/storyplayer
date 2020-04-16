require('./mainRenderer');
require('./homeRenderer');
const { showHomePage } = require('./mainRenderer');

const pageDidLoad = () => {

    const homeButton = document.getElementById("home-button")
    if(homeButton) {
        homeButton.addEventListener("click", showHomePage); 
    }
};



document.addEventListener('DOMContentLoaded',pageDidLoad);