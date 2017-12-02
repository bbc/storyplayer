import BaseRenderer from './BaseRenderer';

export default class SwitchableRenderer extends BaseRenderer {

    _switchOptions;
    _i;

    start() {

        this._target.innerHTML = `<p>${this._representation.name}</p><ul>`;
        const switchlist = document.createElement('ul');
        this._target.appendChild(switchlist);

        if(this._representation.asset_collection.choices){
            // console.log(this._representation.asset_collection.choices);
            for(this._i = 0; this._i < this._representation.asset_collection.choices.length; this._i++){
                this._fetchAssetCollection(this._representation.asset_collection.choices[this._i].id)
                    .then(fg => {
                        const switchitem = document.createElement('li');
                        switchitem.textContent = fg.name;
                        switchlist.appendChild(switchitem);
                        // switchlist.innerHTML += `<li>${fg.name}</li>`; 
                    });
            }
        }

        const button = document.createElement('button');
        button.innerHTML = 'Next';
        console.log('adding click listener');
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
