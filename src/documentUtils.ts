/**
 * Returns an element of a specific type with an id and class names
 * @param {string} type type of element to create
 * @param {string} id id of element
 * @param {string[]} classList class lists,
 * @returns {HTMLElement} Element with id and classnames attached
 */
export const createElementWithClass = (
    type: string,
    id: string,
    classList: string[],
): any => {
    const element = document.createElement(type)
    element.id = id
    element.classList.add(...classList)
    return element
}