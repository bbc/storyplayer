// @flow

import EventEmitter from 'events';

const PlayerEvents = [
    'VOLUME_CHANGED',
    'ICON_CLICKED',
    'REPRESENTATION_CLICKED',
    'BACK_BUTTON_CLICKED',
    'NEXT_BUTTON_CLICKED',
    'SCRUB_BAR_MOUSE_DOWN',
    'SCRUB_BAR_CHANGED',
    'SCRUB_BAR_MOUSE_UP',
    'PLAY_PAUSE_BUTTON_CLICKED',
    'FULLSCREEN_BUTTON_CLICKED',
].reduce((events, eventName) => {
    // eslint-disable-next-line no-param-reassign
    events[eventName] = eventName;
    return events;
}, {});

function createOverlay(name: string) {
    const overlay = document.createElement('div');
    overlay.classList.add('romper-overlay');
    overlay.classList.add(`romper-${name}-overlay`);
    overlay.classList.add('romper-inactive');

    const button = document.createElement('button');
    button.classList.add('romper-button');
    button.classList.add(`romper-${name}-button`);
    button.classList.add('romper-inactive');
    button.onclick = () => {
        Array.prototype.slice
            .call(overlay.parentElement.querySelectorAll('.romper-overlay'))
            .filter(el => el !== overlay)
            .forEach(el => el.classList.add('romper-inactive'));
        overlay.classList.toggle('romper-inactive');
    };

    const elements = {};

    const add = (id: string, el: HTMLElement) => {
        elements[id] = el;
        overlay.appendChild(el);
        button.classList.remove('romper-inactive');
    };

    const get = (id: string) => elements[id];

    const remove = (id: string) => {
        if (elements[id]) {
            overlay.removeChild(elements[id]);
            delete elements[id];
            if (Object.keys(elements).length === 0) {
                button.classList.add('romper-inactive');
            }
        }
    };

    // Consider a set or select method.

    return {
        overlay, button, add, remove, get,
    };
}

class Player extends EventEmitter {
    constructor(target: HTMLElement) {
        super();
        this._player = document.createElement('div');
        this._player.classList.add('romper-player');

        this._backgroundLayer = document.createElement('div');
        this._backgroundLayer.classList.add('romper-background');

        this._mediaLayer = document.createElement('div');
        this._mediaLayer.classList.add('romper-media');

        this._guiLayer = document.createElement('div');
        this._guiLayer.classList.add('romper-gui');

        this._player.appendChild(this._backgroundLayer);
        this._player.appendChild(this._mediaLayer);
        this._player.appendChild(this._guiLayer);

        this._overlays = document.createElement('div');
        this._overlays.classList.add('romper-overlays');

        this._buttons = document.createElement('div');
        this._buttons.classList.add('romper-buttons');

        this._guiLayer.appendChild(this._overlays);
        this._guiLayer.appendChild(this._buttons);

        this._playPauseButton = document.createElement('button');
        this._playPauseButton.classList.add('romper-button');
        this._playPauseButton.classList.add('romper-play-button');
        this._playPauseButton.onclick = this.emit
            .bind(this, PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED);
        this._buttons.appendChild(this._playPauseButton);

        this._backButton = document.createElement('button');
        this._backButton.classList.add('romper-button');
        this._backButton.classList.add('romper-back-button');
        this._backButton.onclick = this.emit
            .bind(this, PlayerEvents.BACK_BUTTON_CLICKED);
        this._buttons.appendChild(this._backButton);

        this._nextButton = document.createElement('button');
        this._nextButton.classList.add('romper-button');
        this._nextButton.classList.add('romper-next-button');
        this._nextButton.onclick = this.emit
            .bind(this, PlayerEvents.NEXT_BUTTON_CLICKED);
        this._buttons.appendChild(this._nextButton);

        // Create the overlays.
        this._volume = createOverlay('volume');
        this._overlays.appendChild(this._volume.overlay);
        this._buttons.appendChild(this._volume.button);

        this._representation = createOverlay('representation');
        this._overlays.appendChild(this._representation.overlay);
        this._buttons.appendChild(this._representation.button);

        this._icon = createOverlay('icon');
        this._overlays.appendChild(this._icon.overlay);
        this._buttons.appendChild(this._icon.button);

        this._fullscreenButton = document.createElement('button');
        this._fullscreenButton.classList.add('romper-button');
        this._fullscreenButton.classList.add('romper-fullscreen-button');
        this._fullscreenButton.onclick = this.emit
            .bind(this, PlayerEvents.FULLSCREEN_BUTTON_CLICKED);
        this._buttons.appendChild(this._fullscreenButton);

        target.appendChild(this._player);

        // Expose the layers for external manipulation if needed.
        this.guiTarget = this._guiLayer;
        this.mediaTarget = this._mediaLayer;
        this.backgroundTarget = this._backgroundLayer;
    }

    addVolumeControl(id: string, label: string) {
        const volumeControl = document.createElement('div');
        volumeControl.classList.add('romper-volume-control');

        const volumeLabel = document.createElement('div');
        volumeLabel.classList.add('romper-volume-label');
        volumeLabel.textContent = label;

        const volumeRange = document.createElement('input');
        volumeRange.type = 'range';
        volumeRange.min = '0';
        volumeRange.step = '0.01';
        volumeRange.max = '1';
        volumeRange.defaultValue = '1';
        volumeRange.classList.add('romper-volume-range');
        volumeRange.onchange = (event) => {
            const value = parseFloat(event.target.value);
            this.emit(PlayerEvents.VOLUME_CHANGED, { id, value });
        };

        volumeControl.appendChild(volumeLabel);
        volumeControl.appendChild(volumeRange);

        this._volume.add(id, volumeControl);
    }

    removeVolumeControl(id: string) {
        this._volume.remove(id);
    }

    addRepresentationControl(id: string, label: string) {
        const representationControl = document.createElement('div');
        representationControl.classList.add('romper-representation-control');

        const representationIcon = document.createElement('img');
        representationIcon.src = label;
        representationIcon.classList.add('romper-representation-icon');
        representationIcon.onclick = () => {
            this.emit(PlayerEvents.REPRESENTATION_CLICKED, { id });
        };

        representationControl.appendChild(representationIcon);

        this._representation.add(id, representationControl);
    }

    activateRepresentationControl(id: string) {
        const representationControl = this._representation.get(id);
        if (representationControl) {
            const icon = representationControl.children[0];
            icon.classList.remove('romper-disabled');
        }
    }

    deactivateRepresentationControl(id: string) {
        const representationControl = this._representation.get(id);
        if (representationControl) {
            const icon = representationControl.children[0];
            icon.classList.add('romper-disabled');
        }
    }

    removeRepresentationControl(id: string) {
        this._representation.remove(id);
    }

    addIconControl(id: string, src: string, selected: boolean) {
        const iconControl = document.createElement('div');
        iconControl.classList.add('romper-icon-control');

        const icon = document.createElement('img');
        icon.src = src;
        icon.classList.add('romper-icon');
        if (selected) {
            icon.classList.add('romper-selected');
        }
        icon.onclick = () => {
            this.emit(PlayerEvents.ICON_CLICKED, { id });
        };

        iconControl.appendChild(icon);

        this._icon.add(id, iconControl);
    }

    setIconControl(id: string, src: string, selected: boolean) {
        const iconControl = this._icon.get(id);

        if (iconControl) {
            const icon = iconControl.children[0];
            if (selected) {
                icon.classList.add('romper-selected');
            } else {
                icon.classList.remove('romper-selected');
            }
            icon.src = src;
        }
    }

    removeIconControl(id: string) {
        this._icon.remove(id);
    }

    setPlaying(isPlaying: boolean) {
        if (isPlaying) {
            this._playPauseButton.classList.add('romper-pause-button');
            this._playPauseButton.classList.remove('romper-play-button');
        } else {
            this._playPauseButton.classList.add('romper-play-button');
            this._playPauseButton.classList.remove('romper-pause-button');
        }
    }

    // setFullscreen(isFullscreen: boolean) {
    //     if (isFullscreen) {
    //         this._fullscreenButton.classList.add('romper-exit-fullscreen-button');
    //         this._fullscreenButton.classList.remove('romper-fullscreen-button');
    //     } else {
    //         this._fullscreenButton.classList.add('romper-fullscreen-button');
    //         this._fullscreenButton.classList.remove('romper-exit-fullscreen-button');
    //     }
    // }

    setNextAvailable(isNextAvailable: boolean) {
        if (isNextAvailable) {
            this._nextButton.classList.remove('romper-inactive');
        } else {
            this._nextButton.classList.add('romper-inactive');
        }
    }

    setBackAvailable(isBackAvailable: boolean) {
        if (isBackAvailable) {
            this._backButton.classList.remove('romper-inactive');
        } else {
            this._backButton.classList.add('romper-inactive');
        }
    }
}


export default Player;
export { PlayerEvents };
