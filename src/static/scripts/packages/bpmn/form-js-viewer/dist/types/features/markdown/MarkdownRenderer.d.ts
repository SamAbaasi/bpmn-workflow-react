declare class MarkdownRenderer {
    _converter: any;
    /**
     * Render markdown to HTML.
     *
     * @param {string} markdown - The markdown to render
     *
     * @returns {string} HTML
     */
    render(markdown: string): string;
}
declare namespace MarkdownRenderer {
    const $inject: any[];
}
export default MarkdownRenderer;
