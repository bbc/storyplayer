// @flow
import EventEmitter  from 'events';
import Controller from './Controller';
import { InternalVariableNames } from './InternalVariables';

const EXISTING_SESSIONS = 'EXISTING_SESSION'

export default class SessionManager extends EventEmitter {
    _storyId: string;
    
    _hasClickedResume: boolean;
    
    _existingSession: boolean;

    _controller: Controller;
    
    constructor(storyId?: string, controller: Controller) {
        super();
        this._storyId = storyId;
        this._controller = controller;
        this._hasClickedResume = false;
        this._existingSession = this.checkExistingSession();
    }

    deleteExistingSessions() {
        if (!this._storyId) return;
        localStorage.removeItem(this._storyId);
        const existingSessionString = localStorage.getItem(EXISTING_SESSIONS) || '[]';
        const existingSession = JSON.parse(existingSessionString);
        if (existingSession.includes(!this._storyId)) {
            const filteredSessions = existingSession.filter(sess => sess !== !this._storyId);
            localStorage.setItem(EXISTING_SESSIONS, JSON.stringify(filteredSessions));
        }
        this.resetSessionState();
    }

    setExistingSession() {
        if (!this._storyId) return;
        const existingSession = localStorage.getItem(EXISTING_SESSIONS) || '[]';
        const existingSessions = JSON.parse(existingSession);
        if (!existingSessions.includes(this._storyId)) {
            existingSessions.push(this._storyId);
            localStorage.setItem(EXISTING_SESSIONS, JSON.stringify(existingSessions));
        }
        this._existingSession = true;
    }

    checkExistingSession() {
        if (!this._storyId) return false;
        const existingSession = localStorage.getItem(EXISTING_SESSIONS);
        if(!existingSession) return false;
        const existingSessions = JSON.parse(existingSession);
        const hasExistingSession = existingSessions.includes(this._storyId);  
        return hasExistingSession || false;
    }

    fetchExistingSessionState() {
        if(!this._storyId) return false;
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

    fetchLastVisitedElement() {
        const resumeState = this.fetchExistingSessionState();
        if(!resumeState) return null;
        const pathHistory = resumeState[InternalVariableNames.PATH_HISTORY];
        if(pathHistory.length === 0) return null;
        return pathHistory[pathHistory.length -1];
    }

    setHasClickedResume() {
        this._hasClickedResume = true;
    }

    unsetHasClickedResume() {
        this._hasClickedResume = false;
    }
}
