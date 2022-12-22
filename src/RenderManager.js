// @flow

import EventEmitter from 'events';
import type {
    NarrativeElement, ExperienceFetchers, Representation,
    RepresentationChoice, AssetUrls, AssetCollection,
} from './storyplayer';
import type { RepresentationReasoner } from './RepresentationReasoner';
import BaseRenderer, { RENDERER_PHASES } from './renderers/BaseRenderer';
import RendererFactory from './renderers/RendererFactory';
import type { StoryPathItem } from './StoryPathWalker';
import StoryIconRenderer from './renderers/StoryIconRenderer';
import SwitchableRenderer from './renderers/SwitchableRenderer';
import BackgroundRendererFactory from './renderers/BackgroundRendererFactory';
import BackgroundRenderer from './renderers/BackgroundRenderer';
import Controller, { PLACEHOLDER_REPRESENTATION } from './Controller';
import RendererEvents from './renderers/RendererEvents';
import logger from './logger';
import type { AnalyticsLogger } from './AnalyticEvents';
import AnalyticEvents from './AnalyticEvents';

import Player, { PlayerEvents } from './gui/Player';
import { REASONER_EVENTS, DOM_EVENTS } from './Events';
import { getSetting, DISABLE_LOOKAHEAD_FLAG, getControlHideList } from './utils';

const FADE_OUT_TIME = 2; // default fade out time for backgrounds, in s

export default class RenderManager extends EventEmitter {

    constructor(
        controller: Controller,
        target: HTMLElement,
        representationReasoner: RepresentationReasoner,
        fetchers: ExperienceFetchers,
        analytics: AnalyticsLogger,
        assetUrls: AssetUrls,
        privacyNotice: ?string,
    ) {
        super();

        this._controller = controller;
        this._target = target;
        this._representationReasoner = representationReasoner;
        this._fetchers = fetchers;
        this._analytics = analytics;
        this._assetUrls = assetUrls;
        this._handleClose = this._handleClose.bind(this);
        this._handleVisibilityChange = this._handleVisibilityChange.bind(this);
        this._handleOrientationChange = this._handleOrientationChange.bind(this);
        this._setVolumePersistence = this._setVolumePersistence.bind(this);
        this._privacyNotice = privacyNotice;

        this._player = new Player(this._target, this._analytics, this._assetUrls, this._controller);
        this._player.on(PlayerEvents.BACK_BUTTON_CLICKED, () => {
            if (this._currentRenderer) {
                this._currentRenderer.emit(RendererEvents.PREVIOUS_BUTTON_CLICKED);
            }
        });
        this._player.on(PlayerEvents.NEXT_BUTTON_CLICKED, () => {
            if (this._currentRenderer) {
                const rend = this._currentRenderer;
                const choiceTime = rend.getChoiceTime();
                const { duration, currentTime } = rend.getCurrentTime();
                if (duration === Infinity){
                    logger.info('Next button clicked during infinite representation - completing element'); // eslint-disable-line max-len
                    this._currentRenderer.complete();
                }
                else if (choiceTime > 0 && currentTime < choiceTime) {
                    logger.info('Next button clicked on element with choices, skip to them');
                    rend.setCurrentTime(choiceTime);
                } else if (rend.hasVariablePanelBehaviour()
                    || (rend.hasShowIconBehaviour() && choiceTime < 0)) {
                    // choices or var panel as end behaviour
                    const representationId = rend.getRepresentation().id;
                    logger.info('Next button ignored due to variable panel/choices, skip to end');
                    // skip to end if we have time-based media
                    // (if not, will continue to play then trigger another ended event)
                    const playoutDuration = this._player.playoutEngine.getDuration(representationId)
                    if (currentTime && playoutDuration) {
                        const playout = this._player.playoutEngine;
                        // skip to 1/4 s before end
                        playout.setCurrentTime(representationId, playoutDuration);
                    } else if (this._currentRenderer) {
                        this._currentRenderer.complete();
                    }
                } else {
                    rend.emit(RendererEvents.NEXT_BUTTON_CLICKED);
                }
            }
        });
        this._player.on(PlayerEvents.REPEAT_BUTTON_CLICKED, () => {
            if (this._controller._currentNarrativeElement) {
                this._controller.repeatStep();
            }
        });
        this._player.on(PlayerEvents.VOLUME_CHANGED, (event) => {
            this._rendererState.volumes[event.label] = event.value;
        });

        this._player.on(PlayerEvents.AUDIO_MIX_CHANGED, (event) => {
            this._rendererState.volumes[event.label] = event.value;
        });

        this._player.on(PlayerEvents.VOLUME_MUTE_TOGGLE, (event) => {
            this._rendererState.muted[event.label] = event.muted;
        });
        // pause background fade when fg renderer pauses
        this._player.on(PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED, () => {
            if (this._player.playoutEngine.isPlaying()) {
                Object.keys(this._backgroundRenderers).forEach(bgrId =>
                    this._backgroundRenderers[bgrId].resumeFade());
            } else {
                Object.keys(this._backgroundRenderers).forEach(bgrId =>
                    this._backgroundRenderers[bgrId].pauseFade());
            }
        });

        if (typeof document.hidden !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                this._handleVisibilityChange(!document.hidden);
            });
        // @flowignore
        } else if (typeof document.webkitHidden !== 'undefined') {
            document.addEventListener('webkitvisibilitychange', () => {
                // @flowignore
                this._handleVisibilityChange(!document.webkitHidden);
            });
        }

        window.addEventListener('orientationchange', this._handleOrientationChange, false);
        window.addEventListener('beforeunload', this._handleClose, false);

        this._player.on(REASONER_EVENTS.ROMPER_STORY_STARTED, () => {
            this.emit(REASONER_EVENTS.ROMPER_STORY_STARTED);
        });

        this._initialise();

        // send fullscreen events
        this._player.on(DOM_EVENTS.TOGGLE_FULLSCREEN, (event) => this.emit(DOM_EVENTS.TOGGLE_FULLSCREEN, event));
    }

    _handleOrientationChange() {
        this._analytics({
            type: AnalyticEvents.types.RENDERER_ACTION,
            name: AnalyticEvents.names.WINDOW_ORIENTATION_CHANGE,
            from: 'unset',
            to: window.orientation,
        });
    }

    /**
     * Event handler for when the visibility of the tab changes
     * @param {boolean} isVisible
     */
    _handleVisibilityChange(isVisible: boolean) {
        this._analytics({
            type: AnalyticEvents.types.RENDERER_ACTION,
            name: AnalyticEvents.names.BROWSER_VISIBILITY_CHANGE,
            from: isVisible ? 'hidden' : 'visible',
            to: isVisible ? 'visible' : 'hidden',
        });

        const { meta } = this._story;
        if (meta.storyplayer && meta.storyplayer.disable_tab_defocus) return;

        if (!isVisible) {
            this._isPlaying = this._player.playoutEngine.isPlaying();
            if (this._currentRenderer && !this._currentRenderer.hasMediaEnded()) {
                // if not waiting at the end, pause the timer for the current representation
                this._currentRenderer.pause();
                this._player.playoutEngine.pause();
            }
            this._player.playoutEngine.pauseBackgrounds();
        } else {
            if (
                this._currentRenderer
                && this._isPlaying 
                && this._currentRenderer.phase === RENDERER_PHASES.MAIN
            ) {
                // unless it has already ended, set it going again
                if (this._currentRenderer && !this._currentRenderer.hasMediaEnded()) {
                    this._currentRenderer.play();
                    this._player.playoutEngine.play();
                }
            }
            if (this._player.playoutEngine.hasStarted()
                && this._player.userInteractionStarted()
            ) {
                this._player.playoutEngine.playBackgrounds();
            }
            if (this._player._choiceCountdownTimeout && this._currentRenderer) {
                // restart countdown
                this._player.startChoiceCountdown(this._currentRenderer);
            }
        }
    }

    /**
    * intercepts the browser/tab close / back button event and logs this event in the analytics
    */
    _handleClose() {
        this._analytics({
            type: AnalyticEvents.types.RENDERER_ACTION,
            name: AnalyticEvents.names.BROWSER_CLOSE_CLICKED,
            from: 'unset',
            to: 'unset',
        });
    }

    /**
     * Fetches the start image and calls the Player to setup the overlays
     * @param {Object} story top level story
     */
    async fetchStartImage(story: Object) {
        let onLaunchConfig = {
            background_art_asset_collection_id: '',
            button_class: 'romper-start-button',
            text: 'Start',
            hide_narrative_buttons: true,
            background_art: this._assetUrls.noBackgroundAssetUrl,
            privacy_notice: this._privacyNotice,
        };
        if (story.meta && story.meta.romper && story.meta.romper.onLaunch) {
            onLaunchConfig = Object.assign(onLaunchConfig, story.meta.romper.onLaunch);
            try {
                const fg = await this._fetchers.assetCollectionFetcher(onLaunchConfig.background_art_asset_collection_id);
                if (fg.assets.image_src) {
                    const mediaUrl = await this._fetchers.mediaFetcher(fg.assets.image_src);
                    logger.info(`FETCHED FROM MS MEDIA! ${mediaUrl}`);
                    return this._player.setupExperienceOverlays(Object.assign(
                        onLaunchConfig, {
                            background_art: mediaUrl
                        },
                    ));
                }
                throw new Error('Could not find splash image Asset Collection');
            } catch (err) {
                logger.error(err, `Could not resolve splash image asset: ${err}`);
                this._player.setupExperienceOverlays(Object.assign(
                    onLaunchConfig, {
                        background_art: this._assetUrls.noBackgroundAssetUrl
                    },
                ));
            }
        }
        logger.warn('No onLaunch config in story meta');
        return this._player.setupExperienceOverlays(Object.assign(
            onLaunchConfig,
            { background_art: this._assetUrls.noBackgroundAssetUrl },
        ));
    }

    /**
     * Fetches the DOG if there is one then
     * @param {Object} story - top level story
     */
    async fetchDog(story: Object) {
        if (story.meta && story.meta.romper && story.meta.romper.dog) {
            try {
                const dog = Object.assign(story.meta.romper.dog);
                const fg = await this._fetchers.assetCollectionFetcher(dog.asset_collection_id)
                if (fg.assets.image_src) {
                    const mediaUrl = await this._fetchers.mediaFetcher(fg.assets.image_src);
                    this._player.addDog(mediaUrl, dog.position);
                }
            } catch (err) {
                logger.error(`Cannot resolve DOG asset: ${err}`)
            }
        }
    }

    /**
     * Handle starting the story by fetching the story annd setting the aspect ratio, dog and start image
     * @param {string} storyId Top level story Id
     */
    async handleStoryStart(storyId: string) {
        try {
            const story = await this._fetchers.storyFetcher(storyId);
            this._story = story;
            this._player.disableControls();
            this._setAspectRatio(story);
            await this.fetchDog(story)
            return await this.fetchStartImage(story);
        } catch (err) {
            logger.error(err, `Could not get fetch story ${err}`);
            return null;
        }
    }

    /**
     * Show an error message over everything
     * Optionally disable controls and remove start button
     * @param {string} message The message to show
     * @param {boolean} message Should controls be disabled
     * @param {boolean} message Should overlays (e.g., start button) be removed
     * 
     */
    showError(message, disableControls, clearOverlays) {
        this._player.showErrorLayer(message);
        if (disableControls) this._player.disableControls();
        if (clearOverlays) this._player.clearStartButton();
    }

    _setAspectRatio(story: Object) {
        let aspectRatio = 16 / 9;
        if (story.meta
        && story.meta.storyplayer
        && story.meta.storyplayer.aspect_ratio) {
            aspectRatio =  story.meta.storyplayer.aspect_ratio;
        }
        this._player.setAspectRatio(aspectRatio);
    }

    handleNEChange(narrativeElement: NarrativeElement) {
        this._player.clearLinkChoices();
        if (narrativeElement.body.representation_collection_target_id) {
            // eslint-disable-next-line max-len
            return this._fetchers.representationCollectionFetcher(narrativeElement.body.representation_collection_target_id)
                .then((representationCollection) => {
                    if (representationCollection.representations.length > 0) {
                        return this._representationReasoner(representationCollection);
                    }
                    // need to render description only as placeholder
                    const dummyRep = {
                        ...PLACEHOLDER_REPRESENTATION,
                        description: narrativeElement.description,
                        id: narrativeElement.id,
                    };
                    return Promise.resolve(dummyRep);
                })
                .then((representation) => {
                    if (this._currentNarrativeElement
                            && this._currentNarrativeElement.id === narrativeElement.id
                            && this._currentRenderer
                            // need to use _representation as switchable getRepresentation
                            // reports current choice id
                            && this._currentRenderer._representation.id === representation.id) {
                        this._restartCurrentRenderer();
                    } else {
                        // get a Renderer for this new NE
                        const newRenderer = this._getRenderer(narrativeElement, representation);

                        // look ahead and create new renderers for the next/previous step
                        this._rendererLookahead(narrativeElement);

                        if (newRenderer) {
                            // swap renderers
                            this._swapRenderers(newRenderer, narrativeElement);
                            // handle backgrounds
                            this._handleBackgroundRendering(newRenderer.getRepresentation());
                        }

                        // tell story renderer that we've changed
                        if (this._renderStory) {
                            this._renderStory.handleNarrativeElementChanged(representation.id);
                        }
                    }
                });
        }
        return Promise.reject(new Error('No representation_collection_target_id on NE'));
    }

    // get the current narrative element object
    getCurrentNarrativeElement(): NarrativeElement {
        return this._currentNarrativeElement;
    }

    // get the current Renderer
    getCurrentRenderer(): ?BaseRenderer {
        return this._currentRenderer;
    }

    /**
     * Creates the story icons and starts the renderer
     * @param {Array<StoryPathItem>} storyItemPath Array of path items for the icons and target narrative elements
     */
    _createStoryIconRenderer(storyItemPath: Array<StoryPathItem>) {
        const hideList = getControlHideList(null, this._story);
        if (hideList.includes('chapters')) return;
        this._renderStory = new StoryIconRenderer(
            storyItemPath,
            this._fetchers.assetCollectionFetcher,
            this._fetchers.mediaFetcher,
            this._player,
        );

        this._renderStory.on(REASONER_EVENTS.JUMP_TO_NARRATIVE_ELEMENT, (neid) => {
            this._controller._jumpToNarrativeElement(neid);
        });

        if (this._currentRenderer) {
            this._renderStory.start(this._currentRenderer.getRepresentation().id);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    getBackgroundIds(representation: Representation) {
        if(representation.asset_collections.background_ids) {
            return representation.asset_collections.background_ids
        }
        return [];
    }


    /**
     * accepts an array of asset collections for this representation backgrounds
     * checks whether we have a renderer for these so to maintain background music continuity
     * otherwise stops all the other background renderers
     * @param {AssetCollection[]} assetCollections 
     */
    stopCurrentBackgroundRenderers(assetCollections: ?AssetCollection[]) {
        const renderersToKeep = [];
        if (assetCollections && assetCollections.length > 0) {
            assetCollections.forEach(ac => {
                if (ac.assets.audio_src) {
                    const src = ac.assets.audio_src;
                    // if we already have a background renderer for this then we want to keep it
                    if (this.hasRendererForBackground(src)) {
                        renderersToKeep.push(src);
                    }
                }
            });
        }

        Object.keys(this._backgroundRenderers).forEach((rendererSrc) => {
            if(renderersToKeep.includes(rendererSrc)) {
                return;
            }
            this.stopBackgroundRenderer(rendererSrc);
        });
    }

    /**
     * If the renderer is needed in up coming representations stop it
     * otherwise destroy it and remove it from the pool of background renderers
     * unless it is explicitly told to be kept around as the current representation has it
     * @param {string} rendererSrc Background renderer source
     */
    stopBackgroundRenderer(rendererSrc: string) {
        const backgroundRenderer = this._backgroundRenderers[rendererSrc];
        if (this.hasUpComingRenderersForBackground(rendererSrc)) {
            // end the renderer we want to keep it around for the next representation
            backgroundRenderer.end();
        } else {
            backgroundRenderer.destroy();
        }
        delete this._backgroundRenderers[rendererSrc];
    }

    /**
     * Cleans up all the active foreground renderers for a 
     * list of element ids where we are not using them
     * @param {NarrativeElement} narrativeElement 
     * @param {*} allIds 
     */
    cleanupActiveRenderers(narrativeElement: NarrativeElement, allIds: string[]) {
        Object.keys(this._activeRenderers)
            .filter(neid => allIds.indexOf(neid) === -1)
            .filter(neid => {
                // make sure we aren't deleting current renderer
                return (this._currentNarrativeElement === undefined) || 
                    (neid !== this._currentNarrativeElement.id);
            })
            .forEach((neid) => {
                if (narrativeElement.id !== neid) {
                    this._activeRenderers[neid].destroy();
                }
                logger.info(`Deleting renderer for NE ${neid}`);
                delete this._activeRenderers[neid];
            });
    }

    /**
     * Checks this._backgroundRenderers contains a renderer for a given src
     * @param {string} src 
     */
    hasRendererForBackground(src: string) {
        if(!src) return false;
        return Object.keys(this._backgroundRenderers).includes(src);
    }

    /**
     * Checks this._upcomingBackgroundRenderers contains a renderer for a given src
     * @param {string} src 
     */
    hasUpComingRenderersForBackground(src: string) {
        if(!src) return false;
        return Object.keys(this._upcomingBackgroundRenderers).includes(src);
    }


    /**
     * Creates a new background renderer for a given asset collection
     * or picks it from the up comming background renderers we currently have
     * And starts the renderer
     * @param {AssetCollection} assetCollection 
     * @param {string} src 
     */
    createNewBackgroundRenderer(assetCollection: AssetCollection, src: string): ? BackgroundRenderer {
        if (this.hasUpComingRenderersForBackground(src)) {
            return this._upcomingBackgroundRenderers[src];
        }
        return BackgroundRendererFactory(
            assetCollection.asset_collection_type,
            assetCollection,
            this._fetchers.mediaFetcher,
            this._player,
        );

    }

    /**
     * Gets all the background asset collections
     * @param {*} backgroundIds 
     */
    async getBackgroundAudioAssets(backgroundIds: string[]) {
        return Promise.all(backgroundIds.map(assetId => this._fetchers.assetCollectionFetcher(assetId)));
    }

    /**
     * given a new representation, handle the background rendering
     * either:
     *      stop if there is no background
     *      continue with the current one (do nothing) if background is same asset_collection
     *      or start a new background renderer
     * @param {*} representation
     */
    async _handleBackgroundRendering(representation: Representation) {
        if (!representation) {
            return;
        }
        const newBackgrounds = this.getBackgroundIds(representation);

        // if there are no new backgrounds to render we stop all the current ones and exit
        if (newBackgrounds.length === 0) {
            this.stopCurrentBackgroundRenderers();
            return;
        }

        // gets all the background asset collections and picks the audio srcs
        const assetCollections = await this.getBackgroundAudioAssets(newBackgrounds);
        // stop the renderers we don't want to keep
        this.stopCurrentBackgroundRenderers(assetCollections);

        // if we have don't have a renderer for this background then add it to list of renderers to start
        assetCollections.forEach(ac => {
            if(ac.assets.audio_src) {
                const src = ac.assets.audio_src;
                if(!this.hasRendererForBackground(src)) {
                    // create a new background renderer and start it
                    const newBackgroundRenderer = this.createNewBackgroundRenderer(ac, src);
                    if (newBackgroundRenderer) {
                        newBackgroundRenderer.start();
                        this._backgroundRenderers[src] = newBackgroundRenderer;
                    }
                } 
            }
        });
    }

    /**
     * Move on to the next node of this story.
     * create a new renderer for the given representation, and attach
     * the standard listeners to it
     *
     * @fires RenderManager#complete
     * @fires RenderManager#nextButtonClicked
     * @fires RenderManager#PreviousButtonClicked
     * @param {*} representation
     */
    _createNewRenderer(representation: Representation): ? BaseRenderer {
        const newRenderer = RendererFactory(
            representation,
            this._fetchers.assetCollectionFetcher,
            this._fetchers.mediaFetcher,
            this._player,
            this._analytics,
            this._controller,
        );

        if (newRenderer) {
            // now it has been constructed, start fetching all the media and building the components
            newRenderer.init();
            newRenderer.on(RendererEvents.COMPLETED, () => {
                this.emit(RendererEvents.COMPLETED);
            });
            newRenderer.on(RendererEvents.NEXT_BUTTON_CLICKED, () => {
                this.emit(RendererEvents.NEXT_BUTTON_CLICKED);
            });
            newRenderer.on(RendererEvents.PREVIOUS_BUTTON_CLICKED, () => {
                this.emit(RendererEvents.PREVIOUS_BUTTON_CLICKED);
            });
            newRenderer.on(
                RendererEvents.SWITCHED_REPRESENTATION,
                (choice: RepresentationChoice) => {
                    this._rendererState.lastSwitchableLabel = choice.label;
                    if (choice.choice_representation) {
                        this._handleBackgroundRendering(choice.choice_representation);
                    }
                    // Set index of each queued switchable
                    Object.keys(this._activeRenderers).forEach((rendererNEId) => {
                        const renderer = this._activeRenderers[rendererNEId];
                        if (renderer instanceof SwitchableRenderer
                            && this._rendererState.lastSwitchableLabel) {
                            // eslint-disable-next-line max-len
                            renderer.setChoiceToRepresentationWithLabel(this._rendererState.lastSwitchableLabel);
                        }
                    });
                    // ensure volume persistence
                    this._setVolumePersistence();
                },
            );

            if (newRenderer instanceof SwitchableRenderer
                && this._rendererState.lastSwitchableLabel) {
                // eslint-disable-next-line max-len
                newRenderer.setChoiceToRepresentationWithLabel(this._rendererState.lastSwitchableLabel);
            }
        } else {
            logger.error(`Do not know how to render ${representation.representation_type}`);
        }
        return newRenderer;
    }

    _restartCurrentRenderer() {
        if (this._currentRenderer) {
            const currentRenderer = this._currentRenderer;
            currentRenderer.end();
            currentRenderer.start();
            this.updateControlAvailability();
            // ensure volume persistence
            this._setVolumePersistence();
        } else {
            logger.error('no current renderer to restart');
        }
    }

    /**
     * swap the renderers over
     * it's here we might want to be clever with retaining elements if
     * Renderers are of the same type
     * @param {*} newRenderer Instance of the new renderer to swap to
     * @param {*} newNarrativeElement New narrative element to swap to
     */
    _swapRenderers(newRenderer: BaseRenderer, newNarrativeElement: NarrativeElement) {
        const oldRenderer = this._currentRenderer;
        this._currentRenderer = newRenderer;
        this._currentNarrativeElement = newNarrativeElement;

        if (newRenderer instanceof SwitchableRenderer
            && this._rendererState.lastSwitchableLabel) {
            // eslint-disable-next-line max-len
            newRenderer.setChoiceToRepresentationWithLabel(this._rendererState.lastSwitchableLabel);
        }

        if (oldRenderer) {
            if(getSetting(DISABLE_LOOKAHEAD_FLAG)) {
                oldRenderer.destroy();
            } else {
                oldRenderer.end();
            }
        }

        if (!oldRenderer) {
            // this will be the first element in a story - notify controller
            // that it has been constructed
            this._player.setCurrentRenderer(newRenderer);
            newRenderer.on(RendererEvents.CONSTRUCTED, () => {
                this.emit(RendererEvents.FIRST_RENDERER_CREATED);
            });
        }

        // Update availability of back and next buttons.
        this._showBackIcon();
        this.updateControlAvailability();
        newRenderer.start();
        // ensure volume persistence
        this._setVolumePersistence();

    }

    _showBackIcon() {
        this._player.setBackAvailable(true);
    }

    _setVolumePersistence() {
        Object.keys(this._rendererState.volumes).forEach((label) => {
            const value = this._rendererState.volumes[label];
            this._player.setVolumeControlLevel(label, value);
        });
        Object.keys(this._rendererState.muted).forEach((label) => {
            const muted = this._rendererState.muted[label];
            this._player.setMuted(label, muted);
        });
    }

    /**
     *  show next button, or icons if choice
     * ... but if there is only one choice, show next!
     */
    updateControlAvailability() {
        // work out what we need to hide
        const hideList = getControlHideList(this._currentNarrativeElement, this._story);
        // hide them
        this._player.applyControlHideList(hideList);

        // calculating next availability - keep in mind if force hidden
        let nextForceHide = false;
        if  (hideList.includes('next')) {
            nextForceHide = true;
        }
        if (this._currentRenderer) {
            const rend = this._currentRenderer;
            if (!rend.inVariablePanel) {
                return this._controller.getValidNextSteps()
                    .then((nextSteps) => {
                        const hasNext = nextSteps.length > 0;
                        this._player.setNextAvailable(!nextForceHide && hasNext);
                    })
                    .catch((err) => {
                        logger.error('Could not get valid next steps to set next button availability', err); // eslint-disable-line max-len
                        this._player.setNextAvailable(false);
                    });
            }
        }
        this._player.setNextAvailable(false);
        return Promise.resolve();
    }


    /**
     *  get a renderer for the given NE, and its Representation
     * see if we've created one in advance, otherwise create a fresh one
     * @param {*} narrativeElement narrative element
     * @param {*} representation representation for narrative element
     */
    _getRenderer(
        narrativeElement: NarrativeElement,
        representation: Representation,
    ): ?BaseRenderer {
        let newRenderer;
        // have we already got a renderer for this NE and the right representation ?
        Object.keys(this._activeRenderers).forEach((rendererNEId) => {
            if (rendererNEId === narrativeElement.id &&
                this._activeRenderers[rendererNEId]._representation.id ===
                representation.id)
            {
                // this is the correct one - use it
                newRenderer = this._activeRenderers[rendererNEId];
            }
        });

        // create the new Renderer if we need to and put it in active list
        if (!newRenderer) {
            newRenderer = this._createNewRenderer(representation);
            if (newRenderer) this._activeRenderers[narrativeElement.id] = newRenderer;
        }
        return newRenderer;
    }

    refreshLookahead() {
        if (this._currentNarrativeElement) {
            this._rendererLookahead(this._currentNarrativeElement);
        }
    }


    /**
     * create reasoners for the NEs that follow narrativeElement
     * @param {*} narrativeElement
     */
    _rendererLookahead(narrativeElement: NarrativeElement): Promise<any> {
        if(getSetting(DISABLE_LOOKAHEAD_FLAG)) {
            return Promise.resolve();
        }
        return Promise.all([
            this._controller.getIdOfPreviousNode(),
            this._controller.getIdsOfNextNodes(narrativeElement),
        ]).then(([previousId, nextIds]) => {
            let allIds = [];
            if (previousId) {
                this._previousNeId = previousId;
                allIds = nextIds.concat([previousId]);
            } else {
                allIds = nextIds;
            }
            if (this._currentRenderer && this._currentNarrativeElement) {
                // add current neid
                allIds.push(this._currentNarrativeElement.id);
                allIds.push(narrativeElement.id);
            }

            // get renderers for all nes in the list
            // any that aren't in the active list will be created
            const renderPromises = allIds
                .map((neid) => {
                    // get the actual NarrativeElement object
                    const neObj = this._controller._getNarrativeElement(neid);
                    if (neObj && neObj.body.representation_collection_target_id) {
                        return this._fetchers
                            // eslint-disable-next-line max-len
                            .representationCollectionFetcher(neObj.body.representation_collection_target_id)
                            .then((representationCollection) => {
                                if (representationCollection.representations.length > 0) {
                                    return this._representationReasoner(representationCollection); // eslint-disable-line max-len
                                }
                                // need to render description only as placeholder
                                const dummyRep = {
                                    ...PLACEHOLDER_REPRESENTATION,
                                    description: neObj.description,
                                    id: neObj.id,
                                };
                                return Promise.resolve(dummyRep);
                            })
                            .then((representation) => {
                                // get the new Renderer (will create if neccessary)
                                this._getRenderer(neObj, representation);
                            });
                    }
                    return Promise.resolve();
                });

            this.updateControlAvailability();
            return Promise.all(renderPromises)
                // Clean up any renderers that are not needed any longer
                .then(() => {
                    this.cleanupActiveRenderers(narrativeElement, allIds);
                    this._runBackgroundLookahead();
                });
        });
    }

    /**
     * evaluate queued renderers for any backgrounds that need to be played
     * and queue up BackgroundRenderers for these
     */
    _runBackgroundLookahead() {
        // get all unique ids
        const backgroundIds = []; // all we may want to render
        const fwdBackgroundAcIds = []; // only those in forward direction
        Object.keys(this._activeRenderers).forEach((neid) => {
            const renderer = this._activeRenderers[neid];
            const representation = renderer.getRepresentation();
            if (representation.asset_collections.background_ids) {
                // eslint-disable-next-line max-len
                representation.asset_collections.background_ids.forEach((backgroundAssetCollectionId) => {
                    if (!(backgroundAssetCollectionId in backgroundIds)) {
                        backgroundIds.push(backgroundAssetCollectionId);
                        // independently store ids of fwd backgrounds
                        if ((!this._previousNeId)
                            || (this._previousNeId && this._previousNeId !== neid)) {
                            fwdBackgroundAcIds.push(backgroundAssetCollectionId);
                        }
                    }
                });
            }
        });

        // get asset collections and find srcs
        const assetCollectionPromises = [];
        const fwdRenderers = {};
        backgroundIds.forEach(backgroundAssetCollectionId =>
            assetCollectionPromises
                .push(this._fetchers.assetCollectionFetcher(backgroundAssetCollectionId)));

        Promise.all(assetCollectionPromises).then((assetCollections) => {
            const srcs = [];
            assetCollections.forEach((ac) => {
                if (ac.assets.audio_src) {
                    srcs.push({
                        src: ac.assets.audio_src,
                        ac,
                    });
                }
            });
            return Promise.resolve(srcs);
        }).then((backgroundSrcObjs) => {
            // for each id, create renderer if we don't have one
            backgroundSrcObjs.forEach((bgSrcObj) => {
                const { src, ac } = bgSrcObj;
                if (!(src in this._upcomingBackgroundRenderers)) {
                    const backgroundRenderer = BackgroundRendererFactory(
                        ac.asset_collection_type,
                        ac,
                        this._fetchers.mediaFetcher,
                        this._player,
                    );
                    if (backgroundRenderer) {
                        this._upcomingBackgroundRenderers[src] = backgroundRenderer;
                    }
                }
                if (fwdBackgroundAcIds.indexOf(ac.id) >= 0) { // fwd
                    fwdRenderers[src] = this._upcomingBackgroundRenderers[src];
                }
            });

            // clear unused from queue
            Object.keys(this._upcomingBackgroundRenderers).forEach((src) => {
                if (backgroundSrcObjs.filter(srcObj => srcObj.src === src).length === 0) {
                    delete this._upcomingBackgroundRenderers[src];
                }
            });

            // set fades for renderers not coming next
            this._setBackgroundFades(fwdRenderers);
        });
    }

    /**
     * look over current background renderers - if they are not in the supplied
     * list of upcoming renderers (excluding user going back), then fade out
     * @param {*} fwdRenderers upcomming renderers to use
     */
    _setBackgroundFades(fwdRenderers: { [key: string]: BaseRenderer }) {
        // set fade outs for the current background renderers
        Object.keys(this._backgroundRenderers).forEach((id) => {
            if (Object.keys(fwdRenderers).indexOf(id) === -1) {
                // bg renderer will end
                if (this._currentRenderer) {
                    const renderer = this._currentRenderer;
                    const timeObj = renderer.getCurrentTime();
                    if (timeObj.remainingTime) {
                        if (timeObj.remainingTime < FADE_OUT_TIME) {
                            this._backgroundRenderers[id].fadeOut(timeObj.remainingTime);
                        } else {
                            const fadeStartTime = timeObj.currentTime +
                                (timeObj.remainingTime - FADE_OUT_TIME);
                            renderer.addTimeEventListener(
                                id,
                                fadeStartTime,
                                () => this._backgroundRenderers[id]
                                    .fadeOut(FADE_OUT_TIME),
                            );
                        }
                    }
                }
            } else {
                // background renderer _may_ continue (but may also end)
                this._backgroundRenderers[id].cancelFade();
                if (this._currentRenderer) {
                    this._currentRenderer.deleteTimeEventListener(id);
                }
            }
        });
    }

    /**
     * Prepare the render manager to restart the story
     */
    prepareForRestart() {
        Object.keys(this._activeRenderers).forEach((rendererNEId) => {
            const renderer = this._activeRenderers[rendererNEId];
            renderer.destroy();
        });
        Object.keys(this._backgroundRenderers).forEach((rendererSrc) => {
            this._backgroundRenderers[rendererSrc].destroy();
        });
        Object.keys(this._upcomingBackgroundRenderers).forEach((src) => {
            this._upcomingBackgroundRenderers[src].destroy();
        });
        this._initialise();
        this._player.prepareForRestart();
    }

    /**
     * Initialize the render manager
     */
    _initialise() {
        this._currentRenderer = null;
        this._activeRenderers = {};
        this._upcomingBackgroundRenderers = {};
        this._backgroundRenderers = {};
        this._rendererState = {
            lastSwitchableLabel: '', // the label of the last selected switchable choice
            // also, audio muted/not...
            volumes: {},
            muted: {},
        };
    }

    /**
     * Reset the renderers and destroy the current one
     */
    reset() {
        if (this._currentRenderer) {
            this._currentRenderer.destroy();
        }
        Object.keys(this._backgroundRenderers).forEach(bgrId =>
            this._backgroundRenderers[bgrId].destroy());
        this._currentRenderer = null;
    }
}
