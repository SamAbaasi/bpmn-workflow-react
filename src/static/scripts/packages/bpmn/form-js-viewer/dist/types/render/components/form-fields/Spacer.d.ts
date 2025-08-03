declare function Spacer(props: any): import("preact").JSX.Element;
declare namespace Spacer {
    namespace config {
        export { type };
        export const keyed: boolean;
        export const label: string;
        export const group: string;
        export function create(options?: {}): {
            height: number;
        };
    }
}
export default Spacer;
declare const type: "spacer";
