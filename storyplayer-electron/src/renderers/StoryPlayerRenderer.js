const {
    ipcRenderer
} = require('electron');
const {
    mediaResolver
} = require('./mediaResolver.js');
const StoryPlayer = require('../dist/romper');
const logger = require('../mainProcess/logger')


class StoryPlayerRenderer {
    constructor() {
        this.logger = logger;
        this.storyPlayer = null;
        this.experienceid = null;
        this.targetElement = document.getElementById('storyplayer-target');
        this.titleElement = document.getElementById('title');
        this.mainInterface = document.getElementById('main-interface');
        this.homePage = document.getElementById('main-content');

    }

    /**
     * Renders an error message
     * @param {*} error Error object
     */
    displayErrorMessage(error) {
        logger.error(error);
        const errorElement = document.getElementById('error-message');
        errorElement.textContent = error.error;
    }

    /**
     * Replaces the title of the page with the story name
     * @param {*} firstStory parent story
     */
    replaceTitle(title) {
        this.titleElement.textContent = title;
    }

    /**
     * Destroys the storyplayer instance and removes the child nodes from the DOM
     */
    destroyStoryPlayer() {
        if (this.storyPlayer) {
            this.storyPlayer.reset();
        }
        this.storyPlayer = null;
        if (this.storyPlayerTarget) {
            while (this.storyPlayerTarget.firstChild) {
                this.storyPlayerTarget.removeChild(this.storyPlayerTarget.firstChild);
            }
        }
    }

    hideMainInterface() {
        if (this.mainInterface) {
            this.mainInterface.style.display = 'none';
        }
    }

    hideHomePage() {
        if (this.homePage) {
            this.homePage.style.display = "none";
        }
    }

    showHomePage() {
        destroyStoryPlayer();
        replaceTitle('StoryPlayer');
        if (this.homePage) {
            this.homePage.style.display = "block";
        }
        hideMainInterface();
    }

    // we send the command to the main process so we don't have any electron remote apis in the window, helps with XSS attacks
    reloadWindow() {
        ipcRenderer.send('reload')
    }

    getTooExperienceid(experience) {
        const topStory = experience.stories && experience.stories[0];
        this.experienceId = topStory.id || 'noID'
    }

    analyticsHandler(analyticsEvent) {
        analyticsEvent.experienceId = this.experienceId;
        analyticsEvent.timestamp = Date.now();
        ipcRenderer.send('analyticsEvent', analyticsEvent);
    }

    initializeStoryPlayer(experience) {
        const storyPlayerTarget = getTargetElement();
        const imagePath = new URLSearchParams(window.location.search).get('imagePath');
        this.storyPlayer = StoryPlayer.init({
            target: this.storyPlayerTarget,
            staticImageBaseUrl: imagePath,
            analyticsLogger: this.analyticsHandler,
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
        this.storyPlayer.start(experience.stories[0].id);
    }


    foundStory() {
        /**
         * Event listener on finding a story we either error or render the player
         */
        ipcRenderer.on('found-story', (event, data) => {
            logger.info(data);
            if (!data || data.error !== undefined) {
                this.displayErrorMessage(data);
                this.showHomePage();
                this.hideMainInterface();
            } else {
                this.destroyStoryPlayer();
                this.hideHomePage();
                this.showMainInterface();
                const firstStory = data.stories[0];
                if (firstStory.meta && firstStory.meta.storyplayer && firstStory.meta.storyplayer.htmltitle) {
                    this.replaceTitle(firstStory.meta.storyplayer.htmltitle);
                }
                this.initializeStoryPlayer(data);
            }
        });
    }

};
