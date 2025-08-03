/**
 * @typedef {object} Condition
 * @property {string} [hide]
 */
declare class ConditionChecker {
    constructor(formFieldRegistry: any, pathRegistry: any, eventBus: any);
    _formFieldRegistry: any;
    _pathRegistry: any;
    _eventBus: any;
    /**
     * For given data, remove properties based on condition.
     *
     * @param {Object<string, any>} properties
     * @param {Object<string, any>} data
     */
    applyConditions(properties: {
        [x: string]: any;
    }, data?: {
        [x: string]: any;
    }): {
        [x: string]: any;
    };
    /**
     * Check if given condition is met. Returns null for invalid/missing conditions.
     *
     * @param {string} condition
     * @param {import('../../types').Data} [data]
     *
     * @returns {boolean|null}
     */
    check(condition: string, data?: import('../../types').Data): boolean | null;
    /**
     * Check if hide condition is met.
     *
     * @param {Condition} condition
     * @param {Object<string, any>} data
     * @returns {boolean}
     */
    _checkHideCondition(condition: Condition, data: {
        [x: string]: any;
    }): boolean;
    _clearObjectValueRecursively(valuePath: any, obj: any): void;
}
declare namespace ConditionChecker {
    const $inject: string[];
}
export default ConditionChecker;
export type Condition = {
    hide?: string;
};
