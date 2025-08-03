/**
 * Evaluate a string reactively based on the expressionLanguage and form data.
 * If the string is not an expression, it is returned as is.
 * Memoised to minimize re-renders.
 *
 * @param {string} value
 *
 */
export default function useExpressionEvaluation(value: string): any;
