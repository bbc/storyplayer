// not a behaviour in itself, just helps, to keep BaseRenderer Clean
import { setDefinedPosition, createContainer } from './ModalHelper';
import { replaceEscapedVariables } from '../utils';
import { createElementWithClass } from '../documentUtils';

/* eslint-disable no-param-reassign */
const setPosition = (modalElement, behaviour) => {
    if (behaviour.position) {
        setDefinedPosition(modalElement, behaviour);
    } else {
        modalElement.style.top = '0';
        modalElement.style.left = '0';
        modalElement.style.width = `98%`;
        modalElement.style.height = '98%';
    }
};
/* eslint-enable no-param-reassign */


// eslint-disable-next-line import/prefer-default-export
export const renderTextOverlay = (behaviour, target, callback, controller) => {
    const modalElement = createElementWithClass('div', behaviour.id, ['romper-behaviour-modal','text-overlay']);
    const modalContainer = createContainer(target);
    modalContainer.appendChild(modalElement);

    if (behaviour.css_class) {
        modalElement.classList.add(behaviour.css_class);
    }

    if ('background_colour' in behaviour) {
        modalElement.style.backgroundColor = behaviour.background_colour;
    }

    if ('font_size' in behaviour) {
        modalElement.style.fontSize = `${behaviour.font_size}%`;
    }

    setPosition(modalElement, behaviour);
    const sentenceDiv = document.createElement('div');
    replaceEscapedVariables(behaviour.text, controller)
        .then((newText) => {
            sentenceDiv.textContent = newText;    
        });
    modalElement.appendChild(sentenceDiv);
    callback();
    return modalElement;
};