Analytics
---------

StoryPlayer generates analytics events so that we can record what users are doing.  These are handled by a function that is passed into StoryPlayer; this function might write some or all of these events into a database.  This function takes a single argument, which is a JavaScript Object containing the data.  This Object has the following attributes:

* `type` - String giving event type (see below for details)
* `name` - String giving event name (see below for details)
* `from` - String representing 'from' state
* `to` - String representing 'to' state
* `current_narrative_element` - UUID of current Narrative Element
* `current_representation` - UUID of current Representation
* `userid` - automatically generated UUID.  If the `saveSession` attribute for StoryPlayer is `true` this uuid is stored in local storage and used across multiple sessions.  Otherwise it lasts for the session.  `userid` is unique per experience (the same browser will use different userids for different stories).
* `timestamp` - String ISO timestamp giving time at which the event was sent
* `data` - Object with other information about the event (see below for details).  A consistent field within this object is `playheadTime` which records the `currentTime` according to the current renderer (e.g., playhead time of the video element)

### Event Types

Events are classified into the following types:

* `STORY_NAVIGATION` - A change in the state of story
* `RENDERER_ACTION` - the renderer has done something
* `USER_ACTION` - the User has done something
* `SEGMENT_COMPLETION` - A NarrativeElement has been completed

Each of these are described in a little more detail below, with the names of all the events that live in each.

### `STORY_NAVIGATION`
| name | meaning | from | to | data |
| -- | -- | -- | -- | -- |
| `NARRATIVE_ELEMENT_CHANGE` | the story has moved to a new narrative element | previous NE UUID | new NE UUID | `fromName`: previous NE name<br> `toName`: new NE name |
| `ENTER_SUB_STORY` | the story has moved to a new NE with a story body | previous NE UUID | new story UUID | - |
| `STORY_END` | the current (sub) story has ended | UUID of NE just finished | "`END_STORY`" | - |

### `RENDERER_ACTION`
These are events that reflect changes in the renderer.  None of these return anything in the `data` field.

| name | meaning | from | to |
| -- | -- | -- | -- |
| `START_BEHAVIOUR_PHASE_STARTED` | The renderer has started running start behaviours | "not_set" | "not_set" |
| `START_BEHAVIOUR_PHASE_ENDED` | The renderer has finished running start behaviours | "not_set" | "not_set" |
| `COMPLETE_BEHAVIOUR_PHASE_STARTED` | The renderer has started running end behaviours | "not_set" | "not_set" |
| `DURING_BEHAVIOUR_STARTED` | The renderer has started running a during behaviour | behaviour URI | - |
| `SWITCHABLE_REPRESENTATION_SWITCH` | The renderer has changed representation in a Switchable | previous Representation name | new Representation name |
| `VIDEO_PAUSE` | The renderer has received the instruction to pause |"not_set" | "not_set" |
| `VIDEO_UNPAUSE` | The renderer has received the instruction to play |"not_set" | "not_set" |
| `WINDOW_ORIENTATION_CHANGE` | The browser has reported a change in window orientation | "not_set" | `window.orientation` |
| `BROWSER_VISIBILITY_CHANGE` | The browser has reported a change in visibility | "visible" or "hidden" | "hidden" or "visible" |
| `BUTTONS_ACTIVATED` | The renderer has started showing the control bar | "not_set" | "not_set" |
| `BUTTONS_DEACTIVATED` | The renderer has hidden the control bar | "not_set" | "not_set" |
| `BROWSER_CLOSE_CLICKED` | The tab/browser close button has been pressed | "not_set" | "not_set" |

### `USER_ACTION`
| name | meaning | from | to | data | notes |
| -- | -- | -- | -- | -- | -- |
| `PLAY_PAUSE_BUTTON_CLICKED` | The user has clicked the play/pause button | "not_set" | "not_set" | - |
| `SEEK_FORWARD_BUTTON_CLICKED`  | The user has clicked the seek forward button | time seeked from | time seeked to | - |
| `SEEK_BACKWARD_BUTTON_CLICKED`  | The user has clicked the seek back button | time seeked from | time seeked to | - |
| `VIDEO_SCRUBBED` | The user has moved the video scrub bar | time scrubbed from | time scrubbed to | - |
| `BACK_BUTTON_CLICKED`  | The user has clicked the back button | "not_set" | "not_set" | - |
| `NEXT_BUTTON_CLICKED`  | The user has clicked the next button | "not_set" | "not_set" | - |
| `START_BUTTON_CLICKED`  | The user has clicked the start button | "not_set" | "not_set" | - |
| `SUBTITLES_BUTTON_CLICKED`  | The user has clicked the subtitles button | "hidden" or "showing" | "showing" or "hidden" | - |
| `FULLSCREEN_BUTTON_CLICKED`  | The user has clicked the fullscreen button | "fullscreen" or "not-fullscreen" | "not-fullscreen" or "fullscreen" | - |
| `VOLUME_CHANGED` | The user has changed the position of the volume slider | `null` | `[volume label]`: new volume level (0-1) | - |
| `VOLUME_MUTE_TOGGLED` | The user has pressed the volume mute/unmute button | `null` | `[volume label]`: `true` (muted) or `false` (not muted) | - |
| `OVERLAY_BUTTON_CLICKED` | The user has clicked a button to toggle an overlay.  Current overlays are `volume` to show volume controls, `representation` to allow changing Switchable representations, `icon` to change NE for chapters.  A fourth overlay is `link-choice`, used to render link choices, but this displays programmatically and does not have a button | `[name]`: "hidden" or  "visible" | `[name]`: "visible" or  "hidden" | - |
| `OVERLAY_DEACTIVATED` | An overlay has been de-activated (made invisible) | `[name]`: "visible" | `[name]`: "hidden" | - | not really a user event |
| `CHANGE_CHAPTER_BUTTON_CLICKED` | The user has clicked an icon in the `icon` overlay to change NE | `null` | UUID of target Representation | - |
| `SWITCH_VIEW_BUTTON_CLICKED` | The user has clicked a `representation` overlay button to change Switchable | `null` | UUID of target Representation | - |
| `LINK_CHOICE_CLICKED` | The user has clicked a `link-choice` overlay button to choose a link | `null` | UUID of target NE | `label`: "Option `[id]`" <br>`text`: rendered text or image src | `showlinkchoices/v1.0` behaviour |
| `BEHAVIOUR_CONTINUE_BUTTON_CLICKED` | The user has revisited an experience and chosen to resume | "not_set" | "not_set" | - |
| `BEHAVIOUR_CANCEL_BUTTON_CLICKED` | The user has revisited an experience and chosen to restart | "not_set" | "not_set" | - |
| `VR_ORIENTATION_CHANGED` | The user has changed view in an immersive (360) view | Previous direction `[phi] [theta]` | New direction `[phi] [theta]` |  | `phi` is latitude - view above/below the equator; `theta` is longitude - direction left/right.  Both in degrees |
| `USER_SET_VARIABLE` | The user has changed the value of a variable in a variables panel  | `[variable name]: [old value]` | `[variable name]: [new value]` |  | `showvariablepanel/v1.0` behaviour |
| `VARIABLE_PANEL_NEXT_CLICKED`  | The user has clicked the next button in the variable panel | "unset" | `[variable name]: [variable value]` | - | `showvariablepanel/v1.0` behaviour |
| `VARIABLE_PANEL_BACK_CLICKED`  | The user has clicked the  button | "unset" | `[variable name]: [variable value]` | - | `showvariablepanel/v1.0` behaviour |
| `SOCIAL_SHARE_CLICKED` | The user has clicked a social media share icon | "not_set" | Platform id, e.g., "twitter", "facebook" | - | `socialmodal/v1.0` behaviour |
| `OUTWARD_LINK_CLICKED` | The user has clicked an outward link | "not_set" | URL of link |  | `linkout/v1.0` behaviour |

### `SEGMENT_COMPLETION`

Segment completion events are events that are fired each time a Narrative Element completes.  They return summary data about user activity during the NE.  This is compiled client-side, so should contain all events.

| name | meaning | from | to |
| -- | -- | -- | -- |
| `NARRATIVE_ELEMENT_CHANGE` | A Narrative Element has completed | UUID of completed NE | UUID of next NE |
| `STORY_END` | The final Narrative Element in a story has completed | UUID of completed NE | `STORY_END` |

The `SEGMENT_COMPLETION` events have a data Object with the following attributes:

* `startTime` - UTC time of starting this NE (as number of milliseconds elapsed since January 1, 1970 00:00:00 UTC)
* `chapter` - UUID of this NE
* `duration` - elapsed time (ms) between NE starting and completing
*  event counts - a set of attributes with the key as the event name (e.g., `PLAY_PAUSE_BUTTON_CLICKED`)  and value of the number of times that event was fired during this NE.  Captures all `USER_ACTION` events.

And the following attributes added in version 0.12.2:
* `pausedTime` - total time (ms) that NE was in paused state but not in invisible state
* `hiddenTime` - total time (ms) that the browser was not visible while in this NE
* `visibleTime` - total time (ms) that the NE was visible
* `playingTime` - total time (ms) that the NE was playing

In 0.12.17
* `defaultDuration` - the time (in seconds) that the media was planned to last.  This is the duration of a piece of timed media (audio, video, or image with duration), and will be null if the representation is not time-bound.

