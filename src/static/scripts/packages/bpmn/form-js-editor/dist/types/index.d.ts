/**
 * @typedef { import('./types').CreateFormEditorOptions } CreateFormEditorOptions
 */
/**
 * Create a form editor.
 *
 * @param {CreateFormEditorOptions} options
 *
 * @return {Promise<FormEditor>}
 */
export function createFormEditor(options: CreateFormEditorOptions): Promise<FormEditor>;
export type CreateFormEditorOptions = import('./types').CreateFormEditorOptions;
import FormEditor from './FormEditor';
import { schemaVersion } from 'src/static/scripts/packages/bpmn/form-js-viewer';
export { FormEditor, schemaVersion };
