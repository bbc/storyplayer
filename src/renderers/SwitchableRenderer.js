import BaseRenderer from './BaseRenderer';

export default class SwitchableRenderer extends BaseRenderer {

    _i;

    start() {

        this._target.innerHTML = `<p>${this._representation.name}</p><p>Options:</p><ul>`;
        const switchlist = document.createElement('ul');
        this._target.appendChild(switchlist);
        const iconData = document.createElement('p');
        iconData.textContent = 'icon: ';
        this._target.appendChild(iconData);

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

        if(this._representation.asset_collection.icon){
            this._fetchAssetCollection(this._representation.asset_collection.icon)
                .then(icon => {
                    iconData.textContent += `${icon.name}`;
                });
        } else {
            console.log("no icon");
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
