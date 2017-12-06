// @flow

import type BaseRenderer from './BaseRenderer';
import type { AssetCollectionFetcher, Representation, MediaFetcher } from '../romper';
import ImageRenderer from './ImageRenderer';
import SimpleAVRenderer from './SimpleAVRenderer';
import SwitchableRenderer from './SwitchableRenderer';

export default function RendererFactory(representation: Representation, assetCollectionFetcher: AssetCollectionFetcher, mediaFetcher: MediaFetcher, target: HTMLElement): ?BaseRenderer {
    const RENDERERS = {
        'urn:x-object-based-media:representation-types:image/v1.0': ImageRenderer,
        'urn:x-object-based-media:representation-types:simple-av/v1.0': SimpleAVRenderer,
        'urn:x-object-based-media:representation-types:switchable/v1.0': SwitchableRenderer,
    };

    let currentRenderer;

    if (representation.representation_type in RENDERERS) {
        const Renderer = RENDERERS[representation.representation_type];
        currentRenderer = new Renderer(
            representation,
            assetCollectionFetcher,
            mediaFetcher,
            target,
        );
    } else {
        console.error(`Do not know how to render ${representation.representation_type}`);
    }
    return currentRenderer;
}
