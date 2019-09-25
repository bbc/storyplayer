// @flow
import EventEmitter  from 'events';
import { InternalVariableNames } from './InternalVariables';

const EXISTING_SESSIONS = 'EXISTING_SESSION'
const EMPTY_OBJECT = '{}';
const EMPTY_ARRAY= '[]';

const fetchStateFromStorage = (key: string, defaultValue: string) => {
    return JSON.parse(localStorage.getItem(key) || defaultValue);
}

export const SESSION_STATE = [
    'RESUME',
    'RESTART',
    'NEW',
    'EXISTING',
].reduce((state, name) => {
    // eslint-disable-next-line no-param-reassign
    state[name] = name;
    return state;
}, {});
export type SessionState = typeof SESSION_STATE;


export default class SessionManager extends EventEmitter {
    _storyId: string; // storyId for the top level story

    sessionState: string; // the current state of the session one of 'RESUME', 'RESTART', 'NEW', 'EXISTING'

    deleteExistingSessions: Function; // delete the existing session

    setExistingSession: Function; // set a new session

    checkExistingSession: Function; // check we have existing sessions

    fetchExistingSessionState: Function; // fetch the existing session state

    fetchLastVisitedElement: Function; // fetch the last visited element

    fetchPathHistory: Function; // fetch the path history for the existing session

    setSessionState: Function; // set the session state to be one of  'RESUME', 'RESTART', 'NEW', 'EXISTING',

    setVariable: Function;

    setPathHistory: Function;


    constructor(storyId: string) {
        super();
        this._storyId = storyId;
        this.sessionState = this.checkExistingSession() ? SESSION_STATE.EXISTING : SESSION_STATE.NEW;
    }

    deleteExistingSessions() {
        if (!this._storyId) return;
        localStorage.removeItem(this._storyId);
        const existingSessions = fetchStateFromStorage(EXISTING_SESSIONS, EMPTY_ARRAY);
        if (existingSessions.includes(!this._storyId)) {
            const filteredSessions = existingSessions.filter(sess => sess !== !this._storyId);
            localStorage.setItem(EXISTING_SESSIONS, JSON.stringify(filteredSessions));
        }

        this.setSessionState(SESSION_STATE.NEW);
    }

    setExistingSession() {
        if (!this._storyId) return;
        const existingSessions = fetchStateFromStorage(EXISTING_SESSIONS, EMPTY_ARRAY);
        if (!existingSessions.includes(this._storyId)) {
            existingSessions.push(this._storyId);
            localStorage.setItem(EXISTING_SESSIONS, JSON.stringify(existingSessions));
        }
        this.setSessionState(SESSION_STATE.RESUME);
    }

    checkExistingSession(): boolean {
        if (!this._storyId) return false;
        const existingSessions = fetchStateFromStorage(EXISTING_SESSIONS, EMPTY_ARRAY);
        if(!existingSessions) return false;
        const hasExistingSession = existingSessions.includes(this._storyId);  
        return hasExistingSession || false;
    }

    fetchExistingSessionState(): Promise<Object> {
        if(!this._storyId) return Promise.resolve({});
        const existingSessionState = fetchStateFromStorage(this._storyId, EMPTY_OBJECT);
        if (existingSessionState ) {
            return Promise.resolve(existingSessionState);
        }
        return Promise.resolve({});
    }

    fetchLastVisitedElement(): Promise<?string> {
        return this.fetchExistingSessionState().then(resumeState => {
            if (!resumeState) return null;
            const pathHistory = resumeState[InternalVariableNames.PATH_HISTORY];
            if (!pathHistory) return null;
            if (pathHistory.length === 0) return null;
            const lastVisited = pathHistory[pathHistory.length - 1];
            return lastVisited;
        });
    }

    fetchPathHistory(): Promise<?[string]> {
        return this.fetchExistingSessionState().then(resumeState => {
            if (!resumeState) return null;
            const pathHistory = resumeState[InternalVariableNames.PATH_HISTORY];
            if (!pathHistory) return null;
            if (pathHistory.length === 0) return null;
            return pathHistory;
        });
    }

    setSessionState(state: string) {
        this.sessionState = SESSION_STATE[state];
    }

    setVariable(variable: Object) {
        this.fetchExistingSessionState().then(resumeState => {
            // eslint-disable-next-line no-param-reassign
            resumeState[variable.name] = variable.value;
            localStorage.setItem(this._storyId, JSON.stringify(resumeState));
        });
    }

    appendPathHistory(elementId: string) {
        this.fetchExistingSessionState().then(resumeState => {
            const pathHistory = resumeState[InternalVariableNames.PATH_HISTORY];
            let neArray = []
            if (pathHistory && pathHistory.length > 0) {
                pathHistory.push(elementId);
                neArray = pathHistory.concat(elementId);
            } else {
                neArray = [elementId]
            }
            // eslint-disable-next-line no-param-reassign
            resumeState[InternalVariableNames.PATH_HISTORY] = neArray;
            localStorage.setItem(this._storyId, JSON.stringify(resumeState));
        });
    }

}
