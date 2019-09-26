// not a behaviour in itself, just helps, to keep BaseRenderer Clean
import { setDefinedPosition, createContainer } from './ModalHelper';

/* eslint-disable no-param-reassign */
const setPosition = (modalElement, behaviour) => {
    if (behaviour.position) {
        setDefinedPosition(modalElement, behaviour);
    } else {
        modalElement.style.top = '30%';
        modalElement.style.left = '30%';
        modalElement.style.width = `40%`;
        modalElement.style.height = '6em';
    }
};
/* eslint-enable no-param-reassign */

const createLink = (behaviour) => {
    const linkText = behaviour.link_text;
    const linkUrl = behaviour.link_url;
    const linkElement = document.createElement('a');
    linkElement.href = linkUrl;
    linkElement.textContent = linkText;

    if (behaviour.open_in_new_tab) {
        linkElement.setAttribute('target', '_blank');
    }
    return linkElement;
};

// eslint-disable-next-line import/prefer-default-export
export const renderLinkoutPopup = (behaviour, target, callback) => {
    const modalElement = document.createElement('div');
    const modalContainer = createContainer(target);
    modalContainer.appendChild(modalElement);

    modalElement.className = 'romper-behaviour-modal link-out';
    if (behaviour.css_class) {
        modalElement.classList.add(behaviour.css_class);
    }

    if (behaviour.title) {
        const titleSpan = document.createElement('div');
        titleSpan.textContent = behaviour.title;
        titleSpan.className = 'title';
        modalElement.appendChild(titleSpan);
    }

    setPosition(modalElement, behaviour);

    const closeButton = document.createElement('div');
    closeButton.className= 'romper-close-button';
    const closeModal = () => {
        modalContainer.removeChild(modalElement);
        callback();
    };
    closeButton.onclick = closeModal;
    modalElement.appendChild(closeButton);

    const link = createLink(behaviour);
    const sentenceDiv = document.createElement('div');
    
    if (behaviour.before_text) {
        const beforeSpan = document.createElement('span');
        beforeSpan.textContent = behaviour.before_text;
        sentenceDiv.appendChild(beforeSpan);
    }
    sentenceDiv.appendChild(link);
    if (behaviour.after_text) {
        const afterSpan = document.createElement('span');
        afterSpan.textContent = behaviour.after_text;
        sentenceDiv.appendChild(afterSpan);
    }
    
    modalElement.appendChild(sentenceDiv);

    return modalElement;
};