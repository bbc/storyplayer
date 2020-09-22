// not a behaviour in itself, just helps, to keep BaseRenderer Clean
import { setDefinedPosition, createContainer } from './ModalHelper';
import AnalyticEvents from '../AnalyticEvents';
import { handleButtonTouchEvent, getCurrentUrl } from '../utils';
import { createElementWithClass } from '../documentUtils';

const createTwitterIcon = (shareText, shareUrl) => {
    const twitterLi = document.createElement('li');
    const twitterDiv = document.createElement('div');
    const twitterAction = () => window.open(
        `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`,
        '_blank',
        'toolbar=no,scrollbars=yes,resizable=no,fullscreen=no,top=50,left=50,width=550,height=250',
    );
    twitterDiv.onclick = twitterAction;
    twitterDiv.addEventListener('touchend', handleButtonTouchEvent(twitterAction));
    twitterLi.className = 'twitter';
    twitterLi.appendChild(twitterDiv);
    return twitterLi;
};

const createEmailIcon = (shareText, shareUrl) => {
    const emailLi = document.createElement('li');
    const emailLink = document.createElement('a');
    const emailDiv = document.createElement('div');
    emailLink.href = `mailto:?Subject=${shareText}&body=${shareUrl}`;
    emailLink.setAttribute('target', '_top');
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
        // eslint-disable-next-line max-len
        `http://www.facebook.com/dialog/feed?app_id=58567469885&link=${shareUrl}&quote=${shareText}&display=popup`,
        '_blank',
        'toolbar=no,scrollbars=yes,resizable=no,fullscreen=no,top=50,left=50,width=550,height=250',
    );
    facebookDiv.onclick = facebookAction;
    facebookDiv.addEventListener('touchend', handleButtonTouchEvent(facebookAction));
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

const addAnalytics = (icon, platformId, analytics) => {
    icon.addEventListener('click', () => {
        analytics({
            type: AnalyticEvents.types.USER_ACTION,
            name: AnalyticEvents.names.SOCIAL_SHARE_CLICKED,
            from: 'not_set',
            to: platformId,
        });
    });
}

// eslint-disable-next-line import/prefer-default-export
export const renderSocialPopup = (behaviour, target, callback, analytics = () => {}) => {
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

    const closeButtonId = 'close-social-modal'
    const closeButton = createElementWithClass('div', closeButtonId,['romper-close-button']);

    const closeModal = () => {
        modalContainer.removeChild(modalElement);
        callback();
    };
    closeButton.onclick = closeModal;
    closeButton.addEventListener('touchend', handleButtonTouchEvent(closeModal));
    modalElement.appendChild(closeButton);

    const shareText = encodeURIComponent(behaviour.share_text);
    let shareUrl = getCurrentUrl();
    if (behaviour.share_url) {
        shareUrl = encodeURIComponent(behaviour.share_url);
    }

    const platformList = createElementWithClass('ul', 'share-list', ['romper-share-list']);

    behaviour.platforms.forEach((platformId) => {
        if (platformId === 'twitter') {
            const twitterIcon = createTwitterIcon(shareText, shareUrl);
            addAnalytics(twitterIcon, platformId, analytics);
            platformList.appendChild(twitterIcon);
        } else if (platformId === 'email') {
            const emailIcon = createEmailIcon(shareText, shareUrl);
            addAnalytics(emailIcon, platformId, analytics);
            platformList.appendChild(emailIcon);
        } else if (platformId === 'facebook') {
            const facebookIcon = createFacebookIcon(shareText, shareUrl);
            addAnalytics(facebookIcon, platformId, analytics);
            platformList.appendChild(facebookIcon);
        }
    });
    modalElement.appendChild(platformList);

    return modalElement;
};
