const express = require('express');
const path = require('path');
const fs = require('fs');
const uuid = require('uuid');

const app = express();

// set the port
app.set('port', 3000);

const bodyParser = require('body-parser');

app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

// Upload JSON story and playback
// WARNING: This is example code and should NEVER be deployed to a server as the following
// upload function could easily be used for mallious purposes
app.post('/upload', (request, respond) => {
    const id = uuid();
    const filePath = `${__dirname}/tmp/${id}.json`;
    fs.appendFile(filePath, request.body.storyjson, () => {
        respond.redirect(`/examples/?storyjson=../tmp/${id}.json`);
    });
});

// tell express that we want to use the www folder
// for our static assets
app.use(express.static(path.join(__dirname, './')));

// Listen for requests
app.listen(app.get('port'), () => {
    console.log('The server is running: view the demos on http://localhost:3000/examples/');
});
