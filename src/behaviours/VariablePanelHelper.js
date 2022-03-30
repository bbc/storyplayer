import BaseRenderer from "../renderers/BaseRenderer";
import Player from '../gui/Player';
import AnalyticEvents from '../AnalyticEvents';

// @flow

// a drop-down list input for selecting the value for a list variable
const _getLongListVariableSetter = (
    varName: string,
    variableDecl: Object,
    getVariableValue: Function,
    setVariableValue: Function,
) => {
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

    getVariableValue(varName)
        .then((varValue) => {
            varInputSelect.value = varValue;
        });

    varInputSelect.onchange = () =>
        setVariableValue(varName, varInputSelect.value);

    return varInput;
};

// an input for selecting the value for a list variable
const _getBooleanVariableSetter = (
    varName: string,
    getVariableValue: Function,
    setVariableValue: Function,
) => {
    const varInput = document.createElement('div');
    varInput.classList.add('romper-var-form-input-container');

    const varInputSelect = document.createElement('div');
    varInputSelect.classList.add('romper-var-form-button-div');

    const yesElement = document.createElement('button');
    yesElement.setAttribute('type', 'button');
    const noElement = document.createElement('button');
    noElement.setAttribute('type', 'button');

    const setSelected = (varVal) => {
        if (varVal) {
            yesElement.classList.add('selected');
            noElement.classList.remove('selected');
        } else {
            yesElement.classList.remove('selected');
            noElement.classList.add('selected');
        }
    };

    yesElement.textContent = 'Yes';
    yesElement.onclick = () => {
        setVariableValue(varName, true);
        setSelected(true);
    };
    varInputSelect.appendChild(yesElement);
    noElement.textContent = 'No';
    noElement.onclick = () => {
        setVariableValue(varName, false);
        setSelected(false);
    };
    varInputSelect.appendChild(noElement);

    varInput.appendChild(varInputSelect);

    getVariableValue(varName)
        .then(varValue => setSelected(varValue));

    return varInput;
};

// an input for changing the value for an integer number variables
const _getIntegerVariableSetter = (
    varName: string,
    getVariableValue: Function,
    setVariableValue: Function,
) => {
    const varInput = document.createElement('div');
    varInput.classList.add('romper-var-form-input-container');

    const varIntInput = document.createElement('input');
    varIntInput.type = 'number';

    getVariableValue(varName)
        .then((varValue) => {
            varIntInput.value = varValue;
        });

    varIntInput.onchange = () => setVariableValue(varName, varIntInput.value);
    varInput.appendChild(varIntInput);

    return varInput;
};

const _getNumberRangeVariableSetter = (
    varName: string,
    range: Object,
    behaviourVar: Object,
    getVariableValue: Function,
    setVariableValue: Function,
) => {
    const varInput = document.createElement('div');
    varInput.classList.add('romper-var-form-input-container');

    const sliderDiv = document.createElement('div');
    sliderDiv.style.position = 'relative';
    const minSpan = document.createElement('span');
    minSpan.classList.add('min');
    if (behaviourVar.hasOwnProperty('min_label')) {
        minSpan.textContent = behaviourVar.min_label === null ? '' : behaviourVar.min_label;
    } else {
        minSpan.textContent = range.min_val;
    }
    const maxSpan = document.createElement('span');
    maxSpan.classList.add('max');
    if (behaviourVar.hasOwnProperty('max_label')) {
        maxSpan.textContent = behaviourVar.max_label === null ? '' : behaviourVar.max_label;
    } else {
        maxSpan.textContent = range.max_val;
    }

    const outputTest = document.createElement('div');
    outputTest.className = 'romper-var-form-range-output';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.classList.add('romper-var-form-slider');
    slider.id = `variable-input-${varName}`;

    sliderDiv.appendChild(minSpan);
    sliderDiv.appendChild(slider);
    sliderDiv.appendChild(maxSpan);

    const numberInput = document.createElement('input');
    numberInput.classList.add('romper-var-form-slider-input');
    numberInput.classList.add('slider-input');
    numberInput.type = 'number';

    const setOutputPosition = () => {
        const proportion = parseFloat(slider.value)/parseFloat(slider.max);
        let leftPos = minSpan.clientWidth; // minimum value element
        leftPos += (1/12) * slider.clientWidth; // slider margin L
        leftPos += (proportion * (10/12) * slider.clientWidth);
        outputTest.style.left = `${leftPos}px`;
    }

    slider.min = range.min_val;
    slider.max = range.max_val;
    getVariableValue(varName)
        .then((varValue) => {
            slider.value = varValue;
            numberInput.value = varValue;
            outputTest.textContent = `${varValue}`;
            setOutputPosition();
        });

    slider.onchange = () => {
        setVariableValue(varName, slider.value);
        numberInput.value = slider.value;
    };

    slider.oninput = () => {
        numberInput.value = slider.value;
        outputTest.textContent = `${slider.value}`;
        setOutputPosition();
    };

    numberInput.onchange = () => {
        setVariableValue(varName, numberInput.value);
        slider.value = numberInput.value;
    };

    numberInput.oninput = () => {
        setVariableValue(varName, numberInput.value);
    };

    varInput.appendChild(sliderDiv);
    if (behaviourVar.hasOwnProperty('precise_entry') && behaviourVar.precise_entry){
        varInput.appendChild(numberInput);
    } else if (!(behaviourVar.hasOwnProperty('min_label')
        || behaviourVar.hasOwnProperty('max_label'))) {
        // if precise, or user has specified labels, don't show
        // otherwise give number feedback
        sliderDiv.appendChild(outputTest);
        window.onresize = () => setOutputPosition();
    }

    return varInput;
};

// create an input element for setting a variable
const getVariableSetter = (
    variableDecl: Object,
    behaviourVar: Object,
    getVariableValue: Function,
    setVariableValue: Function,
): HTMLDivElement => {
    const variableDiv = document.createElement('div');
    variableDiv.className = 'romper-variable-form-item';
    variableDiv.id = `romper-var-form-${behaviourVar.variable_name.replace('_', '-')}`;

    const variableType = variableDecl.variable_type;
    const variableName = behaviourVar.variable_name;

    const labelDiv = document.createElement('div');
    labelDiv.className = 'romper-var-form-label-div';
    const labelSpan = document.createElement('span');
    labelSpan.innerHTML = behaviourVar.label;
    labelDiv.appendChild(labelSpan);
    variableDiv.appendChild(labelDiv);

    const answerContainer = document.createElement('div');
    answerContainer.className = 'romper-var-form-answer-cont-inner';
    const answerContainerOuter = document.createElement('div');
    answerContainerOuter.className = 'romper-var-form-answer-cont';

    answerContainerOuter.appendChild(answerContainer);

    if (variableType === 'boolean') {
        const boolDiv = _getBooleanVariableSetter(
            variableName,
            getVariableValue,
            setVariableValue,
        );
        answerContainer.append(boolDiv);
    } else if (variableType === 'list') {
        const listDiv = _getLongListVariableSetter(
            behaviourVar.variable_name,
            variableDecl,
            getVariableValue,
            setVariableValue,
        );
        listDiv.classList.add('romper-var-form-list-input');
        answerContainer.append(listDiv);
    } else if (variableType === 'number') {
        let numDiv;
        if (variableDecl.hasOwnProperty('range')) {
            numDiv = _getNumberRangeVariableSetter(
                variableName,
                variableDecl.range,
                behaviourVar,
                getVariableValue,
                setVariableValue,
            );
        } else {
            numDiv = _getIntegerVariableSetter(
                variableName,
                getVariableValue,
                setVariableValue,
            );
        }
        numDiv.classList.add('romper-var-form-number-input');
        answerContainer.append(numDiv);
    }

    variableDiv.appendChild(answerContainerOuter);
    return variableDiv;
};

const createVarPanelElements = (formTitle, backgroundColour): Object => {
    const variablePanelElement = document.createElement('div');
    variablePanelElement.className = 'romper-variable-panel';

    if (backgroundColour) {
        variablePanelElement.style.background = backgroundColour;
    }

    const titleDiv = document.createElement('div');
    titleDiv.innerHTML = formTitle;
    titleDiv.className = 'romper-var-form-title';
    variablePanelElement.appendChild(titleDiv);

    const variablesFormContainer = document.createElement('div');
    variablesFormContainer.className = 'romper-var-form-var-containers';

    const carouselDiv = document.createElement('div');
    carouselDiv.className = 'romper-var-form-carousel';
    variablesFormContainer.appendChild(carouselDiv);
    variablePanelElement.appendChild(carouselDiv);

    const okButtonContainer = document.createElement('div');

    okButtonContainer.className = 'romper-var-form-button-container';
    const okButton = document.createElement('input');
    okButton.className = 'romper-var-form-button';
    okButton.type = 'button';
    okButton.classList.add('var-next');
    okButton.value = 'Next';
    variablePanelElement.appendChild(okButtonContainer);

    // back button
    const backButton = document.createElement('input');
    backButton.type = 'button';
    backButton.value = 'Back';
    backButton.classList.add('var-back');
    backButton.classList.add('romper-var-form-button');

    const statusSpan = document.createElement('span');
    statusSpan.classList.add('var-count');
    statusSpan.textContent = '';

    okButtonContainer.appendChild(backButton);
    okButtonContainer.appendChild(statusSpan);
    okButtonContainer.appendChild(okButton);

    return {
        overlayImageElement: variablePanelElement,
        carouselDiv,
        backButton,
        okButton,
        statusSpan,
    }
};

// eslint-disable-next-line import/prefer-default-export
export const buildPanel = (
    behaviour: Object,
    getVariableState: Function,
    getVariableValue: Function,
    setVariableValue: Function,
    callback: Function,
    target: HTMLElement,
    player: Player,
    renderer: BaseRenderer,
    analytics: Function,
) => {
    player.setNextAvailable(false);
    renderer.inVariablePanel = true; // eslint-disable-line no-param-reassign

    // does behaviour definition want us to pause?
    const pauseWhileShowing = (behaviour.pause_content !== undefined) ? behaviour.pause_content : true;
    if (pauseWhileShowing) renderer.pause();

    const {
        overlayImageElement,
        carouselDiv,
        backButton,
        okButton,
        statusSpan,
    } = createVarPanelElements(behaviour.panel_label, behaviour.background_colour);

    player.disableControls();

    overlayImageElement.id = behaviour.id;
    renderer._setBehaviourElementAttribute(overlayImageElement, 'variable-panel');

    const behaviourVariables = behaviour.variables;

    getVariableState()
        .then((storyVariables) => {               
            // get an array of divs - one for each question
            const variableFields = [];
            // div for each variable Element
            behaviourVariables.forEach((behaviourVar, i) => {
                const storyVariable = storyVariables[behaviourVar.variable_name];
                const variableDiv = getVariableSetter(
                    storyVariable,
                    behaviourVar,
                    getVariableValue,
                    setVariableValue,
                );
                if (i > 0) {
                    variableDiv.classList.add('right');
                }
                variableFields.push(variableDiv);
                carouselDiv.appendChild(variableDiv);
            });

            // show first question
            let currentQuestion = 0;

            let statusText = `${currentQuestion + 1} of ${behaviourVariables.length}`;
            statusSpan.textContent = statusText;

            // log var panel, value, even if user doesn't change it
            const logSlideChange = (fwd: boolean) => {
                const currentBehaviour = behaviourVariables[currentQuestion];
                const varName = currentBehaviour.variable_name;
                getVariableValue(varName).then((value) => {
                    const actionName = fwd ?
                        AnalyticEvents.names.VARIABLE_PANEL_NEXT_CLICKED :
                        AnalyticEvents.names.VARIABLE_PANEL_BACK_CLICKED;
                    const logData = {
                        type: AnalyticEvents.types.USER_ACTION,
                        name: actionName,
                        from: 'unset',
                        to: `${varName}: ${value}`,
                    };
                    analytics(logData);
                });
            };

            const changeSlide = (fwd: boolean) => {
                logSlideChange(fwd);
                const targetId = fwd ? currentQuestion + 1 : currentQuestion - 1;

                if (fwd && currentQuestion >= behaviourVariables.length - 1) {
                    // start fade out
                    overlayImageElement.classList.remove('active');
                    renderer.inVariablePanel = false; // eslint-disable-line no-param-reassign
                    // complete NE when fade out done
                    setTimeout(() => {
                        player.enableControls();
                        player.setNextAvailable(true);
                        if (pauseWhileShowing) renderer.play();
                        return callback();
                    }, 700);
                    return false;
                }
                // hide current question and show next
                variableFields.forEach((varDiv, i) => {
                    if (i === targetId) {
                        varDiv.classList.remove('left');
                        varDiv.classList.remove('right');
                    } else if (i < targetId) {
                        varDiv.classList.add('left');
                        varDiv.classList.remove('right');
                    } else {
                        varDiv.classList.remove('left');
                        varDiv.classList.add('right');
                    }
                });

                currentQuestion = targetId;
                if (currentQuestion > 0) {
                    backButton.classList.add('active');
                } else {
                    backButton.classList.remove('active');
                }
                statusText = `${currentQuestion + 1} of ${behaviourVariables.length}`;
                statusSpan.textContent = statusText;
                return false;
            };

            backButton.onclick = () => { changeSlide(false); };
            okButton.onclick = () => { changeSlide(true); };

            target.appendChild(overlayImageElement);
            setTimeout(() => { overlayImageElement.classList.add('active'); }, 200);
            renderer._behaviourElements.push(overlayImageElement);
        });

}
