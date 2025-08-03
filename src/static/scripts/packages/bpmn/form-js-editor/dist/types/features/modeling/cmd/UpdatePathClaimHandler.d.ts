declare class UpdatePathClaimHandler {
    /**
     * @constructor
     * @param { import('@bpmn-io/form-js-viewer').PathRegistry } pathRegistry
     */
    constructor(pathRegistry: import('src/static/scripts/packages/bpmn/form-js-viewer').PathRegistry);
    _pathRegistry: import("src/static/scripts/packages/bpmn/form-js-viewer/dist/types/core/PathRegistry").default;
    execute(context: any): void;
    revert(context: any): void;
}
declare namespace UpdatePathClaimHandler {
    const $inject: string[];
}
export default UpdatePathClaimHandler;
