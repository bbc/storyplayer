// @flow
import Player, { PlayerEvents } from '../gui/Player';
import BaseRenderer, { RENDERER_PHASES } from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../storyplayer';
import RendererFactory from './RendererFactory';
import RendererEvents from './RendererEvents';
import logger from '../logger';
import AnalyticEvents from '../AnalyticEvents';
import type { AnalyticsLogger } from '../AnalyticEvents';
import Controller from '../Controller';

export default class SwitchableRenderer extends BaseRenderer {
    _choiceRenderers: Array<?BaseRenderer>;

    _fetchMedia: MediaFetcher;

    _currentRendererIndex: number;

    _previousRendererPlayheadTime: number;

    _nodeCompleted: boolean;

    _inCompleteBehaviours: boolean;

    _handleChoiceClicked: Function;

    _preloadedSwitchIcons: Array<Image>;

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
        this._handleChoiceClicked = this._handleChoiceClicked.bind(this);
        this._currentRendererIndex = 0;
        this._choiceRenderers = [];
        this._previousRendererPlayheadTime = 0;
        this._nodeCompleted = false;
        this._inCompleteBehaviours = false;
        this._controller = controller;

        this._preloadSwitchIcons();
        this._preloadedSwitchIcons = [];
    }

    async init() {
        this._choiceRenderers = this._constructChoiceRenderers();
        await this._preloadBehaviourAssets();
        await this._initChosenRenderer();
        this._setPhase(RENDERER_PHASES.CONSTRUCTED);
    }

    // create each renderer, but only init the chosen one
    // the rest remain just constructed to save bandwidth
    _constructChoiceRenderers() {
        let choices: Array<any> = [];
        if (this._representation.choices) {
            choices = this._representation.choices.map((choice) => {
                if (choice.choice_representation) {
                    return RendererFactory(
                        choice.choice_representation,
                        this._fetchAssetCollection,
                        this._fetchMedia,
                        this._player,
                        this._analytics,
                        this._controller,
                    );
                }
                throw new Error('No representation for choice');
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

    async _initChosenRenderer() {
        // only init first renderer
        if (this._choiceRenderers.length > this._currentRendererIndex) {
            const firstChoice = this._choiceRenderers[this._currentRendererIndex];
            if (firstChoice) await firstChoice.init();
        }
    }

    // initate all renderers bar the chosen one
    _initRemainingRenderers() {
        this._choiceRenderers.forEach((choiceRenderer, index) => {
            if (choiceRenderer && index !== this._currentRendererIndex) {
                console.log(`ANDY init renderer ${index}`, choiceRenderer);
                choiceRenderer.init();
            }
        });
    }

    // loads the switch icons buttons as IMG elements in a list
    _preloadSwitchIcons() {
        this._preloadedSwitchIcons = [];
        if (this._representation.choices) {
            this._representation.choices.forEach((choice) => {
                if (choice.choice_representation &&
                    choice.choice_representation.asset_collections &&
                    choice.choice_representation.asset_collections.icon &&
                    choice.choice_representation.asset_collections.icon.default_id
                ) {
                    // eslint-disable-next-line max-len
                    this._fetchAssetCollection(choice.choice_representation.asset_collections.icon.default_id)
                        .then((icon) => {
                            if (icon.assets.image_src) {
                                return this._fetchMedia(icon.assets.image_src, { includeCredentials: true });
                            }
                            return Promise.resolve();
                        })
                        .then((iconUrl) => {
                            if (iconUrl) {
                                const image = new Image();
                                image.src = iconUrl;
                                this._preloadedSwitchIcons.push(image);
                            }
                        });
                }
            });
        }
    }

    // display the buttons as IMG elements in a list in a div
    async _renderSwitchButtons() {
        if (!this._representation.choices) return;

        const urlPromises = this._representation.choices
            .filter(choice => (choice.choice_representation &&
                choice.choice_representation.asset_collections
            ))            
            .map(async (choice, idx) => {
                const choiceName = choice.choice_representation.name;
                let iconUrl = '';
                if (
                    choice.choice_representation.asset_collections.icon &&
                    choice.choice_representation.asset_collections.icon.default_id
                ) {
                    const iconAc = await this._fetchAssetCollection(
                        choice.choice_representation.asset_collections.icon.default_id)
                    if (iconAc.assets.image_src) iconUrl = await this._fetchMedia(
                        iconAc.assets.image_src,
                        { includeCredentials: true },
                    );
                }
                return {
                    idx,
                    choiceName,
                    iconUrl,
                };
            });
        const repIconObjects = await Promise.all(urlPromises);
        repIconObjects.forEach(repObj => {
            const { idx, choiceName, iconUrl } = repObj;
            this._player.addRepresentationControl(
                `${idx}`,
                iconUrl,
                choiceName,
            );
        });
        const currentSelection = this._currentRendererIndex.toString();
        this._player._enableRepresentationControl();  
        this._player.setActiveRepresentationControl(currentSelection);
    }

    setCurrentTime(time: number) {
        const currentChoice = this._choiceRenderers[this._currentRendererIndex];
        if (currentChoice) {
            currentChoice.setCurrentTime(time);
        } else {
            logger.error('Setting time on switchable but no current choice');
        }
    }

    getCurrentTime(): Object {
        const currentChoice = this._choiceRenderers[this._currentRendererIndex];
        if (currentChoice) {
            return currentChoice.getCurrentTime();
        }
        logger.error('Getting time on switchable but no current choice');
        return super.getCurrentTime();
    }

    /**
     * Switch to the renderer for a given choice.  Has no effect if
     * index out of range
     *
     * @param {number} choiceIndex index of choices array to show
     */
    switchToRepresentationAtIndex(choiceIndex: number) {
        if (this._currentRendererIndex === choiceIndex) {
            return;
        }
        if (this.phase === RENDERER_PHASES.CONSTRUCTED
            || this.phase === RENDERER_PHASES.CONSTRUCTING) {
            // init new start
            if (choiceIndex >= 0 && choiceIndex < this._choiceRenderers.length) {
                this._currentRendererIndex = choiceIndex;
                this._initChosenRenderer();
            }
            return;
        }
        if (choiceIndex >= 0 && choiceIndex < this._choiceRenderers.length) {
            const currentChoice = this._choiceRenderers[this._currentRendererIndex];
            // handle old choice
            if (currentChoice) {
                const currentTimeData = currentChoice.getCurrentTime();
                if (currentTimeData.timeBased) {
                    // store playhead time
                    this._previousRendererPlayheadTime = currentTimeData.currentTime;
                }
                currentChoice.switchFrom();
            }
            // set new choice
            this._currentRendererIndex = choiceIndex;
            const newChoice = this._choiceRenderers[this._currentRendererIndex];
            if (newChoice) {
                this._player.setCurrentRenderer(this);
                this._logSwitch();
                newChoice.switchTo();
                if (this._representation.choices && this._representation.choices[choiceIndex]) {
                    this.emit(
                        RendererEvents.SWITCHED_REPRESENTATION,
                        this._representation.choices[choiceIndex],
                    );
                }
                // sync playhead time
                newChoice.setCurrentTime(this._previousRendererPlayheadTime);
            }
        }
    }

    _logSwitch() {
        let targetName = 'unknown';
        if (this._choiceRenderers[this._currentRendererIndex]) {
            targetName = this._choiceRenderers[this._currentRendererIndex]._representation.name;
        }
        const logPayload = {
            type: AnalyticEvents.types.RENDERER_ACTION,
            name: AnalyticEvents.names.SWITCHABLE_REPRESENTATION_SWITCH,
            from: this._representation.name,
            to: targetName,
        };
        this._analytics(logPayload);
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
                    this.switchToRepresentationAtIndex(index);
                }
            });
        }
        return this._currentRendererIndex;
    }

    start() {
        super.start();
        this._setPhase(RENDERER_PHASES.MAIN);
        this._initRemainingRenderers();
        this._previousRendererPlayheadTime = 0;
        this._renderSwitchButtons();
        this._player.on(PlayerEvents.REPRESENTATION_CLICKED, this._handleChoiceClicked);

        // start subrenderer for first choice
        const firstChoice = this._choiceRenderers[this._currentRendererIndex];
        if (firstChoice) {
            firstChoice.start();
        }
    }

    end() {
        const needToEnd = super.end();
        if (!needToEnd) return false;

        // end all
        this._choiceRenderers.forEach((cr) => {
            if (cr) cr.end();
        });

        // remove ui
        if (this._representation.choices) {
            this._representation.choices.forEach((choice, idx) => {
                this._player.removeRepresentationControl(`${idx}`);
            });
        }

        // remove listener
        this._player.removeListener(
            PlayerEvents.REPRESENTATION_CLICKED,
            this._handleChoiceClicked,
        );
        this._inCompleteBehaviours = false;
        this._nodeCompleted = false;
        return true;
    }

    _handleChoiceClicked(event: Object): void {
        const index = parseInt(event.id, 10);
        if (!this._inCompleteBehaviours && !Number.isNaN(index)) {
            this.switchToRepresentationAtIndex(index);
        }
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
            const choice = this._representation
                .choices[this._currentRendererIndex];
            if (choice.choice_representation) {
                return choice.choice_representation;
            }
        }
        return this._representation;
    }

    destroy() {
        const needToDestroy = super.destroy();
        if(!needToDestroy) return false;
        this._choiceRenderers.forEach((choice) => {
            if (choice) choice.destroy();
        });
        this._choiceRenderers = [];
        return true;
    }
}
