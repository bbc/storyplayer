// @flow
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollection, AssetCollectionFetcher } from '../romper';
import RendererFactory from './RendererFactory';

export default class SwitchableRenderer extends BaseRenderer {

    _choiceRenderers: Array<?BaseRenderer>;
    _choiceDiv: HTMLDivElement;

    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        target: HTMLElement,
    ) {
        super(representation, assetCollectionFetcher, target);

        this._choiceDiv = document.createElement('div');
        this._choiceDiv.id = 'subrenderer';
        this._choiceRenderers = this.getChoiceRenderers();
    }

    getChoiceRenderers() {
        if (this._representation.choices) {
            return this._representation.choices.map((choice) => {
                // create Renderer
                return RendererFactory(
                    choice.representation,
                    this._fetchAssetCollection,
                    this._choiceDiv
                )
            });
        }
        return [];
    }

    start() {
        this._target.appendChild(this._choiceDiv);
        // start subrenderer for first choice
        this._choiceRenderers[0].start();

        const para = document.createElement('p');
        para.textContent = this._representation.name;
        const optPara = document.createElement('p');
        optPara.textContent = 'Options';
        this._target.appendChild(para);
        this._target.appendChild(optPara);

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
