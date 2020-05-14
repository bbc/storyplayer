# Storyplayer electron App

The folder  `~/storyplayer-electron/` contains th code for the electron player with a separate package.json used for this project so the player is effectively a dependency of the app. In practice the code is copied across to the player folder from the `~/dist/` in the root of the project. This also contains all the local assets as well as the baseline styling.

The player `/dist/` folder containing the player code is wrapped in a simple electron application. This serves the local story media assets and data model JSON from a folder in `~/documents/storyplayer/{story_folder}` The `storyplayer` folder contains a folder for each experience in its own folder.

The player should create this folder on load, and subsequently check for the folder, if it does not then this will have to be created manually. 

## Building the Application

To build/package and publish the application we are using the `electron-builder` npm package. This allows us to package our code as an electron application. The module has various cli arguements we use to achieve this. When we want to compile the code locally we can run the scripts as follows:

```js
"scripts": {
    "compile": "electron src/mainProcess/main.js", // compile the application
    "build": "electron-builder build", // build on the current platform
    "build:all": "electron-builder build -mwl", //build all the platforms
    "build:release": "export $(cat config.env | xargs) && electron-builder build -mwl" // create the release version with code signing
  },
```

The build steps read from the `build` key in the package.json for the electron-app. These are outlined below
```js
{
    "build": {
        "productName": "StoryPlayer", // name of the application
        "appId": "com.bbc.storyplayer", // id used by each platform
        // mac specific config
        "mac": {
            "category": "public.app-category.video", // what do we define our app as for apple to sort
            "asar": true, // zip this up into an archive
            "target": "dmg", // we only target dmg
            "icon": " path to icon.icns", // path to the icon for the application
            "darkModeSupport": false, // no dark mode as we don't support it in the player
            "type": "distribution", // building for distribution not testing
            "publish": { // publishing the application to s3 too
                "provider": "s3",
                "bucket": "live-rd-ux-static-media-a-staticmediaassetsbucket-ejg5pp0z32h7",
                "path": "applications/macos"
            }
        },
        // windows specific config
        "win": {
            "target": "nsis", // we only target this, the others aren't needed
            "asar": true, // package it up like macos
            "icon": "path to icon.icns", // icon path too
            "publisherName": "Name of the publisher",
            "publish": {
                "provider": "s3",
                "bucket": "live-rd-ux-static-media-a-staticmediaassetsbucket-ejg5pp0z32h7",
                "path": "applications/windows"
            }
        }
    }
}
```

## Code Signing

To sign the application we user certificates from [CERT Authority] and create environment variables and pass these to the build steps. The `build:release` command will load the config.env file these contain secrets so should not be checked into source control. The contents of the file looks like this: 
```bash
export CSC_NAME='[certificatename]' #example 1A3JKJD89O
export CSC_LINK=./path/to/mycert/cert.p12 #macos code signing cert
export CSC_KEY_PASSWORD='my-passowrd' #macos code signing cert password
export WIN_CSC_LINK=./path/to/mycert/cert.p12 # windows code signing cert 
export WIN_CSC_KEY_PASSWORD='my-passowrd' # windows code signing cert password
# if this is true we'll use a valid and appropriate identit from the keychain in macos
export CSC_IDENTITY_AUTO_DISCOVERY=true 

# publishing AWS secrets
export AWS_ACCESS_KEY_ID=[AWSKEYID] 
export AWS_SECRET_ACCESS_KEY=[AWSSECRETACCESSKEY]
export AWS_S3_ENDPOINT=[S3ENDPOINT]
```

## Publishing

The built versions of the application are placed in the `/dist/` folder in the storyplayer-electron project. These should be copied across to AWS S3 if the publish runs successfully. If not then they will need to be copied across to the bucket. the location is as follows `live-rd-ux-static-media-a-staticmediaassetsbucket-ejg5pp0z32h7/{macos|windows}` Please ensure the application name is of the following format `StoryPlayer-{x.y.z}.{exe|dmg}` where x.y.z is the version number. Each time the application code is changed, a version bump will need to be done and the code resigned. 