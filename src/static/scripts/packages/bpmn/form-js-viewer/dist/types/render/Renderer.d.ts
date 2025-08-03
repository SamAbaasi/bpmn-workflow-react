/**
 * @typedef { { container } } Config
 * @typedef { import('didi').Injector } Injector
 * @typedef { import('../core/EventBus').default } EventBus
 * @typedef { import('../Form').default } Form
 */
/**
 * @param {Config} config
 * @param {EventBus} eventBus
 * @param {Form} form
 * @param {Injector} injector
 */
declare function Renderer(config: Config, eventBus: EventBus, form: Form, injector: Injector): void;
declare namespace Renderer {
    const $inject: string[];
}
export default Renderer;
export type Config = {
    container;
};
export type Injector = import('didi').Injector;
export type EventBus = import('../core/EventBus').default;
export type Form = import('../Form').default;
