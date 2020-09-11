import AnalyticEvents from './AnalyticEvents';

const uuidv4 = require('uuid/v4');

export default class AnalyticsHandler {
    constructor(analytics, controller) {
        this._analytics = analytics;
        this._controller = controller;
        this.userid = uuidv4();

        this._segmentSummaryData = {};
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

    // add user id, current NE and Representation ids
    _enhanceAnalytics(logData) {
        let repId = logData.current_representation;
        const renderer = this._controller.getCurrentRenderer();
        if (repId === undefined && renderer && renderer.getRepresentation()){
            repId = renderer.getRepresentation().id;
        }
        let neId = logData.current_narrative_element;
        if (neId === undefined) {
            neId = this._controller.getCurrentNarrativeElement() ?
                this._controller.getCurrentNarrativeElement().id : 'null';
        }
        const appendedData = {
            ...logData,
            current_narrative_element: neId,
            current_representation: repId,
            userid: this.userid,
            timestamp: new Date().toISOString(),
        };

        // if we've not yet noted it, get the duration of the element
        if (renderer && this._segmentSummaryData.defaultDuration === null) {
            this._segmentSummaryData.defaultDuration = renderer.getDuration();
        }
        return appendedData;
    }

    // override automatically generated uuid, perhaps with one from saved state
    setUserId(uuid) {
        this.userid = uuid;
    }
     
    _sumpausedTime() {
        const pausedTime = Date.now() - this._lastpausedTime;
        const totalPausedTime = this._segmentSummaryData.pausedTime + pausedTime;
        this._segmentSummaryData.pausedTime = totalPausedTime;
    }

    _sumHiddenTime() {
        const hiddenTime = Date.now() - this._lastHideTime;
        const totalHiddenTime = this._segmentSummaryData.hiddenTime + hiddenTime;
        this._segmentSummaryData.hiddenTime = totalHiddenTime;
    }

    // log events that happen within the lifetime of a NarrativeElement so we can 
    // store a single analytics event with some summary data
    _handleSegmentSummaries(appendedData) {
        // count number of each user event type
        if (appendedData.type === AnalyticEvents.types.USER_ACTION) {
            if (this._segmentSummaryData.hasOwnProperty(appendedData.name)) {
                this._segmentSummaryData[appendedData.name] += 1;
            } else {
                this._segmentSummaryData[appendedData.name] = 1;
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
            startTime: Date.now(),
            pausedTime: 0,
            hiddenTime: 0,
            defaultDuration: null,
        };
        this._lastpausedTime = Date.now();
        this._lastHideTime = Date.now();
        this._paused = false;
    }

    _saveSummaryData(appendedData) {
        const { startTime, pausedTime, hiddenTime } = this._segmentSummaryData;
        const duration = Date.now() - startTime;
        this._segmentSummaryData.duration = duration;
        this._segmentSummaryData.playingTime = duration - pausedTime - hiddenTime;
        this._segmentSummaryData.visibleTime = duration - hiddenTime;

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