// @flow
/* eslint-disable class-methods-use-this */
import EventEmitter from 'events';
import BehaviourRunner from '../behaviours/BehaviourRunner';
import RendererEvents from './RendererEvents';
import BehaviourTimings from '../behaviours/BehaviourTimings';
import type { Representation, AssetCollectionFetcher, MediaFetcher, StoryFetcher } from '../romper';
import Player from '../Player';
import AnalyticEvents from '../AnalyticEvents';
import type { AnalyticsLogger, AnalyticEventName } from '../AnalyticEvents';
import Controller from '../Controller';
import logger from '../logger';

export default class BaseRenderer extends EventEmitter {
    _representation: Representation;
    _fetchAssetCollection: AssetCollectionFetcher;
    _fetchMedia: MediaFetcher;
    _fetchStory: StoryFetcher;
    _player: Player;
    _behaviourRunner: ?BehaviourRunner;
    _behaviourRendererMap: { [key: string]: (behaviour: Object, callback: () => mixed) => void };
    _applyColourOverlayBehaviour: Function;
    _applyShowImageBehaviour: Function;
    _applyShowVariablePanelBehaviour: Function;
    _behaviourElements: Array<HTMLElement>;
    _target: HTMLDivElement;
    _destroyed: boolean;
    _analytics: AnalyticsLogger;
    _controller: Controller;
    _getListVariableSetter: Function;
    _getBooleanVariableSetter: Function;
    _getIntegerVariableSetter: Function;

    /**
     * Load an particular representation. This should not actually render anything until start()
     * is called, as this could be constructed in advance as part of pre-loading.
     *
     * @param {Representation} representation the representation node to be rendered
     * @param {AssetCollectionFetcher} assetCollectionFetcher a fetcher for asset collections
     * @param {MediaFetcher} MediaFetcher a fetcher for media
     * @param {Player} player the Player used to manage DOM changes
     *
     */
    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        mediaFetcher: MediaFetcher,
        player: Player,
        analytics: AnalyticsLogger,
        controller: Controller,
    ) {
        super();
        this._representation = representation;
        this._fetchAssetCollection = assetCollectionFetcher;
        this._fetchMedia = mediaFetcher;
        this._player = player;
        this._target = player.mediaTarget;
        this._controller = controller;

        this._applyColourOverlayBehaviour = this._applyColourOverlayBehaviour.bind(this);
        this._applyShowImageBehaviour = this._applyShowImageBehaviour.bind(this);
        this._applyShowVariablePanelBehaviour = this._applyShowVariablePanelBehaviour.bind(this);

        this._getListVariableSetter = this._getListVariableSetter.bind(this);
        this._getBooleanVariableSetter = this._getBooleanVariableSetter.bind(this);
        this._getIntegerVariableSetter = this._getIntegerVariableSetter.bind(this);

        this._behaviourRunner = this._representation.behaviours
            ? new BehaviourRunner(this._representation.behaviours, this)
            : null;
        this._behaviourRendererMap = {
            // eslint-disable-next-line max-len
            'urn:x-object-based-media:representation-behaviour:colouroverlay/v1.0': this._applyColourOverlayBehaviour,
            // eslint-disable-next-line max-len
            'urn:x-object-based-media:representation-behaviour:showimage/v1.0': this._applyShowImageBehaviour,
            // eslint-disable-next-line max-len
            'urn:x-object-based-media:representation-behaviour:showvariablepanel/v1.0': this._applyShowVariablePanelBehaviour,
        };
        this._behaviourElements = [];

        this._destroyed = false;
        this._analytics = analytics;
    }
    /**
     * An event which fires when this renderer has completed it's part of the experience
     * (e.g., video finished, or the user has clicked 'skip', etc)
     *
     * @event BaseRenderer#complete
     */

    /**
     * When start() is called you are expected to take control of the DOM node in question.
     *
     * @fires BaseRenderer#complete
     * @return {void}
     */

    willStart() {
        this._player.enterStartBehaviourPhase();
        if (!this._behaviourRunner ||
            !this._behaviourRunner.runBehaviours(
                BehaviourTimings.started,
                RendererEvents.COMPLETE_START_BEHAVIOURS,
            )
        ) {
            this.emit(RendererEvents.COMPLETE_START_BEHAVIOURS);
        }
    }

    start() {
        this.emit(RendererEvents.STARTED);
        this._player.exitStartBehaviourPhase();
        this._clearBehaviourElements();
    }

    /* record some analytics for the renderer - not user actions though */
    logRendererAction(userEventName: AnalyticEventName) {
        const logData = {
            type: AnalyticEvents.types.RENDERER_ACTION,
            name: AnalyticEvents.names[userEventName],
            from: 'not_set',
            to: 'not_set',
        };
        this._analytics(logData);
    }

    /* record some analytics for a user action */
    logUserInteraction(
        userEventName: AnalyticEventName,
        fromId: string = 'not_set',
        toId: string = 'not_set',
    ) {
        const logData = {
            type: AnalyticEvents.types.USER_ACTION,
            name: AnalyticEvents.names[userEventName],
            from: fromId === null ? 'not_set' : fromId,
            to: toId === null ? 'not_set' : toId,
        };
        this._analytics(logData);
    }

    /**
     * get the representation that this renderer is currently rendering
     * @returns {Representation}
     */
    getRepresentation(): Representation {
        return this._representation;
    }

    getCurrentTime(): Object {
        logger.warn('getting time data from on BaseRenderer');
        const timeObject = {
            timeBased: false,
            currentTime: 0,
        };
        return timeObject;
    }

    setCurrentTime(time: number) {
        logger.warn(`ignoring setting time on BaseRenderer ${time}`);
    }

    complete() {
        this._player.enterCompleteBehavourPhase();
        this.emit(RendererEvents.STARTED_COMPLETE_BEHAVIOURS);
        if (!this._behaviourRunner ||
            !this._behaviourRunner.runBehaviours(
                BehaviourTimings.completed,
                RendererEvents.COMPLETED,
            )
        ) {
            // we didn't find any behaviours to run, so emit completion event
            this.emit(RendererEvents.COMPLETED);
        }
    }

    switchFrom() {
        this.destroy();
    }

    // prepare rendere so it can be switched to quickly and in sync
    cueUp() { }

    switchTo() {
        this.start();
    }

    getBehaviourRenderer(behaviourUrn: string): (behaviour: Object, callback: () => mixed) => void {
        return this._behaviourRendererMap[behaviourUrn];
    }

    _applyColourOverlayBehaviour(behaviour: Object, callback: () => mixed) {
        const { colour } = behaviour;
        const overlayImageElement = document.createElement('div');
        overlayImageElement.style.background = colour;
        overlayImageElement.className = 'romper-image-overlay';
        this._target.appendChild(overlayImageElement);
        this._behaviourElements.push(overlayImageElement);
        callback();
    }

    _applyShowImageBehaviour(behaviour: Object, callback: () => mixed) {
        const behaviourAssetCollectionMappingId = behaviour.image;
        const assetCollectionId =
            this.resolveBehaviourAssetCollectionMappingId(behaviourAssetCollectionMappingId);
        if (assetCollectionId) {
            this._fetchAssetCollection(assetCollectionId).then((image) => {
                if (image.assets.image_src) {
                    this._overlayImage(image.assets.image_src);
                    callback();
                }
            });
        }
    }

    _overlayImage(imageSrc: string) {
        const overlayImageElement = document.createElement('img');
        overlayImageElement.src = imageSrc;
        overlayImageElement.className = 'romper-image-overlay';
        this._target.appendChild(overlayImageElement);
        this._behaviourElements.push(overlayImageElement);
    }

    // an input for selecting the value for a boolean variable
    _getBooleanVariableSetter(varName: string, variableDecl: Object) {
        const varInput = document.createElement('div');

        // yes button & label
        const radioYesDiv = document.createElement('div');
        radioYesDiv.className = 'romper-var-form-radio-div';
        const radioYes = document.createElement('input');
        radioYes.onclick = (() => this._controller.setVariableValue(varName, true));
        radioYes.type = 'radio';
        radioYes.name = 'bool-option';
        radioYes.checked = variableDecl.default_value;
        const yesLabel = document.createElement('div');
        yesLabel.innerHTML = 'Yes';
        radioYesDiv.appendChild(radioYes);
        radioYesDiv.appendChild(yesLabel);

        // no button & label
        const radioNoDiv = document.createElement('div');
        radioNoDiv.className = 'romper-var-form-radio-div';
        const radioNo = document.createElement('input');
        radioNo.onclick = (() => this._controller.setVariableValue(varName, false));
        radioNo.type = 'radio';
        radioNo.name = 'bool-option';
        radioNo.checked = !variableDecl.default_value;
        const noLabel = document.createElement('div');
        noLabel.innerHTML = 'No';
        radioNoDiv.appendChild(radioNo);
        radioNoDiv.appendChild(noLabel);

        varInput.appendChild(radioYesDiv);
        varInput.appendChild(radioNoDiv);

        return varInput;
    }

    // an input for selecting the value for a list variable
    _getListVariableSetter(varName: string, variableDecl: Object) {
        const options = variableDecl.values;
        const varInput = document.createElement('select');
        options.forEach((optionValue) => {
            const optionElement = document.createElement('option');
            optionElement.setAttribute('value', optionValue);
            optionElement.textContent = optionValue;
            varInput.appendChild(optionElement);
        });

        if (variableDecl.default_value) {
            varInput.value = variableDecl.default_value;
        }
        varInput.onchange = () => this._controller.setVariableValue(varName, varInput.value);

        return varInput;
    }

    // an input for changing the value for an integer number variables
    _getIntegerVariableSetter(varName: string, variableDecl: Object) {
        const varInput = document.createElement('input');
        varInput.type = 'number';

        if (variableDecl.default_value) { varInput.value = variableDecl.default_value; }
        varInput.onchange = () => this._controller.setVariableValue(varName, varInput.value);

        return varInput;
    }


    _applyShowVariablePanelBehaviour(behaviour: Object, callback: () => mixed) {
        this._player.setNextAvailable(false);

        const behaviourVariables = behaviour.variables;
        const formTitle = behaviour.panel_label;
        const overlayImageElement = document.createElement('div');
        overlayImageElement.className = 'romper-variable-panel';

        const titleDiv = document.createElement('div');
        titleDiv.innerHTML = formTitle;
        titleDiv.className = 'romper-var-form-title';
        overlayImageElement.appendChild(titleDiv);


        this._controller.getVariables()
            .then((storyVariables) => {
                const variablesFormContainer = document.createElement('div');
                variablesFormContainer.className = 'romper-var-form-var-containers';
                behaviourVariables.forEach((behaviourVar) => {
                    const storyVariable = storyVariables[behaviourVar.variable_name];

                    // div for each variable Element
                    const variableDiv = document.createElement('div');
                    variableDiv.className = 'romper-variable-form-item';

                    const labelDiv = document.createElement('div');
                    labelDiv.innerHTML = behaviourVar.label;
                    labelDiv.className = 'romper-var-form-label-div';
                    variableDiv.appendChild(labelDiv);

                    if (storyVariable.variable_type === 'boolean') {
                        const boolDiv = this._getBooleanVariableSetter(
                            behaviourVar.variable_name,
                            storyVariable,
                        );
                        variableDiv.append(boolDiv);
                    } else if (storyVariable.variable_type === 'list') {
                        const listDiv = this._getListVariableSetter(
                            behaviourVar.variable_name,
                            storyVariable,
                        );
                        listDiv.className = 'romper-var-form-list-input';
                        variableDiv.append(listDiv);
                    } else if (storyVariable.variable_type === 'number') {
                        const numDiv = this._getIntegerVariableSetter(
                            behaviourVar.variable_name,
                            storyVariable,
                        );
                        numDiv.className = 'romper-var-form-number-input';
                        variableDiv.append(numDiv);
                    }

                    variablesFormContainer.appendChild(variableDiv);
                });

                overlayImageElement.appendChild(variablesFormContainer);

                const okButtonContainer = document.createElement('div');
                okButtonContainer.className = 'romper-var-form-button-container';
                const okButton = document.createElement('input');
                okButton.type = 'button';
                okButton.value = 'Ok!';
                okButton.onclick = (() => {
                    this._player.setNextAvailable(true);
                    return callback();
                });
                // s.onsubmit = this._submitButton;
                okButton.className = 'romper-var-form-button';
                okButtonContainer.appendChild(okButton);
                overlayImageElement.appendChild(okButtonContainer);

                this._target.appendChild(overlayImageElement);
                this._behaviourElements.push(overlayImageElement);
            });

        // callback();
    }

    _clearBehaviourElements() {
        this._behaviourElements.forEach((be) => {
            try {
                this._target.removeChild(be);
            } catch (e) {
                logger.warn(`could not remove behaviour element ${be.id} from Renderer`);
            }
        });
    }

    // Takes a UUID used in a behaviour and resolves it to an asset collection
    resolveBehaviourAssetCollectionMappingId(behaviourAssetCollectionMappingId: string) {
        if (this._representation.asset_collections.behaviours) {
            let returnId = null;
            this._representation.asset_collections.behaviours
                .some((assetCollectionsBehaviour) => {
                    if (assetCollectionsBehaviour.behaviour_asset_collection_mapping_id
                            === behaviourAssetCollectionMappingId) {
                        returnId = assetCollectionsBehaviour.asset_collection_id;
                        return true;
                    }
                    return false;
                });
            return returnId;
        }
        return null;
    }

    /**
     * Destroy is called as this representation is unloaded from being visible.
     * You should leave the DOM as you left it.
     *
     * @return {void}
     */
    destroy() {
        this._clearBehaviourElements();
        if (this._behaviourRunner) {
            this._behaviourRunner.destroyBehaviours();
        }
        // we didn't find any behaviours to run, so emit completion event
        this.emit(RendererEvents.DESTROYED);
        this._destroyed = true;
    }
}
