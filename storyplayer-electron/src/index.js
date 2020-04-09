const { app, BrowserWindow } = require('electron');
const path = require('path');
const express = require('express');
const { createStoriesDirectory }  = require('./utilities');

// create the express server
const server = express();
// create the main window variable
let mainWindow;

const createWindow = () => {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
    });

    mainWindow.on('closed',() => {
        mainWindow = null;
    });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {

    // create the stories directory
    const storiesPath = createStoriesDirectory();

    const staticAssetsPath = path.join(__dirname, 'dist');
    // TODO loop through the stories in here and replace the path

    // use the stories path
    server.use(express.static(storiesPath));
    // serve the other assets
    server.use(express.static(staticAssetsPath));
    // Listen for requests
    server.listen(0, () => {
        console.log('The server is running');
        // create the window
        
        createWindow();

        // and load the index.html of the app.
        mainWindow.loadURL(`file://${path.join(__dirname, 'index.html')}`);

        // Open the DevTools for debugging.
        mainWindow.webContents.openDevTools();

        // focus on the main window
        mainWindow.focus();
    });
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});