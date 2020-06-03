
/**
 * Returns an instance of MediaSelectorMediaFetcher which resolves over the media uri passed in.
 *
 * @param {Object} the parameters affecting the type of media returned
 * @return {Function} A resolver which returns data from the passed in object
 */

const mediaResolver = () => {
    // eslint-disable-line no-unused-vars
    /**
     * Converts a uri to a playable piece of media.
     *
     * @param {string} the uri of the media to be resolved
     * @return {Promise.<any>} A promise which resolves to the requested variable, or null if the
     *         variable does not exist
     */
    return (uri) =>
        new Promise((resolve, reject) => {
            if (uri) {
                if (uri.indexOf('https://www.dropbox.com/') >= 0) {
                    resolve(
                        uri.replace(
                            'https://www.dropbox.com/',
                            'https://dl.dropboxusercontent.com/'
                        )
                    );
                } else {
                    resolve(uri);
                }
            } else {
                reject(new Error('No URI provided'));
            }
        });
};

module.exports= { mediaResolver };
