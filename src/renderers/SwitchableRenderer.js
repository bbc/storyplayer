// @flow
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollection, AssetCollectionFetcher } from '../romper';
import SimpleAVRenderer from './SimpleAVRenderer';
import ImageRenderer from './ImageRenderer';

export default class SwitchableRenderer extends BaseRenderer {

    _choiceRenderers: Array<?BaseRenderer>;

    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        target: HTMLElement,
    ) {
        super(representation, assetCollectionFetcher, target);
        this._choiceRenderers = [];

        if (this._representation.choices) {
            this._representation.choices.forEach((choice) => {
                let SubRenderer = this.getRenderer(choice.representation.representation_type);
                // create Renderer
                this._choiceRenderers.push(
                    new SubRenderer(
                        choice.representation,
                        assetCollectionFetcher,
                        document.createElement('div')
                    )
                );
            }
            );
        }
    }


    getRenderer(representationType: string) {
        const RENDERERS = {
            'urn:x-object-based-media:representation-types:image/v1.0': ImageRenderer,
            'urn:x-object-based-media:representation-types:simple-av/v1.0': SimpleAVRenderer,
            'urn:x-object-based-media:representation-types:switchable/v1.0': SwitchableRenderer,
        };
        return RENDERERS[representationType];
    }

    start() {
        this._target.innerHTML = `<p>${this._representation.name}</p><p>Options:</p><ul>`;
        const switchlist = document.createElement('ul');
        this._target.appendChild(switchlist);
        const iconData = document.createElement('p');
        iconData.textContent = 'icon: ';
        this._target.appendChild(iconData);

        if (this._representation.choices) {
            this._representation.choices.forEach((choice) => {
                const choiceLabel = choice.label;
                let choiceRepresentationDetail = '';
                if (choice.representation) {
                    choiceRepresentationDetail = choice.representation.name;
                }
                const switchitem = document.createElement('li');
                switchitem.textContent = `${choiceLabel}: ${choiceRepresentationDetail}`;
                switchlist.appendChild(switchitem);
            });
        }

        if (this._representation.asset_collection.icon) {
            this._fetchAssetCollection(this._representation.asset_collection.icon).then((icon) => {
                iconData.textContent += `${icon.name}`;
                if (icon.assets.image_src) {
                    iconData.textContent += ` from ${icon.assets.image_src}`;
                }
            });
        } else {
            iconData.textContent += 'none';
        }

        const button = document.createElement('button');
        button.innerHTML = 'Next';
        button.addEventListener('click', () => {
            this.emit('complete');
        });
        this._target.appendChild(button);
    }

    destroy() {
        while (this._target.lastChild) {
            this._target.removeChild(this._target.lastChild);
        }
    }
}
