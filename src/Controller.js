// @flow

import type { StoryReasonerFactory } from './StoryReasonerFactory';
import type StoryReasoner from './StoryReasoner';
import type { StoryFetcher, NarrativeElement, Presentation, PresentationFetcher, AssetCollectionFetcher, MediaFetcher, Renderers } from './romper';
import type { RepresentationReasoner } from './RepresentationReasoner';
import type BaseRenderer from './renderers/BaseRenderer';
import RendererFactory from './renderers/RendererFactory';
import StoryPathWalker from './StoryPathWalker';
import StoryRenderer from './renderers/StoryRenderer';

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
    }

    start(storyId: string) {
        this._storyId = storyId;

        const spw = new StoryPathWalker(this._fetchStory, this._fetchPresentation);
        // spw.on('nonLinear', () => alert('non-linear story'));
        const handleWalkEnd = (linear) => {
            // what do we do if we find a linear story
            const handleLinearStory = (presentationPath: Array<Presentation>) => {
                // resolve a presentation list into a promise of representation list
                const getRepresentationList = (path: Array<Presentation>) => {
                    const replist = [];
                    const promises = [];
                    path.forEach((presentationId) => {
                        promises.push(this._representationReasoner(presentationId)
                            .then((repres) => {
                                replist.push(repres);
                            }));
                    });
                    return Promise.all(promises).then(() => replist);
                };

                getRepresentationList(presentationPath).then((list) => {
                    const storyRenderer = new StoryRenderer(list, this._fetchAssetCollection, this._fetchMedia, this._target);
                    storyRenderer.on('pathShift', (repid) => {
                        console.log('controller switch to', repid);
                    });
                    storyRenderer.start();
                });
            };

            if (linear) {
                spw.getStoryPath()
                    .then(map => handleLinearStory(map));
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
                        const currentRenderer = RendererFactory(representation, this._fetchAssetCollection, this._fetchMedia, this._target);

                        if (currentRenderer) {
                            currentRenderer.start();
                            currentRenderer.on('complete', () => {
                                reasoner.next();
                            });
                            this._currentRenderer = currentRenderer;
                        } else {
                            console.error(`Do not know how to render ${representation.representation_type}`);
                        }
                    });
            };
            reasoner.on('narrativeElementChanged', this._handleNarrativeElementChanged);

            this._reasoner = reasoner;
            this._reasoner.start();
        });
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
            this._reasoner.removeListener('narrativeElementChanged', this._handleNarrativeElementChanged);
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
}
