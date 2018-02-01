// @flow

import ObjectDataResolver from './resolvers/ObjectDataResolver';
import type { Settings } from './romper';
import Controller from './Controller';
// eslint-disable-next-line import/no-named-as-default
import StoryReasonerFactory from './StoryReasonerFactory';
import RepresentationReasonerFactory from './RepresentationReasoner';
import MediaFetcher from './fetchers/MediaFetcher';

// @flowignore
import './assets/styles/player.scss';


const DEFAULT_SETTINGS = {
    mediaFetcher: new MediaFetcher({}),
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
            mergedSettings.mediaFetcher,
            mergedSettings.storyFetcher,
        );
    },
};
