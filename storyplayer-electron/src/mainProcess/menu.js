const {
    Menu, app
} = require('electron');

const isMac = process.platform === 'darwin'

const createAppMenu = () => {
    const appMenuTemplate = [
        (isMac ? {
            label: app.name,
            submenu: [{
                role: 'about'
            },
            {
                type: 'separator'
            },
            {
                role: 'services'
            },
            {
                type: 'separator'
            },
            {
                role: 'hide'
            },
            {
                role: 'hideothers'
            },
            {
                role: 'unhide'
            },
            {
                type: 'separator'
            },
            {
                role: 'quit'
            }
            ]
        } : null),
        {
            label: "Edit",
            submenu: [{
                role: 'undo'
            },
            {
                role: 'redo'
            },
            {
                type: 'separator'
            },
            {
                role: 'cut'
            },
            {
                role: 'copy'
            },
            {
                role: 'paste'
            },
            {
                role: 'delete'
            },
            {
                role: 'selectall'
            }
            ]
        },
        {
            label: "View",
            submenu: [{
                role: 'reload'
            },
            {
                type: 'separator'
            },
            {
                role: 'resetzoom'
            },
            {
                role: 'zoomin'
            },
            {
                role: 'zoomout'
            },
            {
                type: 'separator'
            },
            {
                role: 'togglefullscreen'
            }
            ]
        },
        {
            role: 'Window',
            submenu: [{
                role: 'minimize'
            },
            {
                role: 'close'
            }
            ]
        },
        {
            label: "Debug",
            submenu: [{
                role: 'forcereload'
            },
            {
                role: 'toggledevtools'
            },
            ],
        }
    ].filter(Boolean);
    Menu.setApplicationMenu(
        Menu.buildFromTemplate(appMenuTemplate)
    );

};

module.exports = {
    createAppMenu,
};