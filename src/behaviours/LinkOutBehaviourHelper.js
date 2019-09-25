// not a behaviour in itself, just helps, to keep BaseRenderer Clean

const getPosition = (behaviour) => {
    let position = {
        width: '40%',
        top: '15%',
        left: `30%`,
        height: '6em',
    };

    if (behaviour.position) {
        const { top, left, width, height } = behaviour.position;
        position = {
            top: `${top}%`,
            left: `${left}%`,
            width: `${width}em`,
            height: `${height}%`,
        };
    }
    return position;
};

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

    const { top, left, width, height } = getPosition(behaviour);
    modalElement.style.top = top;
    modalElement.style.left = left;
    modalElement.style.width = width;
    modalElement.style.height = height;

    const closeButton = document.createElement('div');
    closeButton.className= 'romper-close-button';
    const closeModal = () => {
        target.removeChild(modalElement);
        callback();
    };
    closeButton.onclick = closeModal;
    modalElement.appendChild(closeButton);

    target.appendChild(modalElement);

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