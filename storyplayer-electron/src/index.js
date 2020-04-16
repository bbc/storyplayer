const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { getStory, listStories }  = require('./utilities');
const logger = require('./logger');

// create the main window variable
let mainWindow;

const createWindow = () => {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
        }
    });

    mainWindow.on('closed',() => {
        mainWindow = null;
    });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {

    // on event get-story we fetch the story and reply
    ipcMain.on('get-story', async (event, data) => {
        const story = await getStory(data);
        event.reply('found-story', story);
    })


    ipcMain.on('list-stories', async (event) => {
        const storiesData = await listStories();
        event.reply('list-stories-reply', storiesData);
    })

    logger.info('The server is running');
    // create the window
    createWindow();

    // and load the index.html of the app.
    mainWindow.loadURL(`file://${path.join(__dirname, 'index.html')}`);
    
    // Open the DevTools for debugging.
    mainWindow.webContents.openDevTools();


    // once the dom is ready, request the list of stories.  
    mainWindow.webContents.once('dom-ready', async () => {
        const storiesData = await listStories();
        mainWindow.webContents.send('list-stories', storiesData);

        // then on every subsequent reload
        mainWindow.webContents.on('did-frame-finish-load', async (event) => {
            event.preventDefault();
            mainWindow.webContents.send('list-stories', storiesData);
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


app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});