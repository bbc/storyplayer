// @flow

import type { StoryReasonerFactory } from './StoryReasonerFactory';
import StoryReasoner from './StoryReasoner';
import type { StoryFetcher, NarrativeElement, PresentationFetcher, AssetCollectionFetcher, MediaFetcher } from './romper';
import type { RepresentationReasoner } from './RepresentationReasoner';
import StoryPathWalker from './StoryPathWalker';
import type { StoryPathItem } from './StoryPathWalker';
import RenderManager from './RenderManager';

// import VideoContext from 'videocontext';

export default class Controller {
    constructor(
        target: HTMLElement,
        storyReasonerFactory: StoryReasonerFactory,
        fetchPresentation: PresentationFetcher,
        fetchAssetCollection: AssetCollectionFetcher,
        representationReasoner: RepresentationReasoner,
        fetchMedia: MediaFetcher,
        fetchStory: StoryFetcher,
    ) {
        this._storyId = null;
        this._reasoner = null;
        this._target = target;
        this._storyReasonerFactory = storyReasonerFactory;
        this._fetchPresentation = fetchPresentation;
        this._representationReasoner = representationReasoner;
        this._fetchAssetCollection = fetchAssetCollection;
        this._fetchMedia = fetchMedia;
        this._fetchStory = fetchStory;
        this._linearStoryPath = [];
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

        // see if we have a linear story
        this._testForLinearityAndBuildStoryRenderer(storyId);

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

            this._createRenderManager();
        });
    }

    // create a manager to handle the rendering
    _createRenderManager() {
        this._renderManager = new RenderManager(
            this,
            this._target,
            this._fetchPresentation,
            this._fetchAssetCollection,
            this._representationReasoner,
            this._fetchMedia,
        );

        this._renderManager.on('complete', () => {
            if (this._reasoner) this._reasoner.next();
        });
        this._renderManager.on('nextButtonClicked', () => {
            if (this._reasoner) this._reasoner.next();
        });
        this._renderManager.on('backButtonClicked', () => {
            this._goBackOneStepInStory();
        });
    }

    // see if we have a linear story
    // and if we do, create a StoryIconRenderer
    _testForLinearityAndBuildStoryRenderer(storyId: string) {
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
                if (storyItemPath) this._renderManager._createStoryIconRenderer(storyItemPath);
            });
        };

        spw.on('walkComplete', _handleWalkEnd);
        spw.parseStory(storyId);
    }

    //
    // go to previous node in the current story, if we can
    //
    _goBackOneStepInStory() {
        const previous = this._getIdOfPreviousNode();
        if (previous) {
            this._jumpToNarrativeElement(previous);
        } else {
            console.error('cannot resolve previous node to go to');
        }
    }

    // respond to a change in the Narrative Element: update the renderers
    _handleNEChange(reasoner: StoryReasoner, narrativeElement: NarrativeElement) {
        this._currentNarrativeElement = narrativeElement;
        console.log(narrativeElement); // eslint-disable-line no-console
        this._renderManager.handleNEChange(narrativeElement);
    }

    // try to get the narrative element object with the given id
    // returns NE if it is either in the current subStory, or if this story is
    // linear (assuming id is valid).
    // returns null otherwise
    _getNarrativeElement(neid: string): ?NarrativeElement {
        let neObj;
        if (this._reasoner) {
            // get the actual NarrativeElement object
            const subReasoner = this._reasoner.getSubReasonerContainingNarrativeElement(neid);
            if (subReasoner) {
                neObj = subReasoner._narrativeElements[neid];
            }
            if (!neObj && this._linearStoryPath) {
                // can't find it via reasoner if in different substoruy,
                // but can get from storyPath if linear
                this._linearStoryPath.forEach((storyPathItem) => {
                    if (storyPathItem.narrative_element.id === neid) {
                        neObj = storyPathItem.narrative_element;
                    }
                });
            }
        }
        return neObj;
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

    // is the current Narrative Element followed by another?
    hasNextNode(): boolean {
        if (this._reasoner && this._reasoner.hasNextNode()) return true;
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

    // get an array of ids of the NarrativeElements that follow narrativeElement
    // finds next NARRATIVE_ELEMENTs, but does not look out of the current subStory,
    // except in case of linear story
    _getIdsOfNextNodes(narrativeElement: NarrativeElement) {
        const upcomingIds: Array<string> = [];
        const nextNodes = narrativeElement.links;
        nextNodes.forEach((link) => {
            if (link.link_type === 'NARRATIVE_ELEMENT' && link.target) {
                upcomingIds.push(link.target);
            } else if (link.link_type === 'END_STORY') {
                if (this._linearStoryPath) {
                    let matchingId = null;
                    this._linearStoryPath.forEach((storyPathItem, i) => {
                        if (storyPathItem.narrative_element.id === narrativeElement.id
                            && i < this._linearStoryPath.length) {
                            matchingId = this._linearStoryPath[i + 1].narrative_element.id;
                        }
                    });
                    if (matchingId) {
                        upcomingIds.push(matchingId);
                    }
                }
            }
        });
        // console.log('upcoming:', upcomingIds);
        return upcomingIds;
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

        this._renderManager.reset();
    }

    _storyId: ?string;
    _reasoner: ?StoryReasoner;
    _target: HTMLElement;
    _storyReasonerFactory: StoryReasonerFactory;
    _fetchPresentation: PresentationFetcher;
    _fetchAssetCollection: AssetCollectionFetcher;
    _representationReasoner: RepresentationReasoner;
    _fetchMedia: MediaFetcher;
    _fetchStory: StoryFetcher;
    _handleError: ?Function;
    _handleStoryEnd: ?Function;
    _handleNarrativeElementChanged: ?Function;
    _linearStoryPath: Array<StoryPathItem>;
    _currentNarrativeElement: NarrativeElement;
    _renderManager: RenderManager;
}
