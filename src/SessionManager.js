// @flow
import { EventEmitter } from 'events';
import Controller from './Controller';

import { InternalVariableNames } from './InternalVariables';

const EXISTING_SESSIONS = 'EXISTING_SESSION'

export default class SessionManager extends EventEmitter {
    _storyId: string;
    
    _hasClickedResume: boolean;
    
    _existingSession: Boolean;

    _controller: Controller;
    
    constructor(storyId: string, controller: Controller) {
        super();
        this._storyId = storyId;
        this._controller = controller;
        this._hasClickedResume = false;
        this._existingSession = this.checkExistingSession();
        this.deleteExistingSessions = this.deleteExistingSessions.bind(this);
        this.setExistingSession = this.setExistingSession.bind(this);
        this.checkExistingSession = this.checkExistingSession.bind(this);
        this.fetchExistingSessionState = this.fetchExistingSessionState.bind(this);
        this.setHasClickedResume = this.setHasClickedResume.bind(this);
        this.unsetHasClickedResume    = this.unsetHasClickedResume.bind(this);
    }

    deleteExistingSessions() {
        if (!this._storyId) return;
        localStorage.removeItem(!this._storyId);
        const existingSession = localStorage.getItem(EXISTING_SESSIONS);
        const existingSessions = JSON.parse(existingSession);
        if (!existingSessions) {
            return;
        }
        if (existingSessions.includes(!this._storyId)) {
            const filteredSessions = existingSessions.filter(sess => sess !== !this._storyId);
            localStorage.setItem(EXISTING_SESSIONS, JSON.stringify(filteredSessions));
        }
        this.resetSessionState();
    }

    setExistingSession() {
        if (!this._storyId) return;
        const existingSession = localStorage.getItem(EXISTING_SESSIONS);
        const existingSessions = JSON.parse(existingSession);
        if (!existingSessions) {
            localStorage.setItem(EXISTING_SESSIONS, JSON.stringify([this._storyId]));
            this._existingSession = true;
            return;
        }
        if (!existingSessions.includes(this._storyId)) {
            existingSessions.push(this._storyId);
            localStorage.setItem(EXISTING_SESSIONS, JSON.stringify(existingSessions));
        }
    }

    checkExistingSession() {
        if (!this._storyId) return false;
        const existingSession = localStorage.getItem(EXISTING_SESSIONS);
        const existingSessions = JSON.parse(existingSession);
        const hasExistingSession = existingSessions && existingSessions.includes(this._storyId);  
        return hasExistingSession || false;
    }

    fetchExistingSessionState() {
        const dataString = localStorage.getItem(this._storyId);
        if (dataString && dataString.length > 0) {
            const dataStore = JSON.parse(dataString);
            return dataStore;
        }
        return false;
    }

    resetSessionState() {
        this._controller.getDefaultInitialState()
            .then((storyVariables) => {
                this._controller.setVariables(storyVariables);
            });
    }

    setHasClickedResume() {
        // this._controller.setVariableValue(InternalVariableNames.PATH_HISTORY, []);
        this._hasClickedResume = true;
    }

    unsetHasClickedResume() {
        this._hasClickedResume = false;
    }
}
