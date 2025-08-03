declare namespace _default {
    const __depends__: {
        __init__: string[];
        formFields: (string | typeof import("../render").FormFields)[];
        renderer: (string | typeof import("../render/Renderer").default)[];
    }[];
    const eventBus: (string | typeof EventBus)[];
    const importer: (string | typeof Importer)[];
    const fieldFactory: (string | typeof FieldFactory)[];
    const formFieldRegistry: (string | typeof FormFieldRegistry)[];
    const pathRegistry: (string | typeof PathRegistry)[];
    const formLayouter: (string | typeof FormLayouter)[];
    const validator: (string | typeof Validator)[];
}
export default _default;
import Importer from './Importer';
import FieldFactory from './FieldFactory';
import FormFieldRegistry from './FormFieldRegistry';
import PathRegistry from './PathRegistry';
import FormLayouter from './FormLayouter';
import EventBus from './EventBus';
import Validator from './Validator';
export { Importer, FieldFactory, FormFieldRegistry, PathRegistry, FormLayouter };
