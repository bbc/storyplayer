const { ipcRenderer } = require('electron');
const { mediaResolver } = require('./mediaResolver.js');
const logger = require('./logger')

const StoryPlayer = window.Romper;

let storyPlayer;

const storyPlayerTarget = document.getElementById('storyplayer-target');

const displayErrorMessage = (error) => {
    logger.error(error);
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = error.error;
}

const replaceTitle = (firstStory) => {
    if (firstStory.meta && firstStory.meta.storyplayer && firstStory.meta.storyplayer.htmltitle) {
        const titleElement = document.getElementById('title');
        titleElement.textContent = firstStory.meta.storyplayer.htmltitle;
    }
};

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
}

// start storyPlayer
const initializeStoryPlayer = (config) => {
    storyPlayer = StoryPlayer.init({
        target: storyPlayerTarget,
        staticImageBaseUrl: 'src/assets/images',
        analyticsLogger: event => {
            logger.info('ANALYTICS:', event);
        },
        mediaFetcher: mediaResolver({}),
        
        storyFetcher: id => Promise.resolve(config.stories.find(story => story.id === id)),
        
        representationCollectionFetcher: id => Promise.resolve(
            config.representation_collections.filter(repCollection => repCollection.id === id)[0]
        ).then(repCol => repCol || Promise.reject(new Error(`no such presentation object: ${id}`))),
        
        assetCollectionFetcher: id => Promise.resolve(
            config.asset_collections.filter(ac => ac.id === id)[0]
        ).then(ac => ac || Promise.reject(new Error(`no such asset collection: ${id}`))),
        
        representationFetcher: id => Promise.resolve(
            config.representations.filter(rep => rep.id === id)[0]
        ).then(rep => rep || Promise.reject(new Error(`no such representation: ${id}`))),

        narrativeElementFetcher: id => Promise.resolve(
            config.narrative_elements.filter(ne => ne.id === id)[0]
        ).then(ne => ne || Promise.reject(new Error(`no such narrative element: ${id}`))),

        subStoryFetcher: id => Promise.resolve(
            config.stories.find(s => s.narrative_elements.includes(id))[0]
        ).then(story => story || Promise.reject(new Error('no story for narrative element'))),
    });
    storyPlayer.start(config.stories[0].id);
}


// event listener for story
ipcRenderer.on('found-story', (event, data) => {
    logger.info(data);
    if (!data || data.error !== undefined) {
        displayErrorMessage(data)
    } else {
        destroyStoryPlayer();
        const firstStory = data.stories[0];
        replaceTitle(firstStory);
        initializeStoryPlayer(data);
    }
});



module.exports = {
    resetStoryPlayer: initializeStoryPlayer,
    replaceTitle,
    displayErrorMessage,
}

