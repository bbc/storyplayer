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
    let modalContainer;
    const containerel = document.getElementsByClassName('romper-modal-container');
    if (containerel.length === 0) {
        modalContainer = document.createElement('div');
        modalContainer.className = 'romper-modal-container';
        target.appendChild(modalContainer);
    } else {
        modalContainer = containerel[0]; // eslint-disable-line prefer-destructuring
    }
    return modalContainer;
};

export { createContainer, setDefinedPosition };