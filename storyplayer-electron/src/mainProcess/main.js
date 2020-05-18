const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { getStory, listStories }  = require('./utilities');
const { logToFile, createAnalyticsLogFile }  = require('./analyticsLogger');
const { createAppMenu } = require('./menu');
const logger = require('./logger');

// create the main window variable
let mainWindow;


app.setAppLogsPath();
// create the main window
const createWindow = () => {
    // Create the browser window.
    const basePath = __dirname;
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    mainWindow = new BrowserWindow({
        width,
        height,
        webPreferences: {
            preload: path.join(__dirname, '../renderers/rendererPreload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            additionalArguments: [`-base_path=${basePath}`]
        },
        skipTaskBar: true,
    });

    mainWindow.on('closed',() => {
        mainWindow = null;
    });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    createAppMenu();

    createAnalyticsLogFile();

    // on event get-story we fetch the story and reply
    ipcMain.on('get-story', async (event, data) => {
        const story = await getStory(data);
        event.reply('found-story', story);
    });

    // reload safely
    ipcMain.on('reload', () => {
        mainWindow.reload();
    });

    // analytics handlers
    ipcMain.on('analyticsEvent', (event, data) => {
        // eslint-disable-next-line no-param-reassign
        data.timestamp = Date.now();
        logToFile(data);
    })

    logger.info('The server is running at');
    // create the window
    createWindow();

    // get the image path and pass it in
    const imagePath = path.join(__dirname, '..', 'dist', 'images');
    // and load the index.html of the app.
    mainWindow.loadURL(`file://${path.join(__dirname, `../index.html?imagePath=${imagePath}`)}`);
    
    // once the dom is ready, request the list of stories.  
    mainWindow.webContents.once('dom-ready', async () => {
        // then on every subsequent reload
        mainWindow.webContents.on('did-frame-finish-load', async (event) => {
            const storiesData = await listStories();
            event.preventDefault();
            mainWindow.webContents.send('list-stories', storiesData.filter(Boolean));
        });
    });
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


app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (e) => {
        e.preventDefault()
    });
});

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// if we've not caught an exception then quit stuff has really gone wrong
process.on('uncaughtException', (err) => {
    logger.error(err);
    app.quit();
});