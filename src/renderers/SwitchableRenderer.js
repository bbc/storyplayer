// @flow
import Player, { PlayerEvents } from '../Player';
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
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
    _switchableIsQueuedNotPlaying: boolean;

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
        this._switchableIsQueuedNotPlaying = true;
        this._currentRendererIndex = 0;
        console.log('[SW] ', this._rendererId, ' CREATE');
        this._updateChoiceRenderers();
        this._previousRendererPlayheadTime = 0;
        this._nodeCompleted = false;
        this._inCompleteBehaviours = false;
        this._controller = controller;
    }

    _updateChoiceRenderers() {
        console.log('[SW]', this._rendererId, ' UPDATE CHOICE ================');
        console.log('[SW]', this._rendererId, ' INDEX ', this._currentRendererIndex);
        if (this._choiceRenderers) {
            console.log('[SW]', this._rendererId, 'CHOICES', this._choiceRenderers.map((choice) => {
                if (choice) return choice._rendererId;
                return null;
            }));
        }
        let choiceRenderers = [];
        // // eslint-disable-next-line
        // debugger;
        if (this._switchableIsQueuedNotPlaying) {
            console.log('[SW]', this._rendererId, ' QUEUED');
            // Switchable is queued so only create renderer for choice at
            // index _currentRendererIndex (assuming it's not already created)
            if (this._choiceRenderers && this._choiceRenderers.length !== 0) {
                // Renderers have been created by this switchable before so check if we already
                // have a renderer for choice at index _currentRendererIndex
                if (this._choiceRenderers[this._currentRendererIndex] === null) {
                    // Have a renderer for a choice that isn't choice at index _currentRendererIndex
                    // so destroy it and create another renderer
                    choiceRenderers = this._getQueuedChoiceRenderer();
                } else {
                    // eslint-disable-next-line
                    debugger;
                    choiceRenderers = this._choiceRenderers.map((choice, index) => {
                        if (index === this._currentRendererIndex) {
                            return choice;
                        }
                        return null;
                    });
                }
                // Clean up any renderers that are not needed
                this._choiceRenderers
                    .filter((choice, index) => index !== this._currentRendererIndex)
                    .forEach((choice) => {
                        if (choice) {
                            choice.destroy();
                        }
                    });
            } else {
                // No renderers yet created by this switchable so create the one we need.
                choiceRenderers = this._getQueuedChoiceRenderer();
            }
        } else {
            console.log('[SW]', this._rendererId, ' ACTIVE');
            // Switchable is playing so create all renderers for choices
            choiceRenderers = this._choiceRenderers;
            // eslint-disable-next-line max-len
            const missingRenderers = choiceRenderers.some(choiceRenderer => choiceRenderer === null);
            if (choiceRenderers.length === 0 || missingRenderers) {
                const newChoiceRenderers = this._getRemainingChoiceRenderers();
                newChoiceRenderers.forEach((newChoiceRenderer, index) => {
                    if (newChoiceRenderer !== null && choiceRenderers[index] === null) {
                        choiceRenderers[index] = newChoiceRenderer;
                    }
                });
            }
        }
        this._choiceRenderers = choiceRenderers;
        if (this._choiceRenderers) {
            console.log('[SW]', this._rendererId, 'CHOICES', this._choiceRenderers.map((choice) => {
                if (choice) return choice._rendererId;
                return null;
            }));
        }
        console.log('[SW]', this._rendererId, ' END UPDATE CHOICE ================');
    }

    // create a renderer for each choice that isn't the _currentRendererIndex choice
    _getRemainingChoiceRenderers() {
        let choices: Array<any> = [];
        if (this._representation.choices) {
            choices = this._representation.choices.map((choice, index) => {
                if (choice.choice_representation && index !== this._currentRendererIndex) {
                    return RendererFactory(
                        choice.choice_representation,
                        this._fetchAssetCollection,
                        this._fetchMedia,
                        this._player,
                        this._analytics,
                        this._controller,
                    );
                }
                return null;
            });
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

    // create a renderer for the _currentRendererIndex choice
    _getQueuedChoiceRenderer() {
        let choices: Array<any> = [];
        if (this._representation.choices) {
            choices = this._representation.choices.map((choice, index) => {
                if (choice.choice_representation && index === this._currentRendererIndex) {
                    return RendererFactory(
                        choice.choice_representation,
                        this._fetchAssetCollection,
                        this._fetchMedia,
                        this._player,
                        this._analytics,
                        this._controller,
                    );
                }
                return null;
            });
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
        console.log('[SR]', this._rendererId, 'RENDER SWITCH BUTTONS');
        if (this._representation.choices) {
            this._representation.choices.forEach((choice, idx) => {
                if (choice.choice_representation &&
                    choice.choice_representation.asset_collections
                ) {
                    const choiceName = choice.choice_representation.name;
                    const setRepresentationControl = (mediaUrl) => {
                        this._player.addRepresentationControl(
                            `${idx}`,
                            mediaUrl,
                            choiceName,
                        );
                        const currentSelection = this._currentRendererIndex.toString();
                        this._player.setActiveRepresentationControl(currentSelection);
                    };

                    if (
                        choice.choice_representation.asset_collections.icon &&
                        choice.choice_representation.asset_collections.icon.default_id
                    ) {
                        // eslint-disable-next-line max-len
                        this._fetchAssetCollection(choice.choice_representation.asset_collections.icon.default_id)
                            .then((icon) => {
                                if (icon.assets.image_src) {
                                    this._fetchMedia(icon.assets.image_src)
                                        .then(setRepresentationControl)
                                        .catch((err) => { logger.error(err, 'Notfound'); });
                                }
                            });
                    } else {
                        setRepresentationControl('');
                    }
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
                const currentTimeData = currentChoice.getCurrentTime();
                if (currentTimeData.timeBased) {
                    // store playhead time
                    this._previousRendererPlayheadTime = currentTimeData.currentTime;
                }
                currentChoice.switchFrom();
            }
            if (this._currentRendererIndex !== choiceIndex) {
                this._currentRendererIndex = choiceIndex;
                console.log('[SW]', this._rendererId, ' CI: ', this._currentRendererIndex);
                console.log('[SW]', this._rendererId, 'TYPE ', typeof this._currentRendererIndex);
                console.trace();
                this._updateChoiceRenderers();
            }
            const newChoice = this._choiceRenderers[this._currentRendererIndex];
            if (newChoice) {
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
                    if (this._currentRendererIndex !== index) {
                        this._currentRendererIndex = index;
                        console.log('[SW]', this._rendererId, ' CI: ', this._currentRendererIndex);
                        this._updateChoiceRenderers();
                    }
                }
            });
        }
        return this._currentRendererIndex;
    }

    start() {
        this._switchableIsQueuedNotPlaying = false;
        this._updateChoiceRenderers();
        this._previousRendererPlayheadTime = 0;
        this._renderSwitchButtons();
        this._player.on(PlayerEvents.REPRESENTATION_CLICKED, this._handleChoiceClicked);

        // This code path calls an empty function in each renderer
        // this._choiceRenderers.forEach((choice) => {
        //     if (choice) choice.cueUp();
        // });

        // start subrenderer for first choice
        const firstChoice = this._choiceRenderers[this._currentRendererIndex];
        if (firstChoice) {
            firstChoice.willStart();
        }
    }

    end() {
        if (this._switchableIsQueuedNotPlaying === false) {
            console.log('[SR]', this._rendererId, 'RENDER SWITCH BUTTONS DELETED');
            this._switchableIsQueuedNotPlaying = true;
            this._updateChoiceRenderers();
            console.log('[SR]', this._choiceRenderers);
            const activeChoice = this._choiceRenderers[this._currentRendererIndex];
            if (activeChoice) activeChoice.end();
            if (this._representation.choices) {
                this._representation.choices.forEach((choice, idx) => {
                    this._player.removeRepresentationControl(`${idx}`);
                });
            }
        }
        this._player.removeListener(
            PlayerEvents.REPRESENTATION_CLICKED,
            this._handleChoiceClicked,
        );
        this._inCompleteBehaviours = false;
        this._nodeCompleted = false;
    }

    _handleChoiceClicked(event: Object): void {
        console.log('HANDLE CHOICE CLICKED!');
        const index = parseInt(event.id, 10);
        if (!this._inCompleteBehaviours && !Number.isNaN(index)) {
            this.switchToRepresentationAtIndex(index);
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
            const choice = this._representation
                .choices[this._currentRendererIndex];
            if (choice.choice_representation) {
                return choice.choice_representation;
            }
        }
        return this._representation;
    }

    destroy() {
        console.log('[SW] ', this._rendererId, ' DESTROY CALLED');
        super.destroy();

        this._choiceRenderers.forEach((choice) => {
            if (choice) choice.destroy();
        });
        this._choiceRenderers = [];
    }
}
