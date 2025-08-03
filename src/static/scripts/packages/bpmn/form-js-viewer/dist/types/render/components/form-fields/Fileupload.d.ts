declare function Fileupload(props: any): import("preact").JSX.Element;
declare namespace Fileupload {
    namespace config {
        export { type };
        export const keyed: boolean;
        export const label: string;
        export const group: string;
        export const emptyValue: string;
        export function sanitizeValue({ value }: {
            value: any;
        }): string;
        export function create(options?: {}): {};
    }
}
export default Fileupload;
declare const type: "fileupload";
