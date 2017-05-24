// @flow

import type { StoryReasonerFactory } from './StoryReasonerFactory';
import type { NarrativeElement, PresentationFetcher, Renderers } from "./romper";
import type { RepresentationReasoner } from "./RepresentationReasoner";

export default function Controller(
    storyId: string,
    target: HTMLElement,
    storyReasonerFactory: StoryReasonerFactory,
    fetchPresentation: PresentationFetcher,
    representationReasoner: RepresentationReasoner,
    renderers: Renderers
) {
    let currentRenderer;

    storyReasonerFactory(storyId)
        .then(reasoner => {

            reasoner.on('storyEnd', () => {
                alert('Story ended!');
            });

            reasoner.on('error', (err) => {
                console.error(err);
            });

            reasoner.on('narrativeElementChanged', (narrativeElement: NarrativeElement) => {
                if (currentRenderer) {
                    currentRenderer.destroy();
                }
                alert(narrativeElement.description);
                fetchPresentation(narrativeElement.presentation.target)
                    .then(presentation => representationReasoner(presentation))
                    .then(representation => {
                        if (representation.representation_type in renderers) {
                            const Renderer = renderers[representation.representation_type];
                            currentRenderer = new Renderer(representation, target);
                            currentRenderer.start();
                            currentRenderer.on('complete', () => {
                                reasoner.next();
                            });
                        } else {
                            console.error(`Do not know how to render ${representation.representation_type}`);
                        }
                    });
            });

            reasoner.start();
        });
}
