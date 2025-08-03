declare class ViewerCommands {
    constructor(commandStack: any, eventBus: any);
    _commandStack: any;
    registerHandlers(): void;
    getHandlers(): {
        'formField.validation.update': typeof UpdateFieldValidationHandler;
    };
    updateFieldValidation(field: any, value: any): void;
}
declare namespace ViewerCommands {
    const $inject: string[];
}
export default ViewerCommands;
import UpdateFieldValidationHandler from './cmd/UpdateFieldValidationHandler';
