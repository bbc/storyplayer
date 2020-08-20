const { ipcRenderer } = require('electron');
const { mediaResolver } = require('./mediaResolver.js');
const StoryPlayer = require('../dist/romper');
const browserLogger = require('./logger');


let storyPlayer;


const getTargetElement = () => {
    return document.getElementById('storyplayer-target');
}

/**
 * Renders an error message
 * @param {*} error Error object
 */
const displayErrorMessage = (error) => {
    browserLogger.error(error);
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = error.error;
};

/**
 * Replaces the title of the page with the story name
 * @param {*} firstStory parent story
 */
const replaceTitle = (title) => {
    const titleElement = document.getElementById('title');
    titleElement.textContent = title;
};

/**
 * Destroys the storyplayer instance and removes the child nodes from the DOM
 */
const destroyStoryPlayer = () => {
    if(storyPlayer) {
        storyPlayer.reset();
    }
    storyPlayer = null;
    const storyPlayerTarget = getTargetElement();
    if(storyPlayerTarget) {
        while (storyPlayerTarget.firstChild) {
            storyPlayerTarget.removeChild(storyPlayerTarget.firstChild);
        }
    }

};

const hideMainInterface = () => {
    const mainInterface = document.getElementById('main-interface');
    if(mainInterface) {
        mainInterface.style.display = 'none';
    }
    const homeButton = document.getElementById('home-button');
    homeButton.classList.add('disabled');
    homeButton.classList.remove('home-buttons');
};

const showMainInterface = () => {
    const mainInterface = document.getElementById('main-interface');
    if(mainInterface) {
        mainInterface.style.display = 'block';
    }
    const homeButton = document.getElementById('home-button');
    homeButton.classList.remove('disabled');
    homeButton.classList.add('home-buttons');
}

const hideHomePage = () => {
    const homePage = document.getElementById('main-content');
    if(homePage) {
        homePage.style.display = "none"; 
    }
};

const showHomePage = () => {
    destroyStoryPlayer();
    const homePage = document.getElementById('main-content');
    replaceTitle('');
    if(homePage) {
        homePage.style.display = "block"; 
    }
    hideMainInterface();
};

// we send the command to the main process so we don't have any electron remote apis in the window, helps with XSS attacks
const reloadWindow = () => {
    ipcRenderer.send('reload')
};

const getTooExperienceId = (experience) => {
    const topStory = experience.stories && experience.stories[0];
    return topStory.id || 'noID';
}


/**
 * initializes storyplayer 
 * @param {*} experience Experience Data Model
 */
const initializeStoryPlayer = (experience) => {    
    const storyPlayerTarget = getTargetElement();
    const imagePath = new URLSearchParams(window.location.search).get('imagePath');
    const experienceId = getTooExperienceId(experience);
    storyPlayer = StoryPlayer.init({
        target: storyPlayerTarget,
        staticImageBaseUrl: imagePath,
        // remove-analytics
        analyticsLogger: () => undefined,
        mediaFetcher: mediaResolver({}),
        
        storyFetcher: id => Promise.resolve(experience.stories.find(story => story.id === id)),
        
        representationCollectionFetcher: id => Promise.resolve(
            experience.representation_collections.filter(repCollection => repCollection.id === id)[0]
        ).then(repCol => repCol || Promise.reject(new Error(`no such presentation object: ${id}`))),
        
        assetCollectionFetcher: id => Promise.resolve(
            experience.asset_collections.filter(ac => ac.id === id)[0]
        ).then(ac => ac || Promise.reject(new Error(`no such asset collection: ${id}`))),
        
        representationFetcher: id => Promise.resolve(
            experience.representations.filter(rep => rep.id === id)[0]
        ).then(rep => rep || Promise.reject(new Error(`no such representation: ${id}`))),

        narrativeElementFetcher: id => Promise.resolve(
            experience.narrative_elements.filter(ne => ne.id === id)[0]
        ).then(ne => ne || Promise.reject(new Error(`no such narrative element: ${id}`))),

        subStoryFetcher: id => Promise.resolve(
            experience.stories.find(s => s.narrative_elements.includes(id))[0]
        ).then(story => story || Promise.reject(new Error('no story for narrative element'))),
    });
    storyPlayer.start(experienceId);
}


/**
 * Event listener on finding a story we either error or render the player
 */
ipcRenderer.on('found-story', (event, data) => {
    browserLogger.info(data);
    if (!data || data.error !== undefined) {
        displayErrorMessage(data);
        showHomePage();
        hideMainInterface();
    } else {
        destroyStoryPlayer();
        hideHomePage();
        showMainInterface();
        const firstStory = data.stories[0];
        if (firstStory.meta && firstStory.meta.storyplayer && firstStory.meta.storyplayer.htmltitle) {
            replaceTitle(firstStory.meta.storyplayer.htmltitle);
        } else {
            replaceTitle(firstStory.name);
        }
        initializeStoryPlayer(data);
    }
});


module.exports = {
    initializeStoryPlayer,
    destroyStoryPlayer,
    replaceTitle,
    displayErrorMessage,
    showHomePage,
    reloadWindow,
}

