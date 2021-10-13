import AnalyticEvents from './AnalyticEvents';

const { v4: uuidv4 } = require('uuid');

export default class AnalyticsHandler {
    constructor(analytics, controller) {
        this._analytics = analytics;
        this._controller = controller;
        this.userid = uuidv4();

        this._segmentSummaryData = {
            timing: {},
            eventcounts: [],
        };
        this._lastpausedTime = Date.now();
        this._lastHideTime = Date.now();
        this._paused = false;
    }

    // handles an event by taking an Object with attributes
    //  - type
    //  - name
    //  - from
    //  - to
    //  - data (Object)
    handleAnalyticsEvent(logData) {
        const appendedPayload = this._enhanceAnalytics(logData);
        this._handleSegmentSummaries(appendedPayload);
        this._analytics(appendedPayload);
    }

    // takes the log data and returns an object
    // which is the log data supplemented with the playhead time
    static _addPlayheadTime(renderer, logData) {
        if (renderer === undefined) return logData;
        const data = { ...logData.data }
        let playheadTime;
        if (renderer) {
            const timeData = renderer.getCurrentTime();
            if (timeData) playheadTime = timeData.currentTime;
        }
        data.playheadTime = playheadTime;
        return {
            ...logData,
            data,
        };
    }

    // add user id, current NE and Representation ids
    _enhanceAnalytics(logData) {
        let repId = logData.current_representation;
        const renderer = this._controller.getCurrentRenderer();
        const timedData = AnalyticsHandler._addPlayheadTime(renderer, logData);
        if (repId === undefined && renderer && renderer.getRepresentation()){
            repId = renderer.getRepresentation().id;
        }
        let neId = logData.current_narrative_element;
        if (neId === undefined) {
            neId = this._controller.getCurrentNarrativeElement() ?
                this._controller.getCurrentNarrativeElement().id : 'null';
        }
        const appendedData = {
            ...timedData,
            current_narrative_element: neId,
            current_representation: repId,
            userid: this.userid,
            timestamp: new Date(),
        };

        // if we've not yet noted it, get the duration of the element
        if (renderer && this._segmentSummaryData.timing.defaultDuration === null) {
            this._segmentSummaryData.timing.defaultDuration = renderer.getDuration();
        }
        return appendedData;
    }

    // override automatically generated uuid, perhaps with one from saved state
    setUserId(uuid) {
        this.userid = uuid;
    }
     
    _sumpausedTime() {
        const pausedTime = Date.now() - this._lastpausedTime;
        const totalPausedTime = this._segmentSummaryData.timing.pausedTime + pausedTime;
        this._segmentSummaryData.timing.pausedTime = totalPausedTime;
    }

    _sumHiddenTime() {
        const hiddenTime = Date.now() - this._lastHideTime;
        const totalHiddenTime = this._segmentSummaryData.timing.hiddenTime + hiddenTime;
        this._segmentSummaryData.timing.hiddenTime = totalHiddenTime;
    }

    // log events that happen within the lifetime of a NarrativeElement so we can 
    // store a single analytics event with some summary data
    _handleSegmentSummaries(appendedData) {
        // count number of each user event type
        if (appendedData.type === AnalyticEvents.types.USER_ACTION) {
            const { eventcounts } = this._segmentSummaryData;
            const match = eventcounts.find(e => e.event === appendedData.name);
            if (match) {
                match.count += 1;
            } else {
                eventcounts.push({
                    event: appendedData.name,
                    count: 1,
                });
            }
        }

        // log play/pause time (pause time does not include time when browser 
        // is not visible)
        if (appendedData.name === AnalyticEvents.names.VIDEO_PAUSE) {
            this._lastpausedTime = Date.now();
            this._paused = true;
        }
        if (appendedData.name === AnalyticEvents.names.VIDEO_UNPAUSE) {
            this._paused = false;
            this._sumpausedTime();
        }

        // log time browser is visible/hidden (according to browser's 
        // visibilitychange event)
        if (appendedData.name === AnalyticEvents.names.BROWSER_VISIBILITY_CHANGE
            && appendedData.to === 'hidden') {
            this._lastHideTime = Date.now();
            // stop pause time and accrue what has accumulated already
            if (this._paused) {
                this._sumpausedTime();
            }
        } else if (appendedData.name === AnalyticEvents.names.BROWSER_VISIBILITY_CHANGE) {
            // restart pause time if appropriate
            if (this._paused) {
                this._lastpausedTime = Date.now();
            }
            this._sumHiddenTime();
        }

        // starting experience: log start time and first ne
        if (appendedData.name === AnalyticEvents.names.START_BUTTON_CLICKED) {
            this._resetSegmentData();
        }

        // reached NE end - save data
        if (appendedData.name === AnalyticEvents.names.NARRATIVE_ELEMENT_CHANGE
            || appendedData.name === AnalyticEvents.names.STORY_END) {
            this._saveSummaryData(appendedData);
        }

    }

    _resetSegmentData() {
        this._segmentSummaryData = {
            timing: {
                startTime: Date.now(),
                pausedTime: 0,
                hiddenTime: 0,
                defaultDuration: null,
            },
            eventcounts: [],
        };
        this._lastpausedTime = Date.now();
        this._lastHideTime = Date.now();
        this._paused = false;
    }

    _saveSummaryData(appendedData) {
        const { startTime, pausedTime, hiddenTime } = this._segmentSummaryData.timing;
        const duration = Date.now() - startTime;
        this._segmentSummaryData.timing.duration = duration;
        this._segmentSummaryData.timing.playingTime = duration - pausedTime - hiddenTime;
        this._segmentSummaryData.timing.visibleTime = duration - hiddenTime;

        if (!this._segmentSummaryData.chapter) {
            this._segmentSummaryData.chapter = appendedData.from;
        }
        const summaryData = {
            type: AnalyticEvents.types.SEGMENT_COMPLETION,
            name: appendedData.name,
            from: appendedData.from,
            to: appendedData.to,
            data: this._segmentSummaryData,
            userid: this.userid,
            timestamp: new Date().toISOString(),
            current_narrative_element: appendedData.current_narrative_element,
            current_representation: appendedData.current_representation,
        };
        if (summaryData.current_representation) {
            this._analytics(summaryData);
        }

        this._resetSegmentData();
        this._segmentSummaryData.chapter = appendedData.to;
    }

}