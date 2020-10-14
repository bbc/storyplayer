// @flow

import Player from '../gui/Player';
import BaseRenderer, { RENDERER_PHASES } from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';
import { replaceEscapedVariables } from '../utils';

import logger from '../logger';
import { REASONER_EVENTS, VARIABLE_EVENTS } from '../Events';

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

    _setOverflowStyling: Function;

    renderTextElement: Function;

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

        this._setOverflowStyling = this._setOverflowStyling.bind(this);

        // we have a one time event listener as we remove the prestart classname from the media element indicating we've started playing so 
        // we should resize if we need to otherwise the GUI is shrunk and buttons disappear 
        this._player.once(REASONER_EVENTS.ROMPER_STORY_STARTED, () =>
            this._setOverflowStyling(this._target.clientHeight || 720)
        );
    
        // Resize event listener to dynamically resize the text element and apply overflow style rules
        window.addEventListener('resize', () =>
            this._setOverflowStyling(this._target.clientHeight)
        );

        this.renderTextElement = this.renderTextElement.bind(this);
        this._controller.on(VARIABLE_EVENTS.CONTROLLER_CHANGED_VARIABLE, this.renderTextElement);
    }

    /**
     * Inits this renderer
     */
    async init() {
        try {
            this._textDiv = document.createElement('div');
            this._textDiv.classList.add('romper-text-element');
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
        this._playoutEngine.startNonAVPlayout(this._rendererId, 0)

        this._target.appendChild(this._textDiv);
        this._player.disablePlayButton();
        this._player.disableScrubBar();
        this._setOverflowStyling(this._target.clientHeight);
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
        this._playoutEngine.stopNonAVPlayout(this._rendererId)

        logger.info(`Ended: ${this._representation.id}`);
        try {
            this._target.removeChild(this._textDiv);
            const guiLayer = document.getElementById('gui-layer');
            if(guiLayer)
                guiLayer.classList.remove('overflowing-text');
        } catch (e) {
            logger.warn('could not remove text renderer element');
        }
        this._player.enablePlayButton();
        this._player.enableScrubBar();
        this._controller.off(VARIABLE_EVENTS.CONTROLLER_CHANGED_VARIABLE, this.renderTextElement);
        return true;
    }

    /**
     * Determine what text to show, and call the populateTextElement function to 
     * populate it with the inner html
     */
    renderTextElement() {

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
     * check the text element is overflown
     */
    isOverflown() {
        return this._textDiv.scrollHeight > this._textDiv.clientHeight;
    }

    /**
     * Check we aren't in the pre start phase - stiry is yet to start here
     */
    isPreStartPhase() {
        return this._target.classList.contains('romper-prestart');
    }

    /**
     * Remove overflow styling from the player
     * @param {HTMLElement} guiLayer div element containing the buttons and clickable links etc
     */
    _removeOverflowStyle(guiLayer: HTMLElement) {
        guiLayer.classList.remove('overflowing-text');
        this._textDiv.classList.remove('overflowing-text');
        this._textDiv.style['max-height'] = '';
    }



    /**
     * Sets the overflow style for the text element and sets gui layer height so only the button activate area is present
     * @param {HTMLElement} guiLayer div element containing the buttons and clickable links etc
     */
    _addOverflowStyle(guiLayer: HTMLElement, maxHeight: number) {
        if (!this.isPreStartPhase()) {
            guiLayer.classList.add('overflowing-text');
            this._textDiv.classList.add('overflowing-text')
            this._textDiv.style['max-height'] = `calc(${maxHeight}px - 4em)`;
        }
    }
    
    /**
     * Gets the gui layer and checks we have added the text node to the parent, 
     * then sets the CSS style appropriately whether we should overflow and scroll or not
     * @param {number} maxHeight the max height of the player target div, used to set the max height of the text element
     */
    _setOverflowStyling(maxHeight: number) {
        const guiLayer = document.getElementById('gui-layer');
        if(guiLayer && this._textDiv.parentNode) {
            if (this.isOverflown()) {
                this._addOverflowStyle(guiLayer, maxHeight);
            } else {
                this._removeOverflowStyle(guiLayer);
            }     
        }
    }

    /**
     * Populates the text element with the string provided
     * @param {string} textContent 
     */
    populateTextElement(textContent: string) {
        replaceEscapedVariables(textContent, this._controller)
            .then((newText) => {
                this._textDiv.innerHTML = newText;
            });
    }

}
