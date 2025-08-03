declare class Importer {
    /**
     * @constructor
     * @param { import('./FormFieldRegistry').default } formFieldRegistry
     * @param { import('./PathRegistry').default } pathRegistry
     * @param { import('./FieldFactory').default } fieldFactory
     * @param { import('./FormLayouter').default } formLayouter
     */
    constructor(formFieldRegistry: import('./FormFieldRegistry').default, pathRegistry: import('./PathRegistry').default, fieldFactory: import('./FieldFactory').default, formLayouter: import('./FormLayouter').default);
    _formFieldRegistry: import("./FormFieldRegistry").default;
    _pathRegistry: import("./PathRegistry").default;
    _fieldFactory: import("./FieldFactory").default;
    _formLayouter: import("./FormLayouter").default;
    /**
     * Import schema creating rows, fields, attaching additional
     * information to each field and adding fields to the
     * field registry.
     *
     * Additional information attached:
     *
     *   * `id` (unless present)
     *   * `_parent`
     *   * `_path`
     *
     * @param {any} schema
     *
     * @typedef {{ warnings: Error[], schema: any }} ImportResult
     * @returns {ImportResult}
     */
    importSchema(schema: any): {
        warnings: Error[];
        schema: any;
    };
    _cleanup(): void;
    /**
     * @param {{[x: string]: any}} fieldAttrs
     * @param {String} [parentId]
     * @param {number} [index]
     *
     * @return {any} field
     */
    importFormField(fieldAttrs: {
        [x: string]: any;
    }, parentId?: string, index?: number): any;
    /**
     * @param {Array<any>} components
     * @param {string} parentId
     *
     * @return {Array<any>} imported components
     */
    importFormFields(components: Array<any>, parentId: string): Array<any>;
}
declare namespace Importer {
    const $inject: string[];
}
export default Importer;
