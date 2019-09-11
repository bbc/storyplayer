// @flow

import type BaseRenderer from './BaseRenderer';
import type { AssetCollectionFetcher, Representation, MediaFetcher } from '../romper';
import ImageRenderer from './ImageRenderer';
import SimpleAVRenderer from './SimpleAVRenderer';
import SimpleAudioRenderer from './SimpleAudioRenderer';
import SimpleTextRenderer from './SimpleTextRenderer';
import SwitchableRenderer from './SwitchableRenderer';
import ThreeJsVideoRenderer from './ThreeJsVideoRenderer';
import ThreeJsImageRenderer from './ThreeJsImageRenderer';
import Player from '../Player';
import logger from '../logger';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';

export default function RendererFactory(
    representation: Representation,
    assetCollectionFetcher: AssetCollectionFetcher,
    mediaFetcher: MediaFetcher,
    player: Player,
    analytics: AnalyticsLogger,
    controller: Controller,
): ?BaseRenderer {
    const RENDERERS = {
        'urn:x-object-based-media:representation-types:image/v1.0': ImageRenderer,
        'urn:x-object-based-media:representation-types:simple-av/v1.0': SimpleAVRenderer,
        'urn:x-object-based-media:representation-types:simple-audio/v1.0': SimpleAudioRenderer,
        'urn:x-object-based-media:representation-types:simple-text/v1.0': SimpleTextRenderer,
        'urn:x-object-based-media:representation-types:placeholder/v1.0': SimpleTextRenderer,
        'urn:x-object-based-media:representation-types:switchable/v1.0': SwitchableRenderer,
        'urn:x-object-based-media:representation-types:immersive/v1.0': ThreeJsVideoRenderer,
        'urn:x-object-based-media:representation-types:image360/v1.0': ThreeJsImageRenderer,
    };

    let currentRenderer;

    if (representation.representation_type in RENDERERS) {
        const Renderer = RENDERERS[representation.representation_type];
        currentRenderer = new Renderer(
            representation,
            assetCollectionFetcher,
            mediaFetcher,
            player,
            analytics,
            controller,
        );
    } else {
        logger.error(`Do not know how to render ${representation.representation_type}`);
    }
    return currentRenderer;
}
