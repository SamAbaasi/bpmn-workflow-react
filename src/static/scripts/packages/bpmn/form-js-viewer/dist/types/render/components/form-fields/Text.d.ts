declare function Text(props: any): import("preact").JSX.Element;
declare namespace Text {
    namespace config {
        export { type };
        export const keyed: boolean;
        export const label: string;
        export const group: string;
        export function create(options?: {}): {
            text: string;
        };
    }
}
export default Text;
declare const type: "text";
