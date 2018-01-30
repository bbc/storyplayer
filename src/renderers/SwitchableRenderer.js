// @flow
import Player, { PlayerEvents } from '../Player';
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher, AnalyticsLogger } from '../romper';
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
    _inCompleteBehaviours: boolean;
    _handleChoiceClicked: Function;

    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        fetchMedia: MediaFetcher,
        player: Player,
        analytics: AnalyticsLogger,
    ) {
        super(representation, assetCollectionFetcher, fetchMedia, player, analytics);
        this._choiceRenderers = this._getChoiceRenderers();
        this._currentRendererIndex = 0;
        this._previousRendererPlayheadTime = 0;
        this._nodeCompleted = false;
        this._inCompleteBehaviours = false;
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
                            this.complete();
                        }
                        this._nodeCompleted = true;
                    });
                    cr.on(RendererEvents.STARTED_COMPLETE_BEHAVIOURS, () => {
                        this._inCompleteBehaviours = true;
                        this._disableSwitchButtons();
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
                                    this._player.addRepresentationControl(`${idx}`, mediaUrl);
                                }).catch((err) => { logger.error(err, 'Notfound'); });
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
                    this.emit(
                        RendererEvents.SWITCHED_REPRESENTATION,
                        this._representation.choices[choiceIndex],
                    );
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
        this._player.on(PlayerEvents.REPRESENTATION_CLICKED, this._handleChoiceClicked);

        this._choiceRenderers.forEach((choice) => {
            if (choice) choice.cueUp();
        });

        // start subrenderer for first choice
        const firstChoice = this._choiceRenderers[this._currentRendererIndex];
        if (firstChoice) {
            firstChoice.willStart();
        }
    }

    _handleChoiceClicked(event: Object): void {
        if (!this._inCompleteBehaviours) {
            // this.switchToRepresentationAtIndex(parseInt(event.id, 10));
            this.switchToRepresentationAtIndex(event.id);
        }
        // TODO: else show buttons are disabled
    }

    _disableSwitchButtons() {
        if (this._representation.choices) {
            this._representation.choices.forEach((choice, idx) => {
                this._player.deactivateRepresentationControl(`${idx}`);
            });
        }
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

    destroy() {
        this._choiceRenderers.forEach((choice) => {
            if (choice) choice.destroy();
        });

        if (this._representation.choices) {
            this._representation.choices.forEach((choice, idx) => {
                this._player.removeRepresentationControl(`${idx}`);
            });
        }
        this._player.removeListener(
            PlayerEvents.REPRESENTATION_CLICKED,
            this._handleChoiceClicked,
        );
        super.destroy();
    }
}
