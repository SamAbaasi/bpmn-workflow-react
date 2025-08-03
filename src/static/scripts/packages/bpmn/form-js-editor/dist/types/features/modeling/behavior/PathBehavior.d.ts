declare class PathBehavior extends CommandInterceptor {
    constructor(eventBus: any, modeling: any, formFields: any);
}
declare namespace PathBehavior {
    const $inject: string[];
}
export default PathBehavior;
import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';
