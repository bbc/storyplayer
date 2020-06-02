// @flow

import type { DataResolver } from './romper';
import logger from './logger';

export const InternalVariableNames = {
    DAY_OF_WEEK: '_day_of_week',
    PORTION_OF_DAY: '_portion_of_day',
    PATH_HISTORY: '_path_history',
    LONGITUDE: '_location_longitude',
    LATITUDE: '_location_latitude',
    RANDOM: '_random_number',
};

const TimeWindowNames = {
    MORNING: 'Morning',
    AFTERNOON: 'Afternoon',
    EVENING: 'Evening'
};

const weekday = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
];

export default class InternalVariables {
    _dataResolver: DataResolver;

    _requirements: Object;

    constructor(dataResolver: DataResolver, storyMeta: ?Object) {
        this._dataResolver = dataResolver;
        if (storyMeta
            && storyMeta.romper
            && storyMeta.romper.data_requirements) {
            this._requirements = storyMeta.romper.data_requirements;
        } else {
            this._requirements = {};
        }
    }

    setAllVariables() {
        this._setTodaysDay();
        this._setSegmentOfDay();
        if (this._requirements.location) {
            this._setLocation();
        }
    }

    /**
     * Store or change a variable for the reasoner to use while reasoning
     *
     * @param {String} name The name of the variable to set
     * @param {any} value Its value
     */
    _setVariableValue(name: string, value: any) {
        logger.info(`Setting internal variable '${name}' to ${JSON.stringify(value)}`);
        this._dataResolver.set(name, value);
    }

    // sets the value of this variable to be a string for today's day of the week
    _setTodaysDay() {
        this._setVariableValue(InternalVariableNames.DAY_OF_WEEK, weekday[new Date().getDay()]);
    }

    // sets the value of this variable to be a string for today's time of day
    _setSegmentOfDay() {
        const hourNow = new Date().getHours();
        let segmentName;
        if (hourNow < 12) {
            segmentName = TimeWindowNames.MORNING;
        } else if (hourNow < 17) {
            segmentName = TimeWindowNames.MORNING;
        } else {
            segmentName = TimeWindowNames.EVENING;
        }
        this._setVariableValue(InternalVariableNames.PORTION_OF_DAY, segmentName);
    }

    // eslint-disable-next-line class-methods-use-this
    _setLocation() {
        logger.info('GeoLocation has been disabled');
    }

    setQueryParameterVariables(storyVars: Object){
        const varName = new URLSearchParams(window.location.search).get('varName');
        const varVal = new URLSearchParams(window.location.search).get('varVal');
        if (!(varName && varVal)) {
            logger.info(`Query Parameter variable failed - need name and value`);
            return;
        }
        // variable must be defined in story or as internal var
        let isValid = false;
        if (storyVars[varName]) {
            isValid = this._validateExternalVariable(varName, varVal, storyVars[varName])
        } else if (Object.values(InternalVariableNames).includes(varName)) {
            isValid = this._validateInternalVariable(varName, varVal);
        } else {
            logger.info(`Query Parameter variable failed - invalid variable name`);
            return;            
        }

        if (isValid) {
            logger.info(`Query Parameter variable: setting ${varName} to ${varVal}`);
            const typedValue = this._parseExternalVariable(varVal, storyVars[varName]);
            this._setVariableValue(varName, typedValue);
        } else {
            // eslint-disable-next-line max-len
            logger.info(`Query Parameter variable failed: ${varVal} is invalid value for ${varName}`);
        }
    }

    // eslint-disable-next-line class-methods-use-this
    _validateExternalVariable(varName: string, varVal: string, varDef: Object): boolean {
        const varType = varDef.variable_type;
        let isValidType = false;
        switch(varType) {
        case('boolean'):
            isValidType = (varVal === 'true' || varVal === 'false');
            break;
        case('number'):
            {
                const numVal = parseFloat(varVal);
                if (isNaN(numVal) || numVal === null) { // eslint-disable-line no-restricted-globals
                    isValidType = false;
                } else {
                    isValidType = (numVal > varDef.range.min_val 
                        && numVal < varDef.range.max_val);
                }
            }
            break;
        case('list'):
            isValidType = varDef.values.includes(varVal);
            break;
        default:
            break;
        }
        return isValidType;
    }

    // eslint-disable-next-line class-methods-use-this
    _parseExternalVariable(varVal: string, varDef: Object): any {
        const varType = varDef.variable_type;
        switch(varType) {
        case('boolean'):
            return varVal === 'true';
        case('number'):
            return parseFloat(varVal);
        default:
            return varVal;
        }
    }

    // only support setting date/time (can help debugging)
    // eslint-disable-next-line class-methods-use-this
    _validateInternalVariable(varName: string, varVal: string): boolean {
        return (
            (varName === InternalVariableNames.DAY_OF_WEEK && weekday.includes(varVal))
            || (varName === InternalVariableNames.PORTION_OF_DAY && TimeWindowNames.includes(varVal)) // eslint-disable-line max-len
        );
    }
}
