// not a behaviour in itself, just helps, to keep BaseRenderer Clean
import { setDefinedPosition, createContainer } from './ModalHelper';

const createTwitterIcon = (shareText, shareUrl) => {
    const twitterLi = document.createElement('li');
    const twitterDiv = document.createElement('div');
    const twitterAction = () => window.open(
        `https://twitter.com/intent/tweet?text=${shareText}&amp;url=${shareUrl}`,
        '_blank',
        'toolbar=no,scrollbars=yes,resizable=no,fullscreen=no,top=50,left=50,width=550,height=250',
    );
    twitterDiv.onclick = twitterAction;
    twitterLi.className = 'twitter';
    twitterLi.appendChild(twitterDiv);
    return twitterLi;  
};

const createEmailIcon = (shareText, shareUrl) => {
    const emailLi = document.createElement('li');
    const emailLink = document.createElement('a');
    const emailDiv = document.createElement('div');
    emailLink.href = `mailto:?subject=${shareText}&body=${shareUrl}`;
    emailLi.appendChild(emailLink);
    emailLink.appendChild(emailDiv);
    emailLi.className = 'email';
    return emailLi;
};

const createFacebookIcon = (shareText, shareUrl) => {
    const facebookLi = document.createElement('li');
    const facebookDiv = document.createElement('div');
    // TODO: uses app id scraped from BBC news website
    const facebookAction = () => window.open(
        `http://www.facebook.com/dialog/feed?app_id=58567469885&link=${shareUrl}&display=popup`,
        '_blank',
        'toolbar=no,scrollbars=yes,resizable=no,fullscreen=no,top=50,left=50,width=550,height=250',
    );
    facebookDiv.onclick = facebookAction;
    facebookLi.className = 'facebook';
    facebookLi.appendChild(facebookDiv);
    return facebookLi;    
};

/* eslint-disable no-param-reassign */
const setPosition = (modalElement, behaviour) => {
    if (behaviour.position) {
        setDefinedPosition(modalElement, behaviour);
    } else {
        modalElement.style.top = '5%';
        modalElement.style.right = '5%';
    }
};
/* eslint-enable no-param-reassign */

// eslint-disable-next-line import/prefer-default-export
export const renderSocialPopup = (behaviour, target, callback) => { 
    const modalElement = document.createElement('div');
    modalElement.id = behaviour.id;
    const modalContainer = createContainer(target);
    modalContainer.appendChild(modalElement);

    modalElement.className = 'romper-behaviour-modal social-share';
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

    const shareText = behaviour.share_text;
    let shareUrl = window.location.href;
    if (behaviour.share_url) {
        shareUrl = behaviour.share_url;
    }

    const platformList = document.createElement('ul');
    platformList.className = 'romper-share-list';
    behaviour.platforms.forEach((platformId) => {
        if (platformId === 'twitter') {
            const twitterIcon = createTwitterIcon(shareText, shareUrl);
            platformList.appendChild(twitterIcon);
        } else if (platformId === 'email') {
            const emailIcon = createEmailIcon(shareText, shareUrl);
            platformList.appendChild(emailIcon);
        } else if (platformId === 'facebook') {
            const facebookIcon = createFacebookIcon(shareText, shareUrl);
            platformList.appendChild(facebookIcon);
        }
    });
    modalElement.appendChild(platformList);

    return modalElement;
};