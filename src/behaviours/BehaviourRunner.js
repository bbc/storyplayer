// @flow

import BehaviourFactory from '../behaviours/BehaviourFactory';
import BaseRenderer from '../renderers/BaseRenderer';

export default class BehaviourRunner {
    behaviours: Object;
    behavioursRunning: Object;
    baseRenderer: BaseRenderer;
    events: Array<string>;

    constructor(behaviours: Object, baseRenderer: BaseRenderer) {
        this.behaviours = behaviours;
        this.behavioursRunning = {};
        this.baseRenderer = baseRenderer;
        this.events = Object.keys(behaviours);
        for (let i = 0; i < this.events.length; i += 1) {
            this.behavioursRunning[this.events[i]] = 0;
        }
    }

    // Run behaviours for a specific event type.
    // Returns true if there's a behaviour, false if none found
    runBehaviours(event: string, completionEvent: string) {
        const behaviourQueue = [];
        if (this.behaviours[event] === undefined || this.behaviours[event] === []) {
            return false;
        }
        this.behaviours[event].forEach((behaviourDefinition) => {
            const behaviour = BehaviourFactory(behaviourDefinition, this.handleBehaviourComplete.bind(this, event, completionEvent));
            if (behaviour) {
                this.behavioursRunning[event] += 1;
                behaviourQueue.push(behaviour);
            }
        });
        behaviourQueue.forEach((behav) => {
            behav.start(this.baseRenderer);
        });
        return true;
    }

    // Called on behaviour of a specific event type ending
    // Checks for number of behaviours of that type running - if it's zero, send the completion event
    handleBehaviourComplete(event: string, completionEvent: string) {
        console.log(event, completionEvent, this.behavioursRunning[event]);
        if (this.behavioursRunning[event] === undefined) {
            return;
        }

        if (this.behavioursRunning[event] > 0) {
            this.behavioursRunning[event] -= 1;
        }

        if (this.behavioursRunning[event] === 0) {
            this.baseRenderer.emit(completionEvent);
        }
    }
}
