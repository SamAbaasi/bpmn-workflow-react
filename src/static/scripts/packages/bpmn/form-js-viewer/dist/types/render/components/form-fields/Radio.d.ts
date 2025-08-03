declare function Radio(props: any): import("preact").JSX.Element;
declare namespace Radio {
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
export default Radio;
declare const type: "radio";
import { sanitizeSingleSelectValue } from '../util/sanitizerUtil';
import { createEmptyOptions } from '../util/valuesUtil';
