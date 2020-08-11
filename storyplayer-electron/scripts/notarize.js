require('dotenv').config();
const { notarize } = require('electron-notarize');

exports.default = async function notarizing(context) {
    const { electronPlatformName, appOutDir } = context;  
    if (electronPlatformName !== 'darwin') {
        return;
    }
    if (process.env.CSC_IDENTITY_AUTO_DISCOVERY === 'false') {
        return;
    }
    console.log('Notarizing. Please wait...');
    const appName = context.packager.appInfo.productFilename;
    
    await notarize({
        appBundleId: 'uk.co.bbc.rd.storyplayerosx',
        appPath: `${appOutDir}/${appName}.app`,
        appleId: process.env.APPLEID,
        appleIdPassword: process.env.APPLEIDPASS,
    });
};