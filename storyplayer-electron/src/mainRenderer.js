const { ipcRenderer } = require('electron');
const { mediaResolver } = require('./mediaResolver.js');

const StoryPlayer = window.Romper;


const displayErrorMessage = (error) => {
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = error.error;
}

const replaceTitle = (firstStory) => {
    if (firstStory.meta && firstStory.meta.storyplayer && firstStory.meta.storyplayer.htmltitle) {
        const titleElement = document.getElementById('title');
        titleElement.textContent = firstStory.meta.storyplayer.htmltitle;
    }
};

// start storyPlayer
const resetStoryPlayer = (config) => {
    const storyPlayer = StoryPlayer.init({
        target: document.getElementById('storyplayer-target'),
        staticImageBaseUrl: 'src/assets/images',
        analyticsLogger: dataObj => {
            console.log('ANALYTICS:', dataObj);
        },
        storyFetcher: id => Promise.resolve().then(() => config.stories.filter(storyObject => storyObject.id === id)[0]
        ),
        mediaFetcher: mediaResolver({}),
        representationCollectionFetcher: id => Promise.resolve(
            config.representation_collections.filter(presentationObject => presentationObject.id === id)[0]
        ).then(presentationObject => (presentationObject || Promise.reject(`no such presentation object: ${  id}`))),
        assetCollectionFetcher: id => Promise.resolve(
            config.asset_collections.filter(assetCollectionObject => assetCollectionObject.id === id)[0]
        ).then(assetCollectionObject => assetCollectionObject || Promise.reject(`no such asset collection: ${  id}`)),
        representationFetcher: id => Promise.resolve(
            config.representations.filter(representationObject => representationObject.id === id)[0]
        ).then(representationObject => representationObject || Promise.reject(`no such representation: ${  id}`)),
        narrativeElementFetcher: id => Promise.resolve(
            config.narrative_elements.filter(narrativeElementObject => narrativeElementObject.id === id)[0]
        ).then(narrativeElementObject => narrativeElementObject || Promise.reject(`no such narrative element: ${  id}`)),
        subStoryFetcher: id => Promise.resolve(config.stories.find(s => s.narrative_elements.includes(id))[0]
        ).then(storyObject => storyObject || Promise.reject('no story for narrative element')),
    });
    storyPlayer.start(config.stories[0].id);
}


// event listener for story
ipcRenderer.on('found-story', (event, data) => {
    if (data.error !== undefined) {
        displayErrorMessage(data)
    } else {
        resetStoryPlayer(data);
        const firstStory = data.stories[0];
        replaceTitle(firstStory);
    }
});

// send a get story event;
// this will be extended to fetch the story id
ipcRenderer.send('get-story', 'story');