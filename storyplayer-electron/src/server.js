// set the port
const express = require('express');
const path = require('path');


const server = express();

const bodyParser = require('body-parser');

server.use(bodyParser.json()); // support json encoded bodies
server.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

// for our static assets
server.use(express.static(path.join(__dirname, './')));

module.exports = {
    server,
};