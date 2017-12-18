// @flow

import type { StoryReasonerFactory } from './StoryReasonerFactory';
import StoryReasoner from './StoryReasoner';
import type { StoryFetcher, NarrativeElement, PresentationFetcher, AssetCollectionFetcher, MediaFetcher, Renderers } from './romper';
import type { RepresentationReasoner } from './RepresentationReasoner';
import type BaseRenderer from './renderers/BaseRenderer';
import RendererFactory from './renderers/RendererFactory';
import StoryPathWalker from './StoryPathWalker';
import type { StoryPathItem } from './StoryPathWalker';
import StoryIconRenderer from './renderers/StoryIconRenderer';

export default class Controller {
    constructor(
        target: HTMLElement,
        storyReasonerFactory: StoryReasonerFactory,
        fetchPresentation: PresentationFetcher,
        fetchAssetCollection: AssetCollectionFetcher,
        representationReasoner: RepresentationReasoner,
        fetchMedia: MediaFetcher,
        renderers: Renderers,
        fetchStory: StoryFetcher,
    ) {
        this._storyId = null;
        this._reasoner = null;
        this._currentRenderer = null;
        this._target = target;
        this._storyReasonerFactory = storyReasonerFactory;
        this._fetchPresentation = fetchPresentation;
        this._representationReasoner = representationReasoner;
        this._fetchAssetCollection = fetchAssetCollection;
        this._fetchMedia = fetchMedia;
        this._renderers = renderers;
        this._fetchStory = fetchStory;
        this._createStoryAndElementDivs();
        this._linearStoryPath = [];
        // this._currentNarrativeElement = null;
    }

    start(storyId: string) {
        this._storyId = storyId;


        // event handling functions for StoryReasoner
        const _handleStoryEnd = () => {
            alert('Story ended!'); // eslint-disable-line no-alert
        };
        const _handleError = (err) => {
            alert(`Error: ${err}`); // eslint-disable-line no-alert
        };

        // StoryPathWalker stuff:
        // create an spw to see if the story is linear or not
        const spw = new StoryPathWalker(
            this._fetchStory,
            this._fetchPresentation,
            this._storyReasonerFactory,
        );

        // handle our StoryPathWalker reaching the end of its travels:
        // get spw to resolve the list of presentations into representations
        // then (if story is linear) create and start a StoryIconRenderer
        const _handleWalkEnd = () => {
            spw.getStoryItemList(this._representationReasoner).then((storyItemPath) => {
                this._linearStoryPath = storyItemPath;
                this._renderStory = new StoryIconRenderer(
                    storyItemPath,
                    this._fetchAssetCollection,
                    this._fetchMedia,
                    this._storyTarget,
                );
                this._renderStory.on('jumpToNarrativeElement', (neid) => {
                    // console.log('controller received request to switch to ne', neid);
                    this._jumpToNarrativeElement(neid);
                });
                this._renderStory.start();
            });
        };

        spw.on('walkComplete', _handleWalkEnd);
        spw.parseStory(storyId);

        this._storyReasonerFactory(storyId).then((reasoner) => {
            if (this._storyId !== storyId) {
                return;
            }

            reasoner.on('storyEnd', _handleStoryEnd);
            reasoner.on('error', _handleError);

            this._handleNarrativeElementChanged = (narrativeElement: NarrativeElement) => {
                this._handleNEChange(reasoner, narrativeElement);
            };

            reasoner.on('narrativeElementChanged', this._handleNarrativeElementChanged);

            this._reasoner = reasoner;
            this._reasoner.start();
        });
    }

    //
    // go to previous node in the current story
    // @param currentNeId id of narrative element to go back from
    //
    _goBackOneStepInStory() {
        const previous = this._getIdOfPreviousNode();
        if (previous) {
            this._jumpToNarrativeElement(previous);
        } else {
            console.error('cannot resolve previous node to go to');
        }
    }

    // respond to a change in the Narrative Element
    _handleNEChange(reasoner: StoryReasoner, narrativeElement: NarrativeElement) {
        if (this._currentRenderer) {
            this._currentRenderer.destroy();
        }
        this._currentNarrativeElement = narrativeElement;
        console.log(narrativeElement); // eslint-disable-line no-console
        this._fetchPresentation(narrativeElement.presentation.target)
            .then(presentation => this._representationReasoner(presentation))
            .then((representation) => {
                if (this._reasoner !== reasoner) {
                    return;
                }
                const currentRenderer = RendererFactory(
                    representation,
                    this._fetchAssetCollection,
                    this._fetchMedia,
                    this._neTarget,
                );

                if (currentRenderer) {
                    // render buttons if appropriate
                    if (this._getIdOfPreviousNode()) currentRenderer.renderBackButton();
                    if (this._isFollowedByAnotherNode(reasoner)) currentRenderer.renderNextButton();

                    currentRenderer.on('completeStartBehaviours', () => {
                        currentRenderer.start();
                    });
                    currentRenderer.on('complete', () => {
                        reasoner.next();
                    });
                    currentRenderer.on('nextButtonClicked', () => {
                        reasoner.next();
                    });
                    currentRenderer.on('backButtonClicked', () => {
                        this._goBackOneStepInStory();
                    });
                    this._currentRenderer = currentRenderer;
                    currentRenderer.willStart();
                } else {
                    console.error(
                        'Do not know how to render',
                        representation.representation_type,
                    );
                }

                // tell story renderer that we've changed
                if (this._renderStory) {
                    this._renderStory.handleNarrativeElementChanged(representation.id);
                }
            });
    }

    // create a reasoner to do a shadow walk of the story graph
    // when it reaches a target node, it boots out the original reasoner
    // and takes its place (with suitable event listeners)
    _jumpToNarrativeElementUsingShadowReasoner(storyId: string, targetNeId: string) {
        this._storyReasonerFactory(storyId).then((shadowReasoner) => {
            if (this._storyId !== storyId) {
                return;
            }

            // const _shadowHandleStoryEnd = () => {
            //     console.log('reached story end without meeting target node');
            // };
            // shadowReasoner.on('storyEnd', _shadowHandleStoryEnd);

            // the 'normal' event listeners
            const _handleStoryEnd = () => {
                alert('Story ended!'); // eslint-disable-line no-alert
            };
            const _handleError = (err) => {
                alert(`Error: ${err}`); // eslint-disable-line no-alert
            };
            shadowReasoner.on('error', _handleError);

            // run straight through the graph until we hit the target
            // when we do, change our event listeners to the normal ones
            // and take the place of the original _reasoner
            const shadowHandleNarrativeElementChanged = (narrativeElement: NarrativeElement) => {
                // console.log('shadow reasoner at', narrativeElement.name);
                if (narrativeElement.id === targetNeId) {
                    // console.log('TARGET HIT!');

                    // remove event listeners for the original reasoner
                    this.reset();

                    // apply appropriate listeners to this reasoner
                    this._storyId = storyId;
                    shadowReasoner.on('storyEnd', _handleStoryEnd);
                    shadowReasoner.removeListener(
                        'narrativeElementChanged',
                        shadowHandleNarrativeElementChanged,
                    );
                    this._handleNarrativeElementChanged = (ne: NarrativeElement) => {
                        this._handleNEChange(shadowReasoner, ne);
                    };
                    shadowReasoner.on(
                        'narrativeElementChanged',
                        this._handleNarrativeElementChanged,
                    );

                    // swap out the original reasoner for this one
                    this._reasoner = shadowReasoner;

                    // now we've walked to the target, trigger the change event handler
                    // so that it calls the renderers etc.
                    this._handleNEChange(shadowReasoner, narrativeElement);
                } else {
                    // just keep on walking until we find it (or reach the end)
                    shadowReasoner.next();
                }
            };
            shadowReasoner.on('narrativeElementChanged', shadowHandleNarrativeElementChanged);

            shadowReasoner.start();
        });
    }

    //
    // go to an arbitrary node in the current story
    // @param neid: id of narrative element to jump to
    _jumpToNarrativeElement(narrativeElementId: string) {
        if (!this._reasoner) {
            console.error('no reasoner');
            return;
        }
        const currentReasoner = this._reasoner
            .getSubReasonerContainingNarrativeElement(narrativeElementId);
        if (currentReasoner) {
            currentReasoner._setCurrentNarrativeElement(narrativeElementId);
        } else {
            console.log(narrativeElementId, 'not in substory - doing shadow walk');
            if (this._storyId) {
                this._jumpToNarrativeElementUsingShadowReasoner(this._storyId, narrativeElementId);
            }
        }
    }

    // is there a next node in the path.  Takes current reasoner and
    // recurses into subStoryReasoners
    _isFollowedByAnotherNode(reasoner: StoryReasoner): boolean {
        // can't have two end story links, so if multiple links, must continue
        if (reasoner._currentNarrativeElement.links.length > 1) {
            return true;
        }
        // if only link is to an NE, must continue
        if (reasoner._currentNarrativeElement.links[0].link_type === 'NARRATIVE_ELEMENT') {
            return true;
        }
        // if not, check with reasoner whether we go into another story
        const subReasoner = reasoner._subStoryReasoner;
        if (subReasoner) return this._isFollowedByAnotherNode(subReasoner);
        return false;
    }

    // get the id of the previous node
    // if it's a linear path, will use the linearStoryPath to identify
    // if not will ask reasoner to try within ths substory
    // otherwise, returns null.
    _getIdOfPreviousNode(): ?string {
        // console.log('getPrev', this._linearStoryPath);
        let matchingId = null;
        if (this._linearStoryPath) {
            // find current
            this._linearStoryPath.forEach((storyPathItem, i) => {
                if (storyPathItem.narrative_element.id === this._currentNarrativeElement.id
                    && i >= 1) {
                    matchingId = this._linearStoryPath[i - 1].narrative_element.id;
                }
            });
        } else if (this._reasoner) {
            const subReasoner = this._reasoner
                .getSubReasonerContainingNarrativeElement(this._currentNarrativeElement.id);
            if (subReasoner) matchingId = subReasoner.findPreviousNodeId();
        }
        return matchingId;
    }

    // create new divs within the target to hold the storyIconRenderer and
    // the renderer for the current NarrativeElement
    _createStoryAndElementDivs() {
        this._neTarget = document.createElement('div');
        this._neTarget.id = 'render_element';
        this._target.appendChild(this._neTarget);
        this._storyTarget = document.createElement('div');
        this._storyTarget.id = 'story_element';
        this._target.appendChild(this._storyTarget);
    }

    reset() {
        this._storyId = null;
        if (this._reasoner && this._handleStoryEnd) {
            this._reasoner.removeListener('storyEnd', this._handleStoryEnd);
        }
        if (this._reasoner && this._handleError) {
            this._reasoner.removeListener('error', this._handleError);
        }
        if (this._reasoner && this._handleNarrativeElementChanged) {
            this._reasoner.removeListener(
                'narrativeElementChanged',
                this._handleNarrativeElementChanged,
            );
        }
        this._reasoner = null;

        if (this._currentRenderer) {
            this._currentRenderer.destroy();
        }
    }

    _storyId: ?string;
    _reasoner: ?StoryReasoner;
    _currentRenderer: ?BaseRenderer;
    _target: HTMLElement;
    _storyReasonerFactory: StoryReasonerFactory;
    _fetchPresentation: PresentationFetcher;
    _fetchAssetCollection: AssetCollectionFetcher;
    _representationReasoner: RepresentationReasoner;
    _fetchMedia: MediaFetcher;
    _fetchStory: StoryFetcher;
    _renderers: Renderers;
    _handleError: ?Function;
    _handleStoryEnd: ?Function;
    _handleNarrativeElementChanged: ?Function;
    _renderStory: StoryIconRenderer;
    _neTarget: HTMLDivElement;
    _storyTarget: HTMLDivElement;
    _linearStoryPath: Array<StoryPathItem>;
    _currentNarrativeElement: NarrativeElement;
}
