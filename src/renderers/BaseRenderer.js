// @flow
/* eslint-disable class-methods-use-this */
import EventEmitter from 'events';
import BehaviourRunner from '../behaviours/BehaviourRunner';
import RendererEvents from './RendererEvents';
import BehaviourTimings from '../behaviours/BehaviourTimings';
import type { Representation, AssetCollectionFetcher, MediaFetcher } from '../romper';
import Player from '../Player';
import PlayoutEngine from '../playoutEngines/BasePlayoutEngine';
import AnalyticEvents from '../AnalyticEvents';
import type { AnalyticsLogger, AnalyticEventName } from '../AnalyticEvents';
import Controller from '../Controller';
import logger from '../logger';


export default class BaseRenderer extends EventEmitter {
    _rendererId: string;
    _representation: Representation;
    _fetchAssetCollection: AssetCollectionFetcher;
    _fetchMedia: MediaFetcher;
    _player: Player;
    _playoutEngine: PlayoutEngine;
    _behaviourRunner: ?BehaviourRunner;
    _behaviourRendererMap: { [key: string]: (behaviour: Object, callback: () => mixed) => void };
    _applyColourOverlayBehaviour: Function;
    _applyShowImageBehaviour: Function;
    _applyShowVariablePanelBehaviour: Function;
    _hideLinksUntilEndBehaviour: Function;
    _behaviourElements: Array<HTMLElement>;
    _target: HTMLDivElement;
    _destroyed: boolean;
    _analytics: AnalyticsLogger;
    _controller: Controller;

    _hidingIcons: boolean;

    inVariablePanel: boolean;

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
        this._rendererId = this._representation.id;
        this._fetchAssetCollection = assetCollectionFetcher;
        this._fetchMedia = mediaFetcher;
        this._player = player;
        this._playoutEngine = player.playoutEngine;
        this._target = player.mediaTarget;
        this._controller = controller;

        this._applyColourOverlayBehaviour = this._applyColourOverlayBehaviour.bind(this);
        this._applyShowImageBehaviour = this._applyShowImageBehaviour.bind(this);
        this._applyShowVariablePanelBehaviour = this._applyShowVariablePanelBehaviour.bind(this);
        this._hideLinksUntilEndBehaviour = this._hideLinksUntilEndBehaviour.bind(this);

        this._behaviourRendererMap = {
            // eslint-disable-next-line max-len
            'urn:x-object-based-media:representation-behaviour:colouroverlay/v1.0': this._applyColourOverlayBehaviour,
            // eslint-disable-next-line max-len
            'urn:x-object-based-media:representation-behaviour:showimage/v1.0': this._applyShowImageBehaviour,
            // eslint-disable-next-line max-len
            'urn:x-object-based-media:representation-behaviour:showvariablepanel/v1.0': this._applyShowVariablePanelBehaviour,
            // eslint-disable-next-line max-len
            'urn:x-object-based-media:representation-behaviour:hidelinksuntilend/v1.0': this._hideLinksUntilEndBehaviour,
        };
        this._behaviourElements = [];

        this._hidingIcons = false;
        this._destroyed = false;
        this._analytics = analytics;
        this.inVariablePanel = false;
    }

    willStart() {
        this.inVariablePanel = false;
        this._behaviourRunner = this._representation.behaviours
            ? new BehaviourRunner(this._representation.behaviours, this)
            : null;
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

    start() {
        this.emit(RendererEvents.STARTED);
        this._player.exitStartBehaviourPhase();
        this._clearBehaviourElements();
    }

    end() {
    }

    // does this renderer have a show variable panel behaviour
    hasVariablePanelBehaviour(): boolean {
        let hasPanel = false;
        if (this._representation.behaviours && this._representation.behaviours.completed) {
            this._representation.behaviours.completed.forEach((behave) => {
                // eslint-disable-next-line max-len
                if (behave.type === 'urn:x-object-based-media:representation-behaviour:showvariablepanel/v1.0') {
                    hasPanel = true;
                }
            });
        }
        return hasPanel;
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
        if (this._hidingIcons) {
            this._player._linkChoice.overlay.style.visibility = 'visible';
        }
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
        this.end();
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

    _hideLinksUntilEndBehaviour(behaviour: Object, callback: () => mixed) {
        // record this, so we can reveal later
        this._hidingIcons = true;
        // set style directly, as romper-active class may be applied
        // asynchronously
        this._player._linkChoice.overlay.style.visibility = 'collapse';
        callback();
    }

    _overlayImage(imageSrc: string) {
        const overlayImageElement = document.createElement('img');
        overlayImageElement.src = imageSrc;
        overlayImageElement.className = 'romper-image-overlay';
        this._target.appendChild(overlayImageElement);
        this._behaviourElements.push(overlayImageElement);
    }

    // an input for selecting the value for a boolean variable
    _getBooleanVariableSetter(varName: string) {
        const varInput = document.createElement('div');
        varInput.classList.add('romper-var-form-input-container');

        // yes button & label
        const radioYesDiv = document.createElement('div');
        radioYesDiv.className = 'romper-var-form-radio-div';
        const radioYes = document.createElement('input');
        radioYes.onclick = (() => this._controller.setVariableValue(varName, true));
        radioYes.type = 'radio';
        radioYes.name = 'bool-option';
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
        const noLabel = document.createElement('div');
        noLabel.innerHTML = 'No';
        radioNoDiv.appendChild(radioNo);
        radioNoDiv.appendChild(noLabel);

        varInput.appendChild(radioYesDiv);
        varInput.appendChild(radioNoDiv);

        this._controller.getVariableValue(varName)
            .then((varValue) => {
                radioYes.checked = varValue;
                radioNo.checked = !varValue;
            });

        return varInput;
    }

    // an input for selecting the value for a list variable
    _getListVariableSetter(varName: string, variableDecl: Object) {
        const varInput = document.createElement('div');
        varInput.classList.add('romper-var-form-input-container');

        const options = variableDecl.values;
        const varInputSelect = document.createElement('select');
        options.forEach((optionValue) => {
            const optionElement = document.createElement('option');
            optionElement.setAttribute('value', optionValue);
            optionElement.textContent = optionValue;
            varInputSelect.appendChild(optionElement);
        });
        varInput.appendChild(varInputSelect);

        this._controller.getVariableValue(varName)
            .then((varValue) => {
                varInputSelect.value = varValue;
            });

        varInputSelect.onchange = () =>
            this._controller.setVariableValue(varName, varInputSelect.value);

        return varInput;
    }

    // an input for changing the value for an integer number variables
    _getIntegerVariableSetter(varName: string) {
        const varInput = document.createElement('div');
        varInput.classList.add('romper-var-form-input-container');

        const varIntInput = document.createElement('input');
        varIntInput.type = 'number';

        this._controller.getVariableValue(varName)
            .then((varValue) => {
                varIntInput.value = varValue;
            });

        varIntInput.onchange = () => this._controller.setVariableValue(varName, varIntInput.value);
        varInput.appendChild(varIntInput);

        return varInput;
    }

    // create an input element for setting a variable
    _getVariableSetter(variableDecl: Object, behaviourVar: Object): HTMLDivElement {
        const variableDiv = document.createElement('div');
        variableDiv.className = 'romper-variable-form-item';

        const variableType = variableDecl.variable_type;
        const variableName = behaviourVar.variable_name;

        const labelDiv = document.createElement('div');
        labelDiv.innerHTML = behaviourVar.label;
        labelDiv.className = 'romper-var-form-label-div';
        variableDiv.appendChild(labelDiv);

        if (variableType === 'boolean') {
            const boolDiv = this._getBooleanVariableSetter(variableName);
            variableDiv.append(boolDiv);
        } else if (variableType === 'list') {
            const listDiv = this._getListVariableSetter(
                behaviourVar.variable_name,
                variableDecl,
            );
            listDiv.classList.add('romper-var-form-list-input');
            variableDiv.append(listDiv);
        } else if (variableType === 'number') {
            const numDiv = this._getIntegerVariableSetter(variableName);
            numDiv.classList.add('romper-var-form-number-input');
            variableDiv.append(numDiv);
        }

        return variableDiv;
    }

    _applyShowVariablePanelBehaviour(behaviour: Object, callback: () => mixed) {
        this._player.setNextAvailable(false);
        this.inVariablePanel = true;

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

                // get an array of divs - one for each question
                const variableFields = [];
                // div for each variable Element
                behaviourVariables.forEach((behaviourVar, i) => {
                    const storyVariable = storyVariables[behaviourVar.variable_name];
                    const variableDiv = this._getVariableSetter(storyVariable, behaviourVar);
                    if (i === 0) {
                        variableDiv.classList.add('active');
                    }
                    variableFields.push(variableDiv);
                    variablesFormContainer.appendChild(variableDiv);
                });

                overlayImageElement.appendChild(variablesFormContainer);
                // show first question
                let currentQuestion = 0;

                // submit button
                const okButtonContainer = document.createElement('div');

                // number of questions
                const feedbackPar = document.createElement('p');
                feedbackPar.textContent = `Question 1 of ${variableFields.length}`;
                feedbackPar.classList.add('romper-var-form-feedback');

                okButtonContainer.className = 'romper-var-form-button-container';
                const okButton = document.createElement('input');
                okButton.type = 'button';

                okButton.value = behaviourVariables.length > 1 ? 'Next' : 'OK!';
                okButton.onclick = (() => {
                    if (currentQuestion >= behaviourVariables.length - 1) {
                        // start fade out
                        overlayImageElement.classList.remove('active');
                        this.inVariablePanel = false;
                        // complete NE when fade out done
                        setTimeout(() => {
                            this._player.setNextAvailable(true);
                            return callback();
                        }, 700);
                    }
                    // hide current question and show next
                    variableFields.forEach((varDiv, i) => {
                        if (i === currentQuestion) {
                            varDiv.classList.remove('active');
                        } else if (i === currentQuestion + 1) {
                            varDiv.classList.add('active');
                        }
                    });

                    currentQuestion += 1;
                    // set feedback and button texts
                    okButton.value = currentQuestion < (behaviourVariables.length - 1)
                        ? 'Next' : 'OK!';
                    feedbackPar.textContent =
                        `Question ${currentQuestion + 1}
                         of ${behaviourVariables.length}`;
                    return false;
                });
                okButton.className = 'romper-var-form-button';
                okButtonContainer.appendChild(okButton);

                okButtonContainer.appendChild(feedbackPar);

                overlayImageElement.appendChild(okButtonContainer);

                this._target.appendChild(overlayImageElement);
                setTimeout(() => { overlayImageElement.classList.add('active'); }, 200);
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
        this.end();
        this._clearBehaviourElements();
        if (this._behaviourRunner) {
            this._behaviourRunner.destroyBehaviours();
        }
        // we didn't find any behaviours to run, so emit completion event
        this.emit(RendererEvents.DESTROYED);
        this._destroyed = true;
    }
}
