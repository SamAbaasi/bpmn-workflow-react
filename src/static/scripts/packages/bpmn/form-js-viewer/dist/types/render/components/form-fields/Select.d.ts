declare function Select(props: any): import("preact").JSX.Element;
declare namespace Select {
    namespace config {
        export { type };
        export const keyed: boolean;
        export const label: string;
        export const group: string;
        export const emptyValue: any;
        export { sanitizeSingleSelectValue as sanitizeValue };
        export { createEmptyOptions as create };
    }
}
export default Select;
declare const type: "select";
import { sanitizeSingleSelectValue } from '../util/sanitizerUtil';
import { createEmptyOptions } from '../util/valuesUtil';
