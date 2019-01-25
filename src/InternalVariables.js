// @flow

import type { DataResolver } from './romper';
import logger from './logger';

export const InternalVariableNames = {
    DAY_OF_WEEK: '_day_of_week',
    PORTION_OF_DAY: '_portion_of_day',
    PATH_HISTORY: '_romper_path_history',
    LOCATION: '_location',
};

export default class InternalVariables {
    _dataResolver: DataResolver;

    constructor(dataResolver: DataResolver) {
        this._dataResolver = dataResolver;
    }

    setAllVariables() {
        this._setTodaysDay();
        this._setSegmentOfDay();
    }

    /**
     * Store or change a variable for the reasoner to use while reasoning
     *
     * @param {String} name The name of the variable to set
     * @param {any} value Its value
     */
    setVariableValue(name: string, value: any) {
        logger.info(`Setting variable '${name}' to ${JSON.stringify(value)}`);
        this._dataResolver.set(name, value);
    }

    // sets the value of this variable to be a string for today's day of the week
    _setTodaysDay() {
        const weekday = [
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
        ];
        this.setVariableValue(InternalVariableNames.DAY_OF_WEEK, weekday[new Date().getDay()]);
    }

    // sets the value of this variable to be a string for today's time of day
    _setSegmentOfDay() {
        const hourNow = new Date().getHours();
        let segmentName;
        if (hourNow < 12) {
            segmentName = 'Morning';
        } else if (hourNow < 17) {
            segmentName = 'Afternoon';
        } else {
            segmentName = 'Evening';
        }
        this.setVariableValue(InternalVariableNames.PORTION_OF_DAY, segmentName);
    }
}
