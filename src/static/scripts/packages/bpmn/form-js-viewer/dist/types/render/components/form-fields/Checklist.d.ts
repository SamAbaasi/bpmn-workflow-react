declare function Checklist(props: any): import("preact").JSX.Element;
declare namespace Checklist {
    namespace config {
        export { type };
        export const keyed: boolean;
        export const label: string;
        export const group: string;
        export const emptyValue: any[];
        export { sanitizeMultiSelectValue as sanitizeValue };
        export { createEmptyOptions as create };
    }
}
export default Checklist;
declare const type: "checklist";
import { sanitizeMultiSelectValue } from '../util/sanitizerUtil';
import { createEmptyOptions } from '../util/valuesUtil';
