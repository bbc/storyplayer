// @flow

import type { StoryReasonerFactory } from './StoryReasonerFactory';
import type StoryReasoner from './StoryReasoner';
import type { NarrativeElement, PresentationFetcher, AssetCollectionFetcher, Renderers } from './romper';
import type { RepresentationReasoner } from './RepresentationReasoner';
import type BaseRenderer from './renderers/BaseRenderer';
import RendererFactory from './renderers/RendererFactory';
import type { MediaFetcher } from './romper';

export default class Controller {
    constructor(
        target: HTMLElement,
        storyReasonerFactory: StoryReasonerFactory,
        fetchPresentation: PresentationFetcher,
        fetchAssetCollection: AssetCollectionFetcher,
        representationReasoner: RepresentationReasoner,
        fetchMedia: MediaFetcher,
        renderers: Renderers,
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
    }

    start(storyId: string) {
        this._storyId = storyId;

        this._storyReasonerFactory(this._storyId).then((reasoner) => {
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

                        const currentRenderer = RendererFactory(representation, this._fetchAssetCollection, this._target);

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
    _renderers: Renderers;
    _handleError: ?Function;
    _handleStoryEnd: ?Function;
    _handleNarrativeElementChanged: ?Function;
}
