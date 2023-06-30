import Romper from '../src/storyplayer';
import JSONEditor from 'jsoneditor';

window.addEventListener('resize', resizeWindow);

let romperInstance;
let loadedStoryJson;

function resizeWindow() {
}

// load demo stories
const stories = [
    'demo1.json',
    'demo2.json',
    'demo3.json',
    'demo2b.json',
    'demo4.json',
    "demo-form.json",
];

const promises = []
stories.forEach(storyFilename => promises.push(fetchFile(`./examples/${storyFilename}`)));
Promise.all(promises).then((texts) => {
    const divs = [];
    texts.forEach((text, i) => {
        const storyjson = JSON.parse(text);
        const name = storyjson.stories[0].name;
        const description = storyjson.stories[0].description;
        divs.push(addStoryOption(`./examples/${stories[i]}`, name, description));
    });
    divs.sort( function ( a, b ) {
        return (a.id < b.id) ? -1 : (a.id > b.id) ? 1 : 0;
    }).forEach( function ( elem ) {
        document.getElementById('choices').appendChild(elem);
    });
}).catch((rejection) => {
    console.warn('Could not load built-in demo file');
});

// return promise to fetch
function fetchFile(filename) {
    return fetch(filename)
    .then((response) => {
        if (response.ok) {
            return Promise.resolve(response.text());
        }
        return Promise.reject(response);
    })
//     .catch((rejection) => {
//         console.warn(`could not fetch story content for ${filename}: ${rejection.status} ${rejection.statusText}`);
//         return Promise.reject(rejection);
//     });
}

// render a story for user selection
function addStoryOption(filename, storyName, storyDescription) {
    const storyDiv = document.createElement('div');
    let id = storyName.replace(/ /g, '_');
    storyDiv.id = id.replace(/[^0-9a-zA-Z_]*/g, '_');
    const title = document.createElement('h3');
    title.textContent = storyName;
    const desc = document.createElement('p');
    desc.textContent = storyDescription;
    const selectButton = document.createElement('button');
    selectButton.onclick = () => loadStory(filename);
    selectButton.textContent = "Select";

    storyDiv.appendChild(title);
    storyDiv.appendChild(desc);
    storyDiv.appendChild(selectButton);
    return storyDiv;
}

// get a GET query parameter
function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

// load a story from file whose path supplied in query
const getFilename = `./examples/${getParameterByName('storyjson')}`;

if (getFilename) {
    fetchFile(getFilename).then((text) => {
        const storyjson = JSON.parse(text);
        const name = storyjson.stories[0].name;
        const description = storyjson.stories[0].description;
        document.getElementById('choices').appendChild(addStoryOption(getFilename, name, description));
    })
    .catch((rejection) => {
        console.warn(`could not load GET story content`);
    });
    // loadStory(getFilename);
    document.getElementById('chooser').classList.add('active');
    document.getElementById('choosetab').classList.add('active');

} else {
    document.getElementById('chooser').classList.add('active');
    document.getElementById('choosetab').classList.add('active');
}

// display a message to the user
function showMessage(messageText, error=false) {
    const messageDiv = document.getElementById('feedback');
    messageDiv.textContent = `${new Date().toLocaleTimeString()} - ${messageText}\r\n` + messageDiv.textContent;
    if (error) {
        messageDiv.classList.add('warning');
    } else {
        messageDiv.classList.remove('warning');
    }
}

// jsoneditor
const options = {
    mode: 'tree',
};
const jsonEditor = new JSONEditor(document.getElementById('json-view'), options);

// handle changing tabs
function openTab(evt, demoName) {

    // Get all elements with class="tabcontent" and hide them
    var tabcontent = document.getElementsByClassName("tabcontent");
    for (var i = 0; i < tabcontent.length; i++) {
        tabcontent[i].classList.remove('active');
    }

    // Get all elements with class="tablinks" and remove the class "active"
    var tablinks = document.getElementsByClassName("tablinks");
    for (var i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    // Show the current tab, and add an "active" class to the button that opened the tab
    document.getElementById(demoName).classList.add("active");
    evt.currentTarget.className += " active";

    if (evt.currentTarget.id === 'rendertab') {
        resizeWindow();
    }
}

// run edited json
function runEditedJson() {
    const storyJson = jsonEditor.get();
    try {
        run(storyJson);
        showMessage('Story loaded - view the renderer.');
    } catch (e) {
        showMessage('Could not run your json - see the console!');
        console.log(e);
    }
}

// run some json through romper
function run(config) {
    document.getElementById('romper-target').innerHTML = '';
    loadedStoryJson = config;
    document.getElementById('runjson').removeAttribute('disabled');
    document.getElementById('runjson').classList.add('active');
    document.getElementById('restart-button').classList.add('active');
    document.getElementById('restart-button').removeAttribute('disabled');
    document.getElementById('story-title').textContent = config.stories[0].name;
    jsonEditor.set(config);

    romperInstance = Romper.init({
        target: document.getElementById('romper-target'),
        staticImageBaseUrl: '/src/assets/images/',
        analyticsLogger: dataObj => {
            console.log('ANALYTICS:', dataObj);
        },
        storyFetcher: id => Promise.resolve().then(
            () => config.stories.filter(storyObject => storyObject.id === id)[0]
        ),
        mediaFetcher: uri => Promise.resolve(uri).then(resolvedUri => resolvedUri ? resolvedUri : Promise.reject('cannot resolve uri')),
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
    });

    romperInstance.start(config.stories[0].id, getVariablesState());
    // romperInstance.on(window.Romper.REASONER_EVENTS.ROMPER_STORY_STARTED, () => {
    //     addVariableControls(config.stories[0].id);
    // });
}

function restart() {
    showMessage('Story restarted');
    romperInstance.restart(loadedStoryJson.stories[0].id, getVariablesState());
    resizeWindow();
}

function addMeta(storyId) {
    const experienceIdMeta = document.querySelector('meta[name="experienceId"]');
    if(!experienceIdMeta ) {
        const meta = document.createElement('meta');
        meta.name = 'experienceId';
        meta.content = storyId;
        document.getElementsByTagName('head')[0].appendChild(meta);
    } else {
        experienceIdMeta.setAttribute("content", storyId);
    }
}

// fetch a story, load and run it
function loadStory(filepath) {
    showMessage(`Loading ${filepath}`);
    document.getElementById('romper-target').innerHTML = '';
    fetch(filepath)
        .then((response) => {
            if (response.ok) {
                return Promise.resolve(response.text());
            }
            return Promise.reject(response);
        })
        .then((text) => {
            showMessage('Story loaded');
            const storyJson = JSON.parse(text);
            addMeta(storyJson.stories[0].id);
            run(storyJson);
            if(document.getElementById('rendertab').classList.contains('active')) {
                resizeWindow();
            }
        })
        // .catch((rejection) => {
        //     showMessage(rejection);
        //     showMessage(`could not load story content: ${rejection.status} ${rejection.statusText}`, true);
        // });
};

function addVariableControls() {
    const varPanel = document.getElementById('variables-generic');
    romperInstance.getVariableState()
    .then((variableDeclaration) => {
        if (variableDeclaration === undefined || variableDeclaration === {}) {
            varPanel.innerHTML = 'There are no variables in this story';
            return;
        }

        varPanel.innerHTML = '';
        Object.keys(variableDeclaration).forEach((varName) => {
            addVariableSetter(varName, variableDeclaration[varName]);
        });
    });
}

// render a panel enabling the user to modify the value of a variable
function addVariableSetter(varName, variableDecl){
    const varType = variableDecl.variable_type;
    const varDesc = variableDecl.description;
    const parEl = document.createElement('p');
    const nameSpan = document.createElement('span');
    nameSpan.classList.add('slider-choice');
    nameSpan.textContent = varName;

    const descSpan = document.createElement('span');
    descSpan.classList.add('variable-description');
    descSpan.textContent = `(${varDesc})`;

    const sliderSpan = document.createElement('span');
    const label = document.createElement('label');
    label.classList.add('switch');

    let varInput;
    if (varType === 'boolean') {
        varInput = getBooleanVariableSwitch(varName, variableDecl);
    } else if (varType === 'integer') {
        varInput = getIntegerVariableSetter(varName, variableDecl);
    } else if (varType === 'number') {
        varInput = getIntegerVariableSetter(varName, variableDecl);
    } else if (varType === 'string') {
        varInput = getStringVariableSetter(varName, variableDecl);
    } else if (varType === 'list') {
        varInput = getListVariableSetter(varName, variableDecl);
    } else {
        console.warn(`Cannot adjust variable of type ${varType}`);
        return;
    }
    varInput.id = varName;
    varInput.classList.add('variable-input');

    label.appendChild(varInput);
    label.appendChild(sliderSpan);
    parEl.appendChild(label);
    parEl.appendChild(nameSpan);
    parEl.appendChild(descSpan);

    const varPanel = document.getElementById('variables-generic');
    varPanel.appendChild(parEl);
}

// an input for changing integer variables
function getIntegerVariableSetter(varName, variableDecl){
    const varInput = document.createElement('input');
    varInput.type = 'number';

    if (variableDecl.default_value) { varInput.value = variableDecl.default_value; }
    varInput.onchange = () => romperInstance.setVariableValue(varName, varInput.value);

    return varInput;
}

// an input for changing string variables
function getStringVariableSetter(varName, variableDecl){
    const varInput = document.createElement('input');
    varInput.type = 'text';

    if (variableDecl.default_value) { varInput.value = variableDecl.default_value; }
    varInput.onchange = () => romperInstance.setVariableValue(varName, varInput.value);

    return varInput;
}

// an input for changing enumerated string variables
function getListVariableSetter(varName, variableDecl){
    const options = variableDecl.values;
    const varInput = document.createElement('select');
    options.forEach((optionValue) => {
        const optionElement = document.createElement('option');
        optionElement.setAttribute('value', optionValue);
        optionElement.textContent = optionValue;
        varInput.appendChild(optionElement);
    });

    if (variableDecl.default_value) { varInput.value = variableDecl.default_value; }
    varInput.onchange = () => romperInstance.setVariableValue(varName, varInput.value);

    return varInput;
}

// an input for changing boolean variables
function getBooleanVariableSwitch(varName, variableDecl){
    const varInput = document.createElement('input');
    varInput.type = 'checkbox';

    if (variableDecl.default_value) { varInput.setAttribute('checked', true); }
    varInput.onchange = () => romperInstance.setVariableValue(varName, varInput.checked);

    return varInput;
}

// get a key->value object for each variable name->value
function getVariablesState() {
    const varInputs = document.getElementsByClassName('variable-input');
    const variableState = {};
    for(var i = 0; i < varInputs.length; i++){
        const varInputEl = varInputs[i];
        if (varInputEl.getAttribute('type') === 'checkbox') {
            variableState[varInputEl.id] = varInputEl.checked;
        } else if (varInputEl.getAttribute('type') === 'number') {
            variableState[varInputEl.id] = parseInt(varInputEl.value, 10);
        } else {
            variableState[varInputEl.id] = varInputEl.value;
        }
    }
    return variableState;
}

document.getElementById("choosetab").addEventListener('click', (e) => openTab(e, 'chooser'));
document.getElementById("jsontab").addEventListener('click', (e) => openTab(e, 'jsoncontent'));
document.getElementById("rendertab").addEventListener('click', (e) => openTab(e, 'renderer'));
document.getElementById("restart-button").addEventListener('click', restart);
document.getElementById("runjson").addEventListener('click', runEditedJson);
