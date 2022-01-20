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

const getEuclidianDistance = (cxa, cya, cxb, cyb) => {
    const xDist = cxa - cxb;
    const yDist = cya - cyb;
    return Math.sqrt((xDist * xDist) + (yDist * yDist))
}

const changeFocusHorizontal = (focusedElement, otherElements, goRight) => {
    // current: focusedElement
    const { minY, maxY, centreX, centreY } = getElementScope(focusedElement);

    // find all elements that have some vertical overlap with current
    // overlap at least 50% of height of one of the elements
    let verticalOverlaps = otherElements.filter(otherElement => {
        const { minY: minYOther, maxY: maxYOther } = getElementScope(otherElement);
        const overlap = getOverlap(minY, maxY, minYOther, maxYOther);
        return (overlap / (maxY - minY)) > 0.5|| (overlap / (maxYOther - minYOther)) > 0.5; 
    });

    if (verticalOverlaps.length === 0) {
        // none found overlapping, take whatever!
        verticalOverlaps = otherElements;
    }

    const overlapToSide = verticalOverlaps
        .filter(e => {
            // filter to those to the R / L of current
            const { centreX: cxOther } = getElementScope(e);
            return goRight ? (cxOther > centreX) : (cxOther < centreX);
        })
        .sort((a, b) => {
            const { centreY: cya, centreX: cxa } = getElementScope(a);
            const { centreY: cyb, centreX: cxb } = getElementScope(b);
            const distanceA = getEuclidianDistance(centreX, centreY, cxa, cya);
            const distanceB = getEuclidianDistance(centreX, centreY, cxb, cyb);
            return distanceA - distanceB;
        });
    if (overlapToSide.length > 0) overlapToSide[0].focus();
}

const changeFocusVertical = (focusedElement, otherElements, goUp) => {
    const { minX, maxX, centreY, centreX } = getElementScope(focusedElement);

    // find all elements that have some vertical overlap with current
    let horizontalOverlaps = otherElements.filter(otherElement => {
        const { minX: minXOther, maxX: maxXOther } = getElementScope(otherElement);
        const overlap = getOverlap(minX, maxX, minXOther, maxXOther);
        return (overlap / (maxX - minX)) > 0.5 || (overlap / (maxXOther - minXOther)) > 0.5; 
    });

    if (horizontalOverlaps.length === 0) {
        // none found overlapping, take whatever!
        horizontalOverlaps = otherElements;
    }

    const overlaps = horizontalOverlaps
        .filter(e => {
            // filter to those above/below of current
            const { centreY: cyOther } = getElementScope(e);
            return goUp ? (cyOther > centreY) : (cyOther < centreY);
        })
        .sort((a, b) => {
            const { centreY: cya, centreX: cxa } = getElementScope(a);
            const { centreY: cyb, centreX: cxb } = getElementScope(b);
            const distanceA = getEuclidianDistance(centreX, centreY, cxa, cya);
            const distanceB = getEuclidianDistance(centreX, centreY, cxb, cyb);
            return distanceA - distanceB;
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
        if (focusedElement.nodeName === 'INPUT' && focusedElement.type === 'range') return;
        changeFocusHorizontal(focusedElement, otherElements, false);
    }

    goRight() {
        const { focusedElement, otherElements } = this._getElements();
        if (!focusedElement) return;
        // if focussed is scrub bar, var form slider or volume
        // need to move slider, not move focus
        // what is UX?  maybe enter, then move, then enter???
        if (focusedElement.nodeName === 'INPUT' && focusedElement.type === 'range') return;
        changeFocusHorizontal(focusedElement, otherElements, true);
    }

    goUp() {
        const { focusedElement, otherElements } = this._getElements();
        if (!focusedElement) return;
        // if focussed is a dropdown...
        if (focusedElement.nodeName === 'SELECT') return;
        changeFocusVertical(focusedElement, otherElements, false);
    }

    goDown() {
        const { focusedElement, otherElements } = this._getElements();
        if (!focusedElement) return;
        // if focussed is a dropdown up/down should change selection, not move focus
        if (focusedElement.nodeName === 'SELECT') return;
        changeFocusVertical(focusedElement, otherElements, true);
    }

    enter() {
        const { focusedElement } = this._getElements();
        if (focusedElement) focusedElement.click();
    }
}

export default SpatialNavigationHandler;