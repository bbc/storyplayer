const { Menu } = require('electron');
const isDevMode = require('electron-is-dev');

const createAppMenu = () => {
    const appMenuTemplate = [
        {
            label: "Edit",
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'delete' },
                { role: 'selectall' }
            ]
        },
        {
            label: "View",
            submenu: [
                { role: 'reload' },
                { type: 'separator' },
                { role: 'resetzoom' },
                { role: 'zoomin' },
                { role: 'zoomout' },
                { type: 'separator' },
                { role: 'togglefullscreen' }                
            ]
        },
        {
            role: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'close' }
            ]
        },
        {
            label: "Debug",
            submenu: [
                { role: 'forcereload' },
                { role: 'toggledevtools' },
            ],
        }
    ];
    // if (isDevMode) {
    //     appMenuTemplate.push({
    //         label: "Debug",
    //         submenu: [
    //             { role: 'forcereload' },
    //             { role: 'toggledevtools' },
    //         ],
    //     });
    // }
    Menu.setApplicationMenu(
        Menu.buildFromTemplate(appMenuTemplate)
    );

};

module.exports = {
    createAppMenu,
};