declare namespace _default {
    const __depends__: {
        __init__: string[];
        formFields: (string | typeof import("../render/EditorFormFields").default)[];
        renderer: (string | typeof import("../render/Renderer").default)[];
    }[];
    const debounce: (string | typeof DebounceFactory)[];
    const eventBus: (string | typeof EventBus)[];
    const importer: (string | typeof Importer)[];
    const formFieldRegistry: (string | typeof FormFieldRegistry)[];
    const pathRegistry: (string | typeof PathRegistry)[];
    const formLayouter: (string | typeof FormLayouter)[];
    const formLayoutValidator: (string | typeof FormLayoutValidator)[];
    const fieldFactory: (string | typeof FieldFactory)[];
}
export default _default;
import DebounceFactory from './Debounce';
import EventBus from './EventBus';
import { Importer } from 'src/static/scripts/packages/bpmn/form-js-viewer';
import FormFieldRegistry from './FormFieldRegistry';
import { PathRegistry } from 'src/static/scripts/packages/bpmn/form-js-viewer';
import FormLayouter from './FormLayouter';
import FormLayoutValidator from './FormLayoutValidator';
import { FieldFactory } from 'src/static/scripts/packages/bpmn/form-js-viewer';
