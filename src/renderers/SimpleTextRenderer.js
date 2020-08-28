// @flow

import Player from '../gui/Player';
import BaseRenderer, { RENDERER_PHASES } from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';

import logger from '../logger';
import { REASONER_EVENTS } from '../Events';

export type HTMLTrackElement = HTMLElement & {
    kind: string,
    label: string,
    srclang: string,
    src: string,
    mode: string,
    default: boolean,
}

/**
 * Simple text renderer displays a HTML element populated with the description 
 * or asset collection text_src
 */
export default class SimpleTextRenderer extends BaseRenderer {
    _fetchMedia: MediaFetcher;

    _canvas: HTMLCanvasElement;

    _behaviourElements: Array<HTMLElement>;

    _target: HTMLDivElement;

    _textDiv: HTMLDivElement;

    _setGUILayerCSS: Function;

    MAX_HEIGHT: number;

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

        this.MAX_HEIGHT = this._target.clientHeight || 720;;

        this._setGUILayerCSS = this._setGUILayerCSS.bind(this);

        // we have a one time event listener as we remove the prestart classname from the media element
        // to indicate we have started otherwise the GUI is shrunk and buttons disappear
        this._player.once(REASONER_EVENTS.ROMPER_STORY_STARTED, this._setGUILayerCSS);
        window.addEventListener('resize', () => {
            this.MAX_HEIGHT = this._target.clientHeight;
            this._setGUILayerCSS();
        });

    }

    /**
     * Inits this renderer
     */
    async init() {
        try {
            await this.renderTextElement()
            await this._preloadBehaviourAssets();
            this._setPhase(RENDERER_PHASES.CONSTRUCTED);
        } catch(err) {
            logger.error(err, 'could not initiate text renderer');
        }
    }

    /**
     * Called to actually start the renderer
     */
    willStart() {
        const ready = super.willStart();
        if (!ready) return false;

        this._target.appendChild(this._textDiv);
        this._player.disablePlayButton();
        this._player.disableScrubBar();
        this._setGUILayerCSS();
        return true;
    }

    /**
     * Starts the renderer sets the phase to be RENDERER_PHASES.MEDIA_FINISHED
     * @extends BaseRenderer#start()
     */
    start() {
        super.start();
        // no duration, so ends immediately
        this._setPhase(RENDERER_PHASES.MEDIA_FINISHED);
    }

    /**
     * End the renderer, and clean up the css classes on the GUI later if we need to
     * @extends baseRenderer#end()
     */
    end() {
        const needToEnd = super.end();
        if (!needToEnd) return false;

        logger.info(`Ended: ${this._representation.id}`);
        try {
            this._target.removeChild(this._textDiv);
        } catch (e) {
            logger.warn('could not remove text renderer element');
        }
        this._player.enablePlayButton();
        this._player.enableScrubBar();
        return true;
    }

    /**
     * Creates the text element and calls the populateTextElement function to 
     * populate it with the inner html
     */
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

    /**
     * Fetches the text assets from the mediaUrl passed in
     * @param {string} mediaUrl url to text asset collection
     */
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

    /**
     * replaces the escaped variables so we can display them onscreen
     * @param {string} textContent text to replace 
     */
    _replaceEscapedVariables(textContent: string): Promise<string> {
        const varRefs = textContent.match(/\$\{(.*?)\}/g);
        if (varRefs) {
            return this._controller.getVariableState().then((vState) => {
                const getVal = (vName) => {
                    if (vState[vName]) {
                        /* eslint-disable camelcase */
                        const { variable_type, value } = vState[vName];
                        switch(variable_type) {
                        case 'number':
                            return value.toString();
                        case 'boolean':
                            return value ? 'yes' : 'no';
                        case 'list':
                        case 'string':
                        default:
                            return encodeURI(value);
                        }
                        /* eslint-enable camelcase */
                    }
                    return '';
                };
                const replacedText = textContent.replace(/\$\{(.*?)\}/g, (m ,c) => getVal(c));
                return replacedText;
            });
        }
        return Promise.resolve(textContent);
    }

    /**
     * check the text element is overflown
     */
    isOverflown() {
        return this._textDiv.scrollHeight > this._textDiv.clientHeight;
    }

    /**
     * Check we aren't in the pre start phase
     */
    isNotPreStart() {
        return !this._target.classList.contains('romper-prestart');
    }

    /**
     * Sets the overflow style for the text, on the gui layer and the text div too
     * @param {HTMLElement} guiLayer 
     */
    setOverflowStyle(guiLayer: HTMLElement) {
        if(!this._textDiv.parentNode) return;
        if (this.isOverflown()) {
            if (this.isNotPreStart()) {
                guiLayer.classList.add('overflowing-text');
                this._textDiv.classList.add('overflowing-text')
                this._textDiv.style['max-height'] = `calc(${this.MAX_HEIGHT}px - 4em)`;
            }
        } else {
            guiLayer.classList.remove('overflowing-text');
            this._textDiv.classList.remove('overflowing-text');
            this._textDiv.style['max-height'] = '';
        }       
    }
    
    /**
     * Gets the gui layer and checks we have added the text node to the parent, 
     * then sets the CSS style appropriately
     */
    // eslint-disable-next-line class-methods-use-this
    _setGUILayerCSS() {
        const guiLayer = document.getElementById('gui-layer');
        if(guiLayer && this._textDiv.parentNode) {
            this.setOverflowStyle(guiLayer);
        }
    }

    /**
     * Populates the text element with the string provided
     * @param {string} textContent 
     */
    populateTextElement(textContent: string) {
        this._replaceEscapedVariables(textContent)
            .then((newText) => {
                this._textDiv.innerHTML = newText;
            });
    }

}
