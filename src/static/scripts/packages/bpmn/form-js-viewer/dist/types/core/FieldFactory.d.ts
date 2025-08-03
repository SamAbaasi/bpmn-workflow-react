declare class FieldFactory {
    /**
     * @constructor
     *
     * @param  formFieldRegistry
     * @param  formFields
     */
    constructor(formFieldRegistry: any, pathRegistry: any, formFields: any);
    _formFieldRegistry: any;
    _pathRegistry: any;
    _formFields: any;
    create(attrs: any, applyDefaults?: boolean): any;
    _ensureId(field: any): void;
    _ensureKey(field: any): void;
}
declare namespace FieldFactory {
    const $inject: string[];
}
export default FieldFactory;
