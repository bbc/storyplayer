const { ipcRenderer } = require('electron');
const { mediaResolver } = require('./mediaResolver.js');
const logger = require('./logger')

const StoryPlayer = window.Romper;

let storyPlayer;

const storyPlayerTarget = document.getElementById('storyplayer-target');

/**
 * Renders an error message
 * @param {*} error Error object
 */
const displayErrorMessage = (error) => {
    logger.error(error);
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
    if(storyPlayerTarget) {
        while (storyPlayerTarget.firstChild) {
            storyPlayerTarget.removeChild(storyPlayerTarget.firstChild);
        }
    }
};



const hideHomePage = () => {
    const homePage = document.getElementById('main-content');
    if(homePage) {
        homePage.style.display = "none"; 
    }
};



const showHomePage = () => {
    destroyStoryPlayer();
    const homePage = document.getElementById('main-content');
    replaceTitle('Storyplayer');
    if(homePage) {
        homePage.style.display = "block"; 
    }
};
document.getElementById("home-button").addEventListener("click", showHomePage); 

/**
 * initializes storyplayer 
 * @param {*} experience Experience Data Model
 */
const initializeStoryPlayer = (experience) => {
    storyPlayer = StoryPlayer.init({
        target: storyPlayerTarget,
        staticImageBaseUrl: 'src/assets/images',
        analyticsLogger: event => {
            logger.info('ANALYTICS:', event);
        },
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
    storyPlayer.start(experience.stories[0].id);
}

const hideMainInterface = () => {
    const mainInterface = document.getElementById('main-interface');
    if(mainInterface) {
        mainInterface.style.display = 'none';
    }
};

const showMainInterface = () => {
    const mainInterface = document.getElementById('main-interface');
    if(mainInterface) {
        mainInterface.style.display = 'block';
    }
}

/**
 * Event listener on finding a story we either error or render the player
 */
ipcRenderer.on('found-story', (event, data) => {
    logger.info(data);
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
        }
        initializeStoryPlayer(data);
    }
});



module.exports = {
    initializeStoryPlayer,
    destroyStoryPlayer,
    replaceTitle,
    displayErrorMessage,
}

