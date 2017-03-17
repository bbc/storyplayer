// @flow

export type DataResolver = (name: string) => Promise<any>;

export default function (name: string): Promise<any> {
    return Promise.resolve(name);
}
