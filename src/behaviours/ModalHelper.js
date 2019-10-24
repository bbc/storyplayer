// not a behaviour in itself, just helps, to keep BaseRenderer Clean

/* eslint-disable no-param-reassign */
const setDefinedPosition = (modalElement, behaviour) => {
    const { top, left, width, height, bottom, right } = behaviour.position;
    if (top) modalElement.style.top = `${top}%`;
    if (left) modalElement.style.left = `${left}%`;
    if (width) modalElement.style.width = `${width}%`;
    if (height) modalElement.style.height = `${height}%`;
    if (bottom) modalElement.style.bottom = `${bottom}%`;
    if (right) modalElement.style.right = `${right}%`;
};
/* eslint-enable no-param-reassign */

const createContainer = (target) => {
    let modalOverlay = document.getElementById('modal-container');
    if (!modalOverlay) {
        modalOverlay = document.createElement('div');
        modalOverlay.id = 'modal-container'
        modalOverlay.className = 'romper-modal-container';
        target.appendChild(modalOverlay);
    }
    return modalOverlay;
};

export { createContainer, setDefinedPosition };