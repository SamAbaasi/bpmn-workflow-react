declare class IdBehavior extends CommandInterceptor {
    constructor(eventBus: any, modeling: any);
}
declare namespace IdBehavior {
    const $inject: string[];
}
export default IdBehavior;
import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';
