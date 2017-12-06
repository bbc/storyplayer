// @flow
import BaseRenderer from './BaseRenderer';
import type { Representation, AssetCollectionFetcher } from '../romper';
import RendererFactory from './RendererFactory';

export default class SwitchableRenderer extends BaseRenderer {
    _choiceRenderers: Array<?BaseRenderer>;
    _choiceDiv: HTMLDivElement;
    _currentRenderer: number;

    constructor(
        representation: Representation,
        assetCollectionFetcher: AssetCollectionFetcher,
        target: HTMLElement,
    ) {
        super(representation, assetCollectionFetcher, target);

        this._choiceDiv = document.createElement('div');
        this._choiceDiv.id = 'subrenderer';
        this._choiceRenderers = this.getChoiceRenderers();
        this._currentRenderer = 0;
    }

    getChoiceRenderers() {
        if (this._representation.choices) {
            return this._representation.choices.map(choice =>
                RendererFactory(
                    choice.representation,
                    this._fetchAssetCollection,
                    this._choiceDiv,
                ));
        }
        return [];
    }

    renderSwitchButtons() {
        let i = 0;
        if (this._representation.choices) {
            this._representation.choices.forEach((choice) => {
                const index = i;
                const switchButton = document.createElement('button');
                switchButton.innerHTML = choice.label;
                switchButton.addEventListener('click', () => {
                    this.switch(index);
                });
                this._target.appendChild(switchButton);
                i += 1;
            });
        }
    }

    switch(choiceIndex: number) {
        // this._choiceDiv.innerHTML = '';
        if (choiceIndex >= 0 && choiceIndex < this._choiceRenderers.length) {
            const currentChoice = this._choiceRenderers[this._currentRenderer];
            if (currentChoice) currentChoice.destroy();

            this._currentRenderer = choiceIndex;
            const newChoice = this._choiceRenderers[this._currentRenderer];
            if (newChoice) newChoice.start();
        }
    }

    start() {
        this._target.appendChild(this._choiceDiv);
        this.renderSwitchButtons();

        // start subrenderer for first choice
        const firstChoice = this._choiceRenderers[this._currentRenderer];
        if (firstChoice) {
            firstChoice.start();
        }

        this.renderNextButton();
    }

    renderNextButton() {
        // render next button
        const buttonDiv = document.createElement('div');
        const button = document.createElement('button');
        button.innerHTML = 'Next';
        button.addEventListener('click', () => {
            this.emit('complete');
        });
        buttonDiv.appendChild(button);
        this._target.appendChild(buttonDiv);
    }

    renderDataModelInfo() {
        // next just displays info for debug
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
    }

    destroy() {
        while (this._target.lastChild) {
            this._target.removeChild(this._target.lastChild);
        }
    }
}
