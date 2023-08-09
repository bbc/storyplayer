/**
 * Returns an instance of MediaResolver which resolves over the media uri passed in.
 * MediaFetcher just passes through uri with no cleverness.
 *
 * @param {Object} the parameters affecting the type of media returned
 * @return {Function} A resolver which returns data from the passed in object
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function (params?: Record<string, any>) {

    /**
     * Converts a uri to a playable piece of media.
     *
     * @param {string} the uri of the media to be resolved
     * @return {Promise.<any>} A promise which resolves to the requested variable,
     *         or null if the variable does not exist
     */
    return (uri: string): Promise<any> =>
        new Promise((resolve, reject) => {
            if (uri) {
                resolve({ url: uri })
            } else {
                reject(new Error("Invalid URI"))
            }
        })
}
