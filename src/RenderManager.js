// @flow

import EventEmitter from 'events';
import type {
    NarrativeElement, ExperienceFetchers, Representation,
    RepresentationChoice, AssetUrls, AssetCollection,
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

import Player, { PlayerEvents } from './Player';
import AFrameRenderer from './renderers/AFrameRenderer';

export default class RenderManager extends EventEmitter {
    _controller: Controller;
    _currentRenderer: ?BaseRenderer;
    _backgroundRenderers: { [key: string]: BackgroundRenderer };
    _target: HTMLElement;
    _backgroundTarget: HTMLElement;
    _representationReasoner: RepresentationReasoner;
    _fetchers: ExperienceFetchers;
    _analytics: AnalyticsLogger;
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
    _nextButton: HTMLButtonElement;
    _previousButton: HTMLButtonElement;
    _player: Player;
    _assetUrls: AssetUrls;

    _savedLinkConditions: { [key: string]: Object };

    constructor(
        controller: Controller,
        target: HTMLElement,
        representationReasoner: RepresentationReasoner,
        fetchers: ExperienceFetchers,
        analytics: AnalyticsLogger,
        assetUrls: AssetUrls,
    ) {
        super();

        this._controller = controller;
        this._target = target;
        this._representationReasoner = representationReasoner;
        this._fetchers = fetchers;
        this._analytics = analytics;
        this._assetUrls = assetUrls;
        this._savedLinkConditions = {};

        this._player = new Player(this._target, this._analytics, this._assetUrls);
        this._player.on(PlayerEvents.BACK_BUTTON_CLICKED, () => {
            if (this._currentRenderer) {
                this._currentRenderer.emit(RendererEvents.PREVIOUS_BUTTON_CLICKED);
            }
        });
        this._player.on(PlayerEvents.NEXT_BUTTON_CLICKED, () => {
            if (this._currentRenderer) {
                const rend = this._currentRenderer;
                if (rend.hasVariablePanelBehaviour()) {
                    const representationId = rend.getRepresentation().id;
                    logger.info('Next button ignored due to variable panel, skip to end');
                    // skip to end if we have time-based media
                    // (if not, will continue to play then trigger another ended event)
                    if (this._player.playoutEngine.getCurrentTime(representationId)) {
                        const playout = this._player.playoutEngine;
                        const media = playout.getMediaElement(representationId);
                        // skip to 1/4 s before end
                        playout.setCurrentTime(representationId, media.duration - 0.25);
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
        this._player.on(PlayerEvents.LINK_CHOSEN, (event) => {
            // this._player.disableLinkChoiceControl();
            this._followLink(event.id);
        });

        AFrameRenderer.on('aframe-vr-toggle', () => {
            this.refreshLookahead();
        });
        this._initialise();
    }

    prepareForRestart() {
        this._player.prepareForRestart();
    }

    handleStoryStart(storyId: string) {
        let onLaunchConfig = {
            background_art_asset_collection_id: '',
            button_class: 'romper-start-button',
            text: 'Start',
            hide_narrative_buttons: true,
            background_art: this._assetUrls.noBackgroundAssetUrl,
        };
        this._fetchers.storyFetcher(storyId)
            .then((story) => {
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
                this._player.addExperienceStartButtonAndImage(Object.assign(
                    onLaunchConfig,
                    { background_art: mediaUrl },
                ));
            })
            .catch((err) => {
                logger.error(err, 'Could not get url from asset collection uuid');
                this._player.addExperienceStartButtonAndImage(Object.assign(
                    onLaunchConfig,
                    { background_art: this._assetUrls.noBackgroundAssetUrl },
                ));
            });
    }

    handleNEChange(narrativeElement: NarrativeElement) {
        this._player.clearLinkChoices();
        AFrameRenderer.clearLinkIcons();
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

    // Reasoner has told us that there are multiple valid paths:
    // give choice to user
    handleLinkChoice(narrativeElementObjects: Array<Object>) {
        if (!this._currentRenderer) {
            logger.warn('Handling link choice, but no current renderer');
            return;
        }

        logger.warn('RenderManager choice of links - inform player');
        // go through promise chain to get asset collections
        const assetCollectionPromises: Array<Promise<?AssetCollection>> = [];
        narrativeElementObjects.forEach((choiceNarrativeElementObj, i) => {
            logger.info(`choice ${(i + 1)}: ${choiceNarrativeElementObj.ne.id}`);
            // fetch icon representation
            if (choiceNarrativeElementObj.ne.body.representation_collection_target_id) {
                // eslint-disable-next-line max-len
                assetCollectionPromises.push(this._fetchers.representationCollectionFetcher(choiceNarrativeElementObj.ne.body.representation_collection_target_id)
                    // representationCollection
                    .then(representationCollection => this._representationReasoner(representationCollection)) // eslint-disable-line max-len
                    // representation
                    .then((representation) => {
                        if (
                            representation.asset_collections.icon &&
                            representation.asset_collections.icon.default_id
                        ) {
                            // eslint-disable-next-line max-len
                            const iconAssetCollectionId = representation.asset_collections.icon.default_id;
                            // asset collection
                            return this._fetchers.assetCollectionFetcher(iconAssetCollectionId);
                        }
                        return Promise.resolve(null);
                    }));
            } else {
                assetCollectionPromises.push(Promise.resolve(null));
            }
        });

        // @flowignore - tested for this._currentRepresentation above!
        const currentRepresentation = this._currentRenderer.getRepresentation();

        // go through asset collections and render icons
        Promise.all(assetCollectionPromises)
            .then((urls) => {
                this._player.clearLinkChoices();
                AFrameRenderer.clearLinkIcons();
                urls.forEach((iconAssetCollection, choiceId) => {
                    // @flowignore
                    const imgsrc = (iconAssetCollection && iconAssetCollection.assets) ?
                        iconAssetCollection.assets.image_src :
                        '';
                    // when do we show?
                    if (currentRepresentation.meta && currentRepresentation.meta.storyplayer
                        && currentRepresentation.meta.storyplayer.choice_timing) {
                        const time = parseFloat(currentRepresentation.meta.storyplayer.choice_timing);
                        if (time === 0) {
                            // show from start
                            logger.info(`Render icon for ${currentRepresentation.name} now`);
                            this._showLinkIcon(choiceId, narrativeElementObjects, imgsrc);
                        } else {
                            // show from specified time into NE
                            // @flowignore - tested for this._currentRepresentation above!
                            this._currentRenderer.addTimeEventListener(
                                `${currentRepresentation.id}-${choiceId}`,
                                parseFloat(time),
                                () => this._showLinkIcon(choiceId, narrativeElementObjects, imgsrc),
                            );
                            // eslint-disable-next-line max-len
                            logger.info(`Render icon for ${currentRepresentation.name} at time=${time}`);
                        }
                    } else {
                        // if not specified, show from start
                        this._showLinkIcon(choiceId, narrativeElementObjects, imgsrc);
                    }
                });
                this._player.enableLinkChoiceControl();
            });
    }

    _showLinkIcon(choiceId: number, narrativeElementObjects: Array<Object>, imgsrc: string) {
        // tell Player to render icon
        this._player.addLinkChoiceControl(
            narrativeElementObjects[choiceId].targetNeId,
            imgsrc,
            `Option ${(choiceId + 1)}`,
        );
        if (this._currentRenderer && this._currentRenderer.isVRViewable()) {
            AFrameRenderer.addLinkIcon(
                narrativeElementObjects[choiceId].targetNeId,
                imgsrc,
            );
        }
    }

    // get the current narrative element object
    getCurrentNarrativeElement(): NarrativeElement {
        return this._currentNarrativeElement;
    }

    // get the current Renderer
    getCurrentRenderer(): ?BaseRenderer {
        return this._currentRenderer;
    }

    // user has made a choice of link to follow - do it
    _followLink(narrativeElementId: string) {
        if (!this._currentRenderer) { return; }
        const representation = this._currentRenderer.getRepresentation();
        if (representation.meta && representation.meta.storyplayer &&
            representation.meta.storyplayer.choice_show_ne_to_end) {
            // if not done so, save initial conditions
            if (Object.keys(this._savedLinkConditions).length === 0) {
                this._saveLinkConditions();
            }
            // now make this link the only valid option
            this._currentNarrativeElement.links.forEach((neLink) => {
                if (neLink.target_narrative_element_id === narrativeElementId) {
                    // eslint-disable-next-line no-param-reassign
                    neLink.condition = { '==': [1, 1] };
                } else {
                    // eslint-disable-next-line no-param-reassign
                    neLink.condition = { '==': [1, 0] };
                }
            });
            if (representation.meta && representation.meta.storyplayer &&
                representation.meta.storyplayer.choice_one_shot) {
                // hide icons
                this._player.clearLinkChoices();
                // refresh next/prev so user can skip now if necessary
                this._showOnwardIcons();
            } // else link will be followed at NE end
        } else {
            // or follow link now
            this._player.clearLinkChoices();
            this._controller.followLink(narrativeElementId);
        }
    }

    // save link conditions for current NE
    _saveLinkConditions() {
        if (this._currentNarrativeElement) {
            this._savedLinkConditions = {};
            this._currentNarrativeElement.links.forEach((neLink) => {
                if (neLink.target_narrative_element_id) {
                    this._savedLinkConditions[neLink.target_narrative_element_id] =
                        neLink.condition;
                }
            });
        }
    }

    // revert link conditions for current NE to what they were originally
    _reapplyLinkConditions() {
        if (this._currentNarrativeElement) {
            this._currentNarrativeElement.links.forEach((neLink) => {
                if (neLink.target_narrative_element_id &&
                    neLink.target_narrative_element_id in this._savedLinkConditions) {
                    // eslint-disable-next-line no-param-reassign
                    neLink.condition =
                        this._savedLinkConditions[neLink.target_narrative_element_id];
                }
            });
            this._savedLinkConditions = {};
        }
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
    _handleBackgroundRendering(representation: Representation) {
        let newBackgrounds = [];
        if (representation
            && representation.asset_collections.background_ids) {
            newBackgrounds = representation.asset_collections.background_ids;
        }

        // remove dead backgrounds
        Object.keys(this._backgroundRenderers).forEach((rendererACId) => {
            if (newBackgrounds.indexOf(rendererACId) === -1) {
                this._backgroundRenderers[rendererACId].destroy();
                delete this._backgroundRenderers[rendererACId];
            }
        });

        // get renderers
        const rendererPromises = [];
        newBackgrounds.forEach((backgroundAssetCollectionId) => {
            // maintain ones in both, add new ones, remove old ones
            if (!this._backgroundRenderers.hasOwnProperty(backgroundAssetCollectionId)) {
                rendererPromises.push(this._fetchers
                    .assetCollectionFetcher(backgroundAssetCollectionId)
                    .then((bgAssetCollection) => {
                        const backgroundRenderer = BackgroundRendererFactory(
                            bgAssetCollection.asset_collection_type,
                            bgAssetCollection,
                            this._fetchers.mediaFetcher,
                            this._player,
                        );
                        if (backgroundRenderer) {
                            this._backgroundRenderers[backgroundAssetCollectionId]
                                = backgroundRenderer;
                        }
                        return Promise.resolve(backgroundRenderer);
                    }));
            }
        });

        // start renderers
        Promise.all(rendererPromises).then((bgRendererArray) => {
            bgRendererArray.forEach((bgRenderer) => {
                if (bgRenderer) { bgRenderer.start(); }
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
            this._reapplyLinkConditions();
            currentRenderer.end();
            currentRenderer.willStart();
            this._showOnwardIcons();
        } else {
            logger.error('no current renderer to restart');
        }
    }

    // swap the renderers over
    // it's here we might want to be clever with retaining elements if
    // Renderers are of the same type
    _swapRenderers(newRenderer: BaseRenderer, newNarrativeElement: NarrativeElement) {
        const oldRenderer = this._currentRenderer;
        this._reapplyLinkConditions();
        this._currentRenderer = newRenderer;
        this._currentNarrativeElement = newNarrativeElement;

        AFrameRenderer.clearSceneElements();
        AFrameRenderer.setSceneHidden(true);

        if (newRenderer instanceof SwitchableRenderer) {
            if (this._rendererState.lastSwitchableLabel) {
                // eslint-disable-next-line max-len
                newRenderer.setChoiceToRepresentationWithLabel(this._rendererState.lastSwitchableLabel);
            }
        }

        // ensure volume persistence
        Object.keys(this._rendererState.volumes).forEach((label) => {
            const value = this._rendererState.volumes[label];
            this._player.setVolumeControlLevel(label, value);
        });

        if (oldRenderer) {
            if (oldRenderer.isVRViewable() && !newRenderer.isVRViewable()) {
                // exit VR mode if necessary
                // TODO need to go back to full-screen if appropriate
                AFrameRenderer.exitVR();
            }

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
        this._showOnwardIcons();

        newRenderer.willStart();
    }

    _showBackIcon() {
        this._controller.getIdOfPreviousNode()
            .then((id) => {
                const showBack = id !== null;
                this._player.setBackAvailable(showBack);
                if (showBack) {
                    AFrameRenderer.addPrevious(() =>
                        this._player.emit(PlayerEvents.BACK_BUTTON_CLICKED));
                } else {
                    AFrameRenderer.clearPrevious();
                }
            });
    }

    // show next button, or icons if choice
    _showOnwardIcons() {
        const next = this._controller.getValidNextSteps();
        if (next) {
            next.then((nextNarrativeElementObjects) => {
                if (nextNarrativeElementObjects.length === 1) {
                    if (this._currentRenderer && !this._currentRenderer.inVariablePanel) {
                        this._player.setNextAvailable(true);
                        AFrameRenderer.addNext(() => this._player
                            .emit(PlayerEvents.NEXT_BUTTON_CLICKED));
                    }
                } else {
                    this._player.setNextAvailable(false);
                    AFrameRenderer.clearNext();
                }
                if (nextNarrativeElementObjects.length > 1) {
                    // render icons
                    this.handleLinkChoice(nextNarrativeElementObjects);
                }
            });
        }
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
        return Promise.all([
            this._controller.getIdOfPreviousNode(),
            this._controller.getIdsOfNextNodes(narrativeElement),
        ]).then(([previousId, nextIds]) => {
            let allIds = [];
            if (previousId) {
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
                                        } else if (this._upcomingRenderers[neid].isVRViewable() !==
                                            AFrameRenderer.isInVR()) {
                                            this._upcomingRenderers[neid].destroy();
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

            this._showOnwardIcons();
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
                });
        });
    }

    _initialise() {
        this._currentRenderer = null;
        this._upcomingRenderers = {};
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
