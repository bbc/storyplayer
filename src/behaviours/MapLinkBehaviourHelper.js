// not a behaviour in itself, just helps to keep BaseRenderer Clean
import {  createContainer } from './ModalHelper';
import AnalyticEvents from '../AnalyticEvents';

const getLinkId = (e, behaviour) => {
    const { offsetX, offsetY } = e;
    const { offsetWidth, offsetHeight } = e.target;
    const xPercent = 100 * offsetX / offsetWidth;
    const yPercent = 100 * offsetY / offsetHeight;
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
export const renderMapOverlay = (behaviour, target, callback, controller, analytics) => {
    const modalElement = document.createElement('div');
    modalElement.id = behaviour.id;
    const modalContainer = createContainer(target);
    modalContainer.appendChild(modalElement);

    modalElement.className = 'romper-behaviour-modal map-overlay';

    modalElement.onmousemove = (e) => {
        const matchid = getLinkId(e, behaviour);
        modalElement.style.cursor = matchid ? 'pointer' : 'unset';
    }

    modalElement.onclick = (e) => {
        const matchid = getLinkId(e, behaviour);
        if (matchid) {
            const ne = controller._getNarrativeElement(matchid)
            if (ne) {
                analytics({
                    type: AnalyticEvents.types.USER_ACTION,
                    name: AnalyticEvents.names.MAP_OVERLAY_LINK_CLICKED,
                    from: 'not_set',
                    to: matchid,
                });
                controller._jumpToNarrativeElement(matchid);
            }
        }
    }

    callback();
    return modalElement;
};
