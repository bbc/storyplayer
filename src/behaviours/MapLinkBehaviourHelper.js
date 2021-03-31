// not a behaviour in itself, just helps, to keep BaseRenderer Clean
import {  createContainer } from './ModalHelper';

/* eslint-disable no-param-reassign */
const setPosition = (modalElement) => {
    modalElement.style.top = '0';
    modalElement.style.left = '0';
    modalElement.style.width = `98%`;
    modalElement.style.height = '98%';
};
/* eslint-enable no-param-reassign */

const getLinkId = (xPercent, yPercent, behaviour) => {
    const { links } = behaviour;
    const match = links.find(l => {
        const { left, top, width, height } = l.position;
        return (
            xPercent >= left &&
            xPercent <= left + width &&
            yPercent >= top &&
            yPercent <= top + height
        );
    });
    if (match) return match.narrative_element_id;
    return null;
};

// eslint-disable-next-line import/prefer-default-export
export const renderMapOverlay = (behaviour, target, callback, controller) => {
    console.log('ANDY rendering map overlay');
    const modalElement = document.createElement('div');
    modalElement.id = behaviour.id;
    const modalContainer = createContainer(target);
    modalContainer.appendChild(modalElement);

    modalElement.className = 'romper-behaviour-modal map-overlay';

    setPosition(modalElement);

    modalElement.onclick = (e) => {
        const { offsetX, offsetY, target } = e;
        const { offsetWidth, offsetHeight } = target;
        const xPercent = 100 * offsetX / offsetWidth;
        const yPercent = 100 * offsetY / offsetHeight;

        console.log('ANDY map click', xPercent, yPercent);
        const matchid = getLinkId(xPercent, yPercent, behaviour);
        if (matchid) {
            console.log('ANDY go to', matchid);
            controller._jumpToNarrativeElement(matchid);
        }
    }

    callback();
    return modalElement;
};