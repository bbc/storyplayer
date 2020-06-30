// @flow
/* eslint-disable class-methods-use-this */
/* eslint-disable no-unused-vars */
import Player from '../Player';
import { checkAddDetailsOverride } from '../utils';
import logger from '../logger';
import { MediaFormats } from '../browserCapabilities'
import { PLAYOUT_ENGINES } from './playoutEngineConsts'
import BasePlayoutEngine, { MEDIA_TYPES } from './BasePlayoutEngine';
import DOMSwitchPlayoutEngine from './DOMSwitchPlayoutEngine';
import IOSPlayoutEngine from './iOSPlayoutEngine';

export default class SMPPlayoutEngine extends BasePlayoutEngine {
    _backgroundAudioPlayout: BasePlayoutEngine

    constructor(player: Player, debugPlayout: boolean) {
        super(player, debugPlayout);

        const playoutToUse = MediaFormats.getPlayoutEngine();

        logger.info('SMP: Using backup playout engine: ', playoutToUse);

        switch (playoutToUse) {
        case PLAYOUT_ENGINES.DOM_SWITCH_PLAYOUT:
            // Use shiny source switching engine.... smooth.
            this._backgroundAudioPlayout = new DOMSwitchPlayoutEngine(this, debugPlayout);
            break;
        case PLAYOUT_ENGINES.IOS_PLAYOUT:
            // Refactored iOS playout engine
            this._backgroundAudioPlayout = new IOSPlayoutEngine(this, debugPlayout);
            break;
        default:
            logger.fatal('Invalid Playout Engine');
            throw new Error('Invalid Playout Engine');
        }
    }

    setPermissionToPlay(value: boolean) {

    }

    queuePlayout(rendererId: string, mediaObj: Object) {

    }

    unqueuePlayout(rendererId: string) {

    }

    setPlayoutVisible(rendererId: string) {

    }

    getPlayoutActive(rendererId: string): boolean {

    }

    setPlayoutActive(rendererId: string) {

    }

    setPlayoutInactive(rendererId: string) {

    }

    play() {

    }

    pause() {

    }

    isPlaying(): boolean {
    }

    hasStarted(): boolean {

    }

    pauseBackgrounds() {

    }

    playBackgrounds() {

    }

    getCurrentTime(rendererId: string) {

    }

    getDuration(rendererId: string) {

    }

    setCurrentTime(rendererId: string, time: number) {

    }


    on(rendererId: string, event: string, callback: Function) {

    }

    off(rendererId: string, event: string, callback: Function) {

    }

    getMediaElement(rendererId: string): ?HTMLMediaElement {

    }

    setLoopAttribute(rendererId: string, loop: ?boolean, element: ?HTMLMediaElement) {

    }

    removeLoopAttribute(rendererId: string) {

    }

    checkIsLooping(rendererId: string) {

    }
}
