declare class KeyBehavior extends CommandInterceptor {
    constructor(eventBus: any, modeling: any, formFields: any);
}
declare namespace KeyBehavior {
    const $inject: string[];
}
export default KeyBehavior;
import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';
