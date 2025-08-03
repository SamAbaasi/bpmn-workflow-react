declare function Datetime(props: any): import("preact").JSX.Element;
declare namespace Datetime {
    namespace config {
        export { type };
        export const keyed: boolean;
        export const label: string;
        export const group: string;
        export const emptyValue: any;
        export { sanitizeDateTimePickerValue as sanitizeValue };
        export function create(options?: {}): {};
    }
}
export default Datetime;
declare const type: "datetime";
import { sanitizeDateTimePickerValue } from '../util/sanitizerUtil';
