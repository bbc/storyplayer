// @flow

// eslint-disable-next-line import/prefer-default-export
export const createElementWithClass = (type: string, id:string , classList: string[]): any => {
    const element = document.createElement(type);
    element.id = id;
    element.classList.add(...classList);
    return element;
};

