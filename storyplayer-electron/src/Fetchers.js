


export const storyFetcher = id => Promise.resolve(config.stories.filter(storyObject => storyObject.id === id)[0]);

export const representationCollectionFetcher = id => Promise.resolve(
    config.representation_collections.filter(presentationObject => presentationObject.id === id)[0]
).then(presentationObject => (presentationObject || Promise.reject(`no such presentation object: ${id}`)));
const assetCollectionFetcher = id => Promise.resolve(
    config.asset_collections.filter(assetCollectionObject => assetCollectionObject.id === id)[0]
).then(assetCollectionObject => assetCollectionObject || Promise.reject(`no such asset collection: ${id}`));
const representationFetcher = id => Promise.resolve(
    config.representations.filter(representationObject => representationObject.id === id)[0]
).then(representationObject => representationObject || Promise.reject(`no such representation: ${id}`));
const narrativeElementFetcher = id => Promise.resolve(
    config.narrative_elements.filter(narrativeElementObject => narrativeElementObject.id === id)[0]
).then(narrativeElementObject => narrativeElementObject || Promise.reject(`no such narrative element: ${id}`));
const subStoryFetcher = id => Promise.resolve(config.stories.find(s => s.narrative_elements.includes(id))[0]).then(storyObject => storyObject || Promise.reject('no story for narrative element'));