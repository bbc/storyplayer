// not a behaviour in itself, just helps, to keep BaseRenderer Clean
import { setDefinedPosition, createContainer } from './ModalHelper';
import AnalyticEvents from '../AnalyticEvents';
import { createElementWithClass } from '../documentUtils';

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
    let linkUrl = behaviour.link_url;
    const linkId = `link-${behaviour.id}`;
    const linkElement = createElementWithClass('a', linkId, null);

    // if the link isn't absolute ie http or https we are going to assume authors want https absolute links
    if(!(linkUrl.startsWith('http://') || linkUrl.startsWith('https://'))) {
        // set to be https and let the external website handle any failing or redirects
        linkUrl = `https://${linkUrl}`;
    }
    linkElement.href = linkUrl;
    linkElement.textContent = linkText;

    if (behaviour.open_in_new_tab) {
        linkElement.setAttribute('target', '_blank');
    }
    return linkElement;
};

// eslint-disable-next-line import/prefer-default-export
export const renderLinkoutPopup = (behaviour, target, callback, analytics) => {
    const modalId = `modal-${behaviour.id}`;
    const modalElement = createElementWithClass('div', modalId, ['romper-behaviour-modal link-out'])
    const modalContainer = createContainer(target);
    modalContainer.appendChild(modalElement);

    if (behaviour.css_class) {
        modalElement.classList.add(behaviour.css_class);
    }

    if (behaviour.title) {
        const titleId = `title-${behaviour.id}`;
        const titleSpan = createElementWithClass('div', titleId, ['title']);
        titleSpan.textContent = behaviour.title;
        modalElement.appendChild(titleSpan);
    }

    setPosition(modalElement, behaviour);

    const buttonId = `close-button-${behaviour.id}`;
    const closeButton = createElementWithClass('div', buttonId, ['romper-close-button']);

    const closeModal = () => {
        modalContainer.removeChild(modalElement);
        callback();
    };
    closeButton.onclick = closeModal;
    modalElement.appendChild(closeButton);

    const link = createLink(behaviour);
    link.onclick = () => {
        analytics({
            type: AnalyticEvents.types.USER_ACTION,
            name: AnalyticEvents.names.OUTWARD_LINK_CLICKED,
            from: 'not_set',
            to: behaviour.link_url,
        });
    };
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