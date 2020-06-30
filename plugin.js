/* eslint-disable no-shadow */
/* eslint-disable object-shorthand */
/* eslint-disable no-unneeded-ternary */
/* eslint-disable prefer-template */
/* eslint-disable no-console */
/* eslint-disable prefer-promise-reject-errors */
/* eslint-disable prefer-const */
/* eslint-disable no-confusing-arrow */
/* eslint-disable global-require */
/* eslint-disable func-names */
/* eslint-disable no-var */
var smpPlugin = (function () {
    var playerInterface;
    var pluginUtils;
    var smpPlugin = function () {
        return this;
    };
    smpPlugin.prototype = {
        // eslint-disable-next-line object-shorthand
        pluginInitialisation: function (utils) {
            var plug = this;
            playerInterface = utils.playerInterface;
            window.playerInterface = playerInterface;
            pluginUtils = utils;
            pluginUtils.loadCSS('dist/romper.css');

            require.config({
                paths: {
                    "romper": pluginUtils.relativeUrl('dist/romper')
                }
            });
            // eslint-disable-next-line import/no-dynamic-require
            require(["romper"], function (romper) {
                var json = playerInterface.datastore.get("STORY.json") || '3209a7a8-771d-466c-a9bb-8b7866373501.json';
                plug.go(romper, json);
            });


            // XXX how do we get the plugin reference into romper?
            // XXX currently creating window.playerInterface...
            window.playerInterface = playerInterface;

        },
        go: function (Romper, json) {
            // XXX this should of course come from the plugin data.
            fetch(pluginUtils.relativeUrl(json))
                .then((response) => {
                    if (response.ok) {
                        return Promise.resolve(response.text());
                    }
                    return Promise.reject(response);
                })
                .then((text) => {
                    const config = JSON.parse(text);

                    const romper = Romper.init({
                        target: playerInterface.container,
                        staticImageBaseUrl: 'src/assets/images/',
                        analyticsLogger: dataObj => {
                            console.log('ANALYTICS:', dataObj);
                        },
                        storyFetcher: id => Promise.resolve().then(
                            () => config.stories.filter(storyObject => storyObject.id === id)[0]
                        ),
                        mediaFetcher: uri => Promise.resolve(uri).then(resolvedUri => (resolvedUri || Promise.reject('cannot resolve uri'))),
                        representationCollectionFetcher: id => Promise.resolve(
                            config.representation_collections
                                .filter(presentationObject => presentationObject.id === id)[0]
                        ).then(presentationObject => presentationObject ? presentationObject : Promise.reject('no such presentation object: ' + id)),
                        assetCollectionFetcher: id => Promise.resolve(
                            config.asset_collections
                                .filter(assetCollectionObject => assetCollectionObject.id === id)[0]
                        ).then(assetCollectionObject => assetCollectionObject ? assetCollectionObject : Promise.reject('no such asset collection: ' + id)),
                        representationFetcher: id => Promise.resolve(
                            config.representations
                                .filter(representationObject => representationObject.id === id)[0]
                        ).then(representationObject => representationObject ? representationObject : Promise.reject('no such representation: ' + id)),
                        narrativeElementFetcher: id => Promise.resolve(
                            config.narrative_elements
                                .filter(narrativeElementObject => narrativeElementObject.id === id)[0]
                        ).then(narrativeElementObject => narrativeElementObject ? narrativeElementObject : Promise.reject('no such narrative element: ' + id)),
                        subStoryFetcher: id => Promise.resolve(
                            config.stories
                                .find(s => s.narrative_elements.includes(id))[0]
                        // eslint-disable-next-line no-unneeded-ternary
                        ).then(storyObject => storyObject ? storyObject : Promise.reject('no story for narrative element')),
                    });

                    romper.start(config.stories[0].id);
                })
                .catch((rejection) => {
                    // eslint-disable-next-line max-len
                    console.log(`could not fetch story content: ${rejection}`);
                    console.log(`could not fetch story content: ${rejection.status} ${rejection.statusText}`);
                });
        }
    };

    return smpPlugin;
})();

var runPlugin = function (utils) {
    return new smpPlugin();
};
