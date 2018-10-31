// @flow

import BehaviourFactory from '../behaviours/BehaviourFactory';
import BaseRenderer from '../renderers/BaseRenderer';
import type { RendererEvent } from '../renderers/RendererEvents';
import type { BehaviourTiming } from './BehaviourTimings';

export default class BehaviourRunner {
    behaviourDefinitions: Object;
    eventCounters: Object;
    baseRenderer: BaseRenderer;
    eventNames: Array<string>;
    behaviours: Array<Object>;
    handleCompletion: Function;

    constructor(behaviourDefinitions: Object, baseRenderer: BaseRenderer) {
        this.behaviourDefinitions = behaviourDefinitions;
        this.eventCounters = {};
        this.behaviours = [];
        this.baseRenderer = baseRenderer;

        // Events in romper are upper case, events in json schema are lower case
        this.eventNames = Object.keys(behaviourDefinitions);

        this.eventNames.forEach((eventName) => {
            this.eventCounters[eventName] = 0;
        });
    }

    // Run behaviours for a specific event type. Returns true if there's a behaviour,
    // false if none found
    runBehaviours(event: BehaviourTiming, completionEvent: RendererEvent) {
        this.behaviours = [];
        if (this.behaviourDefinitions[event] === undefined ||
            this.behaviourDefinitions[event].length === 0
        ) {
            return false;
        }
        // Create all behaviours before starting any behaviours for correct handleOnComplete
        // reference counting
        this.behaviourDefinitions[event].forEach((behaviourDefinition) => {
            const behaviour = BehaviourFactory(
                behaviourDefinition,
                // (Can't for the life of me figure out why flow hates this)
                // @flowignore
                () => { this.handleCompletion(event, completionEvent); },
            );
            if (behaviour) {
                this.behaviours.push(behaviour);
                this.eventCounters[event] += 1;
            }
        });


        if (this.behaviours.length === 0) {
            return false;
        }
        this.behaviours.forEach((behaviour) => { behaviour.start(this.baseRenderer); });
        return true;
    }

    destroyBehaviours() {
        this.behaviours.forEach((behaviour) => { behaviour.destroy(); });
    }

    // Called on behaviour of a specific event type ending
    // Checks for number of behaviours of that type running
    //   - if it's zero, send the completion event
    handleCompletion(event: BehaviourTiming, completionEvent: RendererEvent) {
        if (this.eventCounters[event] === undefined) {
            return;
        }

        if (this.eventCounters[event] > 0) {
            this.eventCounters[event] -= 1;
        }

        if (this.eventCounters[event] === 0) {
            this.baseRenderer.emit(completionEvent);
        }
    }
}
