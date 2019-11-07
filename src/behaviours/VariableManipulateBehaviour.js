// @flow

import JsonLogic from 'json-logic-js';
import BaseBehaviour from './BaseBehaviour';
import logger from '../logger';

import { convertDotNotationToNestedObjects } from '../logic';

export default class VariableManipulateBehaviour extends BaseBehaviour {

    start(renderer: BaseRenderer) {
        // eslint-disable-next-line max-len
        logger.info(`ANDY starting manipulator behaviour ${JSON.stringify(this._behaviourDefinition)}`);
        const { operation, targetVariable } = this._behaviourDefinition;
        
        const controller = renderer.getController();

        const interestingVars = [];
        JsonLogic.uses_data(operation).forEach(cv => interestingVars.push(cv));

        return Promise.all(interestingVars.map(interestingVar =>
            controller.getVariableValue(interestingVar)
                .catch(() => null)
                .then(value => ({ key: interestingVar, value })))
        )
            .then(convertDotNotationToNestedObjects)
            .then((resolvedVars) => {
                const output = JsonLogic.apply(operation, resolvedVars);
                if (output) {
                    logger.info(`ANDY variable manipluated: ${targetVariable} set to ${output}`);
                    controller.setVariableValue(targetVariable, output);
                } else {
                    logger.warn('ANDY variable manipulation operation failed');
                }
                this._handleDone();
            }).catch(() => {
                logger.warn('ANDY variable manipulation operation failed');
                this._handleDone();
            });
    }
}