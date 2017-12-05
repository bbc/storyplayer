// @flow

import ObjectDataResolver from './resolvers/ObjectDataResolver';
import SimpleAVRenderer from './renderers/SimpleAVRenderer';
import ImageRenderer from './renderers/ImageRenderer';
import SwitchableRenderer from './renderers/SwitchableRenderer';
import type { Settings } from './romper';
import Controller from './Controller';
import StoryReasonerFactory from './StoryReasonerFactory'; // eslint-disable-line import/no-named-as-default
import RepresentationReasonerFactory from './RepresentationReasoner';

const DEFAULT_SETTINGS = {
};

module.exports = {
    RESOLVERS: {
        FROM_OBJECT: ObjectDataResolver,
    },

    init: (settings: Settings) => {
        const mergedSettings = Object.assign({}, DEFAULT_SETTINGS, settings);

        const storyReasonerFactory = StoryReasonerFactory(
            mergedSettings.storyFetcher,
            mergedSettings.dataResolver,
        );
        const representationReasoner = RepresentationReasonerFactory(mergedSettings.dataResolver);
        return new Controller(
            mergedSettings.target,
            storyReasonerFactory,
            mergedSettings.presentationFetcher,
            mergedSettings.assetCollectionFetcher,
            representationReasoner,
            mergedSettings.renderers,
        );
    },
};
