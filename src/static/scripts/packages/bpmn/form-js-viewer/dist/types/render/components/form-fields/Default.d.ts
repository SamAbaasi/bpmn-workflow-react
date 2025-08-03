declare function FormComponent(props: any): import("preact").JSX.Element;
declare namespace FormComponent {
    namespace config {
        const type: string;
        const keyed: boolean;
        const label: any;
        const group: any;
        function create(options?: {}): {
            components: any[];
        };
    }
}
export default FormComponent;
