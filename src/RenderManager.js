// @flow

import EventEmitter from 'events';
import type {
    NarrativeElement, ExperienceFetchers, Representation,
    RepresentationChoice, AssetUrls,
} from './romper';
import type { RepresentationReasoner } from './RepresentationReasoner';
import BaseRenderer from './renderers/BaseRenderer';
import RendererFactory from './renderers/RendererFactory';
import type { StoryPathItem } from './StoryPathWalker';
import StoryIconRenderer from './renderers/StoryIconRenderer';
import SwitchableRenderer from './renderers/SwitchableRenderer';
import BackgroundRendererFactory from './renderers/BackgroundRendererFactory';
import BackgroundRenderer from './renderers/BackgroundRenderer';
import Controller from './Controller';
import RendererEvents from './renderers/RendererEvents';
import logger from './logger';
import type { AnalyticsLogger } from './AnalyticEvents';
import AnalyticEvents from './AnalyticEvents';

import Player, { PlayerEvents } from './Player';
import ImageRenderer from './renderers/ImageRenderer';

const FADE_OUT_TIME = 2; // default fade out time for backgrounds, in s

export default class RenderManager extends EventEmitter {
    _controller: Controller;

    _currentRenderer: ?BaseRenderer;

    _handleOrientationChange: Function;

    _backgroundRenderers: { [key: string]: BackgroundRenderer };

    _target: HTMLElement;

    _backgroundTarget: HTMLElement;

    _representationReasoner: RepresentationReasoner;

    _fetchers: ExperienceFetchers;

    _analytics: AnalyticsLogger;

    _privacyNotice: ?string;

    _renderStory: StoryIconRenderer;

    _neTarget: HTMLDivElement;

    _storyTarget: HTMLDivElement;

    _linearStoryPath: Array<StoryPathItem>;

    _currentNarrativeElement: NarrativeElement;

    _rendererState: {
        lastSwitchableLabel: string,
        volumes: { [key: string]: number },
    };

    _upcomingRenderers: { [key: string]: BaseRenderer };

    _upcomingBackgroundRenderers: { [key: string]: BackgroundRenderer };

    _previousNeId: ?string;

    _nextButton: HTMLButtonElement;

    _previousButton: HTMLButtonElement;

    _player: Player;

    _assetUrls: AssetUrls;

    _handleVisibilityChange: Function;

    _isPlaying: boolean;

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
        this._handleVisibilityChange = this._handleVisibilityChange.bind(this);
        this._handleOrientationChange = this._handleOrientationChange.bind(this)
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
                const { currentTime } = rend.getCurrentTime();
                if (choiceTime > 0 && currentTime < choiceTime) {
                    logger.info('Next button clicked on element with choices, skip to them');
                    rend.setCurrentTime(choiceTime - 0.25);
                } else if (rend.hasVariablePanelBehaviour()
                    || (rend.hasShowIconBehaviour() && choiceTime < 0)) {
                    // choices or var panel as end behaviour
                    const representationId = rend.getRepresentation().id;
                    logger.info('Next button ignored due to variable panel/choices, skip to end');
                    // skip to end if we have time-based media
                    // (if not, will continue to play then trigger another ended event)
                    const duration = this._player.playoutEngine.getDuration(representationId)
                    if (currentTime && duration) {
                        const playout = this._player.playoutEngine;
                        // skip to 1/4 s before end
                        playout.setCurrentTime(representationId, duration - 0.25);
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

        this._initialise();
    }


    _handleOrientationChange() {
        logger.info(`Window Orientation change to ${window.orientation}`);
        // pause when in portrait
        if (window.orientation === 0) {
            this._player.playoutEngine.pause();
            this._player.playoutEngine.pauseBackgrounds();
            if (this._currentRenderer instanceof ImageRenderer) {
                this._currentRenderer.pause();
            }
        } else {
            this._player.playoutEngine.play();
            if (this._player.playoutEngine.hasStarted()) {
                this._player.playoutEngine.playBackgrounds();
            }
            if (this._currentRenderer instanceof ImageRenderer) {
                this._currentRenderer.play();
            }
        }

        if (Player._isFullScreen()) {
            this._player._exitFullScreen();
        }

        this._analytics({
            type: AnalyticEvents.types.RENDERER_ACTION,
            name: AnalyticEvents.names.WINDOW_ORIENTATION_CHANGE,
            from: 'unset',
            to: window.orientation,
        });
    }

    prepareForRestart() {
        this._player.prepareForRestart();
    }

    _handleVisibilityChange(isVisible: boolean) {
        if (!isVisible) {
            this._isPlaying = this._player.playoutEngine.isPlaying();
            this._player.playoutEngine.pause();
            this._player.playoutEngine.pauseBackgrounds();
            if (this._currentRenderer instanceof ImageRenderer) {
                this._currentRenderer.pause();
            }
        } else {
            if (this._isPlaying) {
                // unless it has already ended, set it going again
                if (this._currentRenderer && !this._currentRenderer.hasEnded()) {
                    this._player.playoutEngine.play();
                }
            }
            if (this._player.playoutEngine.hasStarted()) {
                this._player.playoutEngine.playBackgrounds();
            }
            if (this._player._choiceCountdownTimeout && this._currentRenderer) {
                // restart countdown
                this._player.startChoiceCountdown(this._currentRenderer);
            }
            if (this._currentRenderer instanceof ImageRenderer) {
                this._currentRenderer.play();
            }
        }
        this._analytics({
            type: AnalyticEvents.types.RENDERER_ACTION,
            name: AnalyticEvents.names.BROWSER_VISIBILITY_CHANGE,
            from: isVisible ? 'hidden' : 'visible',
            to: isVisible ? 'visible' : 'hidden',
        });
    }

    handleStoryStart(storyId: string) {
        let onLaunchConfig = {
            background_art_asset_collection_id: '',
            button_class: 'romper-start-button',
            text: 'Start',
            hide_narrative_buttons: !this._controller._sessionManager._hasClickedResume,
            background_art: this._assetUrls.noBackgroundAssetUrl,
            privacy_notice: this._privacyNotice,
        };
        this._fetchers.storyFetcher(storyId)
            .then((story) => {
                if (story.meta && story.meta.romper && story.meta.romper.dog) {
                    const dog = Object.assign(story.meta.romper.dog);
                    this._fetchers.assetCollectionFetcher(dog.asset_collection_id)
                        .then((fg) => {
                            if (fg.assets.image_src) {
                                return this._fetchers.mediaFetcher(fg.assets.image_src);
                            }
                            return Promise.reject(new Error("Failed to fetch AC with image_src"));
                        })
                        .then(mediaurl => this._player.addDog(mediaurl, dog.position))
                        .catch(err => logger.error(`Cannot resolve DOG asset: ${err}`));
                }
                if (story.meta && story.meta.romper && story.meta.romper.onLaunch) {
                    onLaunchConfig = Object.assign(onLaunchConfig, story.meta.romper.onLaunch);
                    return this._fetchers
                        .assetCollectionFetcher(onLaunchConfig.background_art_asset_collection_id);
                }
                return Promise.reject(new Error('No onLaunch options in Story'));
            })
            .then((fg) => {
                if (fg.assets.image_src) {
                    return this._fetchers.mediaFetcher(fg.assets.image_src);
                }
                return Promise.reject(new Error('Could not find Asset Collection'));
            })
            .then((mediaUrl) => {
                logger.info(`FETCHED FROM MS MEDIA! ${mediaUrl}`);
                this._player.setupExperienceOverlays(Object.assign(
                    onLaunchConfig,
                    { background_art: mediaUrl },
                ));
            })
            .catch((err) => {
                logger.error(err, 'Could not get url from asset collection uuid');
                this._player.setupExperienceOverlays(Object.assign(
                    onLaunchConfig,
                    { background_art: this._assetUrls.noBackgroundAssetUrl },
                ));
            });
    }

    handleNEChange(narrativeElement: NarrativeElement) {
        this._player.clearLinkChoices();
        if (narrativeElement.body.representation_collection_target_id) {
            // eslint-disable-next-line max-len
            return this._fetchers.representationCollectionFetcher(narrativeElement.body.representation_collection_target_id)
                .then(representationCollection =>
                    this._representationReasoner(representationCollection))
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

    // create and start a StoryIconRenderer
    _createStoryIconRenderer(storyItemPath: Array<StoryPathItem>) {
        this._renderStory = new StoryIconRenderer(
            storyItemPath,
            this._fetchers.assetCollectionFetcher,
            this._fetchers.mediaFetcher,
            this._player,
        );

        this._renderStory.on('jumpToNarrativeElement', (neid) => {
            this._controller._jumpToNarrativeElement(neid);
        });

        if (this._currentRenderer) {
            this._renderStory.start(this._currentRenderer.getRepresentation().id);
        }
    }

    // given a new representation, handle the background rendering
    // either:
    //     stop if there is no background
    //     continue with the current one (do nothing) if background is same asset_collection
    //  or start a new background renderer
    _handleBackgroundRendering(representation: Representation): Promise<any> {
        let newBackgrounds = [];
        if (representation
            && representation.asset_collections.background_ids) {
            newBackgrounds = representation.asset_collections.background_ids;
        }

        // get asset collections and find srcs
        const assetCollectionPromises = [];
        newBackgrounds.forEach(backgroundAssetCollectionId =>
            assetCollectionPromises
                .push(this._fetchers.assetCollectionFetcher(backgroundAssetCollectionId)));

        return Promise.all(assetCollectionPromises).then((assetCollections) => {
            const srcs = [];
            assetCollections.forEach((ac) => {
                if (ac.assets.audio_src) {
                    srcs.push({
                        src: ac.assets.audio_src,
                        acId: ac.id,
                    });
                }
            });
            return Promise.resolve(srcs);
        }).then((newBackgroundSrcs) => {
            // remove dead backgrounds
            Object.keys(this._backgroundRenderers).forEach((rendererSrc) => {
                if (newBackgroundSrcs.filter(srcObj => srcObj.src === rendererSrc).length === 0) {
                    if (Object.values(this._upcomingBackgroundRenderers)
                        .includes(this._backgroundRenderers[rendererSrc])) {
                        this._backgroundRenderers[rendererSrc].end();
                    } else {
                        this._backgroundRenderers[rendererSrc].destroy();
                    }
                    delete this._backgroundRenderers[rendererSrc];
                }
            });

            newBackgroundSrcs.forEach((srcObj) => {
                const { src, acId } = srcObj;
                // maintain ones in both, add new ones, remove old ones
                if (!this._backgroundRenderers.hasOwnProperty(src)) {
                    this._fetchers.assetCollectionFetcher(acId)
                        .then((bgAssetCollection) => {
                            let backgroundRenderer = null;
                            if (src in this._upcomingBackgroundRenderers) {
                                backgroundRenderer = this._upcomingBackgroundRenderers[src];
                            } else {
                                backgroundRenderer = BackgroundRendererFactory(
                                    bgAssetCollection.asset_collection_type,
                                    bgAssetCollection,
                                    this._fetchers.mediaFetcher,
                                    this._player,
                                );
                            }
                            if (backgroundRenderer) {
                                backgroundRenderer.start();
                                this._backgroundRenderers[src]
                                    = backgroundRenderer;
                            }
                            return Promise.resolve(backgroundRenderer);
                        });
                }
            });
        });
    }

    /**
     * Move on to the next node of this story.
     *
     * @fires RenderManager#complete
     * @fires RenderManager#nextButtonClicked
     * @fires RenderManager#PreviousButtonClicked
     */
    // create a new renderer for the given representation, and attach
    // the standard listeners to it
    _createNewRenderer(representation: Representation): ?BaseRenderer {
        const newRenderer = RendererFactory(
            representation,
            this._fetchers.assetCollectionFetcher,
            this._fetchers.mediaFetcher,
            this._player,
            this._analytics,
            this._controller,
        );

        if (newRenderer) {
            newRenderer.on(RendererEvents.COMPLETE_START_BEHAVIOURS, () => {
                newRenderer.start();
            });
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
                    Object.keys(this._upcomingRenderers).forEach((rendererNEId) => {
                        const renderer = this._upcomingRenderers[rendererNEId];
                        if (renderer instanceof SwitchableRenderer) {
                            // eslint-disable-next-line max-len
                            renderer.setChoiceToRepresentationWithLabel(this._rendererState.lastSwitchableLabel);
                        }
                    });
                    // ensure volume persistence
                    Object.keys(this._rendererState.volumes).forEach((label) => {
                        const value = this._rendererState.volumes[label];
                        this._player.setVolumeControlLevel(label, value);
                    });
                },
            );

            if (newRenderer instanceof SwitchableRenderer) {
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
            currentRenderer.willStart();
            this.refreshOnwardIcons();
            // ensure volume persistence
            Object.keys(this._rendererState.volumes).forEach((label) => {
                const value = this._rendererState.volumes[label];
                this._player.setVolumeControlLevel(label, value);
            });
        } else {
            logger.error('no current renderer to restart');
        }
    }

    // swap the renderers over
    // it's here we might want to be clever with retaining elements if
    // Renderers are of the same type
    _swapRenderers(newRenderer: BaseRenderer, newNarrativeElement: NarrativeElement) {
        const oldRenderer = this._currentRenderer;
        this._currentRenderer = newRenderer;
        this._currentNarrativeElement = newNarrativeElement;

        if (newRenderer instanceof SwitchableRenderer) {
            if (this._rendererState.lastSwitchableLabel) {
                // eslint-disable-next-line max-len
                newRenderer.setChoiceToRepresentationWithLabel(this._rendererState.lastSwitchableLabel);
            }
        }

        if (oldRenderer) {
            const currentRendererInUpcoming = Object.values(this._upcomingRenderers)
                .some((renderer) => {
                    if (renderer === oldRenderer) {
                        return true;
                    }
                    return false;
                });
            if (!currentRendererInUpcoming) {
                oldRenderer.destroy();
            } else {
                oldRenderer.end();
            }
        }

        // Update availability of back and next buttons.
        this._showBackIcon();
        this.refreshOnwardIcons();

        newRenderer.willStart();

        // ensure volume persistence
        Object.keys(this._rendererState.volumes).forEach((label) => {
            const value = this._rendererState.volumes[label];
            this._player.setVolumeControlLevel(label, value);
        });

    }

    _showBackIcon() {
        this._player.setBackAvailable(true);
    }

    // show next button, or icons if choice
    // ... but if there is only one choice, show next!
    refreshOnwardIcons() {
        if (this._currentRenderer
            && !this._currentRenderer.inVariablePanel) {
            return this._controller.getValidNextSteps()
                .then((nextSteps) => {
                    const hasNext = nextSteps.length > 0;
                    this._player.setNextAvailable(hasNext);
                })
                .catch((err) => {
                    logger.error('Could not get valid next steps to set next button availability', err); // eslint-disable-line max-len
                    this._player.setNextAvailable(false);
                });
        }
        this._player.setNextAvailable(false);
        return Promise.resolve();
    }

    // get a renderer for the given NE, and its Representation
    // see if we've created one in advance, otherwise create a fresh one
    _getRenderer(
        narrativeElement: NarrativeElement,
        representation: Representation,
    ): ?BaseRenderer {
        let newRenderer;
        // have we already got a renderer?
        Object.keys(this._upcomingRenderers).forEach((rendererNEId) => {
            if (rendererNEId === narrativeElement.id) {
                // this is the correct one - use it
                newRenderer = this._upcomingRenderers[rendererNEId];
            }
        });

        // create the new Renderer if we need to
        if (!newRenderer) {
            newRenderer = this._createNewRenderer(representation);
        }
        return newRenderer;
    }

    refreshLookahead() {
        if (this._currentNarrativeElement) {
            this._rendererLookahead(this._currentNarrativeElement);
        }
    }

    // create reasoners for the NEs that follow narrativeElement
    _rendererLookahead(narrativeElement: NarrativeElement): Promise<any> {
        const disableLookahead
            = new URLSearchParams(window.location.search).get('disableLookahead');
        if(disableLookahead === 'true') {
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

            // Generate new renderers for any that are missing
            const renderPromises = allIds
                .map((neid) => {
                    // Check to see if required NE renderer is the one currently being shown
                    if (
                        this._currentRenderer &&
                        this._currentNarrativeElement &&
                        this._currentNarrativeElement.id === neid
                    ) {
                        this._upcomingRenderers[neid] = this._currentRenderer;
                    } else {
                        // get the actual NarrativeElement object
                        const neObj = this._controller._getNarrativeElement(neid);
                        if (neObj && neObj.body.representation_collection_target_id) {
                            return this._fetchers
                                // eslint-disable-next-line max-len
                                .representationCollectionFetcher(neObj.body.representation_collection_target_id)
                                .then(representationCollection =>
                                    this._representationReasoner(representationCollection))
                                .then((representation) => {
                                    // create the new Renderer
                                    if (this._upcomingRenderers[neid]) {
                                        if (this._upcomingRenderers[neid]._representation.id !==
                                            representation.id) {
                                            const newRenderer = this
                                                ._createNewRenderer(representation);
                                            if (newRenderer) {
                                                this._upcomingRenderers[neid] = newRenderer;
                                            }
                                        }
                                    } else {
                                        const newRenderer = this
                                            ._createNewRenderer(representation);
                                        if (newRenderer) {
                                            this._upcomingRenderers[neid] = newRenderer;
                                        }
                                    }
                                });
                        }
                        return Promise.resolve();
                    }
                    return Promise.resolve();
                });

            this.refreshOnwardIcons();
            return Promise.all(renderPromises)
                // Clean up any renderers that are not needed any longer
                .then(() => {
                    Object.keys(this._upcomingRenderers)
                        .filter(neid => allIds.indexOf(neid) === -1)
                        .forEach((neid) => {
                            if (narrativeElement.id !== neid) {
                                this._upcomingRenderers[neid].destroy();
                            }
                            delete this._upcomingRenderers[neid];
                        });
                    this._runBackgroundLookahead();
                });
        });
    }

    // evaluate queued renderers for any backgrounds that need to be played
    // and queue up BackgroundRenderers for these
    _runBackgroundLookahead() {
        // get all unique ids
        const backgroundIds = []; // all we may want to render
        const fwdBackgroundAcIds = []; // only those in forward direction
        Object.keys(this._upcomingRenderers).forEach((neid) => {
            const renderer = this._upcomingRenderers[neid];
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

    // look over current background renderers - if they are not in the supplied
    // list of upcoming renderers (excluding user going back), then fade out
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

    _initialise() {
        this._currentRenderer = null;
        this._upcomingRenderers = {};
        this._upcomingBackgroundRenderers = {};
        this._backgroundRenderers = {};
        this._rendererState = {
            lastSwitchableLabel: '', // the label of the last selected switchable choice
            // also, audio muted/not...
            volumes: {},
        };
    }

    reset() {
        if (this._currentRenderer) {
            this._currentRenderer.destroy();
        }
        this._currentRenderer = null;
    }
}
