declare function Checkbox(props: any): import("preact").JSX.Element;
declare namespace Checkbox {
    namespace config {
        export { type };
        export const keyed: boolean;
        export const label: string;
        export const group: string;
        export const emptyValue: boolean;
        export function sanitizeValue({ value }: {
            value: any;
        }): boolean;
        export function create(options?: {}): {};
    }
}
export default Checkbox;
declare const type: "checkbox";
