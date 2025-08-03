declare namespace _default {
    const __depends__: (import("didi").ModuleDeclaration | {
        __init__: string[];
        idBehavior: (string | typeof import("./behavior/IdBehavior").default)[];
        keyBehavior: (string | typeof import("./behavior/KeyBehavior").default)[];
        pathBehavior: (string | typeof import("./behavior/PathBehavior").default)[];
        validateBehavior: (string | typeof import("./behavior/ValidateBehavior").default)[];
    })[];
    const __init__: string[];
    const formLayoutUpdater: (string | typeof FormLayoutUpdater)[];
    const modeling: (string | typeof Modeling)[];
}
export default _default;
import FormLayoutUpdater from './FormLayoutUpdater';
import Modeling from './Modeling';
