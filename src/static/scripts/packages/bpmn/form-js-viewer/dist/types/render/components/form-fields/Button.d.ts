declare function Button(props: any): import("preact").JSX.Element;
declare namespace Button {
    namespace config {
        export { type };
        export const keyed: boolean;
        export const label: string;
        export const group: string;
        export function create(options?: {}): {
            action: string;
        };
    }
}
export default Button;
declare const type: "button";
