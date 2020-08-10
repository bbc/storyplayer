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
* Adding `yarn build:electron -m` will attempt to mangle/obfuscate the code. Should not be used until we're sure the player is functioning with this option in testing.

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
        "productName": "BBC StoryPlayer",                   // name of the application
        "mac": {
            "dmg": {                                        
                "sign": false                               // do not sign the DMG, just the app
            },
            "afterSign": "scripts/notarize.js",             // send app to Apple for notarization
            "appId": "uk.co.bbc.rd.storyplayerosx",         // do not change - tied to signing process
            "category": "public.app-category.video",        // apple store category, presumably not relevant
            "asar": true,                                   // zip up into an archive
            "target": "dmg",                                // target dmg
            "hardenedRuntime": true,                        // hardened runtimes are a prerequisite for notarisation
            "entitlements": "entitlements.mac.plist",       // required for Electron apps
            "entitlementsInherit": "entitlements.mac.plist",// required for Electron apps
            "gatekeeperAssess": false                       // do not let electron-osx-sign validate the signin (will cause notarization to fail)
        },
        "win": {
            "appId": "uk.co.bbc.rd.storyplayerwin",
            "target": "nsis",
            "asar": true
        }
  },
}
```

## Code Signing

### Windows
The easiest way to tell electron to user certs is via environment variables. The `build:release` command will load the config.env file.
This is explicitly ignored and MUST NOT BE CHECKED INTO SOURCE CONTROL. Don't rely on the `.gitignore` file, you should ALWAYS check it isn't in the staged commits.

```bash
export WIN_CSC_LINK=./path/to/mycert/cert.p12 # windows code signing cert 
export WIN_CSC_KEY_PASSWORD='my-password' # windows code signing cert password
```
### MacOS 

## Building
There are no specific prerequisites for building the MacOS application code.

## Signing and Notarizing
To sign and notarize the MacOS application code, you will need an Apple ID, and access to a paid-for Apple Developer account.
In the Security section of your Developer account at https://appleid.apple.com/account/manage, generate an app-specific password.
Add your developer account ID (e.g. jimmy.blobs@bbc.co.uk) and your app-specific password to a file named .env in the storyplayer-electron folder.
```
APPLEID=[your Apple ID]
APPLEIDPASS=[your app-specific password]
```

Other steps need to be taken inside the Apple Developer system in order for the notarization process to work.

* Once you have a free dev account, retrieve an “Apple Development” cert from the apple dev website and import to your keychain.
* You'll need an invite from a team that has a paid-for Apple Developer account, so you can notarize the application. The team account holder can generate this for you.
* The account holder will need to generate a new App ID for this app
* The account holder will need to generate a Mac Developer cert for you as a team member
* Once you have this cert, you will need to generate a CSR (Keychain access->Certificate Assistant->Request a certificate from a certificate authority) and send this back to the account holder.
* The account holder can then generate a Developer ID Application cert which will be used for signing. You can download this from the developer portal once it's been generated.

## Publishing

The built versions of the application are placed in the `/dist/` folder in the storyplayer-electron project. These should be copied across to AWS S3 if the publish runs successfully. If not then they will need to be copied across to the bucket. the location is as follows `live-rd-ux-static-media-a-staticmediaassetsbucket-ejg5pp0z32h7/{macos|windows}` Please ensure the application name is of the following format `StoryPlayer-{x.y.z}.{exe|dmg}` where x.y.z is the version number. Each time the application code is changed, a version bump will need to be done and the code may need to be resigned (will check this). 