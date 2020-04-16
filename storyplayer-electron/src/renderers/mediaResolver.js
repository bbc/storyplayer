
/**
 * Returns an instance of MediaSelectorMediaFetcher which resolves over the media uri passed in.
 *
 * @param {Object} the parameters affecting the type of media returned
 * @return {Function} A resolver which returns data from the passed in object
 */

let msResponseId = 0;

const isAudioVideoMedia = (packageType) =>
    (packageType === 'av' || packageType === 'audio' || packageType === 'video');


const checkDashOrHls = (mediaFormat) => {
    return mediaFormat === 'hls' || mediaFormat === 'dash';
}

const VIDEO = 'video';

const defaultOptions = {
    mediaType:  VIDEO,
    mediaFormat: '',
};


const _getOptions = (suppliedOptions) => {
    if(suppliedOptions && Object.keys(suppliedOptions).length > 0) {
        const options = {...defaultOptions, ...suppliedOptions};
        return options;
    }
    return defaultOptions;
}

const mediaResolver = () => {
    // eslint-disable-line no-unused-vars
    /**
     * Converts a uri to a playable piece of media.
     *
     * @param {string} the uri of the media to be resolved
     * @return {Promise.<any>} A promise which resolves to the requested variable, or null if the
     *         variable does not exist
     */
    return (uri, suppliedOptions) =>
        new Promise((resolve, reject) => {
            if (uri) {

                const options = _getOptions(suppliedOptions);
                if (uri.indexOf('bbc.co.uk/mediaselector') > -1) {
                    let testEnv = false
                    if (uri.indexOf('test.bbc.co.uk') > -1) {
                        testEnv = true
                    }
                    // eslint-disable-next-line no-plusplus
                    const jsonpCallback = `ms_response_${msResponseId++}`;
                    const script = document.createElement('script');
                    // eslint-disable-next-line camelcase
                    window[jsonpCallback] = ms_response => {
                        // eslint-disable-next-line camelcase
                        if (!ms_response) {
                            // eslint-disable-line camelcase
                            return reject(
                                new Error('MSMF: rejected promise No Reponse')
                            );
                        }

                        // if we're passed something weird reject it
                        if(options.mediaType === VIDEO && options.mediaFormat && !checkDashOrHls(options.mediaFormat)) {
                            return reject(new Error('Could not find a valid format'));
                        }


                        const debugPlayout = new URLSearchParams(window.location.search).get('debugPlayout');

                        // Populate URL list
                        const urls = [];
                        if(debugPlayout) {
                            console.log('ms_response', ms_response)
                        }
                        // eslint-disable-next-line camelcase
                        if(!ms_response) {
                            return reject(
                                new Error('MSMF: rejected promise No Reponse')
                            );
                        }
                        ms_response.media.forEach(mediaItem => {
                            if (mediaItem.kind === options.mediaType) {
                                mediaItem.connection.forEach(connection => {
                                    if (
                                        connection.transferFormat === options.mediaFormat &&
                                        (!testEnv || connection.supplier.indexOf("akamai") > -1)
                                    ) {
                                        urls.push({
                                            url: connection.href,
                                            priority: connection.priority,
                                            dpw: connection.dpw || '',
                                        });
                                    }
                                });
                            }
                        });

                        if(debugPlayout) {
                            console.log('ms_response', ms_response)
                            console.log(`Resolving ${uri} and found: ${JSON.stringify(urls)}` )
                        }

                        // Sort URL list with lowest priority values at beginning of array
                        const comparePriorities = (a, b) => {
                            const aPri = parseInt(a.priority, 10);
                            const bPri = parseInt(b.priority, 10);
                            if (aPri < bPri) {
                                return -1;
                            }
                            if (aPri > bPri) {
                                return 1;
                            }
                            return 0;
                        };
                        urls.sort(comparePriorities);

                        // The following handles the dpw load balancing as described on confluence
                        // eslint-disable-next-line max-len

                        // Generate number between 0-99
                        const rand = Math.floor(Math.random() * 100);
                        let totalDpw = 0;
                        let foundDpwValue = false;
                        let chosenUrlIndex = -1;

                        // dpw details what percentage of requests should go through a url. We pick
                        // a number between 0 and 99 and find which dpw this lands in and bring
                        // that url to the top of the list.
                        // I.e. if we have a url with dpw of 60% (covers 0-59) then a url with dpw
                        // of 40% (covers 60-99) in our list then if we get a random number of 64,
                        // the url with dpw of 40% will be brought to the start of the url list.
                        // This results in 60% of requests going to the url with dpw of 60% and 40%
                        // to dpw of 40% (assuming rand is a perfect number generator)
                        // The code gets a bit complicated as dpw can be implied based on order in
                        // list and dpw of element before it
                        urls.forEach((urlObj, urlIndex) => {
                            if (urlObj.dpw !== '') {
                                foundDpwValue = true;
                                totalDpw += parseInt(urlObj.dpw, 10);
                                if (rand < totalDpw) {
                                    chosenUrlIndex = urlIndex;
                                    return true;
                                }
                            } else if (foundDpwValue === true) {
                                // Assume dpw of this url is 100-totalDpw so our rand number must
                                // fall in this dpw.
                                chosenUrlIndex = urlIndex;
                                return true;
                            }
                            // Keep going until we get an index or run out of urls.
                            return false;
                        });

                        // Bring chosen URL to front of array
                        if (chosenUrlIndex !== -1) {
                            if(debugPlayout) {
                                console.log(`Resolving ${uri} and chose: ${JSON.stringify(urls[chosenUrlIndex])}` )
                            }
                            const removedUrl = urls.splice(
                                chosenUrlIndex,
                                1
                            )[0];
                            urls.unshift(removedUrl);
                        }

                        if(debugPlayout) {
                            console.log(`Resolving ${uri} and list is: ${JSON.stringify(urls)}` )
                        }

                        // Hacky Recursive Promise. Promise goes through each URL in the list
                        // provided and makes a HEAD request to the URL. If the HEAD request returns
                        // HTTP 200 then promise resolves with URL. If not then it tries the next
                        // URL in the list by calling this promise function again.
                        const recPromise = (testUrls, index) =>
                            Promise.resolve(true).then(() => {
                                if (
                                    testUrls === undefined ||
                                    index === undefined
                                ) {
                                    return Promise.reject(
                                        new Error(
                                            'mediaSelectorMediaFetcher: ' +
                                            'rejected promise - invalid parameters passed to recPromise'
                                        )
                                    );
                                }
                                if (testUrls.length - 1 < index) {
                                    return Promise.reject(
                                        new Error(
                                            'mediaSelectorMediaFetcher: ' +
                                            'rejected promise - no valid URLs found for media'
                                        )
                                    );
                                }

                                return fetch(testUrls[index].url, { method: 'HEAD' })
                                    .then(response => {
                                        if (response.status === 200) {
                                            // Resolve with URL
                                            return Promise.resolve(
                                                testUrls[index].url
                                            );
                                        }
                                        // Try next URL in list
                                        return recPromise(testUrls, index + 1);
                                    })
                                    .catch(() =>
                                        // Catches errors with request-promise and tries next URL
                                        recPromise(testUrls, index + 1));
                            });

                        if (urls.length > 0) {
                            return resolve(recPromise(urls, 0));
                        }

                        return reject(
                            new Error(
                                'mediaSelectorMediaFetcher: ' +
                                'rejected promise - No Url found for media'
                            )
                        );
                    };

                    script.src = `${uri}/jsfunc/${jsonpCallback}`;
                    // $FlowFixMe;
                    document.body.appendChild(script);
                } else if (uri.indexOf('x-ipstudio:') === 0) {
                    // Old urn format
                    const packageId = uri.split(':')[2];
                    resolve(`/manifests/${packageId}.mpd`);
                } else if (uri.indexOf('urn:x-ipstudio:') === 0) {
                    const packageType = uri.split(':')[3];
                    const packageId = uri.split(':')[4];
                    if (isAudioVideoMedia(packageType)) {
                        resolve(`/manifests/${packageId}.mpd`);
                    } else {
                        resolve(`/media/${packageId}`);
                    }
                } else if (uri.indexOf('https://www.dropbox.com/') >= 0) {
                    resolve(
                        uri.replace(
                            'https://www.dropbox.com/',
                            'https://dl.dropboxusercontent.com/'
                        )
                    );
                } else {
                    resolve(uri);
                }
            }
        });
};

module.exports= { mediaResolver };
