// @flow

import EventEmitter from 'events';
import type {
    NarrativeElement, PresentationFetcher, AssetCollectionFetcher, Representation, MediaFetcher,
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
import SimpleAVVideoContextRenderer from './renderers/SimpleAVVideoContextRenderer';
import logger from './logger';

import Player, { PlayerEvents } from './Player';

export default class RenderManager extends EventEmitter {
    constructor(
        controller: Controller,
        target: HTMLElement,
        fetchPresentation: PresentationFetcher,
        fetchAssetCollection: AssetCollectionFetcher,
        representationReasoner: RepresentationReasoner,
        fetchMedia: MediaFetcher,
    ) {
        super();
        this._controller = controller;
        this._target = target;
        this._fetchPresentation = fetchPresentation;
        this._representationReasoner = representationReasoner;
        this._fetchAssetCollection = fetchAssetCollection;
        this._fetchMedia = fetchMedia;

        this._player = new Player(this._target);
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

        this._initialise();
    }

    handleNEChange(narrativeElement: NarrativeElement) {
        this._fetchPresentation(narrativeElement.presentation.target)
            .then(presentation => this._representationReasoner(presentation))
            .then((representation) => {
                // get a Renderer for this new NE
                const newRenderer = this._getRenderer(narrativeElement, representation);

                // look ahead and create new renderers for the next step
                this._rendererLookahead(narrativeElement);

                // TODO: need to clean up upcomingRenderers here too

                if (newRenderer) {
                    // swap renderers
                    this._swapRenderers(newRenderer);
                    // handle backgrounds
                    this._handleBackgroundRendering(newRenderer.getRepresentation());
                }

                // tell story renderer that we've changed
                if (this._renderStory) {
                    this._renderStory.handleNarrativeElementChanged(representation.id);
                }
            });
    }

    // create and start a StoryIconRenderer
    _createStoryIconRenderer(storyItemPath: Array<StoryPathItem>) {
        this._renderStory = new StoryIconRenderer(
            storyItemPath,
            this._fetchAssetCollection,
            this._fetchMedia,
            this._player,
        );

        this._renderStory.on('jumpToNarrativeElement', (neid) => {
            this._controller._jumpToNarrativeElement(neid);
        });
        this._renderStory.start();
    }

    // given a new representation, handle the background rendering
    // either:
    //     stop if there is no background
    //     continue with the current one (do nothing) if background is same asset_collection
    //  or start a new background renderer
    _handleBackgroundRendering(representation: Representation) {
        let newBackgrounds = [];
        if (representation
            && representation.asset_collection.background) {
            newBackgrounds = representation.asset_collection.background;
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
                this._fetchAssetCollection(backgroundAssetCollectionId)
                    .then((bgAssetCollection) => {
                        const backgroundRenderer = BackgroundRendererFactory(
                            bgAssetCollection.type,
                            bgAssetCollection,
                            this._fetchMedia,
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
            this._fetchAssetCollection,
            this._fetchMedia,
            this._player,
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
            newRenderer.on(RendererEvents.SWITCHED_REPRESENTATION, (choice) => {
                this._rendererState.lastSwitchableLabel = choice.label;
                this._handleBackgroundRendering(choice.representation);
            });
        } else {
            logger.error(`Do not know how to render ${representation.representation_type}`);
        }
        return newRenderer;
    }

    // swap the renderers over
    // it's here we might want to be clever with retaining elements if
    // Renderers are of the same type
    _swapRenderers(newRenderer: BaseRenderer) {
        // if both same type, just update current
        //   else
        // destroy old renderer
        if (this._currentRenderer instanceof SimpleAVVideoContextRenderer &&
            newRenderer instanceof SimpleAVVideoContextRenderer) {
            this._currentRenderer.stopAndDisconnect();
        } else if (this._currentRenderer) {
            this._currentRenderer.destroy();
        }
        this._currentRenderer = newRenderer;

        // Update availability of back and next buttons.
        this._player.setBackAvailable(this._controller._getIdOfPreviousNode() !== null);
        this._player.setNextAvailable(this._controller.hasNextNode());

        if (newRenderer instanceof SwitchableRenderer) {
            if (this._rendererState.lastSwitchableLabel) {
                // eslint-disable-next-line max-len
                newRenderer.setChoiceToRepresentationWithLabel(this._rendererState.lastSwitchableLabel);
            }
        }

        newRenderer.willStart();
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

    // create reasoners for the NEs that follow narrativeElement
    _rendererLookahead(narrativeElement: NarrativeElement) {
        const upcomingIds = this._controller._getIdsOfNextNodes(narrativeElement);
        const upcomingRenderers = {};
        upcomingIds.forEach((neid) => {
            // get the actual NarrativeElement object
            const neObj = this._controller._getNarrativeElement(neid);
            if (neObj) {
                this._fetchPresentation(neObj.presentation.target)
                    .then(presentation => this._representationReasoner(presentation))
                    .then((representation) => {
                        // create the new Renderer
                        const newRenderer = this._createNewRenderer(representation);
                        upcomingRenderers[neid] = newRenderer;
                    });
            }
        });
        this._upcomingRenderers.push(upcomingRenderers);
    }

    _initialise() {
        this._currentRenderer = null;
        this._upcomingRenderers = [];
        this._backgroundRenderers = {};
        this._rendererState = {
            lastSwitchableLabel: '', // the label of the last selected switchable choice
            // also, audio muted/not...
        };
    }

    reset() {
        if (this._currentRenderer) {
            this._currentRenderer.destroy();
        }
        this._currentRenderer = null;
    }

    _controller: Controller;
    _currentRenderer: ?BaseRenderer;
    _backgroundRenderers: { [key: string]: BackgroundRenderer };
    _target: HTMLElement;
    _backgroundTarget: HTMLElement;
    _fetchPresentation: PresentationFetcher;
    _fetchAssetCollection: AssetCollectionFetcher;
    _representationReasoner: RepresentationReasoner;
    _fetchMedia: MediaFetcher;
    _renderStory: StoryIconRenderer;
    _neTarget: HTMLDivElement;
    _storyTarget: HTMLDivElement;
    _linearStoryPath: Array<StoryPathItem>;
    _currentNarrativeElement: NarrativeElement;
    _rendererState: {
        lastSwitchableLabel: string,
    };
    _upcomingRenderers: Array<{ [key: string]: BaseRenderer }>;
    _nextButton: HTMLButtonElement;
    _previousButton: HTMLButtonElement;
    _player: Player;
}
