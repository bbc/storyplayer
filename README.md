StoryPlayer
===========

StoryPlayer is R&D's Object-based Media Player.  It is designed to read stories that are expressed using our [object-based media schema](https://github.com/bbc/object-based-media-schema) and render the experience within an HTML `<div>` element, responding to audience interactions as and when.

Installing the library
======================
To install the library
```npm install @bbc/storyplayer --save```

Using the library
-----------------

> You'll notice the term "_romper_" appears frequently in the code, rather than StoryPlayer.  This is historical - the player was initially called Romper, an acronym for **R**&D **O**bject based **M**edia **P**lay**ER**.  The name was changed to better fit with the naming conventions of the StoryKit suite of tools, but _romper_ remains in many places in the code.

The default export from [storyplayer.js](src/storyplayer.js) is a function that is used to initiate and return an instance of StoryPlayer. It takes one argument, defining the Player settings, which has the following attributes:

* `target` - An HTML element for the player to live in.
* fetchers - functions that take a UUID and return an Object describing an instance of the data model for the given experience.
  - `storyFetcher` - returns a [`story`](https://github.com/bbc/object-based-media-schema/blob/main/docs/SCHEMA.md#story)
  - `narrativeElementFetcher` - returns a [`Narrative Element`](https://github.com/bbc/object-based-media-schema/blob/main/docs/SCHEMA.md#narrative-element)
  - `representationCollectionFetcher` - returns a [`Representation Collection`](https://github.com/bbc/object-based-media-schema/blob/main/docs/SCHEMA.md#representation-collection)
  - `representationFetcher` - returns a [`Representation`](https://github.com/bbc/object-based-media-schema/blob/main/docs/SCHEMA.md#representation)
  - `assetCollectionFetcher` - returns an [`Asset Collection`](https://github.com/bbc/object-based-media-schema/blob/main/docs/SCHEMA.md#asset-collection)
* `mediaFetcher`  - A function that takes a URI for some media and returns a URL that can be given, for example, as a `src` attribute for a `<video>` element
* `staticImageBaseUrl` - The location of some static assets used by the player (specifically image assets to used if not defined in the story)
* `analyticsLogger` (optional, defaults to logging on the browser console) - A function that processes analytics data Objects; see [docs/analytics.md](https://github.com/bbc/object-based-media-schema/blob/main/docs/analytics.md).  For example, the function might save the information into a database
* `dataResolver` (optional, defaults to creating one) - contains `get` and `set` functions to get and set the values of the variables that determine the flow of logic of the story (see the [built-in DataResolver](https://github.com/bbc/object-based-media-schema/blob/main/docs/resolvers/ObjectDataResolver.js)).  This can be used to hook the player into an external data store
* `privacyNotice` (optional, defaults to null) - A string rendered alongside the start button and start image designed to present a privacy warning to users
* `saveSession` (optional, defaults to false) - A boolean to say whether or not the player should save state and offer to resume when restarted
* `handleKeys` (optional, defaults to true) - A boolean to say whether keyboard events should be handled by the player

For example, in a React application import the player:

```
import StoryPlayer, { VARIABLE_EVENTS,  REASONER_EVENTS } from '@bbc/storyplayer';
```

Initiate it using an Object with the attributes described above:
```
    const playerSettingsObject = {
        // an Object including the above attributes
    }
    this.storyplayer = StoryPlayer(playerSettingsObject);
```

The returned instance will fire events that can be listened for and handled.  For example:

```
    // whenever a variable is changed
    this.storyplayer.on(VARIABLE_EVENTS.VARIABLE_CHANGED, this.handleVariableChange);

    // whenever the user changes to a new Narrative Element
    this.storyplayer.on(REASONER_EVENTS.NARRATIVE_ELEMENT_CHANGED,
        this.handleNarrativeElementChange);

    // whenever the Controller calculates what elements can come next
    this.storyplayer.on(REASONER_EVENTS.NEXT_ELEMENTS, this.handleUpcomingChange);

    // the story has started
    this.storyplayer.on(REASONER_EVENTS.ROMPER_STORY_STARTED, this.handleStoryStart);

    // the story has ended
    this.storyplayer.on(REASONER_EVENTS.STORY_END, this.handleStoryEnd)
```

The [examples code](https://github.com/bbc/storyplayer/blob/main/examples/main.js#L162) shows how this might work, with simple fetchers all reading from the same single pre-loaded JSON file for the story.  See [Running the examples in the repo](#running-the-examples-in-the-repo), below for how to view the demos.

Building the library from the repo
==================================

> Ensure you have NodeJS v20 installed.
> We use NPM for dependency management and building.\
> We have an ESLint file based on the `typescript-eslint` parser.\
> We have moved from Flow to TypeScript for type-checking, albeit the types are fairly permissive.

* First, clone [the repo](https://github.com/bbc/storyplayer) and ```cd``` into the new directory.
* Run `npm install` to pull down and build all the dependencies, and the library.
* `npm run build` will do a single build of the library
* `npm run test` will do a single run of the tests (eslint, sass-lint, tsc)
* `npm run dev` will serve up the example content (see below) and continuously build and test the library on changes.

Running the examples in the repo
--------------------------------

To check everything is installed correctly, run `npm run dev` in the root of the project, then visit [`http://localhost:5173`](http://localhost:5173).

Select a demo using the left hand tab. Use the middle tabs to inspect (and edit, if you wish) the demo's JSON representation. Use the right hand tab to play the selected story.

Running StoryPlayer against local stories and media
---------------------------------------------------

* Run `npm run dev` in the root of the project.

* The media can be placed in the `/examples/` folder.  It can be put directly in, or organised into subfolders.

* The story json can be placed in the `/examples/` folder.  The json must conform with the [schema](https://github.com/bbc/object-based-media-schema); there are stories in the examples folder there can provide some guidance or be edited manually for testing and exploration.   The Asset Collection source values can use a relative path to the local folder containing the media.  For example, if you are editing `my_story.json` in the `/examples/` folder, and wish to use the video `/examples/my_project/my_nice_vid.mp4`, then the asset collection should have:

```
    "assets": {
        "av_src": "./my_project/my_nice_vid.mp4"
    }
```

* Stories can be played by visiting [`http://localhost:5173`](http://localhost:5173); there you will see a list of the example stories provided in the repository.  Select a story in the "Select story" tab then visit the "Render" tab to play.

* Other stories can be viewed by providing the filename in the URL, e.g.,  `localhost:5173?storyjson=my_story.json` (e.g., if `my_story.json` is in the `examples/` folder).

StoryPlayer Implementation details
----------------------------------
Information regarding the implementation of StoryPlayer is detailed [here](https://github.com/bbc/storyplayer/blob/main/docs/implementation.md), and includes:
* [URL Parameters for Playback](https://github.com/bbc/storyplayer/blob/main/docs/implementation.md#url-parameters-for-playback)
* [URL Parameters for Debugging](https://github.com/bbc/storyplayer/blob/main/docs/implementation.md#url-parameters-for-debugging)
* [Internal Variables](https://github.com/bbc/storyplayer/blob/main/docs/implementation.md#internal-variables)
* [Document Object Model](https://github.com/bbc/storyplayer/blob/main/docs/implementation.md#document-object-model)
* [Code Components and Data Flow](https://github.com/bbc/storyplayer/blob/main/docs/implementation.md#code-components-and-data-flow)

StoryPlayer Analytics
---------------------
StoryPlayer features a highly granular analytics solution that can be used to record user behaviour. For full details, head [here](https://github.com/bbc/storyplayer/blob/main/docs/analytics.md).

How to contribute
=================

Please read our [CONTRIBUTING.md](https://github.com/bbc/storyplayer/blob/main/.github/CONTRIBUTING.md) and our [CODE_OF_CONDUCT.md](https://github.com/bbc/storyplayer/blob/main/.github/CODE_OF_CONDUCT.md) if you are interested in making contributions.

Licence
=======

StoryPlayer is available to everyone under the terms of the GNU General Public Licence v3.0. Take a look at the [licence file](https://github.com/bbc/storyplayer/blob/main/LICENCE) and [COPYING](https://github.com/bbc/storyplayer/blob/main/COPYING) in the repo for further details.
