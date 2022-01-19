const getElementScope = (element) => {
    const { top, left, bottom, right } = element.getBoundingClientRect();
    const centreX = left + ((right - left) / 2);
    const centreY = top + ((bottom - top) / 2);
    return {
        centreX, centreY, minX: left, maxX: right, minY: top, maxY: bottom,
    };
}

const getOverlap = (minA, maxA, minB, maxB) => {
    if (minA >= maxB || minB >= maxA) return 0;
    if (minB > minA) return Math.min(...[maxB - minB, maxA - minB]);
    return Math.min(...[maxB - minA, maxA - minA]);
}

const changeFocusHorizontal = (focusedElement, otherElements, goRight) => {
    // current: focusedElement
    const { minY, maxY, centreX } = getElementScope(focusedElement);

    // find all elements that have some vertical overlap with current
    // overlap at least 50% of height of one of the elements
    const verticalOverlaps = otherElements.filter(otherElement => {
        const { minY: minYOther, maxY: maxYOther } = getElementScope(otherElement);
        const overlap = getOverlap(minY, maxY, minYOther, maxYOther);
        return (overlap / (maxY - minY)) > 0.5|| (overlap / (maxYOther - minYOther)) > 0.5; 
    });

    const overlapToSide = verticalOverlaps
        .filter(e => {
            // filter to those to the R / L of current
            const { centreX: cxOther } = getElementScope(e);
            return goRight ? (cxOther > centreX) : (cxOther < centreX);
        })
        .sort((a, b) => {
            const { centreX: cxa } = getElementScope(a);
            const { centreX: cxb } = getElementScope(b);
            const directionFactor = goRight ? 1 : -1
            const distanceA = (cxa - centreX) * directionFactor;
            const distanceB = (cxb - centreX) * directionFactor;
            // sort by closeness
            // should probably select according to vertical overlap too, if competition
            return distanceA - distanceB
        });
    if (overlapToSide.length > 0) overlapToSide[0].focus();
}

const changeFocusVertical = (focusedElement, otherElements, goUp) => {
    const { minX, maxX, centreY } = getElementScope(focusedElement);

    // find all elements that have some vertical overlap with current
    const horizontalOverlaps = otherElements.filter(otherElement => {
        const { minX: minXOther, maxX: maxXOther } = getElementScope(otherElement);
        const overlap = getOverlap(minX, maxX, minXOther, maxXOther);
        return (overlap / (maxX - minX)) > 0.5 || (overlap / (maxXOther - minXOther)) > 0.5; 
    });

    const overlaps = horizontalOverlaps
        .filter(e => {
            // filter to those above/below of current
            const { centreY: cyOther } = getElementScope(e);
            return goUp ? (cyOther > centreY) : (cyOther < centreY);
        })
        .sort((a, b) => {
            const { centreY: cya } = getElementScope(a);
            const { centreY: cyb } = getElementScope(b);
            // sort by closeness
            const directionFactor = goUp ? 1 : -1
            const distanceA = (cya - centreY) * directionFactor;
            const distanceB = (cyb - centreY) * directionFactor;
            // should probably select according to vertical overlap too, if competition
            return distanceB - distanceA;
        });
    if (overlaps.length > 0) overlaps[0].focus();
}

class SpatialNavigationHandler {

    _includeTransport = false;

    _includeContent = true;

    constructor(includeContent, includeTransport) {
        this._includeContent = includeContent;
        this._includeTransport = includeTransport;
    }

    _getElements() {
        // get all elements with given data
        const taggedTransportEls = this._includeTransport ? 
            document.querySelectorAll('[spatial-navigation-object="transport"]') : [];
        const taggedContentEls = this._includeContent ?
            document.querySelectorAll('[spatial-navigation-object="content"]') : [];
        
        const basicUiComponents = Array.from(taggedTransportEls);
        const contentUiComponents = Array.from(taggedContentEls);
        const uiComponents = [...basicUiComponents, ...contentUiComponents];
        let focusedElement = uiComponents.find(e => e === document.activeElement);
        if (!focusedElement) {
            focusedElement = uiComponents[0] || undefined;
        }
           
        const otherElements = uiComponents
            .filter(e => e !== focusedElement)
            .filter(e => !e.disabled);

        return {
            focusedElement,
            otherElements,
        }
    }

    goLeft() {
        const { focusedElement, otherElements } = this._getElements();
        if (!focusedElement) return;
        changeFocusHorizontal(focusedElement, otherElements, false);
    }

    goRight() {
        const { focusedElement, otherElements } = this._getElements();
        if (!focusedElement) return;
        changeFocusHorizontal(focusedElement, otherElements, true);
    }

    goUp() {
        const { focusedElement, otherElements } = this._getElements();
        if (!focusedElement) return;
        changeFocusVertical(focusedElement, otherElements, false);
    }

    goDown() {
        const { focusedElement, otherElements } = this._getElements();
        if (!focusedElement) return;
        changeFocusVertical(focusedElement, otherElements, true);
    }

    enter() {
        const { focusedElement } = this._getElements();
        if (focusedElement) focusedElement.click();
    }
}

// const handleSpatialNavigation = (eventCode) => {
//     console.log('ANDY spatial nav')
//     // add data id to each 'entity' to be interacted with
    
//     // get all elements with given data
//     const taggedTransportEls = document.querySelectorAll('[spatial-navigation-object="transport"]');
//     const taggedContentEls = document.querySelectorAll('[spatial-navigation-object="content"]');

//     // console.log('ANDY spatial UIs', taggedEls);
//     // if (taggedEls.length <= 1) return;

//     const basicUiComponents = Array.from(taggedTransportEls);
//     const contentUiComponents = Array.from(taggedContentEls);
//     const uiComponents = [...basicUiComponents, ...contentUiComponents];
//     let focusedElement = uiComponents.find(e => e === document.activeElement);
//     if (!focusedElement) {
//         // set focus to btlr?
//         focusedElement = uiComponents[0] || undefined;
//         console.log('ANDY no element focused', focusedElement);
//     }

//     const otherElements = uiComponents
//         .filter(e => e !== focusedElement)
//         .filter(e => !e.disabled);

//     // which is focused?
//     // where is LRUD?
//     if (eventCode === 'ArrowRight') {
//         changeFocusHorizontal(focusedElement, otherElements, true);
//     } else if (eventCode === 'ArrowLeft') {
//         changeFocusHorizontal(focusedElement, otherElements, false);
//     } else if (eventCode === 'ArrowUp' ) {
//         changeFocusVertical(focusedElement, otherElements, false);
//     } else if (eventCode === 'ArrowDown') {
//         changeFocusVertical(focusedElement, otherElements, true);
//     }
// }

export default SpatialNavigationHandler;