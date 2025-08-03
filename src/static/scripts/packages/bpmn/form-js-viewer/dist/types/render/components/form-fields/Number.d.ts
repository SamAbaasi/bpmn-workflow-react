declare function Numberfield(props: any): import("preact").JSX.Element;
declare namespace Numberfield {
    namespace config {
        export { type };
        export const keyed: boolean;
        export const label: string;
        export const group: string;
        export const emptyValue: any;
        export function sanitizeValue({ value, formField }: {
            value: any;
            formField: any;
        }): any;
        export function create(options?: {}): {};
    }
}
export default Numberfield;
declare const type: "number";
