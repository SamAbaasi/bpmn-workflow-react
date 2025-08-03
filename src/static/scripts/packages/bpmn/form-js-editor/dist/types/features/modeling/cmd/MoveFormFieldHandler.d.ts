declare class MoveFormFieldHandler {
    /**
     * @constructor
     * @param { import('../../../FormEditor').default } formEditor
     * @param { import('../../../core/FormFieldRegistry').default } formFieldRegistry
     * @param { import('@bpmn-io/form-js-viewer').PathRegistry } pathRegistry
     */
    constructor(formEditor: import('../../../FormEditor').default, formFieldRegistry: import('../../../core/FormFieldRegistry').default, pathRegistry: import('src/static/scripts/packages/bpmn/form-js-viewer').PathRegistry);
    _formEditor: import("../../../FormEditor").default;
    _formFieldRegistry: import("../../../core/FormFieldRegistry").default;
    _pathRegistry: import("src/static/scripts/packages/bpmn/form-js-viewer/dist/types/core/PathRegistry").default;
    execute(context: any): void;
    revert(context: any): void;
    moveFormField(context: any, revert: any): void;
}
declare namespace MoveFormFieldHandler {
    const $inject: string[];
}
export default MoveFormFieldHandler;
