// @flow

import Player from '../Player';
import BaseRenderer, { RENDERER_PHASES } from './BaseRenderer';
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
    }

    async init() {
        await this.renderTextElement()
            .catch(err => logger.error(err, 'could not initiate text renderer'));
        this.phase = RENDERER_PHASES.CONSTRUCTED;
    }

    willStart() {
        super.willStart();
        this._target.appendChild(this._textDiv);
        this._player.disablePlayButton();
        this._player.disableScrubBar();
    }

    start() {
        super.start();
        this._hasEnded = true;
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
            return this._fetchAssetCollection(this._representation.asset_collections.foreground_id)
                .then((fg) => {
                    if (fg.assets.text_src) {
                        return this._fetchMedia(fg.assets.text_src)
                            .then((textFileUrl) => {
                                this._fetchTextContent(textFileUrl);
                            });
                    }
                    return Promise.reject(new Error('No text_src in foreground asset collection'));
                });
        }
        if (this._representation.description) {
            this.populateTextElement(this._representation.description);
            logger.warn('Text Renderer has no asset collection - rendering description');
            return Promise.resolve();
        }
        return Promise.reject(new Error('No text to render'));
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
    }

    destroy() {
        this.end();
        super.destroy();
    }
}
