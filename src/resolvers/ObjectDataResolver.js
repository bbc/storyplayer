// @flow

import type { DataResolver } from '../romper';

/**
 * Returns an instance of DataResolver which resolves over the data object passed in
 *
 * @param {Object} data The data object constaining data
 * @return {Function} A resolver which returns data from the passed in object
 */
export default function (data: Object): DataResolver {
    /**
     * 
     * @param {string} name Name of variable
     * @param {value} value Value of variable
     * Saves the variable in local storage
     */
    const saveToStorage = (name: string, value: any) => {
        let dataStore = {};
        const dataString = localStorage.getItem('DATA_STORE');
        if(dataString && dataString.length > 0) {
            dataStore = JSON.parse(dataString);
        }
        dataStore[name] = value;
        localStorage.setItem('DATA_STORE', JSON.stringify(dataStore));
    }

    const saveAllToStorage = () => {
        localStorage.setItem('DATA_STORE', JSON.stringify(data));
    }

    /**
     * Fetches a piece of data from the pre-configured dictionary
     *
     * @param {string} name The name of the variable to be resolved, in the form of dot nations
     *        (e.g., "foo.bar")
     * @return {Promise.<any>} A promise which resolves to the requested variable, or null if the
     *        variable does not exist
     */
    const get = (name: string): Promise<any> => Promise.resolve((name.split('.'): any)
        .reduce((obj, key) => ((obj !== null && key in obj) ? obj[key] : null), data));

    /**
     * Fetches a piece of data from the pre-configured dictionary
     *
     * @param {string} name The name of the variable to be stored and its value
     */
    const set = (name: string, value: any) => {
        // eslint-disable-next-line no-param-reassign
        data[name] = value;
    };

    return { get, set, saveToStorage, saveAllToStorage };
}
