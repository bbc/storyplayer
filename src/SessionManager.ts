import EventEmitter from "eventemitter3"
import {InternalVariableNames} from "./InternalVariables"
const EXISTING_SESSIONS = "EXISTING_SESSION"
const EMPTY_OBJECT = "{}"
const EMPTY_ARRAY = "[]"
export const fetchStateFromStorage = (key: string, defaultValue: string) => {
    return JSON.parse(localStorage.getItem(key) || defaultValue)
}
export const SESSION_STATE: Record<string, string> = ["RESUME", "RESTART", "NEW", "EXISTING"].reduce(
    (state, name) => {
        // eslint-disable-next-line no-param-reassign
        state[name] = name
        return state
    },
    {},
)
export type SessionState = typeof SESSION_STATE
export default class SessionManager extends EventEmitter {
    _storyId: string // storyId for the top level story

    sessionState: string // current state of the session 'RESUME'/'RESTART'/'NEW'/'EXISTING'

    constructor(storyId: string) {
        super()
        this._storyId = storyId
        this.sessionState = this.checkExistingSession()
            ? SESSION_STATE.EXISTING
            : SESSION_STATE.NEW
    }

    static deleteExistingSession(storyId: string) {
        if (!storyId) return
        localStorage.removeItem(storyId)
        const existingSessions = fetchStateFromStorage(
            EXISTING_SESSIONS,
            EMPTY_ARRAY,
        )

        if (existingSessions.includes(storyId)) {
            const filteredSessions = existingSessions.filter(
                sess => sess !== storyId,
            )
            localStorage.setItem(
                EXISTING_SESSIONS,
                JSON.stringify(filteredSessions),
            )
        }
    }

    clearExistingSession() {
        if (!this._storyId) return
        this.fetchUserId().then(userid => {
            if (userid) {
                // clear all but userid
                const blankState = {
                    userid,
                }
                localStorage.setItem(this._storyId, JSON.stringify(blankState))
            } else {
                // clear the lot
                SessionManager.deleteExistingSession(this._storyId)
            }
        })
    }

    setExistingSession() {
        if (!this._storyId) return
        const existingSessions = fetchStateFromStorage(
            EXISTING_SESSIONS,
            EMPTY_ARRAY,
        )

        if (!existingSessions.includes(this._storyId)) {
            existingSessions.push(this._storyId)
            localStorage.setItem(
                EXISTING_SESSIONS,
                JSON.stringify(existingSessions),
            )
        }

        this.setSessionState(SESSION_STATE.RESUME)
    }

    checkExistingSession(): boolean {
        if (!this._storyId) return false
        const existingSessions = fetchStateFromStorage(
            EXISTING_SESSIONS,
            EMPTY_ARRAY,
        )
        if (!existingSessions) return false
        const hasExistingSession = existingSessions.includes(this._storyId)
        return hasExistingSession || false
    }

    fetchExistingSessionState(): Promise<Record<string, any>> {
        if (!this._storyId) return Promise.resolve({})
        const existingSessionState = fetchStateFromStorage(
            this._storyId,
            EMPTY_OBJECT,
        )

        if (existingSessionState) {
            return Promise.resolve(existingSessionState)
        }

        return Promise.resolve({})
    }

    fetchLastVisitedElement(): Promise<string | null | undefined> {
        return this.fetchExistingSessionState().then(resumeState => {
            if (!resumeState) return null
            const pathHistory = resumeState[InternalVariableNames.PATH_HISTORY]
            if (!pathHistory) return null
            if (pathHistory.length === 0) return null
            const lastVisited = pathHistory[pathHistory.length - 1]
            return lastVisited
        })
    }

    fetchPathHistory(): Promise<[string] | null | undefined> {
        return this.fetchExistingSessionState().then(resumeState => {
            if (!resumeState) return null
            const pathHistory = resumeState[InternalVariableNames.PATH_HISTORY]
            if (!pathHistory) return null
            if (pathHistory.length === 0) return null
            return pathHistory
        })
    }

    fetchUserId(): Promise<[string] | null | undefined> {
        return this.fetchExistingSessionState().then(resumeState => {
            if (!resumeState) return null
            return resumeState.userid
        })
    }

    setUserId(userid: string) {
        this.fetchExistingSessionState().then(resumeState => {
            // eslint-disable-next-line no-param-reassign
            resumeState.userid = userid
            localStorage.setItem(this._storyId, JSON.stringify(resumeState))
        })
    }

    setSessionState(state: string) {
        this.sessionState = SESSION_STATE[state]
    }

    setVariable(variable: Record<string, any>) {
        this.fetchExistingSessionState().then(resumeState => {
            // only update when there is a change
            if (resumeState[variable.name] !== variable.value) {
                // eslint-disable-next-line no-param-reassign
                resumeState[variable.name] = variable.value
            }

            localStorage.setItem(this._storyId, JSON.stringify(resumeState))
        })
    }

    appendPathHistory(elementId: string) {
        this.fetchExistingSessionState().then(resumeState => {
            const pathHistory = resumeState[InternalVariableNames.PATH_HISTORY]
            let neArray = []

            if (pathHistory && pathHistory.length > 0) {
                pathHistory.push(elementId)
                neArray = pathHistory.concat(elementId)
            } else {
                neArray = [elementId]
            }

            // eslint-disable-next-line no-param-reassign
            resumeState[InternalVariableNames.PATH_HISTORY] = neArray
            localStorage.setItem(this._storyId, JSON.stringify(resumeState))
        })
    }

    setDefaultState(variables: Record<string, any>) {
        this.fetchExistingSessionState().then(resumeState => {
            Object.keys(variables).forEach(varName => {
                // only update when there is a change
                if (resumeState[varName] !== variables[varName]) {
                    // eslint-disable-next-line no-param-reassign
                    resumeState[varName] = variables[varName]
                }
            })
            localStorage.setItem(this._storyId, JSON.stringify(resumeState))
        })
    }
}
