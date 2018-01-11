const RendererEvents = {
    STARTED: 'started',
    RENDERER_READY: 'rendererReady', // the renderer has loaded all media and is ready to play
    COMPLETED: 'completed', // the renderer has played all of its media+completed behaviours
    DESTROYED: 'destroyed', // the renderer has been succesfully destroyed
    COMPLETE_START_BEHAVIOURS: 'completeStartBehaviours', // ronseal.
    NEXT_BUTTON_CLICKED: 'nextButtonClicked', // ronseal
    BACK_BUTTON_CLICKED: 'backButtonClicked', // ronseal
    ADD_TO_DOM: 'addToDom', // one of the renderers wants to add an element to its div
    REMOVE_FROM_DOM: 'removeFromDom', // one of the renderers wants to remove an element from its div
};

export default RendererEvents;
