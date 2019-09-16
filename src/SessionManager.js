// @flow
import EventEmitter  from 'events';
import Controller from './Controller';
import { InternalVariableNames } from './InternalVariables';

const EXISTING_SESSIONS = 'EXISTING_SESSION'
const EMPTY_OBJECT = '{}';
const EMPTY_ARRAY= '[]';

const fetchStateFromStorage = (key: string, defaultValue: string) => {
    return JSON.parse(localStorage.getItem(key) || defaultValue);
}


const SESSION_STATE = {
    RESUME: 'RESUME',
    RESTART: 'RESTART',
    NEW: 'NEW',
    EXISTING: 'EXISTING',
};

export default class SessionManager extends EventEmitter {
    _storyId: string;
    
    _existingSession: boolean;

    _controller: Controller;

    sessionState: string;
    
    constructor(storyId?: string, controller: Controller) {
        super();
        this._storyId = storyId;
        this._controller = controller;
        this._existingSession = this.checkExistingSession();
        this.sessionState = this._existingSession ? SESSION_STATE.EXISTING : SESSION_STATE.NEW;
    }

    deleteExistingSessions() {
        if (!this._storyId) return;
        localStorage.removeItem(this._storyId);
        const existingSessions = fetchStateFromStorage(EXISTING_SESSIONS, EMPTY_ARRAY);
        if (existingSessions.includes(!this._storyId)) {
            const filteredSessions = existingSessions.filter(sess => sess !== !this._storyId);
            localStorage.setItem(EXISTING_SESSIONS, JSON.stringify(filteredSessions));
        }
        this._existingSession = false;
        this.resetSessionState();
    }

    setExistingSession() {
        if (!this._storyId) return;
        const existingSessions = fetchStateFromStorage(EXISTING_SESSIONS, EMPTY_ARRAY);
        if (!existingSessions.includes(this._storyId)) {
            existingSessions.push(this._storyId);
            localStorage.setItem(EXISTING_SESSIONS, JSON.stringify(existingSessions));
        }
        this._existingSession = true;
    }

    checkExistingSession() {
        if (!this._storyId) return false;
        const existingSessions = fetchStateFromStorage(EXISTING_SESSIONS, EMPTY_ARRAY);
        if(!existingSessions) return false;
        const hasExistingSession = existingSessions.includes(this._storyId);  
        return hasExistingSession || false;
    }

    fetchExistingSessionState() {
        if(!this._storyId) return {};
        const existingSessionState = fetchStateFromStorage(this._storyId, EMPTY_OBJECT);
        if (existingSessionState ) {
            return existingSessionState;
        }
        return {};
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

    setSessionState(state: string) {
        this.sessionState = SESSION_STATE[state];
    }
}
