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
        this.createStoryAndElementDivs();
    }

    start(storyId: string) {
        this._storyId = storyId;

        // is the narrative element with id neid one of the narrative elements
        // that reasoner is currently reasoning over?
        const isInReasoner = (neid: string, reasoner: StoryReasoner): boolean => {
            const rids = Object.keys(reasoner._narrativeElements);
            return (rids.indexOf(neid) !== -1);
        };

        // dive into the substory reasoners until we find one that has neid
        // as one of its narrative elements
        // if not found, returns null
        const getSubReasoner = (neid: string, reasoner: ?StoryReasoner): ?StoryReasoner => {
            if (!reasoner) return null;
            if (isInReasoner(neid, reasoner)) {
                return reasoner;
            } else if (reasoner._subStoryReasoner) {
                return getSubReasoner(neid, reasoner._subStoryReasoner);
            }
            return null;
        };

        /**
         * go to an arbitrary node in the current story
         * @param neid: id of narrative element to jump to
         */
        const jumpToNarrativeElement = (neid: string) => {
            if (!this._reasoner) console.error('no reasoner');
            // console.log('finding reasoner for', neid);
            const currentReasoner = getSubReasoner(neid, this._reasoner);
            if (currentReasoner) {
                currentReasoner._setCurrentNarrativeElement(neid);
            } else {
                console.error('cannot navigate to', neid);
            }
        };

        /**
         * go to previous node in the current story
         * @param currentNeId id of narrative element to go back from
         */
        const goBack = () => {
            let currentReasoner = this._reasoner;

            if (!currentReasoner) {
                console.error('cannot go back - no reasoner');
                return;
            }

            while (currentReasoner._subStoryReasoner) {
                currentReasoner = currentReasoner._subStoryReasoner;
            }

            const previous = currentReasoner._findPreviousNode();
            if (previous) {
                jumpToNarrativeElement(previous);
            } else {
                console.error('cannot resolve previous node to go to');
            }
        };

        const spw = new StoryPathWalker(this._fetchStory, this._fetchPresentation);

        // handle our StoryPathWalker reaching the end of its travels:
        // resolve the list of presentations into representations
        // then (if story is linear) create and start a StoryIconRenderer
        const handleWalkEnd = (presentationPath: Array<StoryPathItem>) => {
            // resolve a presentation list into a promise of representation list
            // returns a promise for such a list
            const getRepresentationList = (path: Array<StoryPathItem>) => {
                const replist = [];
                const promises = [];
                path.forEach((pathItem) => {
                    promises.push(this._representationReasoner(pathItem.presentation));
                });

                return Promise.all(promises).then((representations) => {
                    representations.forEach((repres, i) => {
                        path[i].representation = repres;
                        replist.push(path[i]);
                    });
                    return Promise.resolve(replist);
                });
            };

            // resolve the promise by creating the StoryIconRenderer
            getRepresentationList(presentationPath).then((list) => {
                this._renderStory = new StoryIconRenderer(
                    list,
                    this._fetchAssetCollection,
                    this._fetchMedia,
                    this._storyTarget,
                );
                this._renderStory.on('jumpToNarrativeElement', (neid) => {
                    console.log('controller received request to switch to ne', neid);
                    jumpToNarrativeElement(neid);
                });
                this._renderStory.start();
            });

            // the walk has finished - is it linear
            if (presentationPath.length > 0) {
                // yes - do all the above to build the StoryIconRenderer
                spw.getStoryPath()
                    .then(map => getRepresentationList(map));
            }
        };

        spw.on('walkComplete', handleWalkEnd);
        spw.parseStory(storyId);

        this._storyReasonerFactory(storyId).then((reasoner) => {
            if (this._storyId !== storyId) {
                return;
            }

            this._handleStoryEnd = () => {
                alert('Story ended!'); // eslint-disable-line no-alert
            };
            reasoner.on('storyEnd', this._handleStoryEnd);

            this._handleError = (err) => {
                alert(`Error: ${err}`); // eslint-disable-line no-alert
            };
            reasoner.on('error', this._handleError);

            this._handleNarrativeElementChanged = (narrativeElement: NarrativeElement) => {
                if (this._currentRenderer) {
                    this._currentRenderer.destroy();
                }
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
                            currentRenderer.renderBackButton();
                            currentRenderer.renderNextButton();
                            currentRenderer.on('completeStartBehaviours', () => {
                                currentRenderer.start();
                            });
                            currentRenderer.on('complete', () => {
                                reasoner.next();
                            });
                            currentRenderer.on('nextButtonClicked', () => {
                                reasoner.next();
                            });

                            // this is used by a custom behaviour...
                            // can't really go about adapting controller
                            // when we have new behaviours
                            // (although most behaviours shouldn't interfere with
                            // story logic)
                            currentRenderer.on('backButtonClicked', () => {
                                goBack();
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
            };
            reasoner.on('narrativeElementChanged', this._handleNarrativeElementChanged);

            this._reasoner = reasoner;
            this._reasoner.start();
        });
    }

    createStoryAndElementDivs() {
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
}
