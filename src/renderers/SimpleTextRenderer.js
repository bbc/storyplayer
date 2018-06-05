// @flow

import Player, { PlayerEvents } from '../Player';
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import AnalyticEvents from '../AnalyticEvents';
import type { AnalyticsLogger } from '../AnalyticEvents';

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
    ) {
        super(representation, assetCollectionFetcher, fetchMedia, player, analytics);
        
        this._target = player.mediaTarget;

        
        this._behaviourRendererMap = { };
    }
    
    start() {
        super.start();
        this.renderTextElement();
    }

    end() {
        logger.info(`Ended: ${this._representation.id}`);
        this._target.removeChild(this._textDiv);
    }

    renderTextElement() {
        this._textDiv = document.createElement('div');
        this._textDiv.classList.add('romper-text-element');

        // set audio source
        if (this._representation.asset_collection.foreground) {
            this._fetchAssetCollection(this._representation.asset_collection.foreground)
                .then((fg) => {
                    if (fg.assets.text_content) {
                        this.populateTextElement(fg.assets.text_content);
                    } else if (fg.assets.text_src) {
                        this._fetchMedia(fg.assets.text_src)
                            .then((textFileUrl) => {
                                this._fetchTextContent(textFileUrl);
                            })
                            .catch((err) => {
                                logger.error(err, 'audio not found');
                            });
                        
                    } else {
                        logger.warn('No text content found');
                    }
                });
        }
    }

    _fetchTextContent(mediaUrl: string) {
        fetch(mediaUrl)
            .then((response) => {
                if(response.ok) {
                    return response.text();
                } else {
                    return Promise.reject(response);
                }
            })
            .then(text => this.populateTextElement(text))
            .catch((rejection) => logger.error(`could not fetch text content ${mediaUrl}: ${rejection.status} ${rejection.statusText}`));
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
