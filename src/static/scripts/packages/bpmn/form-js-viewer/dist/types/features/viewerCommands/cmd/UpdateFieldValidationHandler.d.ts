declare class UpdateFieldValidationHandler {
    constructor(form: any, validator: any);
    _form: any;
    _validator: any;
    execute(context: any): void;
    revert(context: any): void;
}
declare namespace UpdateFieldValidationHandler {
    const $inject: string[];
}
export default UpdateFieldValidationHandler;
