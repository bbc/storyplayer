import Romper from '../../src/romper'
import './plugin.scss'

const SmpPlugin = (() => {
    let playerInterface;
    let pluginUtils;
    const smpPlugin = function constructor() {
        return this;
    };
    smpPlugin.prototype = {
        // eslint-disable-next-line object-shorthand
        pluginInitialisation: function pluginInitialisation(utils) {
            const plug = this;
            playerInterface = utils.playerInterface;
            pluginUtils = utils;
            pluginUtils.loadCSS(playerInterface.datastore.get("cssInclude"));

            const json = playerInterface.datastore.get("storyJsonUrl")
            plug.go(json);

            // XXX how do we get the plugin reference into romper?
            // XXX currently creating window.playerInterface...
            window.playerInterface = playerInterface;

        },
        go (json) {
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
                        mediaFetcher: uri => Promise.resolve(uri)
                            .then(resolvedUri => (resolvedUri || Promise.reject(new Error('cannot resolve uri')))),
                        representationCollectionFetcher: id => Promise.resolve(
                            config.representation_collections
                                .filter(presentationObject => presentationObject.id === id)[0]
                        ).then(presentationObject => (presentationObject || Promise.reject(new Error(`no such presentation object: ${  id}`)))),
                        assetCollectionFetcher: id => Promise.resolve(
                            config.asset_collections
                                .filter(assetCollectionObject => assetCollectionObject.id === id)[0]
                        ).then(assetCollectionObject => (assetCollectionObject || Promise.reject(new Error(`no such asset collection: ${  id}`)))),
                        representationFetcher: id => Promise.resolve(
                            config.representations
                                .filter(representationObject => representationObject.id === id)[0]
                        ).then(representationObject => (representationObject || Promise.reject(new Error(`no such representation: ${  id}`)))),
                        narrativeElementFetcher: id => Promise.resolve(
                            config.narrative_elements
                                .filter(narrativeElementObject => narrativeElementObject.id === id)[0]
                        ).then(narrativeElementObject => (narrativeElementObject || Promise.reject(new Error(`no such narrative element: ${  id}`)))),
                        subStoryFetcher: id => Promise.resolve(
                            config.stories
                                .find(s => s.narrative_elements.includes(id))[0]
                        // eslint-disable-next-line no-unneeded-ternary
                        ).then(storyObject => (storyObject ? storyObject : Promise.reject(new Error('no story for narrative element')))),
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

window.runPlugin = () => {
    return new SmpPlugin();
};
