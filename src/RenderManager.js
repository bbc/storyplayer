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
    _upcomingRenderers: Array<{ [key: string]: BaseRenderer }>;
    _nextButton: HTMLButtonElement;
    _previousButton: HTMLButtonElement;
    _player: Player;
    _assetUrls: AssetUrls;

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

        this._player = new Player(this._target, this._analytics, this._assetUrls);
        this._player.on(PlayerEvents.BACK_BUTTON_CLICKED, () => {
            if (this._currentRenderer) {
                this._currentRenderer.emit(RendererEvents.PREVIOUS_BUTTON_CLICKED);
            }
        });
        this._player.on(PlayerEvents.NEXT_BUTTON_CLICKED, () => {
            if (this._currentRenderer) {
                this._currentRenderer.emit(RendererEvents.NEXT_BUTTON_CLICKED);
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
            this._player.disableLinkChoiceControl();
            this._followLink(event.id);
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
        if (narrativeElement.body.representation_collection_target_id) {
            // eslint-disable-next-line max-len
            this._fetchers.representationCollectionFetcher(narrativeElement.body.representation_collection_target_id)
                .then(representationCollection =>
                    this._representationReasoner(representationCollection))
                .then((representation) => {
                    if (this._currentNarrativeElement === narrativeElement) {
                        // Restarting Current NE
                        this._restartCurrentRenderer();
                    } else {
                        // get a Renderer for this new NE
                        const newRenderer = this._getRenderer(narrativeElement, representation);

                        // look ahead and create new renderers for the next step
                        this._rendererLookahead(narrativeElement);

                        // TODO: need to clean up upcomingRenderers here too

                        if (newRenderer) {
                            this._currentNarrativeElement = narrativeElement;
                            // swap renderers
                            this._swapRenderers(newRenderer);
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
    }

    // Reasoner has told us that there are multiple valid paths:
    // give choice to user
    handleLinkChoice(narrativeElements: Array<NarrativeElement>) {
        logger.warn('RenderManager choice of links - inform player');
        // go through promise chain to get asset collections
        const assetCollectionPromises: Array<Promise<?AssetCollection>> = [];
        narrativeElements.forEach((choiceNarrativeElement, i) => {
            logger.info(`choice ${(i + 1)}: ${choiceNarrativeElement.id}`);
            // fetch icon representation
            if (choiceNarrativeElement.body.representation_collection_target_id) {
                // eslint-disable-next-line max-len
                assetCollectionPromises.push(this._fetchers.representationCollectionFetcher(choiceNarrativeElement.body.representation_collection_target_id)
                    // presentation
                    .then(presentation => this._representationReasoner(presentation))
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

        // go through asset collections and render icons
        Promise.all(assetCollectionPromises)
            .then((urls) => {
                this._player.clearLinkChoices();
                urls.forEach((iconAssetCollection, choiceId) => {
                    if (iconAssetCollection && iconAssetCollection.assets.image_src) {
                        // tell Player to render icon
                        this._player.addLinkChoiceControl(
                            narrativeElements[choiceId].id,
                            iconAssetCollection.assets.image_src,
                            `Option ${(choiceId + 1)}`,
                        );
                    }
                });
                this._player.enableLinkChoiceControl();
            });
    }

    // get the current narrative element object
    getCurrentNarrativeElement(): NarrativeElement {
        return this._currentNarrativeElement;
    }

    // user has made a choice of link to follow - do it
    _followLink(narrativeElementId: string) {
        this._player.clearLinkChoices();
        this._controller.followLink(narrativeElementId);
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

        newBackgrounds.forEach((backgroundAssetCollectionId) => {
            // maintain ones in both, add new ones, remove old ones
            if (!this._backgroundRenderers.hasOwnProperty(backgroundAssetCollectionId)) {
                this._fetchers.assetCollectionFetcher(backgroundAssetCollectionId)
                    .then((bgAssetCollection) => {
                        const backgroundRenderer = BackgroundRendererFactory(
                            bgAssetCollection.asset_collection_type,
                            bgAssetCollection,
                            this._fetchers.mediaFetcher,
                            this._player,
                        );
                        if (backgroundRenderer) {
                            backgroundRenderer.start();
                            this._backgroundRenderers[backgroundAssetCollectionId]
                                = backgroundRenderer;
                        }
                    });
            }
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
                },
            );
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
        }
    }

    // swap the renderers over
    // it's here we might want to be clever with retaining elements if
    // Renderers are of the same type
    _swapRenderers(newRenderer: BaseRenderer) {
        // if both same type, just update current
        //   else
        // destroy old renderer
        if (this._currentRenderer) {
            this._currentRenderer.destroy();
        }
        this._currentRenderer = newRenderer;

        // Update availability of back and next buttons.
        this._player.setBackAvailable(this._controller._getIdOfPreviousNode() !== null);
        this._showOnwardIcons();

        if (newRenderer instanceof SwitchableRenderer) {
            if (this._rendererState.lastSwitchableLabel) {
                // eslint-disable-next-line max-len
                newRenderer.setChoiceToRepresentationWithLabel(this._rendererState.lastSwitchableLabel);
            }
        }

        newRenderer.willStart();

        // ensure volume persistence
        Object.keys(this._rendererState.volumes).forEach((label) => {
            const value = this._rendererState.volumes[label];
            this._player.setVolumeControlLevel(label, value);
        });
    }

    // show next button, or icons if choice
    _showOnwardIcons() {
        const next = this._controller.getValidNextSteps();
        if (next) {
            next.then((nextNarrativeElements) => {
                if (nextNarrativeElements.length === 1) {
                    this._player.setNextAvailable(true);
                } else {
                    this._player.setNextAvailable(false);
                }
                if (nextNarrativeElements.length > 1) {
                    // render icons
                    this.handleLinkChoice(nextNarrativeElements);
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
        if (this._upcomingRenderers.length === 1) {
            const newRenderersList = this._upcomingRenderers.shift();
            Object.keys(newRenderersList).forEach((rendererNEId) => {
                if (rendererNEId === narrativeElement.id) {
                    // this is the correct one - use it
                    newRenderer = newRenderersList[rendererNEId];
                } else {
                    // only using one - destroy any others
                    newRenderersList[rendererNEId].destroy();
                }
            });
        }
        // create the new Renderer if we need to
        if (!newRenderer) {
            newRenderer = this._createNewRenderer(representation);
        }
        return newRenderer;
    }

    refreshLookahead() {
        this._upcomingRenderers = [];
        if (this._currentNarrativeElement) {
            this._rendererLookahead(this._currentNarrativeElement);
        }
    }

    // create reasoners for the NEs that follow narrativeElement
    _rendererLookahead(narrativeElement: NarrativeElement) {
        const upcomingIds = this._controller._getIdsOfNextNodes(narrativeElement);
        const upcomingRenderers = {};
        upcomingIds.forEach((neid) => {
            // get the actual NarrativeElement object
            const neObj = this._controller._getNarrativeElement(neid);
            if (neObj && neObj.body.representation_collection_target_id) {
                this._fetchers
                    .representationCollectionFetcher(neObj.body.representation_collection_target_id)
                    .then(presentation => this._representationReasoner(presentation))
                    .then((representation) => {
                        // create the new Renderer
                        const newRenderer = this._createNewRenderer(representation);
                        upcomingRenderers[neid] = newRenderer;
                    });
            }
        });
        this._upcomingRenderers.push(upcomingRenderers);
        this._showOnwardIcons();
    }

    _initialise() {
        this._currentRenderer = null;
        this._upcomingRenderers = [];
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
