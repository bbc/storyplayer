// @flow

import ObjectDataResolver from './resolvers/ObjectDataResolver';
import type { Settings, ExperienceFetchers, AssetUrls } from './romper.js.flow';
import Controller from './Controller';

// eslint-disable-next-line import/no-named-as-default
import StoryReasonerFactory from './StoryReasonerFactory';
import RepresentationReasonerFactory from './RepresentationReasoner';
import MediaFetcher from './fetchers/MediaFetcher';
import logger from './logger';

import BrowserCapabilities, { BrowserUserAgent } from './browserCapabilities';

import Package from '../package.json';

// Import Assets for assetUrls object as they may not of been imported in CSS
import './assets/images/media-play-8x.png';
import './assets/images/media-pause-8x.png';
import './assets/images/media-step-forward-8x.png';
import './assets/images/media-step-backward-8x.png';
import './assets/images/no-asset.svg';

// @flowignore
import './assets/styles/player.scss';

import { REASONER_EVENTS, VARIABLE_EVENTS, ERROR_EVENTS} from './Events';

const DEFAULT_SETTINGS = {
    mediaFetcher: new MediaFetcher({}),
    analyticsLogger: (logdata) => {
        if (logdata.to
            && logdata.from
            && logdata.current_narrative_element
            && logdata.current_representation) {
            // eslint-disable-next-line max-len
            logger.info(`ANALYTICS: ${logdata.type}, ${logdata.name}: ${logdata.from} - ${logdata.to}; NE: ${logdata.current_narrative_element}, Rep: ${logdata.current_representation}`);
        } else {
            logger.info(`ANALYTICS: ${logdata.type}, ${logdata.name}`);
        }
    },
    staticImageBaseUrl: '/dist/images',
    privacyNotice: null,
};

module.exports = {
    RESOLVERS: {
        FROM_OBJECT: ObjectDataResolver,
    },
    BrowserUserAgent,
    BrowserCapabilities,
    ERROR_EVENTS,
    REASONER_EVENTS,
    VARIABLE_EVENTS,
    init: (settings: Settings): ?Controller => {
        logger.info('StoryPlayer Version: ', Package.version);
        const mergedSettings = Object.assign({}, DEFAULT_SETTINGS, settings);

        if (!mergedSettings.dataResolver) {
            logger.info('No data resolver passed to romper - creating one');
            mergedSettings.dataResolver = ObjectDataResolver({});
        }

        const storyReasonerFactory = StoryReasonerFactory(
            mergedSettings.storyFetcher,
            mergedSettings.narrativeElementFetcher,
            mergedSettings.dataResolver,
        );

        const representationReasonerFactory = RepresentationReasonerFactory(
            mergedSettings.representationFetcher,
            mergedSettings.dataResolver,
        );

        const assetUrls: AssetUrls = {
            noAssetIconUrl: `${mergedSettings.staticImageBaseUrl}/no-asset.svg`,
            noBackgroundAssetUrl: `${mergedSettings.staticImageBaseUrl}/no-asset.svg`
        };

        const fetchers: ExperienceFetchers = {
            storyFetcher: mergedSettings.storyFetcher,
            narrativeElementFetcher: mergedSettings.narrativeElementFetcher,
            representationCollectionFetcher: mergedSettings.representationCollectionFetcher,
            representationFetcher: mergedSettings.representationFetcher,
            assetCollectionFetcher: mergedSettings.assetCollectionFetcher,
            mediaFetcher: mergedSettings.mediaFetcher,
        };

        return new Controller(
            mergedSettings.target,
            storyReasonerFactory,
            representationReasonerFactory,
            fetchers,
            mergedSettings.analyticsLogger,
            assetUrls,
            mergedSettings.privacyNotice,
        );
    },
};
