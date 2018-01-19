// @flow
import { PlayerEvents } from '../Player';
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import RendererFactory from './RendererFactory';
import RendererEvents from './RendererEvents';

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
        player: Player,
    ) {
        super(representation, assetCollectionFetcher, fetchMedia, player);
        this._handleChoiceClicked = this._handleChoiceClicked.bind(this);

        this._choiceDiv = document.createElement('div');
        this._choiceDiv.id = 'subrenderer';
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
                    this._player,
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
                            // console.log('first switchable finished event');
                            this.complete();// .bind(this);
                        } // else {
                        //     console.log('another of the switchables has finished');
                        // }
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
        if (this._representation.choices) {
            this._representation.choices.forEach((choice, idx) => {
                if (choice.representation.asset_collection.icon) {
                    this._fetchAssetCollection(choice.representation.asset_collection.icon.default)
                        .then((icon) => {
                            if (icon.assets.image_src) {
                                this._fetchMedia(icon.assets.image_src).then((mediaUrl) => {
                                    // console.log('FETCHED ICON FROM MS MEDIA!', mediaUrl);
                                    // this._player.addRepresentationControl(`${idx}`, mediaUrl);
                                    this._player.addRepresentationControl(idx, mediaUrl);
                                }).catch((err) => { console.error(err, 'Notfound'); });
                            }
                        });
                }
            });
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
        // this._target.appendChild(this._choiceDiv);
        this._renderSwitchButtons();
        this._player.on(PlayerEvents.REPRESENTATION_CLICKED, this._handleChoiceClicked);

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

    _handleChoiceClicked(event: Object): void {
        // this.switchToRepresentationAtIndex(parseInt(event.id, 10));
        this.switchToRepresentationAtIndex(event.id);
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
                            // console.log('FETCHED ICON FROM MS MEDIA!', mediaUrl);
                            element.setAttribute('src', mediaUrl);
                        }).catch((err) => { console.error(err, 'Notfound'); });
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
        // while (this._target.lastChild) {
        //     this._target.removeChild(this._target.lastChild);
        // }
        this._player.removeListener(
            PlayerEvents.REPRESENTATION_CLICKED,
            this._handleChoiceClicked,
        );
        super.destroy();
    }
}
