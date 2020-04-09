const { app, BrowserWindow } = require('electron');
const path = require('path');
const { createStoriesDirectory }  = require('./utilities');

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

    // in here we want to fetch the story and then send that data to the renderer process

    //ipcmain ipcrenderer

    console.log('The server is running');
    // create the window

    createWindow();

    // and load the index.html of the app.
    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // Open the DevTools for debugging.
    mainWindow.webContents.openDevTools();

    // focus on the main window
    mainWindow.focus();
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