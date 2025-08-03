export const MAX_COLUMNS_PER_ROW: 16;
export const MAX_COLUMNS: 16;
export const MIN_COLUMNS: 2;
export const MAX_FIELDS_PER_ROW: 4;
declare class FormLayoutValidator {
    /**
     * @constructor
     *
     * @param { import('./FormLayouter').default } formLayouter
     * @param { import('./FormFieldRegistry').default } formFieldRegistry
     */
    constructor(formLayouter: import('./FormLayouter').default, formFieldRegistry: import('./FormFieldRegistry').default);
    _formLayouter: import("src/static/scripts/packages/bpmn/form-js-viewer/dist/types/core/FormLayouter").default;
    _formFieldRegistry: import("./FormFieldRegistry").default;
    validateField(field: {}, columns: any, row: any): string;
}
declare namespace FormLayoutValidator {
    const $inject: string[];
}
export default FormLayoutValidator;
