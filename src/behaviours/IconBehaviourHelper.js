// not a behaviour in itself, just helps, to keep BaseRenderer Clean
import {  createContainer, setDefinedPosition } from './ModalHelper';

// eslint-disable-next-line import/prefer-default-export
export const renderBehaviourIcon = (iconACId, position, behaviourId, target, callback, fetchAC, _fetchMedia, clickHandler) => {
    const modalElement = document.createElement('div');
    modalElement.id = behaviourId;
    const modalContainer = createContainer(target);
    modalContainer.appendChild(modalElement);

    modalElement.className = 'romper-behaviour-modal behaviour-icon';
    modalElement.onclick = clickHandler;

    fetchAC(iconACId)
        .then((assetCollection) => {
            if (assetCollection.assets.image_src) {
                return _fetchMedia(assetCollection.assets.image_src);
            }
            return Promise.resolve();
        })
        .then((imageUrl) => {
            if (imageUrl) {
                const icon = document.createElement('img');
                icon.src = imageUrl;
                modalElement.appendChild(icon);
                setDefinedPosition(modalElement, { position });
            }
            callback();
        });

    callback();
    return modalElement;
};