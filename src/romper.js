// @flow

import ObjectDataResolver from './resolvers/ObjectDataResolver';
import SimpleAVRenderer from './renderers/SimpleAVRenderer';
import type { Settings } from "./romper";
import Controller from "./Controller";
import StoryReasonerFactory from "./StoryReasonerFactory";
import RepresentationReasonerFactory from "./RepresentationReasoner";

const RENDERERS = {
    "urn:x-object-based-media:representation-types:simple-av/v1.0": SimpleAVRenderer,
    "urn:x-object-based-media:representation-types:switchable/v1.0": SimpleAVRenderer
};

const DEFAULT_SETTINGS = {
    renderers: RENDERERS,
};

module.exports = {
    RENDERERS,

    RESOLVERS: {
        FROM_OBJECT: ObjectDataResolver,
    },

    init: (settings: Settings) => {
        const mergedSettings = Object.assign({}, DEFAULT_SETTINGS, settings);

        const storyReasonerFactory = StoryReasonerFactory(mergedSettings.storyFetcher, mergedSettings.dataResolver);
        const representationReasoner = RepresentationReasonerFactory(mergedSettings.dataResolver);
        return new Controller(
            mergedSettings.target,
            storyReasonerFactory,
            mergedSettings.presentationFetcher,
            representationReasoner,
            mergedSettings.renderers
        );
    },
};
