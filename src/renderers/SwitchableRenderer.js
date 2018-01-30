// @flow
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import RendererFactory from './RendererFactory';
import RendererEvents from './RendererEvents';
import logger from '../logger';

export default class SwitchableRenderer extends BaseRenderer {
    _choiceRenderers: Array<?BaseRenderer>;
    _choiceDiv: HTMLElement;
    _fetchMedia: MediaFetcher;
    _currentRendererIndex: number;
    _previousRendererPlayheadTime: number;
    _nodeCompleted: boolean;
    _buttonPanel: HTMLDivElement;

    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        target: HTMLElement,
    ) {
        super(representation, assetCollectionFetcher, fetchMedia, target);
        this._choiceRenderers = this._getChoiceRenderers();
        this._currentRendererIndex = 0;
        this._previousRendererPlayheadTime = 0;
        this._nodeCompleted = false;
    }

    // create a renderer for each choice
    _getChoiceRenderers() {
        let choices = [];
        if (this._representation.choices) {
            choices = this._representation.choices.map(choice =>
                RendererFactory(
                    choice.representation,
                    this._fetchAssetCollection,
                    this._fetchMedia,
                    this._target,
                ));
            choices.forEach((choiceRenderer) => {
                if (choiceRenderer) {
                    const cr = choiceRenderer;
                    cr.on(RendererEvents.COMPLETE_START_BEHAVIOURS, () => {
                        cr.start();
                    });
                }
            });
            choices.forEach((choiceRenderer) => {
                if (choiceRenderer) {
                    const cr = choiceRenderer;
                    cr.on(RendererEvents.COMPLETED, () => {
                        if (!this._nodeCompleted) {
                            this.complete();// .bind(this);
                        }
                        this._nodeCompleted = true;
                        // this.emit(RendererEvents.COMPLETED);
                    });
                }
            });
        }
        return choices;
    }

    // display the buttons as IMG elements in a list in a div
    _renderSwitchButtons() {
        this._buttonPanel = document.createElement('div');
        const buttonList = document.createElement('ul');
        this._buttonPanel.className = 'switchbuttons';
        let i = 0;
        if (this._representation.choices) {
            this._representation.choices.forEach((choice) => {
                const index = i;
                const switchListItem = document.createElement('li');
                const switchButton = document.createElement('img');
                switchButton.setAttribute('role', 'button');
                switchButton.setAttribute('alt', choice.label);
                switchButton.addEventListener('click', () => {
                    this.switchToRepresentationAtIndex(index);
                });
                // switchButton.innerHTML = choice.label;
                this._setIcon(switchButton, choice.representation);
                switchListItem.appendChild(switchButton);
                buttonList.appendChild(switchListItem);
                i += 1;
            });
            this._buttonPanel.appendChild(buttonList);
            this._target.appendChild(this._buttonPanel);
        }
    }

    /**
     * Switch to the renderer for a given choice.  Has no effect if
     * index out of range
     *
     * @param {number} choiceIndex index of choices array to show
     */
    switchToRepresentationAtIndex(choiceIndex: number) {
        if (choiceIndex >= 0 && choiceIndex < this._choiceRenderers.length) {
            const currentChoice = this._choiceRenderers[this._currentRendererIndex];
            if (currentChoice) {
                // TODO: implement this in SimpleAVVideoContextRenderer
                const currentTimeData = currentChoice.getCurrentTime();
                if (currentTimeData.timeBased) {
                    // store playhead time
                    this._previousRendererPlayheadTime = currentTimeData.currentTime;
                }
                currentChoice.switchFrom();
            }
            this._currentRendererIndex = choiceIndex;
            const newChoice = this._choiceRenderers[this._currentRendererIndex];
            if (newChoice) {
                newChoice.switchTo();
                if (this._representation.choices && this._representation.choices[choiceIndex]) {
                    this.emit(RendererEvents.SWITCHED_REPRESENTATION, this._representation.choices[choiceIndex]);
                }
            }
            if (newChoice) {
                // sync playhead time
                newChoice.setCurrentTime(this._previousRendererPlayheadTime);
            }
        }
    }

    /**
     * set selection renderer for a given choice.  Has no effect if
     * label not associated with any choice
     *
     * @param {string} choiceLabel label of choice to show
     *
     * returns selected index, but does not change the renderer
     */
    setChoiceToRepresentationWithLabel(choiceLabel: string) {
        if (this._representation.choices) {
            this._representation.choices.forEach((choice, index) => {
                if (choiceLabel === choice.label) {
                    this._currentRendererIndex = index;
                }
            });
        }
        return this._currentRendererIndex;
    }

    start() {
        this._renderSwitchButtons();

        this._choiceRenderers.forEach((choice) => {
            if (choice) choice.cueUp();
        });

        // start subrenderer for first choice
        const firstChoice = this._choiceRenderers[this._currentRendererIndex];
        if (firstChoice) {
            firstChoice.willStart();
        }
        // this._renderDataModelInfo();
    }

    // return the currently chosen representation, unless we can't
    // in which case return main Switchable Representation
    getRepresentation() {
        if (this._representation.choices && this._representation
            .choices.length >= this._currentRendererIndex) {
            return this._representation
                .choices[this._currentRendererIndex].representation;
        }
        return this._representation;
    }

    // fetch the icon asset for the given representation and set
    // the source of the IMG element
    _setIcon(element: HTMLImageElement, choiceRepresentation: Representation) {
        if (choiceRepresentation.asset_collection.icon) {
            this._fetchAssetCollection(choiceRepresentation.asset_collection.icon.default)
                .then((icon) => {
                    if (icon.assets.image_src) {
                        this._fetchMedia(icon.assets.image_src).then((mediaUrl) => {
                            element.setAttribute('src', mediaUrl);
                        }).catch((err) => { logger.error(err, 'Notfound'); });
                    }
                });
        }
    }

    // display some text that shows what we're supposed to be rendering, according
    // to the data model
    _renderDataModelInfo() {
        // next just displays info for debug
        const para = document.createElement('p');
        para.textContent = this._representation.name;
        const optPara = document.createElement('p');
        optPara.textContent = 'Options';
        this._target.appendChild(para);
        this._target.appendChild(optPara);

        const switchlist = document.createElement('ul');
        this._target.appendChild(switchlist);
        const iconData = document.createElement('p');
        iconData.textContent = 'icon: ';
        this._target.appendChild(iconData);

        if (this._representation.choices) {
            this._representation.choices.forEach((choice) => {
                const choiceLabel = choice.label;
                let choiceRepresentationDetail = '';
                if (choice.representation) {
                    choiceRepresentationDetail = choice.representation.name;
                }
                const switchitem = document.createElement('li');
                switchitem.textContent = `${choiceLabel}: ${choiceRepresentationDetail}`;
                switchlist.appendChild(switchitem);
            });
        }

        if (this._representation.asset_collection.icon) {
            this._fetchAssetCollection(this._representation.asset_collection.icon.default)
                .then((icon) => {
                    iconData.textContent += `${icon.name}`;
                    if (icon.assets.image_src) {
                        iconData.textContent += ` from ${icon.assets.image_src}`;
                    }
                });
        } else {
            iconData.textContent += 'none';
        }
    }

    destroy() {
        this._choiceRenderers.forEach((choice) => {
            if (choice) choice.destroy();
        });
        if (this._buttonPanel) {
            this._target.removeChild(this._buttonPanel);
        }
        super.destroy();
    }
}
