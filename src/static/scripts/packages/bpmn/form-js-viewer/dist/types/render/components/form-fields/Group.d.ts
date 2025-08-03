declare function Group(props: any): import("preact").JSX.Element;
declare namespace Group {
    namespace config {
        const type: string;
        const pathed: boolean;
        const label: string;
        const group: string;
        function create(options?: {}): {
            components: any[];
            showOutline: boolean;
        };
    }
}
export default Group;
