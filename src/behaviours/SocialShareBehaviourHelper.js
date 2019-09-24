// not a behaviour in itself, just helps, to keep BaseRenderer Clean

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

// eslint-disable-next-line import/prefer-default-export
export const renderSocialPopup = (behaviour, target, callback) => { 
    const modalElement = document.createElement('div');
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

    const { top, left, width, height } = behaviour.position;
    modalElement.style.top = `${top}%`;
    modalElement.style.left = `${left}%`;
    modalElement.style.width = `${width}%`;
    modalElement.style.height = `${height}%`;

    const closeButton = document.createElement('div');
    closeButton.className= 'romper-close-button';
    closeButton.textContent = 'X';
    const closeModal = () => {
        target.removeChild(modalElement);
        callback();
    };
    closeButton.onclick = closeModal;
    modalElement.appendChild(closeButton);

    target.appendChild(modalElement);

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