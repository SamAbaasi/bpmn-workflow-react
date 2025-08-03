declare function Image(props: any): import("preact").JSX.Element;
declare namespace Image {
    namespace config {
        export { type };
        export const keyed: boolean;
        export const label: string;
        export const group: string;
        export function create(options?: {}): {};
    }
}
export default Image;
declare const type: "image";
