// @flow

import type BackgroundRenderer from './BackgroundRenderer';
import type { AssetCollectionFetcher, Representation, MediaFetcher } from '../romper';
import BackgroundAudioRenderer from './BackgroundAudioRenderer';

export default function BackgroundRendererFactory(
    assetCollectionType: string,
    representation: Representation,
    assetCollectionFetcher: AssetCollectionFetcher,
    mediaFetcher: MediaFetcher, target: HTMLElement,
): ?BackgroundRenderer {
    const RENDERERS = {
        'urn:x-object-based-media:asset-collection-types:looping-audio/v1.0': BackgroundAudioRenderer,
    };

    let currentRenderer;

    if (assetCollectionType in RENDERERS) {
        const Renderer = RENDERERS[assetCollectionType];
        currentRenderer = new Renderer(
            representation,
            assetCollectionFetcher,
            mediaFetcher,
            target,
        );
    } else {
        console.error(`Do not know how to render background ${assetCollectionType}`);
    }
    return currentRenderer;
}
