// @flow
import EventEmitter from 'events';
import { createElementWithClass } from '../documentUtils';
import logger from '../logger';
import { OVERLAY_ACTIVATED_EVENT, OVERLAY_DEACTIVATED_EVENT } from './Overlay';
import { REASONER_EVENTS } from '../Events';

class NavPanel extends EventEmitter {

    constructor(
        backgroundImageId,
        elements,
        player,
        fetchAssetCollection,
        fetchMedia,
    ) {
        super();
        this._player = player;
        this._fetchAssetCollection = fetchAssetCollection;
        this._fetchMedia = fetchMedia;
        this._elements = elements;
        this._createNavPanel(backgroundImageId);
        this._handleClick = this._handleClick.bind(this);
        this._overlay = this._player._icon; // we're overriding this overlay button
        this._currentPosition = {
            lastX: null,
            lastY: null,
        };

        // show/hide on chapter icon clicks
        this._overlay.on(OVERLAY_ACTIVATED_EVENT, () => {
            this._navPanel.classList.remove('hidden')
        });
        this._overlay.on(OVERLAY_DEACTIVATED_EVENT, () => {
            this._navPanel.classList.add('hidden')
        });
    }

    _createNavPanel(backgroundImageId) {
        const navPanel = createElementWithClass('div', 'nav-panel', ['nav-panel', 'hidden']);
        const underlayImageElement = createElementWithClass('img', 'nav-panel', []);
        underlayImageElement.setAttribute('draggable', 'false');
        this._fetchAssetCollection(backgroundImageId)
        .then((assetCollection) => {
            if (assetCollection.assets.image_src) {
                return this._fetchMedia(assetCollection.assets.image_src);
            }
            return Promise.resolve();
        })
        .then((imageUrl) => {
            if (imageUrl) {
                underlayImageElement.src = imageUrl;
            }
        })
        .catch((err) => {
            logger.error(err, 'could not get image for nav panel');
        });
        navPanel.addEventListener('click', (e) => this._handleClick(e));
        navPanel.appendChild(underlayImageElement);

        this._canvas = document.createElement('canvas');
        const { offsetHeight, offsetWidth } = this._player.mediaTarget;
        this._canvas.setAttribute('width', offsetWidth);
        this._canvas.setAttribute('height', offsetHeight);
        navPanel.appendChild(this._canvas);
        this._navPanel = navPanel;
    }

    _handleClick(event) {
        const elementid = this._findElementClicked(event);
        if (elementid) {
            this.emit(REASONER_EVENTS.JUMP_TO_NARRATIVE_ELEMENT, elementid);
            this._overlay.disactivateOverlay();
        }
    }

    _findElementClicked(e) {
        const { offsetX, offsetY } = e;
        const { offsetWidth, offsetHeight } = e.target;
        const xPercent = 100 * offsetX / offsetWidth;
        const yPercent = 100 * offsetY / offsetHeight;
        const match = this._elements.filter(e =>
            e.meta && e.meta.storyplayer &&
            e.meta.storyplayer.navpanel &&
            e.meta.storyplayer.navpanel.clickArea
        ).find(el => {
            const { left, top, width, height } = el.meta.storyplayer.navpanel.clickArea;
            return (
                xPercent >= left &&
                xPercent <= left + width &&
                yPercent >= top &&
                yPercent <= top + height
            );
        });
        if (match) return match.id;
        return null; 
    }

    _plotLine(x1, y1, x2, y2) {
        const { offsetHeight, offsetWidth } = this._player.mediaTarget;
        const ctx = this._canvas.getContext('2d');
        ctx.fillStyle = "#FFf"; 
        ctx.lineWidth = "5"; 
        ctx.strokeStyle = "#FFf"; 

        // draw end only
        const xp2 = x2 * offsetWidth / 100;
        const yp2 = y2 * offsetHeight / 100;
        ctx.fillRect(xp2-5, yp2-5, 10, 10); 
        if (!x1) {
            return;
        }

        const yp1 = y1 * offsetHeight / 100;
        const xp1 = x1 * offsetWidth / 100;
        console.log('ANDY media size', offsetHeight, offsetWidth);
        ctx.moveTo(xp1, yp1);
        ctx.lineTo(xp2, yp2);
        ctx.stroke();        
    }

    handleNarrativeElementChange(neid) {
        const match = this._elements.find(e => e.id === neid);
        if (
            match &&
            match.meta &&
            match.meta.storyplayer &&
            match.meta.storyplayer.navpanel &&
            match.meta.storyplayer.navpanel.scrubPosition
        ) {
            const { x, y } = match.meta.storyplayer.navpanel.scrubPosition
            const { lastX, lastY } = this._currentPosition;
            console.log(`ANDY plot (${lastX}, ${lastY}) to (${x}, ${y})`);
            this._currentPosition = {
                lastY: y,
                lastX: x,
            };
            this._plotLine(lastX, lastY, x, y);
        }
    }

    getOverlay(): HTMLInputElement {
        return this._navPanel;
    }

}

export default NavPanel;
