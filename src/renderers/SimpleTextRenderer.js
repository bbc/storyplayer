// @flow

import Player from '../Player';
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';

import logger from '../logger';

export type HTMLTrackElement = HTMLElement & {
    kind: string,
    label: string,
    srclang: string,
    src: string,
    mode: string,
    default: boolean,
}

export default class SimpleTextRenderer extends BaseRenderer {
    _fetchMedia: MediaFetcher;

    _canvas: HTMLCanvasElement;

    _behaviourElements: Array<HTMLElement>;

    _target: HTMLDivElement;

    _textDiv: HTMLDivElement;


    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        player: Player,
        analytics: AnalyticsLogger,
        controller: Controller,
    ) {
        super(
            representation,
            assetCollectionFetcher,
            fetchMedia,
            player,
            analytics,
            controller,
        );

        this._target = player.mediaTarget;

        this._behaviourRendererMap = {};
    }

    willStart() {
        super.willStart();
        this._player.disablePlayButton();
        this._player.disableScrubBar();
    }

    start() {
        super.start();
        this.renderTextElement();
    }

    end() {
        super.end();
        logger.info(`Ended: ${this._representation.id}`);
        try {
            this._target.removeChild(this._textDiv);
        } catch (e) {
            logger.warn('could not remove text renderer element');
        }
        this._player.enablePlayButton();
        this._player.enableScrubBar();
    }

    renderTextElement() {
        this._textDiv = document.createElement('div');
        this._textDiv.classList.add('romper-text-element');

        // set text source
        if (this._representation.asset_collections.foreground_id) {
            this._fetchAssetCollection(this._representation.asset_collections.foreground_id)
                .then((fg) => {
                    if (fg.assets.text_src) {
                        this._fetchMedia(fg.assets.text_src)
                            .then((textFileUrl) => {
                                this._fetchTextContent(textFileUrl);
                            })
                            .catch((err) => {
                                logger.error(err, 'text not found');
                            });
                    } else {
                        logger.warn('No text content found');
                    }
                });
        } else if (this._representation.description) {
            this.populateTextElement(this._representation.description);
            logger.warn('Text Renderer has no asset collection - rendering description');
        }
    }

    _fetchTextContent(mediaUrl: string) {
        fetch(mediaUrl)
            .then((response) => {
                if (response.ok) {
                    return response.text();
                }
                return Promise.reject(new Error(`Invalid response: ${response.toString()}`));
            })
            .then(text => this.populateTextElement(text))
            .catch((rejection) => {
                // eslint-disable-next-line max-len
                logger.error(`could not fetch text content ${mediaUrl}: ${rejection.status} ${rejection.statusText}`);
            });
    }

    populateTextElement(textContent: string) {
        this._textDiv.innerHTML = textContent;
        this._target.appendChild(this._textDiv);
    }

    destroy() {
        this.end();
        super.destroy();
    }
}
