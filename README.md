Romper
======

R&D's Object-based Media Player

How to use
----------

_Coming soon_

How to develop
--------------

* We use [Yarn](https://yarnpkg.com/en/) for dependency management, Mocha as a test runner with Chai for assertions.
  TDD is preferred here. We have an ESLint file which follows our house file, and we prefer to have Facebook Flow
  annotations in place for type checking.
* Run `yarn` to get all your dev dependencies included
* `demo.html` puts a simple player onto a page
* `npm run build` will do a single build of the library
* `npm test` will do a single run of the tests (Mocha with Chai, ESLint and Flow type checking)
* `npm run watch` will do continuously build and test the libraryon change

Developing against a local [Romper](https://github.com/bbc/romper) instance
--------------

You'll need to follow the steps below to test Storyformer against unpublished Romper changes (assuming Yarn is being used for dependency management):

1. SSH into the Storyformer Vagrant box with `vagrant ssh`
1. Navigate to the Romper directory: `cd ~/workspace/romper`
1. Run `yarn link` and check you see the following output:

   ```bash
   [developer@sandbox7 romper]$ yarn link
   yarn link v1.2.1
   success Registered "@bbc/romper".
   info You can now run `yarn link "@bbc/romper"` in the projects where you want to use this module and it will be used instead.
   ```

1. Navigate back to the Storyformer repo: `cd ~/workspace/rd-ux-storyformer`
1. Run `yarn link "@bbc/romper"` and verify the command worked:

   ```bash
   [developer@sandbox7 rd-ux-storyformer]$ yarn link "@bbc/romper"
   yarn link v1.2.1
   success Using linked module for "@bbc/romper".
   ```

1. (Optional) Verify that your `node_modules` is pointing to the correct version of Romper:

       ```bash
       [developer@sandbox7 rd-ux-storyformer]$ ls -l node_modules/@bbc
       total 4
       ... 1 1499 developer 15 Dec  4 11:12 romper -> ../../../romper
       ```

⚠️ You must run `yarn build` in the Romper directory to make local changes available to repositories using the linked
version.

⚠️ The Webpack default setting for symlink resolution when building must be disabled:

```javascript
const config = {
    resolve: {
        extensions: ['.js', '.jsx'],
        symlinks: false, // webpack builds will fail without this line
    },
};
```

Code Components and Data Flow
-----------------------------

(This is a very quickly written overview - needs diagrams etc.)

## Story Control

Each instance of StoryPlayer is an instance of a `Controller` that is created by `romper.js`.  This creates a `RenderManager`, which handles rendering of content, and two reasoners for determining which content is shown.  The `StoryReasoner` is responsible for evaluating links between Narrative Elements to determine which is taken (the first link in the array whose conditions evaluate to true), while the `RepresentationReasoner` is responsible for determining which Representation is rendered for a given Narrative Element (again, the first Representation in the RepresentationCollection whose conditions evaluate to true).  Both reasoners use a `DataResolver` that is passed in to StoryPlayer (although there is a default that is used if one is not provided); this is essentially the variable store.  Also passed in to StoryPlayer are:

* Story Fetchers, which fetch objects of the story data model from the Media Store
* A Media Fetcher, which handles fetching media assets (e.g., from CDNs)
* An Analytics Logger, which takes Analytics Events and processes them (e.g., write to a DB)

The `Controller` also determines whether the system meets the story requirements (as defined in the story meta), tests if the story is linear (and, if so, creates the chapter markers using the representation icons) and handles movement between elements of the story.

The `RenderManager` is responsible for creating and managing the Renderers that display each Narrative Element.  This involves using the `RepresentationReasoner` to determine which Representation will be used, then using the `RendererFactory` to find a Renderer that is capable of rendering it.  In order to achieve smooth playback, it also creates renderers for current, previous and next Narrative Elements so these are ready to play as soon as the story moves on to the next NarrativeElement (a change in the variable state requires these to be refreshed as the particular representation that should be played depends on the state of the variables).  The `RenderManager` creates a `Player` that all Renderers use, and which is responsible for creating the UI and handling the HTML/DOM that the browser displays.

## UI
The `Player` builds the DOM tree for rendering the content and the UI.  It handles the overlay system, which is used to display multiple volume controls, chapter icons (for switching Narrative Elements), Representation icons (for switching Representations in a Switchable Representation).  It manages the Scrub Bar so it is associated with the appropriate video/audio and the rendering of icons to represent branch choices (the `Player` manages the rendering of these, but the logic is controlled from within the Renderer that is handling the Representation with which this behaviour is associated).  The `Player` creates and handles a `PlayoutEngine` that handles changes of AV media; either by handling multiple video elements or by changing the src of a single element.

## Renderer Lifecycle
The `BaseRenderer` is the base class for all the Renderers and handles concerns that are common to all.  The rough lifecycle is that constructing a Renderer builds the necessary components for it to play (e.g., a `SimpleAVRenderer` fetches the media assets and gets the `PlayoutEngine` to queue them up).  When the Controller tells the RenderManager to change to the NarrativeElement that the Renderer is handling, the `willStart()` function is called.  This tells the `BehaviourRunner` to run any start behaviours for the Representation and the `PlayoutEngine` to move on to this media.  Once the behaviours have all completed, the `start()` function is called, which clears any behaviour DOM elements and starts rendering (e.g., video playback commences).  It also tests for during behaviours and queues these to run at the appropriate time.  The Renderer is responsible for ending itself, which is done by running the `complete()` function, e.g., when the video has completed.  The `complete()` function asks the `BehaviourRunner` to run any completed behaviours; once these have completed, the Renderer emits a COMPLETED event, which is heard by the RenderManager and passed on to the Controller.  The Controller then tells its StoryReasoner to move on to the next element; this fires events which the Controller listens for and handles, e.g., to tell the RenderManager handle a change in NarrativeElement. change in Narrative Element.  The renderer's `destroy()` function is called when it is no longer either playing or held in the RenderManager's 'buffer' of next and

### Behaviours
Behaviours are associated with Representations in the Data Model, and can be run at the start, middle, or end of an Element.  They are handled by the Renderer for the given Representation; this uses a `BehaviourRunner` to run the behaviours.  The BehaviourRunner passes each behaviour to the `BehaviourFactory`; which returns a `Behaviour` that is capable of handling it.  Some (e.g., pause) are generic enough to be handled by their own class for all Renderer types; other behaviours can only be handled by certain Representation types, or need to be handled differently for different Representation types; these are handled by the `BaseBehaviour`, which basically passes responsibility on to the Renderer for the Representation.  Each Renderer has a map that associates functions with the URNs of the behaviours it can handle; the function is called when the behaviour needs to be run and runs a callback when it is completed.  The behaviours are considered complete when all of those which are capable of being run have run their callbacks.