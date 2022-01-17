import EventEmitter from 'events';

import { PlayerEvents } from './Player';
import RendererEvents from '../renderers/RendererEvents';

export default class Api extends EventEmitter {

    /*
    'SCRUB_BAR_MOUSE_DOWN', // ignore
    'SCRUB_BAR_CHANGED', // ignore
    'SCRUB_BAR_MOUSE_UP', // ignore
    'ERROR_SKIP_BUTTON_CLICKED', // ignore
    'FULLSCREEN_BUTTON_CLICKED', // ignore

    'VOLUME_CHANGED',
    'AUDIO_MIX_CHANGED',
    'VOLUME_MUTE_TOGGLE',

    'ICON_CLICKED', // representation id - chapter icons
    'REPRESENTATION_CLICKED', // representation id - switchables
    'BACK_BUTTON_CLICKED',
    'REPEAT_BUTTON_CLICKED', // complex!
    'NEXT_BUTTON_CLICKED',
    'PLAY_PAUSE_BUTTON_CLICKED',
    'SEEK_FORWARD_BUTTON_CLICKED', Player emit(PlayerEvents.SEEK_FORWARD_BUTTON_CLICKED))
    'SEEK_BACKWARD_BUTTON_CLICKED',
    'LINK_CHOSEN', // id: narrativeElementId, behaviourId

    'SUBTITLES_BUTTON_CLICKED',

    start button click => Player _startButtonHandler
    restartButton => Player restartButtonHandler
    resumeButton => Player resumeExperienceButtonHandler

    overlays:
        map - neid
        social share?
        linkout ?

    */
    constructor (player, controller) {
        super();
        this._player = player;
        this._controller = controller;
        
        // TODO: also need to log to analytics

        // handle incoming events from ui here:

        // complex events where need event name and some data
        this._controller.on(PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED, (e) => this._player.emit(PlayerEvents.PLAY_PAUSE_BUTTON_CLICKED, e));
        this._controller.on(PlayerEvents.LINK_CHOSEN, (e) => this._player.emit(PlayerEvents.LINK_CHOSEN, e));
        this._controller.on(PlayerEvents.ICON_CLICKED, (e) => this._player.emit(PlayerEvents.ICON_CLICKED, e));
        this._controller.on(PlayerEvents.REPRESENTATION_CLICKED, (e) => this._player.emit(PlayerEvents.REPRESENTATION_CLICKED, e));
        this._controller.on(PlayerEvents.SCRUB_BAR_CHANGED, (e) => this._player._currentRenderer.setCurrentTime(e.seekTime))

        // simple events where just need right event name
        this._controller.on(PlayerEvents.BACK_BUTTON_CLICKED, () => this._player._controls.emit(PlayerEvents.BACK_BUTTON_CLICKED));
        this._controller.on(PlayerEvents.NEXT_BUTTON_CLICKED, () => this._player.emit(PlayerEvents.NEXT_BUTTON_CLICKED));
        this._controller.on(PlayerEvents.SEEK_FORWARD_BUTTON_CLICKED, () => this._player.emit(PlayerEvents.SEEK_FORWARD_BUTTON_CLICKED));
        this._controller.on(PlayerEvents.SEEK_BACKWARD_BUTTON_CLICKED, () => this._player.emit(PlayerEvents.SEEK_BACKWARD_BUTTON_CLICKED));
        this._controller.on(PlayerEvents.START_BUTTON_CLICKED, this._player._startButtonHandler);

        // outgoing events, to render ui
        this._player.on(RendererEvents.UI_RENDER, (e) => this._controller.emit(RendererEvents.UI_RENDER, e));
    }

}