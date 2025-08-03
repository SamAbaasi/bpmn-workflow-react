declare class FormEditorActions extends EditorActions {
    constructor(eventBus: any, injector: any);
    _registerDefaultActions(injector: any): void;
}
declare namespace FormEditorActions {
    const $inject: string[];
}
export default FormEditorActions;
import EditorActions from 'diagram-js/lib/features/editor-actions/EditorActions';
