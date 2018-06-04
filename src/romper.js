// @flow

import ObjectDataResolver from './resolvers/ObjectDataResolver';
import type { Settings } from './romper';
import Controller from './Controller';

// eslint-disable-next-line import/no-named-as-default
import StoryReasonerFactory from './StoryReasonerFactory';
import RepresentationReasonerFactory from './RepresentationReasoner';
import MediaFetcher from './fetchers/MediaFetcher';
// import MediaManager from './MediaManager';
import logger from './logger';

// @flowignore
import './assets/styles/player.scss';


const DEFAULT_SETTINGS = {
    mediaFetcher: new MediaFetcher({}),
    analyticsLogger: (logdata) => {
        if (logdata.to && logdata.from) {
            // eslint-disable-next-line max-len
            logger.info(`ANALYTICS: ${logdata.type}, ${logdata.name}: ${logdata.from} - ${logdata.to}`);
        } else {
            logger.info(`ANALYTICS: ${logdata.type}, ${logdata.name}`);
        }
    },
};


module.exports = {
    RESOLVERS: {
        FROM_OBJECT: ObjectDataResolver,
    },

    init: (settings: Settings): ?Controller => {
        const mergedSettings = Object.assign({}, DEFAULT_SETTINGS, settings);

        if (!mergedSettings.dataResolver) {
            logger.info('No data resolver passed to romper - creating one');
            mergedSettings.dataResolver = ObjectDataResolver({});
        }

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
            mergedSettings.analyticsLogger,
        );
    },
};
