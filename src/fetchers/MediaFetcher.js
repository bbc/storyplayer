// @flow

/**
 * Returns an instance of MediaResolver which resolves over the media uri passed in.
 * MediaFetcher just passes through uri with no cleverness.
 *
 * @param {Object} the parameters affecting the type of media returned
 * @return {Function} A resolver which returns data from the passed in object
 */

export default function (params: Object) { // eslint-disable-line no-unused-vars
    /**
     * Converts a uri to a playable piece of media.
         *
     * @param {string} the uri of the media to be resolved
     * @return {Promise.<any>} A promise which resolves to the requested variable, or null if the variable does not exist
     */
    return function (uri: string): Promise<any> {
        return new Promise((resolve, reject) => {
            if (uri) {
                resolve(uri);
            } else {
                reject(uri);
            }
        });
    };
}
