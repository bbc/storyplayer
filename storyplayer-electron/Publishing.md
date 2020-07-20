# Storyplayer electron App

The storyplayer electron app is a simple wrapper for the `rd-ux-storyplayer` player client library. It reads from the local user filesystem to load the data model and media to playback an experience. Users can add multiple stories to their filesystem and the player will allow them choice to choose to play back a single experience in the list of experiences it can find. The player also stores analytics for users experiences.


## Running the Application

The storyplayer application relies on some folders in specific locations to read and write to. Experiences are read from the `storyplayer` folder and analytics are written to an `analytics.txt` folder.

### Experience
The electron app sets up some folders on the users machine to store the experience data models as well as create experience analytics. The local data model and media should all be saved in one folder per experience, under the `storyplayer` folder. These must be in the users documents folder: `~/documents/storyplayer/{story_folder}`. The player should create the `~/$documents/storuplayer/` folder on load. Subsequent application starts will just check this folder exists each time, in case the user has deleted the folder.

### Analytics
Player analytics are streamed to an `analytics.txt` file  which on player startup will check exists and create if needed. The file is found in the users home directory in a `Storyplayer-analytics` folder like so: `$USER_HOME/Storyplayer-analytics/analytics.txt`. The app does not check this exists each time as the overhead on this is significant, if it cannot write that log event it will be logged to the console which is stored somewhere on the users OS. but it does not try to write these again.


## Building the Application

### Building the player code

These commands are run from the root `rd-ux-storyplayer`folder.

The first step to build this is to build the storyplayer code and minify it. This builds and copies the code across to the storyplayer-electron folder. 
* Running `yarn build:electron` will build the player library and copy this and the assets across to the right folders for the electron app to use. 
* Adding `yarn build:electorn -m` will attempt to mangle/obfuscate the code. Should not be used until we're sure the player is functioning with this option in testing.

### Building the electron application

The following should be run from the `storyplayer-electron` folder. 

* You will first need to run `yarn` to install the dependencies. 
* The application build steps are platform agnostic, but if you are to build and publish the application on MacOS, it must be built on MacOS.

To build/package and publish the application we are using the `electron-builder` npm package. This allows us to package our code as an electron application. The module has various cli arguements we use to achieve this.
* `compile`, compiles the application in dev mode.
* `build`, builds on the current platform. Note this will not perform code signing.
* `build:all` builds the application for all platforms, (windows, mac, linux)
* `build:release` create the release version with code signing. This will need extra configuration, noted below.

For development, the  `"identity": null` property may be set we set in the mac build configuration of the package.json. To sign the code this property must be removed so electron-builder knows to pass an identity from the user keychain to sign the application. Steps to do this will follow, oce we know how to.

The build steps for each platform read from the `build` key in the package.json for the electron-app. These are outlined below for the mac and 
```js
{
    "build": {
        "productName": "StoryPlayer", // name of the application
        // mac specific config
        "mac": {
            "category": "public.app-category.video", // what do we define our app as for apple to sort
            "asar": true, // zip this up into an archive
            "target": "dmg", // we only target dmg
            "icon": " path to icon.icns", // path to the icon for the application
            "darkModeSupport": false, // no dark mode as we don't support it in the player
            "type": "distribution" // building for distribution not testing
            "appId": "uk.co.bbc.rd.storyplayerosx", // id used by each platform

        },
        // windows specific config
        "win": {
            "target": "nsis", // we only target this, the others aren't needed
            "asar": true, // package it up like macos
            "icon": "path to icon.icns", // icon path too
            "publisherName": "Name of the publisher",
            "appId": "uk.co.bbc.rd.storyplayerwin", // id used by each platform
        }
    }
}
```

## Code Signing

To sign the application we user certificates from BBC for windows loaded via ENV vars and [SOME OTHER PROCESS] for MacOS. 

### Windows
The easiest way to tell electron to user certs is via environment variables. The `build:release` command will load the config.env file, this is explicitly ignored and MUST NOT BE CHECKED INTO SOURCE CONTROL. Don't rely on the `.gitignre` file,  you should ALWAYS check it isnt in the staged commits.

The cert and password are loaded into the environment variables on MacOS for signing the windows code.
```bash
export WIN_CSC_LINK=./path/to/mycert/cert.p12 # windows code signing cert 
export WIN_CSC_KEY_PASSWORD='my-passowrd' # windows code signing cert password
```

### MacOS 

To sign the MacOS application code, we may be using a similar process, though [NOT SURE YET]. The env variables look like this if we are using a digial cert. If they come from the keychain then the process will be different.

```bash
export CSC_NAME='[certificatename]' #example 1A3JKJD89O
export CSC_LINK=./path/to/mycert/cert.p12 # macos code signing cert
export CSC_KEY_PASSWORD='my-passowrd' # macos code signing cert password
# if this is true we'll use a valid and appropriate identity from the keychain in macos
export CSC_IDENTITY_AUTO_DISCOVERY=true 
```

## Publishing

The built versions of the application are placed in the `/dist/` folder in the storyplayer-electron project. These should be copied across to AWS S3 if the publish runs successfully. If not then they will need to be copied across to the bucket. the location is as follows `live-rd-ux-static-media-a-staticmediaassetsbucket-ejg5pp0z32h7/{macos|windows}` Please ensure the application name is of the following format `StoryPlayer-{x.y.z}.{exe|dmg}` where x.y.z is the version number. Each time the application code is changed, a version bump will need to be done and the code may need to be resigned (will check this). 