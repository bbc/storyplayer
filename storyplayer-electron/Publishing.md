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

Both the Windows and Mac applications can be built on a Mac.
The Mac application cannot be built from Linux or Windows.

* `compile` - compiles the application in dev mode.
* `build` - builds the Mac and Windows applications. 
* `build:windows` - build for Windows only
* `build:mac` - build for Mac only
* `sign` - build and sign the Mac and Windows applications. 
* `sign:windows` - build and sign for Windows only
* `sign:mac` - build and sign for Mac only

The build steps for each platform read from the `build` key in the package.json for the electron-app. 
```js
{
    "build": {
        "productName": "BBC StoryPlayer",                   // name of the application
        "afterSign": "scripts/notarize.js",                 // afterSign hook notarizes mac version (returns without action for windows version)
        "dmg": {
          "sign": false                                     // do not sign DMG
        },
        "mac": {
          "appId": "uk.co.bbc.rd.storyplayerosx",           // Corresponds to appId of provisioning profile at https://developer.apple.com/account/resources/profiles/ 
        "category": "public.app-category.video",            // Not relevant - app store category
        "asar": true,                                       // package into an archive
        "target": "dmg",                                    // target dmg
        "hardenedRuntime": true,                            // hardened runtimes are a prerequisite for notarisation
        "darkModeSupport": false,                           // We don't have a dark mode
        "entitlements": "entitlements.mac.plist",           // required for Electron apps
        "entitlementsInherit": "entitlements.mac.plist",    // required for Electron apps
        "gatekeeperAssess": false                           // do not let electron-osx-sign validate the signin (will cause notarization to fail)
    },
    "win": {
        "appId": "uk.co.bbc.rd.storyplayerwin",             // Not sure this is used
        "target": "nsis",                                   // Use NSIS to create Windows installer 
        "asar": true                                        // package into an archive
    }
  },
```

## Code Signing

To give our end users confidence in the standalone StoryPlayer app, we sign it for Windows and Mac, so it appears trusted to the host OS.
This process is automatic, providing you have the appropriate credentials in place.

### Windows
Prerequisites here are that you have access to the BBC's signing certificate and knowledge of the password. 
See this ticket for details. https://jira.dev.bbc.co.uk/browse/SECUREKEY-60
This certificate should only be stored on an encrypted USB stick which itself needs to be stored securely - the original USB stick is stored in a physical safe.

### MacOS
To sign and notarize the MacOS application code, you will need an Apple ID, and access to a paid-for Apple Developer account.

* You'll need an invite from a team that has a paid-for Apple Developer account. The team account holder can generate this for you.
* Once you have set up a developer account, retrieve an “Apple Development” certificate and import to your keychain.
* The account holder will need to generate a new App ID for this app.
* The account holder will need to generate a Mac Developer cert for you as a team member. Import it to your keychain.
* Once you have this certificate, you will need to generate a CSR (Keychain access->Certificate Assistant->Request a certificate from a certificate authority) and send this back to the account holder.
* The account holder can then generate a Developer ID Application cert which will be used for signing. You can download this from the developer portal once it's been generated. Import it to your keychain. Electron-builder should find it automatically.

### Credentials

Signing credentials for Windows and MacOS should be stored in a `.env` file in the root of this folder.
This is explicitly ignored and MUST NOT BE CHECKED INTO SOURCE CONTROL.
Don't rely on the `.gitignore` file - check it isn't in the staged commits.
You do *not* want to commit your app-specific password, or the password for the BBC's Windows signing certificate.

It should look something like this:
```
export APPLEID=myAppleDevAccount@mac.com
export APPLEIDPASS=app-specific-password
export WIN_CSC_LINK=/Volumes/USBStick/Name-of-BBC-signing-certificate.pfx
export WIN_CSC_KEY_PASSWORD='quoted-password-for-BBC-signing-certificate'
```

An explanation of the fields:

APPLEID:                Set to your Apple developer account email.

APPLEIDPASS:            Set to your app-specific password, as detailed here https://support.apple.com/en-gb/HT204397

WIN_CSC_LINK:           Path to the Windows signing certificate. Keep on an external USB stick and plug in only to sign.

WIN_CSC_KEY_PASSWORD:   Password for BBC signing certificate, must be quoted.

## Publishing

The built versions of the application are placed in the `/dist/` folder in the storyplayer-electron project. These should be copied across to AWS S3 if the publish runs successfully. If not then they will need to be copied across to the bucket. the location is as follows `live-rd-ux-static-media-a-staticmediaassetsbucket-ejg5pp0z32h7/{macos|windows}` Please ensure the application name is of the following format `StoryPlayer-{x.y.z}.{exe|dmg}` where x.y.z is the version number. Each time the application code is changed, a version bump will need to be done and the code may need to be resigned (will check this). 