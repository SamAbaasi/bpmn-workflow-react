import Ids from 'ids';
import { isString, get, set, isObject, values, uniqueBy, isArray, isFunction, isNumber, bind, assign, isNil, groupBy, flatten, findIndex, isUndefined } from 'min-dash';
import Big from 'big.js';
import { parseExpression, parseUnaryTests, evaluate, unaryTest } from 'feelin';
//import { date } from 'feelin/dist/temporal';
import { evaluate as evaluate$1, parser, buildSimpleTree } from 'feelers';
import classNames from 'classnames';
import { jsx, jsxs, Fragment as Fragment$1 } from 'preact/jsx-runtime';
import { useContext, useMemo, useEffect, useRef, useState, useCallback, useLayoutEffect } from 'preact/hooks';
import { createContext, createElement, Fragment, render } from 'preact';
import * as React from 'preact/compat';
import { createPortal } from 'preact/compat';
import flatpickr from 'flatpickr';
import Markup from 'preact-markup';
import { Injector } from 'didi';
import showdown from 'showdown';
import { debounceTime, map, tap, distinctUntilChanged, delay } from 'rxjs/operators';
import { fromEvent, Subject } from 'rxjs';
import ShortcutButtonsPlugin from 'shortcut-buttons-flatpickr/dist/shortcut-buttons-flatpickr';
//import { ShortcutButtonsPlugin } from 'shortcut-buttons-flatpickr/dist/types/index.d';

const getFlavouredFeelVariableNames = (feelString, feelFlavour = 'expression', options = {}) => {
  const {
    depth = 0,
    specialDepthAccessors = {}
  } = options;
  if (!['expression', 'unaryTest'].includes(feelFlavour)) return [];
  const tree = feelFlavour === 'expression' ? parseExpression(feelString) : parseUnaryTests(feelString);
  const simpleExpressionTree = _buildSimpleFeelStructureTree(tree, feelString);
  const variables = function _unfoldVariables(node) {
    if (node.name === 'PathExpression') {
      if (Object.keys(specialDepthAccessors).length === 0) {
        return depth === 0 ? [_getVariableNameAtPathIndex(node, 0)] : [];
      }

      // if using special depth accessors, use a more complex extraction
      return Array.from(_smartExtractVariableNames(node, depth, specialDepthAccessors));
    }
    if (depth === 0 && node.name === 'VariableName') return [node.variableName];

    // for any other kind of node, traverse its children and flatten the result
    if (node.children) {
      const variables = node.children.reduce((acc, child) => {
        return acc.concat(_unfoldVariables(child));
      }, []);

      // if we are within a filter context, we need to remove the item variable as it is used for iteration there
      return node.name === 'FilterContext' ? variables.filter(name => name !== 'item') : variables;
    }
    return [];
  }(simpleExpressionTree);
  return [...new Set(variables)];
};

/**
 * Get the variable name at the specified index in a given path expression.
 *
 * @param {Object} root - The root node of the path expression tree.
 * @param {number} index - The index of the variable name to retrieve.
 * @returns {string|null} The variable name at the specified index or null if index is out of bounds.
 */
const _getVariableNameAtPathIndex = (root, index) => {
  const accessors = _deconstructPathExpression(root);
  return accessors[index] || null;
};

/**
 * Extracts the variables which are required of the external context for a given path expression.
 * This is done by traversing the path expression tree and keeping track of the current depth relative to the external context.
 *
 * @param {Object} node - The root node of the path expression tree.
 * @param {number} initialDepth - The depth at which the root node is located in the outer context.
 * @param {Object} specialDepthAccessors - Definitions of special keywords which represent more complex accesses of the outer context.
 * @returns {Set} - A set containing the extracted variable names.
 */
const _smartExtractVariableNames = (node, initialDepth, specialDepthAccessors) => {
  // depth info represents the previous (initialised as null) and current depth of the current accessor in the path expression
  // we track multiple of these to account for the fact that a path expression may be ambiguous due to special keywords
  let accessorDepthInfos = [{
    previous: null,
    current: initialDepth - 1
  }];
  const extractedVariables = new Set();
  const nodeAccessors = _deconstructPathExpression(node);
  for (let i = 0; i < nodeAccessors.length; i++) {
    const currentAccessor = nodeAccessors[i];
    if (currentAccessor in specialDepthAccessors) {
      const depthOffsets = specialDepthAccessors[currentAccessor];

      // if the current accessor is a special keyword, we need to expand the current depth info set
      // this is done to account for the ambiguity of keywords like parent, which may be used to access
      // the parent of the current node, or a child variable of the same name
      accessorDepthInfos = depthOffsets.reduce((accumulator, offset) => {
        return [...accumulator, ...accessorDepthInfos.map(depthInfo => ({
          previous: depthInfo.current,
          current: depthInfo.current + offset
        }))];
      }, []).filter(depthInfo => depthInfo.current >= -1); // discard all depth infos which are out of bounds
    } else {
      // if the current accessor is not a special keyword, we know it's simply accessing a child
      // hence we are now one level deeper in the tree and simply increment
      accessorDepthInfos = accessorDepthInfos.map(depthInfo => ({
        previous: depthInfo.current,
        current: depthInfo.current + 1
      }));
    }

    // finally, we check if for the current accessor, there is a scenario where:
    // previous it was at depth -1 (i.e. the root context), and is now at depth 0 (i.e. a variable)
    // these are the variables we need to request, so we add them to the set
    if (accessorDepthInfos.some(depthInfo => depthInfo.previous === -1 && depthInfo.current === 0)) {
      extractedVariables.add(currentAccessor);
    }
  }

  // we return a set to avoid duplicates
  return new Set(extractedVariables);
};

/**
 * Deconstructs a path expression tree into an array of components.
 *
 * @param {Object} root - The root node of the path expression tree.
 * @returns {Array<string>} An array of components in the path expression, in the correct order.
 */
const _deconstructPathExpression = root => {
  let node = root;
  let parts = [];

  // Traverse the tree and collect path components
  while (node.name === 'PathExpression') {
    parts.push(node.children[1].variableName);
    node = node.children[0];
  }

  // Add the last component to the array
  parts.push(node.variableName);

  // Reverse and return the array to get the correct order
  return parts.reverse();
};

/**
 * Builds a simplified feel structure tree from the given parse tree and feel string.
 * The nodes follow this structure: `{ name: string, children: Array, variableName?: string }`
 *
 * @param {Object} parseTree - The parse tree generated by a parser.
 * @param {string} feelString - The feel string used for parsing.
 * @returns {Object} The simplified feel structure tree.
 */
const _buildSimpleFeelStructureTree = (parseTree, feelString) => {
  const stack = [{
    children: []
  }];
  parseTree.iterate({
    enter: node => {
      const nodeRepresentation = {
        name: node.type.name,
        children: []
      };
      if (node.type.name === 'VariableName') {
        nodeRepresentation.variableName = feelString.slice(node.from, node.to);
      }
      stack.push(nodeRepresentation);
    },
    leave: () => {
      const result = stack.pop();
      const parent = stack[stack.length - 1];
      parent.children.push(result);
    }
  });
  return _extractFilterExpressions(stack[0].children[0]);
};

/**
 * Restructure the tree in such a way to bring filters (which create new contexts) to the root of the tree.
 * This is done to simplify the extraction of variables and match the context hierarchy.
 */
const _extractFilterExpressions = tree => {
  const flattenedExpressionTree = {
    name: 'Root',
    children: [tree]
  };
  const iterate = node => {
    if (node.children) {
      for (let x = 0; x < node.children.length; x++) {
        if (node.children[x].name === 'FilterExpression') {
          const filterTarget = node.children[x].children[0];
          const filterExpression = node.children[x].children[2];

          // bypass the filter expression
          node.children[x] = filterTarget;
          const taggedFilterExpression = {
            name: 'FilterContext',
            children: [filterExpression]
          };

          // append the filter expression to the root
          flattenedExpressionTree.children.push(taggedFilterExpression);

          // recursively iterate the expression
          iterate(filterExpression);
        } else {
          iterate(node.children[x]);
        }
      }
    }
  };
  iterate(tree);
  return flattenedExpressionTree;
};

class FeelExpressionLanguage {
  constructor(eventBus) {
    this._eventBus = eventBus;
  }

  /**
   * Determines if the given value is a FEEL expression.
   *
   * @param {any} value
   * @returns {boolean}
   *
   */
  isExpression(value) {
    return isString(value) && value.startsWith('=');
  }

  /**
   * Retrieve variable names from a given FEEL expression.
   *
   * @param {string} expression
   * @param {object} [options]
   * @param {string} [options.type]
   *
   * @returns {string[]}
   */
  getVariableNames(expression, options = {}) {
    const {
      type = 'expression'
    } = options;
    if (!this.isExpression(expression)) {
      return [];
    }
    if (!['unaryTest', 'expression'].includes(type)) {
      throw new Error('Unknown expression type: ' + type);
    }
    return getFlavouredFeelVariableNames(expression, type);
  }

  /**
   * Evaluate an expression.
   *
   * @param {string} expression
   * @param {import('../../types').Data} [data]
   *
   * @returns {any}
   */
  evaluate(expression, data = {}) {

    if (!expression) {
      return null;
    }
    if (!isString(expression) || !expression.startsWith('=')) {
      return null;
    }
    try {
      const result = evaluate(expression.slice(1), data);
      return result;
    } catch (error) {
      this._eventBus.fire('error', {
        error
      });
      return null;
    }
  }
}
FeelExpressionLanguage.$inject = ['eventBus'];

class FeelersTemplating {
  constructor() { }

  /**
   * Determines if the given value is a feelers template.
   *
   * @param {any} value
   * @returns {boolean}
   *
   */
  isTemplate(value) {
    return isString(value) && (value.startsWith('=') || /{{.*?}}/.test(value));
  }

  /**
   * Retrieve variable names from a given feelers template.
   *
   * @param {string} template
   *
   * @returns {string[]}
   */
  getVariableNames(template) {
    if (!this.isTemplate(template)) {
      return [];
    }
    const expressions = this._extractExpressionsWithDepth(template);

    // defines special accessors, and the change(s) in depth they could imply (e.g. parent can be used to access the parent context (depth - 1) or a child variable named parent (depth + 1)
    const specialDepthAccessors = {
      parent: [-1, 1],
      _parent_: [-1],
      this: [0, 1],
      _this_: [0]
    };
    return expressions.reduce((variables, {
      expression,
      depth
    }) => {
      return variables.concat(getFlavouredFeelVariableNames(expression, 'expression', {
        depth,
        specialDepthAccessors
      }));
    }, []);
  }

  /**
   * Evaluate a template.
   *
   * @param {string} template
   * @param {Object<string, any>} context
   * @param {Object} options
   * @param {boolean} [options.debug = false]
   * @param {boolean} [options.strict = false]
   * @param {Function} [options.buildDebugString]
   *
   * @returns
   */
  evaluate(template, context = {}, options = {}) {
    const {
      debug = false,
      strict = false,
      buildDebugString = err => ' {{⚠}} '
    } = options;
    return evaluate$1(template, context, {
      debug,
      strict,
      buildDebugString
    });
  }

  /**
  * @typedef {Object} ExpressionWithDepth
  * @property {number} depth - The depth of the expression in the syntax tree.
  * @property {string} expression - The extracted expression
  */

  /**
  * Extracts all feel expressions in the template along with their depth in the syntax tree.
  * The depth is incremented for child expressions of loops to account for context drilling.
  * @name extractExpressionsWithDepth
  * @param {string} template - A feelers template string.
  * @returns {Array<ExpressionWithDepth>} An array of objects, each containing the depth and the extracted expression.
  *
  * @example
  * const template = "Hello {{user}}, you have:{{#loop items}}\n- {{amount}} {{name}}{{/loop}}.";
  * const extractedExpressions = _extractExpressionsWithDepth(template);
  */
  _extractExpressionsWithDepth(template) {
    // build simplified feelers syntax tree
    const parseTree = parser.parse(template);
    const tree = buildSimpleTree(parseTree, template);
    return function _traverse(n, depth = 0) {
      if (['Feel', 'FeelBlock'].includes(n.name)) {
        return [{
          depth,
          expression: n.content
        }];
      }
      if (n.name === 'LoopSpanner') {
        const loopExpression = n.children[0].content;
        const childResults = n.children.slice(1).reduce((acc, child) => {
          return acc.concat(_traverse(child, depth + 1));
        }, []);
        return [{
          depth,
          expression: loopExpression
        }, ...childResults];
      }
      return n.children.reduce((acc, child) => {
        return acc.concat(_traverse(child, depth));
      }, []);
    }(tree);
  }
}
FeelersTemplating.$inject = [];

// config  ///////////////////

const MINUTES_IN_DAY = 60 * 24;
const DATETIME_SUBTYPES = {
  DATE: 'date',
  TIME: 'time',
  DATETIME: 'datetime'
};
const TIME_SERIALISING_FORMATS = {
  UTC_OFFSET: 'utc_offset',
  UTC_NORMALIZED: 'utc_normalized',
  NO_TIMEZONE: 'no_timezone'
};
const DATETIME_SUBTYPES_LABELS = {
  [DATETIME_SUBTYPES.DATE]: 'Date',
  [DATETIME_SUBTYPES.TIME]: 'Time',
  [DATETIME_SUBTYPES.DATETIME]: 'Date & Time'
};
const TIME_SERIALISINGFORMAT_LABELS = {
  [TIME_SERIALISING_FORMATS.UTC_OFFSET]: 'UTC offset',
  [TIME_SERIALISING_FORMATS.UTC_NORMALIZED]: 'UTC normalized',
  [TIME_SERIALISING_FORMATS.NO_TIMEZONE]: 'No timezone'
};
const DATETIME_SUBTYPE_PATH = ['subtype'];
//const DATE_LABEL_PATH = ['dateLabel'];
const DATE_LABEL_PATH = ['label'];
const DATE_DISALLOW_PAST_PATH = ['disallowPassedDates'];
const TIME_LABEL_PATH = ['timeLabel'];
const TIME_USE24H_PATH = ['use24h'];
const TIME_INTERVAL_PATH = ['timeInterval'];
const TIME_SERIALISING_FORMAT_PATH = ['timeSerializingFormat'];

const MEGA_DROPDOWN_VIEW_PATH = ['megaDropdownView'];

const LATLONG_SUBTYPES = {
  LAT: 'lat',
  LONG: 'long',
  LATLONG: 'latlong'
};
const LATLONG_SUBTYPES_LABELS = {
  [LATLONG_SUBTYPES.LAT]: 'Lat',
  [LATLONG_SUBTYPES.LONG]: 'Long',
  [LATLONG_SUBTYPES.LATLONG]: 'Lat & Long'
};
const LAT_LABEL_PATH = ['latLabel'];
const LONG_LABEL_PATH = ['longLabel'];
// config  ///////////////////

const VALUES_SOURCES = {
  STATIC: 'static',
  // INPUT: 'input',
  //EXPRESSION: 'expression',
  API: 'api'
};
const VALUES_SOURCE_DEFAULT = VALUES_SOURCES.STATIC;
const VALUES_SOURCES_LABELS = {
  [VALUES_SOURCES.STATIC]: 'Manual',
  [VALUES_SOURCES.INPUT]: 'Input data',
  [VALUES_SOURCES.EXPRESSION]: 'Expression',
  [VALUES_SOURCES.API]: 'Api',
};
const VALUES_SOURCES_PATHS = {
  [VALUES_SOURCES.STATIC]: ['values'],
  [VALUES_SOURCES.INPUT]: ['valuesKey'],
  [VALUES_SOURCES.EXPRESSION]: ['valuesExpression'],
  [VALUES_SOURCES.API]: ['valuesApi'],
};
const VALUES_SOURCES_DEFAULTS = {
  [VALUES_SOURCES.STATIC]: [{
    label: 'Value',
    value: 'value'
  }],
  [VALUES_SOURCES.INPUT]: '',
  [VALUES_SOURCES.EXPRESSION]: '=',
  [VALUES_SOURCES.API]: '',
};

// helpers ///////////////////

function getValuesSource(field) {
  for (const source of Object.values(VALUES_SOURCES)) {
    if (get(field, VALUES_SOURCES_PATHS[source]) !== undefined) {
      return source;
    }
  }
  return VALUES_SOURCE_DEFAULT;
}

function createInjector(bootstrapModules) {
  const injector = new Injector(bootstrapModules);
  injector.init();
  return injector;
}

/**
 * @param {string?} prefix
 *
 * @returns Element
 */
function createFormContainer(prefix = 'fjs') {
  const container = document.createElement('div');
  container.classList.add(`${prefix}-container`);
  return container;
}

const EXPRESSION_PROPERTIES = ['alt', 'appearance.prefixAdorner', 'appearance.suffixAdorner', 'conditional.hide', 'description', 'label', 'source', 'readonly', 'text', 'validate.min', 'validate.max', 'validate.minLength', 'validate.maxLength',
  'validate.lessThan', 'validate.lessThanOrEqual', 'validate.equal', 'validate.notEqual', 'validate.greaterThan', 'validate.greaterThanOrEqual', 'validate.maxTotalSize', 'validate.maxFileNumber', ''];
const TEMPLATE_PROPERTIES = ['alt', 'appearance.prefixAdorner', 'appearance.suffixAdorner', 'description', 'label', 'source', 'text'];
function isRequired(field) {
  return field.required;
}
function pathParse(path) {
  if (!path) {
    return [];
  }
  return path.split('.').map(key => {
    return isNaN(parseInt(key)) ? key : parseInt(key);
  });
}
function pathsEqual(a, b) {
  return a && b && a.length === b.length && a.every((value, index) => value === b[index]);
}
const indices = {};
function generateIndexForType(type) {
  if (type in indices) {
    indices[type]++;
  } else {
    indices[type] = 1;
  }
  return indices[type];
}
function generateIdForType(type) {
  return `${type}${generateIndexForType(type)}`;
}

/**
 * @template T
 * @param {T} data
 * @param {(this: any, key: string, value: any) => any} [replacer]
 * @return {T}
 */
function clone(data, replacer) {
  return JSON.parse(JSON.stringify(data, replacer));
}

/**
 * Parse the schema for input variables a form might make use of
 *
 * @param {any} schema
 *
 * @return {string[]}
 */
function getSchemaVariables(schema, options = {}) {
  const {
    expressionLanguage = new FeelExpressionLanguage(null),
    templating = new FeelersTemplating(),
    inputs = true,
    outputs = true
  } = options;
  if (!schema.components) {
    return [];
  }
  const getAllComponents = node => {
    const components = [];
    if (node.components) {
      node.components.forEach(component => {
        components.push(component);
        components.push(...getAllComponents(component));
      });
    }
    return components;
  };
  const variables = getAllComponents(schema).reduce((variables, component) => {
    const {
      valuesKey
    } = component;

    // collect input-only variables
    if (inputs) {
      if (valuesKey) {
        variables = [...variables, valuesKey];
      }
      EXPRESSION_PROPERTIES.forEach(prop => {
        const property = get(component, prop.split('.'));
        if (property && expressionLanguage.isExpression(property)) {
          const expressionVariables = expressionLanguage.getVariableNames(property, {
            type: 'expression'
          });
          variables = [...variables, ...expressionVariables];
        }
      });
      TEMPLATE_PROPERTIES.forEach(prop => {
        const property = get(component, prop.split('.'));
        if (property && !expressionLanguage.isExpression(property) && templating.isTemplate(property)) {
          const templateVariables = templating.getVariableNames(property);
          variables = [...variables, ...templateVariables];
        }
      });
    }
    return variables.filter(variable => variable !== undefined || variable !== null);
  }, []);
  const getBindingVariables = node => {
    const bindingVariable = [];

    // c.f. https://github.com/bpmn-io/form-js/issues/778 @Skaiir to remove?
    if (node.type === 'button') {
      return [];
    } else if (node.key) {
      return [node.key.split('.')[0]];
    } else if (node.path) {
      return [node.path.split('.')[0]];
    } else if (node.components) {
      node.components.forEach(component => {
        bindingVariable.push(...getBindingVariables(component));
      });
    }
    return bindingVariable;
  };

  // collect binding variables
  if (inputs || outputs) {
    variables.push(...getBindingVariables(schema));
  }

  // remove duplicates
  return Array.from(new Set(variables));
}
function runRecursively(formField, fn) {
  const components = formField.components || [];
  components.forEach((component, index) => {
    runRecursively(component, fn);
  });
  fn(formField);
}

/**
 * @typedef {object} Condition
 * @property {string} [hide]
 */

class ConditionChecker {
  constructor(formFieldRegistry, pathRegistry, eventBus) {
    this._formFieldRegistry = formFieldRegistry;
    this._pathRegistry = pathRegistry;
    this._eventBus = eventBus;
  }

  /**
   * For given data, remove properties based on condition.
   *
   * @param {Object<string, any>} properties
   * @param {Object<string, any>} data
   */
  applyConditions(properties, data = {}) {
    const newProperties = clone(properties);
    const form = this._formFieldRegistry.getAll().find(field => field.type === 'default');
    if (!form) {
      throw new Error('form field registry has no form');
    }
    this._pathRegistry.executeRecursivelyOnFields(form, ({
      field,
      isClosed,
      context
    }) => {
      const {
        conditional: condition
      } = field;
      context.isHidden = context.isHidden || condition && this._checkHideCondition(condition, data);

      // only clear the leaf nodes, as groups may both point to the same path
      if (context.isHidden && isClosed) {
        const valuePath = this._pathRegistry.getValuePath(field);
        this._clearObjectValueRecursively(valuePath, newProperties);
      }
    });
    return newProperties;
  }

  /**
   * Check if given condition is met. Returns null for invalid/missing conditions.
   *
   * @param {string} condition
   * @param {import('../../types').Data} [data]
   *
   * @returns {boolean|null}
   */
  check(condition, data = {}) {
    if (!condition) {
      return null;
    }
    if (!isString(condition) || !condition.startsWith('=')) {
      return null;
    }
    try {
      // cut off initial '='
      const result = unaryTest(condition.slice(1), data);
      return result;
    } catch (error) {
      this._eventBus.fire('error', {
        error
      });
      return null;
    }
  }

  /**
   * Check if hide condition is met.
   *
   * @param {Condition} condition
   * @param {Object<string, any>} data
   * @returns {boolean}
   */
  _checkHideCondition(condition, data) {
    if (!condition.hide) {
      return false;
    }
    const result = this.check(condition.hide, data);
    return result === true;
  }
  _clearObjectValueRecursively(valuePath, obj) {
    const workingValuePath = [...valuePath];
    let recurse = false;
    do {
      set(obj, workingValuePath, undefined);
      workingValuePath.pop();
      const parentObject = get(obj, workingValuePath);
      recurse = isObject(parentObject) && !values(parentObject).length && !!workingValuePath.length;
    } while (recurse);
  }
}
ConditionChecker.$inject = ['formFieldRegistry', 'pathRegistry', 'eventBus'];

var ExpressionLanguageModule = {
  __init__: ['expressionLanguage', 'templating', 'conditionChecker'],
  expressionLanguage: ['type', FeelExpressionLanguage],
  templating: ['type', FeelersTemplating],
  conditionChecker: ['type', ConditionChecker]
};

// bootstrap showdown to support github flavored markdown
showdown.setFlavor('github');
class MarkdownRenderer {
  constructor() {
    this._converter = new showdown.Converter();
  }

  /**
   * Render markdown to HTML.
   *
   * @param {string} markdown - The markdown to render
   *
   * @returns {string} HTML
   */
  render(markdown) {
    return this._converter.makeHtml(markdown);
  }
}
MarkdownRenderer.$inject = [];

var MarkdownModule = {
  __init__: ['markdownRenderer'],
  markdownRenderer: ['type', MarkdownRenderer]
};

/**
 * @typedef {import('didi').Injector} Injector
 *
 * @typedef {import('../core/Types').ElementLike} ElementLike
 *
 * @typedef {import('../core/EventBus').default} EventBus
 * @typedef {import('./CommandHandler').default} CommandHandler
 *
 * @typedef { any } CommandContext
 * @typedef { {
 *   new (...args: any[]) : CommandHandler
 * } } CommandHandlerConstructor
 * @typedef { {
 *   [key: string]: CommandHandler;
 * } } CommandHandlerMap
 * @typedef { {
 *   command: string;
 *   context: any;
 *   id?: any;
 * } } CommandStackAction
 * @typedef { {
 *   actions: CommandStackAction[];
 *   dirty: ElementLike[];
 *   trigger: 'execute' | 'undo' | 'redo' | 'clear' | null;
 *   atomic?: boolean;
 * } } CurrentExecution
 */

/**
 * A service that offers un- and redoable execution of commands.
 *
 * The command stack is responsible for executing modeling actions
 * in a un- and redoable manner. To do this it delegates the actual
 * command execution to {@link CommandHandler}s.
 *
 * Command handlers provide {@link CommandHandler#execute(ctx)} and
 * {@link CommandHandler#revert(ctx)} methods to un- and redo a command
 * identified by a command context.
 *
 *
 * ## Life-Cycle events
 *
 * In the process the command stack fires a number of life-cycle events
 * that other components to participate in the command execution.
 *
 *    * preExecute
 *    * preExecuted
 *    * execute
 *    * executed
 *    * postExecute
 *    * postExecuted
 *    * revert
 *    * reverted
 *
 * A special event is used for validating, whether a command can be
 * performed prior to its execution.
 *
 *    * canExecute
 *
 * Each of the events is fired as `commandStack.{eventName}` and
 * `commandStack.{commandName}.{eventName}`, respectively. This gives
 * components fine grained control on where to hook into.
 *
 * The event object fired transports `command`, the name of the
 * command and `context`, the command context.
 *
 *
 * ## Creating Command Handlers
 *
 * Command handlers should provide the {@link CommandHandler#execute(ctx)}
 * and {@link CommandHandler#revert(ctx)} methods to implement
 * redoing and undoing of a command.
 *
 * A command handler _must_ ensure undo is performed properly in order
 * not to break the undo chain. It must also return the shapes that
 * got changed during the `execute` and `revert` operations.
 *
 * Command handlers may execute other modeling operations (and thus
 * commands) in their `preExecute(d)` and `postExecute(d)` phases. The command
 * stack will properly group all commands together into a logical unit
 * that may be re- and undone atomically.
 *
 * Command handlers must not execute other commands from within their
 * core implementation (`execute`, `revert`).
 *
 *
 * ## Change Tracking
 *
 * During the execution of the CommandStack it will keep track of all
 * elements that have been touched during the command's execution.
 *
 * At the end of the CommandStack execution it will notify interested
 * components via an 'elements.changed' event with all the dirty
 * elements.
 *
 * The event can be picked up by components that are interested in the fact
 * that elements have been changed. One use case for this is updating
 * their graphical representation after moving / resizing or deletion.
 *
 * @see CommandHandler
 *
 * @param {EventBus} eventBus
 * @param {Injector} injector
 */
function CommandStack(eventBus, injector) {
  /**
   * A map of all registered command handlers.
   *
   * @type {CommandHandlerMap}
   */
  this._handlerMap = {};

  /**
   * A stack containing all re/undoable actions on the diagram
   *
   * @type {CommandStackAction[]}
   */
  this._stack = [];

  /**
   * The current index on the stack
   *
   * @type {number}
   */
  this._stackIdx = -1;

  /**
   * Current active commandStack execution
   *
   * @type {CurrentExecution}
   */
  this._currentExecution = {
    actions: [],
    dirty: [],
    trigger: null
  };

  /**
   * @type {Injector}
   */
  this._injector = injector;

  /**
   * @type EventBus
   */
  this._eventBus = eventBus;

  /**
   * @type { number }
   */
  this._uid = 1;
  eventBus.on(['diagram.destroy', 'diagram.clear'], function () {
    this.clear(false);
  }, this);
}
CommandStack.$inject = ['eventBus', 'injector'];

/**
 * Execute a command.
 *
 * @param {string} command The command to execute.
 * @param {CommandContext} context The context with which to execute the command.
 */
CommandStack.prototype.execute = function (command, context) {
  if (!command) {
    throw new Error('command required');
  }
  this._currentExecution.trigger = 'execute';
  const action = {
    command: command,
    context: context
  };
  this._pushAction(action);
  this._internalExecute(action);
  this._popAction();
};

/**
 * Check whether a command can be executed.
 *
 * Implementors may hook into the mechanism on two ways:
 *
 *   * in event listeners:
 *
 *     Users may prevent the execution via an event listener.
 *     It must prevent the default action for `commandStack.(<command>.)canExecute` events.
 *
 *   * in command handlers:
 *
 *     If the method {@link CommandHandler#canExecute} is implemented in a handler
 *     it will be called to figure out whether the execution is allowed.
 *
 * @param {string} command The command to execute.
 * @param {CommandContext} context The context with which to execute the command.
 *
 * @return {boolean} Whether the command can be executed with the given context.
 */
CommandStack.prototype.canExecute = function (command, context) {
  const action = {
    command: command,
    context: context
  };
  const handler = this._getHandler(command);
  let result = this._fire(command, 'canExecute', action);

  // handler#canExecute will only be called if no listener
  // decided on a result already
  if (result === undefined) {
    if (!handler) {
      return false;
    }
    if (handler.canExecute) {
      result = handler.canExecute(context);
    }
  }
  return result;
};

/**
 * Clear the command stack, erasing all undo / redo history.
 *
 * @param {boolean} [emit=true] Whether to fire an event. Defaults to `true`.
 */
CommandStack.prototype.clear = function (emit) {
  this._stack.length = 0;
  this._stackIdx = -1;
  if (emit !== false) {
    this._fire('changed', {
      trigger: 'clear'
    });
  }
};

/**
 * Undo last command(s)
 */
CommandStack.prototype.undo = function () {
  let action = this._getUndoAction(),
    next;
  if (action) {
    this._currentExecution.trigger = 'undo';
    this._pushAction(action);
    while (action) {
      this._internalUndo(action);
      next = this._getUndoAction();
      if (!next || next.id !== action.id) {
        break;
      }
      action = next;
    }
    this._popAction();
  }
};

/**
 * Redo last command(s)
 */
CommandStack.prototype.redo = function () {
  let action = this._getRedoAction(),
    next;
  if (action) {
    this._currentExecution.trigger = 'redo';
    this._pushAction(action);
    while (action) {
      this._internalExecute(action, true);
      next = this._getRedoAction();
      if (!next || next.id !== action.id) {
        break;
      }
      action = next;
    }
    this._popAction();
  }
};

/**
 * Register a handler instance with the command stack.
 *
 * @param {string} command Command to be executed.
 * @param {CommandHandler} handler Handler to execute the command.
 */
CommandStack.prototype.register = function (command, handler) {
  this._setHandler(command, handler);
};

/**
 * Register a handler type with the command stack  by instantiating it and
 * injecting its dependencies.
 *
 * @param {string} command Command to be executed.
 * @param {CommandHandlerConstructor} handlerCls Constructor to instantiate a {@link CommandHandler}.
 */
CommandStack.prototype.registerHandler = function (command, handlerCls) {
  if (!command || !handlerCls) {
    throw new Error('command and handlerCls must be defined');
  }
  const handler = this._injector.instantiate(handlerCls);
  this.register(command, handler);
};

/**
 * @return {boolean}
 */
CommandStack.prototype.canUndo = function () {
  return !!this._getUndoAction();
};

/**
 * @return {boolean}
 */
CommandStack.prototype.canRedo = function () {
  return !!this._getRedoAction();
};

// stack access  //////////////////////

CommandStack.prototype._getRedoAction = function () {
  return this._stack[this._stackIdx + 1];
};
CommandStack.prototype._getUndoAction = function () {
  return this._stack[this._stackIdx];
};

// internal functionality //////////////////////

CommandStack.prototype._internalUndo = function (action) {
  const command = action.command,
    context = action.context;
  const handler = this._getHandler(command);

  // guard against illegal nested command stack invocations
  this._atomicDo(() => {
    this._fire(command, 'revert', action);
    if (handler.revert) {
      this._markDirty(handler.revert(context));
    }
    this._revertedAction(action);
    this._fire(command, 'reverted', action);
  });
};
CommandStack.prototype._fire = function (command, qualifier, event) {
  if (arguments.length < 3) {
    event = qualifier;
    qualifier = null;
  }
  const names = qualifier ? [command + '.' + qualifier, qualifier] : [command];
  let result;
  event = this._eventBus.createEvent(event);
  for (const name of names) {
    result = this._eventBus.fire('commandStack.' + name, event);
    if (event.cancelBubble) {
      break;
    }
  }
  return result;
};
CommandStack.prototype._createId = function () {
  return this._uid++;
};
CommandStack.prototype._atomicDo = function (fn) {
  const execution = this._currentExecution;
  execution.atomic = true;
  try {
    fn();
  } finally {
    execution.atomic = false;
  }
};
CommandStack.prototype._internalExecute = function (action, redo) {
  const command = action.command,
    context = action.context;
  const handler = this._getHandler(command);
  if (!handler) {
    throw new Error('no command handler registered for <' + command + '>');
  }
  this._pushAction(action);
  if (!redo) {
    this._fire(command, 'preExecute', action);
    if (handler.preExecute) {
      handler.preExecute(context);
    }
    this._fire(command, 'preExecuted', action);
  }

  // guard against illegal nested command stack invocations
  this._atomicDo(() => {
    this._fire(command, 'execute', action);
    if (handler.execute) {
      // actual execute + mark return results as dirty
      this._markDirty(handler.execute(context));
    }

    // log to stack
    this._executedAction(action, redo);
    this._fire(command, 'executed', action);
  });
  if (!redo) {
    this._fire(command, 'postExecute', action);
    if (handler.postExecute) {
      handler.postExecute(context);
    }
    this._fire(command, 'postExecuted', action);
  }
  this._popAction();
};
CommandStack.prototype._pushAction = function (action) {
  const execution = this._currentExecution,
    actions = execution.actions;
  const baseAction = actions[0];
  if (execution.atomic) {
    throw new Error('illegal invocation in <execute> or <revert> phase (action: ' + action.command + ')');
  }
  if (!action.id) {
    action.id = baseAction && baseAction.id || this._createId();
  }
  actions.push(action);
};
CommandStack.prototype._popAction = function () {
  const execution = this._currentExecution,
    trigger = execution.trigger,
    actions = execution.actions,
    dirty = execution.dirty;
  actions.pop();
  if (!actions.length) {
    this._eventBus.fire('elements.changed', {
      elements: uniqueBy('id', dirty.reverse())
    });
    dirty.length = 0;
    this._fire('changed', {
      trigger: trigger
    });
    execution.trigger = null;
  }
};
CommandStack.prototype._markDirty = function (elements) {
  const execution = this._currentExecution;
  if (!elements) {
    return;
  }
  elements = isArray(elements) ? elements : [elements];
  execution.dirty = execution.dirty.concat(elements);
};
CommandStack.prototype._executedAction = function (action, redo) {
  const stackIdx = ++this._stackIdx;
  if (!redo) {
    this._stack.splice(stackIdx, this._stack.length, action);
  }
};
CommandStack.prototype._revertedAction = function (action) {
  this._stackIdx--;
};
CommandStack.prototype._getHandler = function (command) {
  return this._handlerMap[command];
};
CommandStack.prototype._setHandler = function (command, handler) {
  if (!command || !handler) {
    throw new Error('command and handler required');
  }
  if (this._handlerMap[command]) {
    throw new Error('overriding handler for command <' + command + '>');
  }
  this._handlerMap[command] = handler;
};

/**
 * @type { import('didi').ModuleDeclaration }
 */
var commandModule = {
  commandStack: ['type', CommandStack]
};

class UpdateFieldValidationHandler {
  constructor(form, validator) {
    this._form = form;
    this._validator = validator;
  }
  execute(context) {
    const {
      field,
      value
    } = context;
    const {
      errors
    } = this._form._getState();
    context.oldErrors = clone(errors);
    const fieldErrors = this._validator.validateField(field, value);
    const updatedErrors = set(errors, [field.id], fieldErrors.length ? fieldErrors : undefined);
    this._form._setState({
      errors: updatedErrors
    });
  }
  revert(context) {
    this._form._setState({
      errors: context.oldErrors
    });
  }
}
UpdateFieldValidationHandler.$inject = ['form', 'validator'];

class ViewerCommands {
  constructor(commandStack, eventBus) {
    this._commandStack = commandStack;
    eventBus.on('form.init', () => {
      this.registerHandlers();
    });
  }
  registerHandlers() {
    Object.entries(this.getHandlers()).forEach(([id, handler]) => {
      this._commandStack.registerHandler(id, handler);
    });
  }
  getHandlers() {
    return {
      'formField.validation.update': UpdateFieldValidationHandler
    };
  }
  updateFieldValidation(field, value) {
    const context = {
      field,
      value
    };
    this._commandStack.execute('formField.validation.update', context);
  }
}
ViewerCommands.$inject = ['commandStack', 'eventBus'];

var ViewerCommandsModule = {
  __depends__: [commandModule],
  __init__: ['viewerCommands'],
  viewerCommands: ['type', ViewerCommands]
};

var FN_REF = '__fn';
var DEFAULT_PRIORITY = 1000;
var slice = Array.prototype.slice;

/**
 * @typedef { {
 *   stopPropagation(): void;
 *   preventDefault(): void;
 *   cancelBubble: boolean;
 *   defaultPrevented: boolean;
 *   returnValue: any;
 * } } Event
 */

/**
 * @template E
 *
 * @typedef { (event: E & Event, ...any) => any } EventBusEventCallback
 */

/**
 * @typedef { {
 *  priority: number;
 *  next: EventBusListener | null;
 *  callback: EventBusEventCallback<any>;
 * } } EventBusListener
 */

/**
 * A general purpose event bus.
 *
 * This component is used to communicate across a diagram instance.
 * Other parts of a diagram can use it to listen to and broadcast events.
 *
 *
 * ## Registering for Events
 *
 * The event bus provides the {@link EventBus#on} and {@link EventBus#once}
 * methods to register for events. {@link EventBus#off} can be used to
 * remove event registrations. Listeners receive an instance of {@link Event}
 * as the first argument. It allows them to hook into the event execution.
 *
 * ```javascript
 *
 * // listen for event
 * eventBus.on('foo', function(event) {
 *
 *   // access event type
 *   event.type; // 'foo'
 *
 *   // stop propagation to other listeners
 *   event.stopPropagation();
 *
 *   // prevent event default
 *   event.preventDefault();
 * });
 *
 * // listen for event with custom payload
 * eventBus.on('bar', function(event, payload) {
 *   console.log(payload);
 * });
 *
 * // listen for event returning value
 * eventBus.on('foobar', function(event) {
 *
 *   // stop event propagation + prevent default
 *   return false;
 *
 *   // stop event propagation + return custom result
 *   return {
 *     complex: 'listening result'
 *   };
 * });
 *
 *
 * // listen with custom priority (default=1000, higher is better)
 * eventBus.on('priorityfoo', 1500, function(event) {
 *   console.log('invoked first!');
 * });
 *
 *
 * // listen for event and pass the context (`this`)
 * eventBus.on('foobar', function(event) {
 *   this.foo();
 * }, this);
 * ```
 *
 *
 * ## Emitting Events
 *
 * Events can be emitted via the event bus using {@link EventBus#fire}.
 *
 * ```javascript
 *
 * // false indicates that the default action
 * // was prevented by listeners
 * if (eventBus.fire('foo') === false) {
 *   console.log('default has been prevented!');
 * };
 *
 *
 * // custom args + return value listener
 * eventBus.on('sum', function(event, a, b) {
 *   return a + b;
 * });
 *
 * // you can pass custom arguments + retrieve result values.
 * var sum = eventBus.fire('sum', 1, 2);
 * console.log(sum); // 3
 * ```
 */
function EventBus() {
  /**
   * @type { Record<string, EventBusListener> }
   */
  this._listeners = {};

  // cleanup on destroy on lowest priority to allow
  // message passing until the bitter end
  this.on('diagram.destroy', 1, this._destroy, this);
}

/**
 * Register an event listener for events with the given name.
 *
 * The callback will be invoked with `event, ...additionalArguments`
 * that have been passed to {@link EventBus#fire}.
 *
 * Returning false from a listener will prevent the events default action
 * (if any is specified). To stop an event from being processed further in
 * other listeners execute {@link Event#stopPropagation}.
 *
 * Returning anything but `undefined` from a listener will stop the listener propagation.
 *
 * @template T
 *
 * @param {string|string[]} events to subscribe to
 * @param {number} [priority=1000] listen priority
 * @param {EventBusEventCallback<T>} callback
 * @param {any} [that] callback context
 */
EventBus.prototype.on = function (events, priority, callback, that) {
  events = isArray(events) ? events : [events];
  if (isFunction(priority)) {
    that = callback;
    callback = priority;
    priority = DEFAULT_PRIORITY;
  }
  if (!isNumber(priority)) {
    throw new Error('priority must be a number');
  }
  var actualCallback = callback;
  if (that) {
    actualCallback = bind(callback, that);

    // make sure we remember and are able to remove
    // bound callbacks via {@link #off} using the original
    // callback
    actualCallback[FN_REF] = callback[FN_REF] || callback;
  }
  var self = this;
  events.forEach(function (e) {
    self._addListener(e, {
      priority: priority,
      callback: actualCallback,
      next: null
    });
  });
};

/**
 * Register an event listener that is called only once.
 *
 * @template T
 *
 * @param {string|string[]} events to subscribe to
 * @param {number} [priority=1000] the listen priority
 * @param {EventBusEventCallback<T>} callback
 * @param {any} [that] callback context
 */
EventBus.prototype.once = function (events, priority, callback, that) {
  var self = this;
  if (isFunction(priority)) {
    that = callback;
    callback = priority;
    priority = DEFAULT_PRIORITY;
  }
  if (!isNumber(priority)) {
    throw new Error('priority must be a number');
  }
  function wrappedCallback() {
    wrappedCallback.__isTomb = true;
    var result = callback.apply(that, arguments);
    self.off(events, wrappedCallback);
    return result;
  }

  // make sure we remember and are able to remove
  // bound callbacks via {@link #off} using the original
  // callback
  wrappedCallback[FN_REF] = callback;
  this.on(events, priority, wrappedCallback);
};

/**
 * Removes event listeners by event and callback.
 *
 * If no callback is given, all listeners for a given event name are being removed.
 *
 * @param {string|string[]} events
 * @param {EventBusEventCallback} [callback]
 */
EventBus.prototype.off = function (events, callback) {
  events = isArray(events) ? events : [events];
  var self = this;
  events.forEach(function (event) {
    self._removeListener(event, callback);
  });
};

/**
 * Create an event recognized be the event bus.
 *
 * @param {Object} data Event data.
 *
 * @return {Event} An event that will be recognized by the event bus.
 */
EventBus.prototype.createEvent = function (data) {
  var event = new InternalEvent();
  event.init(data);
  return event;
};

/**
 * Fires an event.
 *
 * @example
 *
 * ```javascript
 * // fire event by name
 * events.fire('foo');
 *
 * // fire event object with nested type
 * var event = { type: 'foo' };
 * events.fire(event);
 *
 * // fire event with explicit type
 * var event = { x: 10, y: 20 };
 * events.fire('element.moved', event);
 *
 * // pass additional arguments to the event
 * events.on('foo', function(event, bar) {
 *   alert(bar);
 * });
 *
 * events.fire({ type: 'foo' }, 'I am bar!');
 * ```
 *
 * @param {string} [type] event type
 * @param {Object} [data] event or event data
 * @param {...any} [args] additional arguments the callback will be called with.
 *
 * @return {any} The return value. Will be set to `false` if the default was prevented.
 */
EventBus.prototype.fire = function (type, data) {
  var event, firstListener, returnValue, args;
  args = slice.call(arguments);
  if (typeof type === 'object') {
    data = type;
    type = data.type;
  }
  if (!type) {
    throw new Error('no event type specified');
  }
  firstListener = this._listeners[type];
  if (!firstListener) {
    return;
  }

  // we make sure we fire instances of our home made
  // events here. We wrap them only once, though
  if (data instanceof InternalEvent) {
    // we are fine, we alread have an event
    event = data;
  } else {
    event = this.createEvent(data);
  }

  // ensure we pass the event as the first parameter
  args[0] = event;

  // original event type (in case we delegate)
  var originalType = event.type;

  // update event type before delegation
  if (type !== originalType) {
    event.type = type;
  }
  try {
    returnValue = this._invokeListeners(event, args, firstListener);
  } finally {
    // reset event type after delegation
    if (type !== originalType) {
      event.type = originalType;
    }
  }

  // set the return value to false if the event default
  // got prevented and no other return value exists
  if (returnValue === undefined && event.defaultPrevented) {
    returnValue = false;
  }
  return returnValue;
};

/**
 * Handle an error by firing an event.
 *
 * @param {Error} error The error to be handled.
 *
 * @return {boolean} Whether the error was handled.
 */
EventBus.prototype.handleError = function (error) {
  return this.fire('error', {
    error: error
  }) === false;
};
EventBus.prototype._destroy = function () {
  this._listeners = {};
};

/**
 * @param {Event} event
 * @param {any[]} args
 * @param {EventBusListener} listener
 *
 * @return {any}
 */
EventBus.prototype._invokeListeners = function (event, args, listener) {
  var returnValue;
  while (listener) {
    // handle stopped propagation
    if (event.cancelBubble) {
      break;
    }
    returnValue = this._invokeListener(event, args, listener);
    listener = listener.next;
  }
  return returnValue;
};

/**
 * @param {Event} event
 * @param {any[]} args
 * @param {EventBusListener} listener
 *
 * @return {any}
 */
EventBus.prototype._invokeListener = function (event, args, listener) {
  var returnValue;
  if (listener.callback.__isTomb) {
    return returnValue;
  }
  try {
    // returning false prevents the default action
    returnValue = invokeFunction(listener.callback, args);

    // stop propagation on return value
    if (returnValue !== undefined) {
      event.returnValue = returnValue;
      event.stopPropagation();
    }

    // prevent default on return false
    if (returnValue === false) {
      event.preventDefault();
    }
  } catch (error) {
    if (!this.handleError(error)) {
      console.error('unhandled error in event listener', error);
      throw error;
    }
  }
  return returnValue;
};

/**
 * Add new listener with a certain priority to the list
 * of listeners (for the given event).
 *
 * The semantics of listener registration / listener execution are
 * first register, first serve: New listeners will always be inserted
 * after existing listeners with the same priority.
 *
 * Example: Inserting two listeners with priority 1000 and 1300
 *
 *    * before: [ 1500, 1500, 1000, 1000 ]
 *    * after: [ 1500, 1500, (new=1300), 1000, 1000, (new=1000) ]
 *
 * @param {string} event
 * @param {EventBusListener} listener
 */
EventBus.prototype._addListener = function (event, newListener) {
  var listener = this._getListeners(event),
    previousListener;

  // no prior listeners
  if (!listener) {
    this._setListeners(event, newListener);
    return;
  }

  // ensure we order listeners by priority from
  // 0 (high) to n > 0 (low)
  while (listener) {
    if (listener.priority < newListener.priority) {
      newListener.next = listener;
      if (previousListener) {
        previousListener.next = newListener;
      } else {
        this._setListeners(event, newListener);
      }
      return;
    }
    previousListener = listener;
    listener = listener.next;
  }

  // add new listener to back
  previousListener.next = newListener;
};

/**
 * @param {string} name
 *
 * @return {EventBusListener}
 */
EventBus.prototype._getListeners = function (name) {
  return this._listeners[name];
};

/**
 * @param {string} name
 * @param {EventBusListener} listener
 */
EventBus.prototype._setListeners = function (name, listener) {
  this._listeners[name] = listener;
};
EventBus.prototype._removeListener = function (event, callback) {
  var listener = this._getListeners(event),
    nextListener,
    previousListener,
    listenerCallback;
  if (!callback) {
    // clear listeners
    this._setListeners(event, null);
    return;
  }
  while (listener) {
    nextListener = listener.next;
    listenerCallback = listener.callback;
    if (listenerCallback === callback || listenerCallback[FN_REF] === callback) {
      if (previousListener) {
        previousListener.next = nextListener;
      } else {
        // new first listener
        this._setListeners(event, nextListener);
      }
    }
    previousListener = listener;
    listener = nextListener;
  }
};

/**
 * A event that is emitted via the event bus.
 */
function InternalEvent() { }
InternalEvent.prototype.stopPropagation = function () {
  this.cancelBubble = true;
};
InternalEvent.prototype.preventDefault = function () {
  this.defaultPrevented = true;
};
InternalEvent.prototype.init = function (data) {
  assign(this, data || {});
};

/**
 * Invoke function. Be fast...
 *
 * @param {Function} fn
 * @param {any[]} args
 *
 * @return {any}
 */
function invokeFunction(fn, args) {
  return fn.apply(null, args);
}

function countDecimals(number) {
  const num = Big(number);
  if (num.toString() === num.toFixed(0)) return 0;
  return num.toFixed().split('.')[1].length || 0;
}
function isValidNumber(value) {
  return (typeof value === 'number' || typeof value === 'string') && value !== '' && !isNaN(Number(value));
}

function willKeyProduceValidNumber(key, previousValue, caretIndex, selectionWidth, decimalDigits) {
  // Dot and comma are both treated as dot
  previousValue = previousValue.replace(',', '.');
  const isFirstDot = !previousValue.includes('.') && (key === '.' || key === ',');
  const isFirstMinus = !previousValue.includes('-') && key === '-' && caretIndex === 0;
  const keypressIsNumeric = /^[0-9]$/i.test(key);
  const dotIndex = previousValue === undefined ? -1 : previousValue.indexOf('.');

  // If the caret is positioned after a dot, and the current decimal digits count is equal or greater to the maximum, disallow the key press
  const overflowsDecimalSpace = typeof decimalDigits === 'number' && selectionWidth === 0 && dotIndex !== -1 && previousValue.includes('.') && previousValue.split('.')[1].length >= decimalDigits && caretIndex > dotIndex;
  const keypressIsAllowedChar = keypressIsNumeric || decimalDigits !== 0 && isFirstDot || isFirstMinus;
  return keypressIsAllowedChar && !overflowsDecimalSpace;
}
function isNullEquivalentValue(value) {
  return value === undefined || value === null || value === '';
}

const EMAIL_PATTERN = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,60}[a-zA-Z0-9])?)+.[a-zA-Z0-9]*$/;
const PHONE_PATTERN = /0?\d{8}$/;
const VALIDATE_FEEL_PROPERTIES = ['min', 'max', 'minLength', 'maxLength', 'lessThan', 'lessThanOrEqual', 'equal', 'notEqual', 'greaterThan', 'greaterThanOrEqual', 'domainType', 'domainList', 'blacklistAttachment', 'attachedType', 'whitelistAttachment', 'maxTotalSize', 'maxFileNumber'];
class Validator {
  constructor(expressionLanguage, conditionChecker, form) {
    this._expressionLanguage = expressionLanguage;
    this._conditionChecker = conditionChecker;
    this._form = form;
  }
  validateField(field, value) {
    const {
      type,
      validate
    } = field;
    let errors = [];
    if (type === 'number') {
      const {
        decimalDigits,
        increment
      } = field;
      if (value === 'NaN') {
        errors = [...errors, 'Value is not a number.'];
      } else if (value) {
        if (decimalDigits >= 0 && countDecimals(value) > decimalDigits) {
          errors = [...errors, 'Value is expected to ' + (decimalDigits === 0 ? 'be an integer' : `have at most ${decimalDigits} decimal digit${decimalDigits > 1 ? 's' : ''}`) + '.'];
        }
        if (increment) {
          const bigValue = Big(value);
          const bigIncrement = Big(increment);
          const offset = bigValue.mod(bigIncrement);
          if (offset.cmp(0) !== 0) {
            const previousValue = bigValue.minus(offset);
            const nextValue = previousValue.plus(bigIncrement);
            errors = [...errors, `Please select a valid value, the two nearest valid values are ${previousValue} and ${nextValue}.`];
          }
        }
      }
    }
    if (!validate) {
      return errors;
    }
    const evaluatedValidation = evaluateFEELValues(validate, this._expressionLanguage, this._conditionChecker, this._form);
    if (evaluatedValidation.pattern && value && !new RegExp(evaluatedValidation.pattern).test(value)) {
      errors = [...errors, `Field "${field.label}" must match pattern ${evaluatedValidation.pattern}.`];
    }

    if (evaluatedValidation.required) {
      const isUncheckedCheckbox = type === 'checkbox' && value === false;
      const isUnsetValue = isNil(value) || value === '';
      const isEmptyMultiselect = Array.isArray(value) && value.length === 0;

      if (isUncheckedCheckbox || isUnsetValue || isEmptyMultiselect) {
        errors = [...errors, `Field "${field.label}" is required.`];
      }
    }

    if ('min' in evaluatedValidation && (value || value === 0) && value < evaluatedValidation.min) {
      errors = [...errors, `Field "${field.label}" must have minimum value of ${evaluatedValidation.min}.`];
    }
    if ('max' in evaluatedValidation && (value || value === 0) && value > evaluatedValidation.max) {
      errors = [...errors, `Field "${field.label}" must have maximum value of ${evaluatedValidation.max}.`];
    }
    if ('minLength' in evaluatedValidation && value && value.trim().length < evaluatedValidation.minLength) {
      errors = [...errors, `Field "${field.label}" must have minimum length of ${evaluatedValidation.minLength}.`];
    }
    if ('maxLength' in evaluatedValidation && value && value.trim().length > evaluatedValidation.maxLength) {
      errors = [...errors, `Field "${field.label}" must have maximum length of ${evaluatedValidation.maxLength}.`];
    }
    if ('validationType' in evaluatedValidation && value && evaluatedValidation.validationType === 'phone' && !PHONE_PATTERN.test(value)) {
      errors = [...errors, `Field "${field.label}" must be a valid phone number.`];
    }
    if ('validationType' in evaluatedValidation && value && evaluatedValidation.validationType === 'email' && !EMAIL_PATTERN.test(value)) {
      errors = [...errors, `Field "${field.label}" must be a valid email.`];
    }

    if (field.type == 'datetime' && !field.disabled) {
      if ('lessThan' in evaluatedValidation && value && new Date(value).toISOString() < evaluatedValidation.lessThan) {
        errors = [...errors, `Field "${field.label}" can not be less than ${new Date(evaluatedValidation.lessThan).toLocaleString()}.`];
      }
      if ('lessThanOrEqual' in evaluatedValidation && value && new Date(value).toISOString() <= evaluatedValidation.lessThanOrEqual) {
        errors = [...errors, `Field "${field.label}" can not be less than or equal to ${new Date(evaluatedValidation.lessThanOrEqual).toLocaleString()}.`];
      }
      if ('equal' in evaluatedValidation && value && new Date(value).toISOString() == evaluatedValidation.equal) {
        errors = [...errors, `Field "${field.label}" can not be equal to ${new Date(evaluatedValidation.equal).toLocaleString()}.`];
      }
      if ('notEqual' in evaluatedValidation && value && new Date(value).toISOString() !== evaluatedValidation.notEqual) {
        errors = [...errors, `Field "${field.label}" must be equal to ${new Date(evaluatedValidation.notEqual).toLocaleString()}.`];
      }
      if ('greaterThan' in evaluatedValidation && value && new Date(value).toISOString() > evaluatedValidation.greaterThan) {
        errors = [...errors, `Field "${field.label}" can not be greater than ${new Date(evaluatedValidation.greaterThan).toLocaleString()}.`];
      }
      if ('greaterThanOrEqual' in evaluatedValidation && value && new Date(value).toISOString() >= evaluatedValidation.greaterThanOrEqual) {
        errors = [...errors, `Field "${field.label}" can not be greater than or equal to ${new Date(evaluatedValidation.greaterThanOrEqual).toLocaleString()}.`];
      }
    }

    else if (field.type == 'number') {
      if ('lessThan' in evaluatedValidation && (value || value == 0) && value < evaluatedValidation.lessThan) {
        errors = [...errors, `Field "${field.label}" can not be lass than ${evaluatedValidation.lessThan}.`];
      }
      if ('lessThanOrEqual' in evaluatedValidation && (value || value == 0) && value <= evaluatedValidation.lessThanOrEqual) {
        errors = [...errors, `Field "${field.label}" can not be lass than or equal to ${evaluatedValidation.lessThanOrEqual}.`];
      }
      if ('equal' in evaluatedValidation && (value || value == 0) && value == evaluatedValidation.equal) {
        errors = [...errors, `Field "${field.label}" can not be equal to ${evaluatedValidation.equal}.`];
      }
      if ('notEqual' in evaluatedValidation && (value || value == 0) && value !== evaluatedValidation.notEqual) {
        errors = [...errors, `Field "${field.label}" must be equal to ${evaluatedValidation.notEqual}.`];
      }
      if ('greaterThan' in evaluatedValidation && (value || value == 0) && value > evaluatedValidation.greaterThan) {
        errors = [...errors, `Field "${field.label}" can not be greater than ${evaluatedValidation.greaterThan}.`];
      }
      if ('greaterThanOrEqual' in evaluatedValidation && (value || value == 0) && value >= evaluatedValidation.greaterThanOrEqual) {
        errors = [...errors, `Field "${field.label}" can not be greater than or equal to ${evaluatedValidation.greaterThanOrEqual}.`];
      }
    }

    else if (field.type == 'email') {
      if ('domainType' in evaluatedValidation && 'domainList' in evaluatedValidation && evaluatedValidation.domainType == 'Blacklist') {
        const arrayDomainList = evaluatedValidation.domainList.split(',');
        const searchDomainIndex = arrayDomainList.findIndex(domain => {
          const domainEnterd = value?.trim().split('@')[1]?.split('.')[0]
          return domainEnterd == domain
        })
        if (searchDomainIndex > -1) {
          errors = [...errors, `The "${field.label}" field must not contain _ ${evaluatedValidation.domainList}.`];
        }
      }
      if ('domainType' in evaluatedValidation && 'domainList' in evaluatedValidation && evaluatedValidation.domainType == 'Whitelist') {
        const arrayDomainList = evaluatedValidation.domainList.split(',')
        const searchDomainIndex = arrayDomainList.findIndex(domain => {
          const domainEnterd = value?.trim().split('@')[1]?.split('.')[0]
          return domainEnterd == domain
        })
        if (searchDomainIndex == -1 && value !== '') {
          errors = [...errors, `The "${field.label}" field must contain_${evaluatedValidation.domainList}.`];
        }
      }
    }

    return errors;
  }
}
Validator.$inject = ['expressionLanguage', 'conditionChecker', 'form'];

// helpers //////////

/**
 * Helper function to evaluate optional FEEL validation values.
 */
function evaluateFEELValues(validate, expressionLanguage, conditionChecker, form) {
  const evaluatedValidate = {
    ...validate
  };
  VALIDATE_FEEL_PROPERTIES.forEach(property => {
    const path = property.split('.');
    const value = get(evaluatedValidate, path);

    // mirroring FEEL evaluation of our hooks
    if (!expressionLanguage || !expressionLanguage.isExpression(value)) {
      return value;
    }
    const {
      initialData,
      data
    } = form._getState();
    const newData = conditionChecker ? conditionChecker.applyConditions(data, data) : data;
    const filteredData = {
      ...initialData,
      ...newData
    };
    const evaluatedValue = expressionLanguage.evaluate(value, filteredData);

    // replace validate property with evaluated value
    if (evaluatedValue) {
      set(evaluatedValidate, path, evaluatedValue);
    }
  });
  return evaluatedValidate;
}

class Importer {
  /**
   * @constructor
   * @param { import('./FormFieldRegistry').default } formFieldRegistry
   * @param { import('./PathRegistry').default } pathRegistry
   * @param { import('./FieldFactory').default } fieldFactory
   * @param { import('./FormLayouter').default } formLayouter
   */
  constructor(formFieldRegistry, pathRegistry, fieldFactory, formLayouter) {
    this._formFieldRegistry = formFieldRegistry;
    this._pathRegistry = pathRegistry;
    this._fieldFactory = fieldFactory;
    this._formLayouter = formLayouter;
  }

  /**
   * Import schema creating rows, fields, attaching additional
   * information to each field and adding fields to the
   * field registry.
   *
   * Additional information attached:
   *
   *   * `id` (unless present)
   *   * `_parent`
   *   * `_path`
   *
   * @param {any} schema
   *
   * @typedef {{ warnings: Error[], schema: any }} ImportResult
   * @returns {ImportResult}
   */
  importSchema(schema) {
    // TODO: Add warnings
    const warnings = [];
    try {
      this._cleanup();
      const importedSchema = this.importFormField(clone(schema));
      this._formLayouter.calculateLayout(clone(importedSchema));
      return {
        schema: importedSchema,
        warnings
      };
    } catch (err) {
      this._cleanup();
      err.warnings = warnings;
      throw err;
    }
  }
  _cleanup() {
    this._formLayouter.clear();
    this._formFieldRegistry.clear();
    this._pathRegistry.clear();
  }

  /**
   * @param {{[x: string]: any}} fieldAttrs
   * @param {String} [parentId]
   * @param {number} [index]
   *
   * @return {any} field
   */
  importFormField(fieldAttrs, parentId, index) {
    const {
      components
    } = fieldAttrs;
    let parent, path;
    if (parentId) {
      parent = this._formFieldRegistry.get(parentId);
    }

    // set form field path
    path = parent ? [...parent._path, 'components', index] : [];
    const field = this._fieldFactory.create({
      ...fieldAttrs,
      _path: path,
      _parent: parentId
    }, false);
    this._formFieldRegistry.add(field);

    if (components) {
      field.components = this.importFormFields(components, field.id);
    }
    return field;
  }

  /**
   * @param {Array<any>} components
   * @param {string} parentId
   *
   * @return {Array<any>} imported components
   */
  importFormFields(components, parentId) {
    return components.map((component, index) => {
      return this.importFormField(component, parentId, index);
    });
  }
}
Importer.$inject = ['formFieldRegistry', 'pathRegistry', 'fieldFactory', 'formLayouter'];

class FieldFactory {
  /**
   * @constructor
   *
   * @param  formFieldRegistry
   * @param  formFields
   */
  constructor(formFieldRegistry, pathRegistry, formFields) {
    this._formFieldRegistry = formFieldRegistry;
    this._pathRegistry = pathRegistry;
    this._formFields = formFields;
  }
  create(attrs, applyDefaults = true) {
    const {
      id,
      type,
      key,
      path,
      _parent
    } = attrs;
    const fieldDefinition = this._formFields.get(type);
    if (!fieldDefinition) {
      throw new Error(`form field of type <${type}> not supported`);
    }
    const {
      config
    } = fieldDefinition;
    if (!config) {
      throw new Error(`form field of type <${type}> has no config`);
    }
    if (id && this._formFieldRegistry._ids.assigned(id)) {
      throw new Error(`form field with id <${id}> already exists`);
    }

    // ensure that we can claim the path

    const parent = _parent && this._formFieldRegistry.get(_parent);
    const parentPath = parent && this._pathRegistry.getValuePath(parent) || [];
    if (config.keyed && key && !this._pathRegistry.canClaimPath([...parentPath, ...key.split('.')], true)) {
      throw new Error(`binding path '${[...parentPath, key].join('.')}' is already claimed`);
    }
    if (config.pathed && path && !this._pathRegistry.canClaimPath([...parentPath, ...path.split('.')], false)) {
      throw new Error(`binding path '${[...parentPath, ...path.split('.')].join('.')}' is already claimed`);
    }
    const labelAttrs = applyDefaults && config.label ? {
      label: config.label
    } : {};
    const field = config.create({
      ...labelAttrs,
      ...attrs
    });
    this._ensureId(field);
    if (config.keyed) {
      this._ensureKey(field);
    }
    if (config.pathed && path) {
      this._pathRegistry.claimPath(this._pathRegistry.getValuePath(field), false);
    }
    return field;
  }
  _ensureId(field) {
    if (field.id) {
      this._formFieldRegistry._ids.claim(field.id, field);
      return;
    }
    let prefix = 'Field';
    if (field.type === 'default') {
      prefix = 'Form';
    }
    field.id = this._formFieldRegistry._ids.nextPrefixed(`${prefix}_`, field);
  }
  _ensureKey(field) {
    if (!field.key) {
      let random;
      const parent = this._formFieldRegistry.get(field._parent);

      // ensure key uniqueness at level
      do {
        random = Math.random().toString(36).substring(7);
      } while (parent && parent.components.some(child => child.key === random));
      field.key = `${field.type}_${random}`;
    }
    this._pathRegistry.claimPath(this._pathRegistry.getValuePath(field), true);
  }
}
FieldFactory.$inject = ['formFieldRegistry', 'pathRegistry', 'formFields'];

/**
 * The PathRegistry class manages a hierarchical structure of paths associated with form fields.
 * It enables claiming, unclaiming, and validating paths within this structure.
 *
 * Example Tree Structure:
 *
 *   [
 *     {
 *       segment: 'root',
 *       claimCount: 1,
 *       children: [
 *         {
 *           segment: 'child1',
 *           claimCount: 2,
 *           children: null  // A leaf node (closed path)
 *         },
 *         {
 *           segment: 'child2',
 *           claimCount: 1,
 *           children: [
 *             {
 *               segment: 'subChild1',
 *               claimCount: 1,
 *               children: []  // An open node (open path)
 *             }
 *           ]
 *         }
 *       ]
 *     }
 *   ]
 */
class PathRegistry {
  constructor(formFieldRegistry, formFields) {
    this._formFieldRegistry = formFieldRegistry;
    this._formFields = formFields;
    this._dataPaths = [];
  }
  canClaimPath(path, closed = false) {
    let node = {
      children: this._dataPaths
    };
    for (const segment of path) {
      node = _getNextSegment(node, segment);

      // if no node at that path, we can claim it no matter what
      if (!node) {
        return true;
      }

      // if we reach a leaf node, definitely not claimable
      if (node.children === null) {
        return false;
      }
    }

    // if after all segments we reach a node with children, we can claim it only openly
    return !closed;
  }
  claimPath(path, closed = false) {
    if (!this.canClaimPath(path, closed)) {
      throw new Error(`cannot claim path '${path.join('.')}'`);
    }
    let node = {
      children: this._dataPaths
    };
    for (const segment of path) {
      let child = _getNextSegment(node, segment);
      if (!child) {
        child = {
          segment,
          claimCount: 1,
          children: []
        };
        node.children.push(child);
      } else {
        child.claimCount++;
      }
      node = child;
    }
    if (closed) {
      node.children = null;
    }
  }
  unclaimPath(path) {
    // verification Pass
    let node = {
      children: this._dataPaths
    };
    for (const segment of path) {
      const child = _getNextSegment(node, segment);
      if (!child) {
        throw new Error(`no open path found for '${path.join('.')}'`);
      }
      node = child;
    }

    // mutation Pass
    node = {
      children: this._dataPaths
    };
    for (const segment of path) {
      const child = _getNextSegment(node, segment);
      child.claimCount--;
      if (child.claimCount === 0) {
        node.children.splice(node.children.indexOf(child), 1);
        break; // Abort early if claimCount reaches zero
      }

      node = child;
    }
  }

  /**
   * Applies a function (fn) recursively on a given field and its children.
   *
   * - `field`: Starting field object.
   * - `fn`: Function to apply.
   * - `context`: Optional object for passing data between calls.
   *
   * Stops early if `fn` returns `false`. Useful for traversing the form field tree.
   *
   * @returns {boolean} Success status based on function execution.
   */
  executeRecursivelyOnFields(field, fn, context = {}) {
    let result = true;
    const formFieldConfig = this._formFields.get(field.type).config;
    if (formFieldConfig.keyed) {
      const callResult = fn({
        field,
        isClosed: true,
        context
      });
      return result && callResult;
    } else if (formFieldConfig.pathed) {
      const callResult = fn({
        field,
        isClosed: false,
        context
      });
      result = result && callResult;
    }
    if (field.components) {
      for (const child of field.components) {
        const callResult = this.executeRecursivelyOnFields(child, fn, clone(context));
        result = result && callResult;

        // only stop executing if false is specifically returned, not if undefined
        if (result === false) {
          return result;
        }
      }
    }
    return result;
  }

  /**
   * Generates an array representing the binding path to an underlying data object for a form field.
   *
   * @param {Object} field - The field object with properties: `key`, `path`, `id`, and optionally `_parent`.
   * @param {Object} [options={}] - Configuration options.
   * @param {Object} [options.replacements={}] - A map of field IDs to alternative path arrays.
   * @param {Object} [options.cutoffNode] - The ID of the parent field at which to stop generating the path.
   *
   * @returns {(Array<string>|undefined)} An array of strings representing the binding path, or undefined if not determinable.
   */
  getValuePath(field, options = {}) {
    const {
      replacements = {},
      cutoffNode = null
    } = options;
    let localValuePath = [];
    const hasReplacement = Object.prototype.hasOwnProperty.call(replacements, field.id);
    const formFieldConfig = this._formFields.get(field.type).config;
    if (hasReplacement) {
      const replacement = replacements[field.id];
      if (replacement === null || replacement === undefined || replacement === '') {
        localValuePath = [];
      } else if (typeof replacement === 'string') {
        localValuePath = replacement.split('.');
      } else if (Array.isArray(replacement)) {
        localValuePath = replacement;
      } else {
        throw new Error(`replacements for field ${field.id} must be a string, array or null/undefined`);
      }
    } else if (formFieldConfig.keyed) {
      localValuePath = field.key.split('.');
    } else if (formFieldConfig.pathed && field.path) {
      localValuePath = field.path.split('.');
    }
    if (field._parent && field._parent !== cutoffNode) {
      const parent = this._formFieldRegistry.get(field._parent);
      return [...(this.getValuePath(parent, options) || []), ...localValuePath];
    }
    return localValuePath;
  }
  clear() {
    this._dataPaths = [];
  }
}
const _getNextSegment = (node, segment) => {
  if (isArray(node.children)) {
    return node.children.find(node => node.segment === segment) || null;
  }
  return null;
};
PathRegistry.$inject = ['formFieldRegistry', 'formFields'];

/**
 * @typedef { { id: String, components: Array<String> } } FormRow
 * @typedef { { formFieldId: String, rows: Array<FormRow> } } FormRows
 */

/**
 * Maintains the Form layout in a given structure, for example
 *
 *  [
 *    {
 *      formFieldId: 'FormField_1',
 *      rows: [
 *        { id: 'Row_1', components: [ 'Text_1', 'Textdield_1', ... ]  }
 *      ]
 *    }
 *  ]
 *
 */
class FormLayouter {
  constructor(eventBus) {
    /** @type Array<FormRows>  */
    this._rows = [];
    this._ids = new Ids([32, 36, 1]);
    this._eventBus = eventBus;
  }

  /**
   * @param {FormRow} row
   */
  addRow(formFieldId, row) {
    let rowsPerComponent = this._rows.find(r => r.formFieldId === formFieldId);
    if (!rowsPerComponent) {
      rowsPerComponent = {
        formFieldId,
        rows: []
      };
      this._rows.push(rowsPerComponent);
    }
    rowsPerComponent.rows.push(row);
  }

  /**
   * @param {String} id
   * @returns {FormRow}
   */
  getRow(id) {
    const rows = allRows(this._rows);
    return rows.find(r => r.id === id);
  }

  /**
   * @param {any} formField
   * @returns {FormRow}
   */
  getRowForField(formField) {
    return allRows(this._rows).find(r => {
      const {
        components
      } = r;
      return components.includes(formField.id);
    });
  }

  /**
   * @param {String} formFieldId
   * @returns { Array<FormRow> }
   */
  getRows(formFieldId) {
    const rowsForField = this._rows.find(r => formFieldId === r.formFieldId);
    if (!rowsForField) {
      return [];
    }
    return rowsForField.rows;
  }

  /**
   * @returns {string}
   */
  nextRowId() {
    return this._ids.nextPrefixed('Row_');
  }

  /**
   * @param {any} formField
   */
  calculateLayout(formField) {
    const {
      type,
      components
    } = formField;
    if (type !== 'default' && type !== 'group' || !components) {
      return;
    }

    // (1) calculate rows order (by component order)
    const rowsInOrder = groupByRow(components, this._ids);
    Object.entries(rowsInOrder).forEach(([id, components]) => {
      // (2) add fields to rows
      this.addRow(formField.id, {
        id: id,
        components: components.map(c => c.id)
      });
    });

    // (3) traverse through nested components
    components.forEach(field => this.calculateLayout(field));

    // (4) fire event to notify interested parties
    this._eventBus.fire('form.layoutCalculated', {
      rows: this._rows
    });
  }
  clear() {
    this._rows = [];
    this._ids.clear();

    // fire event to notify interested parties
    this._eventBus.fire('form.layoutCleared');
  }
}
FormLayouter.$inject = ['eventBus'];

// helpers //////

function groupByRow(components, ids) {
  return groupBy(components, c => {
    // mitigate missing row by creating new (handle legacy)
    const {
      layout
    } = c;
    if (!layout || !layout.row) {
      return ids.nextPrefixed('Row_');
    }
    return layout.row;
  });
}

/**
 * @param {Array<FormRows>} formRows
 * @returns {Array<FormRow>}
 */
function allRows(formRows) {
  return flatten(formRows.map(c => c.rows));
}

class FormFieldRegistry {
  constructor(eventBus) {
    this._eventBus = eventBus;
    this._formFields = {};
    eventBus.on('form.clear', () => this.clear());
    this._ids = new Ids([32, 36, 1]);
  }
  add(formField) {
    const {
      id
    } = formField;

    if (this._formFields[id]) {
      throw new Error(`form field with ID ${id} already exists`);
    }
    this._eventBus.fire('formField.add', {
      formField
    });
    this._formFields[id] = formField;
  }
  remove(formField) {
    const {
      id
    } = formField;
    if (!this._formFields[id]) {
      return;
    }
    this._eventBus.fire('formField.remove', {
      formField
    });
    delete this._formFields[id];
  }
  get(id) {
    return this._formFields[id];
  }
  getAll() {
    return Object.values(this._formFields);
  }
  forEach(callback) {
    this.getAll().forEach(formField => callback(formField));
  }
  clear() {
    this._formFields = {};
    this._ids.clear();
  }
}
FormFieldRegistry.$inject = ['eventBus'];

function formFieldClasses(type, {
  errors = [],
  disabled = false,
  readonly = false
} = {}) {
  if (!type) {
    throw new Error('type required');
  }
  return classNames('fjs-form-field', `fjs-form-field-${type}`, {
    'fjs-has-errors': errors.length > 0,
    'fjs-disabled': disabled,
    'fjs-readonly': readonly
  });
}
function gridColumnClasses(formField) {
  const {
    layout = {}
  } = formField;
  const {
    columns
  } = layout;
  return classNames('fjs-layout-column', `cds--col${columns ? '-lg-' + columns : ''}`,
    // always fall back to top-down on smallest screens
    'cds--col-sm-16', 'cds--col-md-16');
}
function prefixId(id, formId) {
  if (formId) {
    return `fjs-form-${formId}-${id}`;
  }
  return `fjs-form-${id}`;
}

const type$c = 'button';
function Button(props) {
  const {
    disabled,
    field
  } = props;
  const {
    action = 'submit'
  } = field;
  return jsx("div", {
    class: formFieldClasses(type$c),
    children: jsx("button", {
      class: "fjs-button",
      type: action,
      disabled: disabled,
      children: field.label
    })
  });
}
Button.config = {
  type: type$c,
  keyed: false,
  label: 'Button',
  group: 'action',
  create: (options = {}) => ({
    action: 'submit',
    ...options
  })
};

const FormRenderContext = createContext({
  EmptyRoot: props => {
    return null;
  },
  Empty: props => {
    return null;
  },
  Children: props => {
    return jsx("div", {
      class: props.class,
      children: props.children
    });
  },
  Element: props => {
    return jsx("div", {
      class: props.class,
      children: props.children
    });
  },
  Row: props => {
    return jsx("div", {
      class: props.class,
      children: props.children
    });
  },
  Column: props => {
    if (props.field.type === 'default') {
      return props.children;
    }
    return jsx("div", {
      class: props.class,
      children: props.children
    });
  },
  hoveredId: [],
  setHoveredId: newValue => {
    console.log(`setHoveredId not defined, called with '${newValue}'`);
  }
});
var FormRenderContext$1 = FormRenderContext;

/**
 * @param {string} type
 * @param {boolean} [strict]
 *
 * @returns {any}
 */
function getService(type, strict) { }
const FormContext = createContext({
  getService,
  formId: null
});
var FormContext$1 = FormContext;

function useService(type, strict) {
  const {
    getService
  } = useContext(FormContext$1);
  return getService(type, strict);
}

/**
 * Returns the conditionally filtered data of a form reactively.
 * Memoised to minimize re-renders
 *
 */
function useFilteredFormData() {
  const {
    initialData,
    data
  } = useService('form')._getState();
  const conditionChecker = useService('conditionChecker', false);
  return useMemo(() => {
    const newData = conditionChecker ? conditionChecker.applyConditions(data, data) : data;
    return {
      ...initialData,
      ...newData
    };
  }, [conditionChecker, data, initialData]);
}

/**
 * Evaluate if condition is met reactively based on the conditionChecker and form data.
 *
 * @param {string | undefined} condition
 *
 * @returns {boolean} true if condition is met or no condition or condition checker exists
 */
function useCondition(condition) {
  const conditionChecker = useService('conditionChecker', false);
  const filteredData = useFilteredFormData();
  return useMemo(() => {
    return conditionChecker ? conditionChecker.check(condition, filteredData) : null;
  }, [conditionChecker, condition, filteredData]);
}

/**
 * Evaluate a string reactively based on the expressionLanguage and form data.
 * If the string is not an expression, it is returned as is.
 * Memoised to minimize re-renders.
 *
 * @param {string} value
 *
 */
function useExpressionEvaluation(value) {
  const formData = useFilteredFormData();
  const expressionLanguage = useService('expressionLanguage');
  return useMemo(() => {
    if (expressionLanguage && expressionLanguage.isExpression(value)) {
      return expressionLanguage.evaluate(value, formData);
    }
    return value;
  }, [expressionLanguage, formData, value]);
}

function useKeyDownAction(targetKey, action, listenerElement = window) {
  function downHandler({
    key
  }) {
    if (key === targetKey) {
      action();
    }
  }
  useEffect(() => {
    listenerElement.addEventListener('keydown', downHandler);
    return () => {
      listenerElement.removeEventListener('keydown', downHandler);
    };
  });
}

/**
 * Retrieve readonly value of a form field, given it can be an
 * expression optionally or configured globally.
 *
 * @typedef { import('../../types').FormProperties } FormProperties
 *
 * @param {any} formField
 * @param {FormProperties} properties
 *
 * @returns {boolean}
 */
function useReadonly(formField, properties = {}) {
  const expressionLanguage = useService('expressionLanguage');
  const conditionChecker = useService('conditionChecker', false);
  const filteredData = useFilteredFormData();
  const {
    readonly
  } = formField;
  if (properties.readOnly) {
    return true;
  }
  if (expressionLanguage && expressionLanguage.isExpression(readonly)) {
    return conditionChecker ? conditionChecker.check(readonly, filteredData) : false;
  }
  return readonly || false;
}

function usePrevious(value, defaultValue, dependencies) {
  const ref = useRef(defaultValue);
  useEffect(() => ref.current = value, dependencies);
  return ref.current;
}

/**
 * A custom hook to manage state changes with deep comparison.
 *
 * @param {any} value - The current value to manage.
 * @param {any} defaultValue - The initial default value for the state.
 * @returns {any} - Returns the current state.
 */
function useDeepCompareState(value, defaultValue) {
  const [state, setState] = useState(defaultValue);
  const previous = usePrevious(value, defaultValue, [value]);
  const changed = !compare(previous, value);
  useEffect(() => {
    if (changed) {
      setState(value);
    }
  }, [changed, value]);
  return state;
}

// helpers //////////////////////////

function compare(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Template a string reactively based on form data. If the string is not a template, it is returned as is.
 * Memoised to minimize re-renders
 *
 * @param {string} value
 * @param {Object} options
 * @param {boolean} [options.debug = false]
 * @param {boolean} [options.strict = false]
 * @param {Function} [options.buildDebugString]
 *
 */
function useTemplateEvaluation(value, options) {
  const filteredData = useFilteredFormData();
  const templating = useService('templating');
  return useMemo(() => {
    if (templating && templating.isTemplate(value)) {
      return templating.evaluate(value, filteredData, options);
    }
    return value;
  }, [filteredData, templating, value, options]);
}

/**
 * Template a string reactively based on form data. If the string is not a template, it is returned as is.
 * If the string contains multiple lines, only the first line is returned.
 * Memoised to minimize re-renders
 *
 * @param {string} value
 * @param {Object} [options]
 * @param {boolean} [options.debug = false]
 * @param {boolean} [options.strict = false]
 * @param {Function} [options.buildDebugString]
 *
 */
function useSingleLineTemplateEvaluation(value, options = {}) {
  const evaluatedTemplate = useTemplateEvaluation(value, options);
  return useMemo(() => evaluatedTemplate && evaluatedTemplate.split('\n')[0], [evaluatedTemplate]);
}

function Description(props) {
  const {
    description
  } = props;
  const evaluatedDescription = useSingleLineTemplateEvaluation(description || '', {
    debug: true
  });
  if (!evaluatedDescription) {
    return null;
  }
  return jsx("div", {
    class: "fjs-form-field-description",
    children: evaluatedDescription
  });
}

function Errors(props) {
  const {
    errors,
    id
  } = props;
  if (!errors.length) {
    return null;
  }
  return jsx("div", {
    class: "fjs-form-field-error",
    "aria-live": "polite",
    id: id,
    children: jsx("ul", {
      children: errors.map(error => {
        return jsx("li", {
          children: error
        });
      })
    })
  });
}

function Label(props) {
  const {
    id,
    label,
    collapseOnEmpty = true,
    required = false
  } = props;
  const evaluatedLabel = useSingleLineTemplateEvaluation(label || '', {
    debug: true
  });
  return jsxs("label", {
    for: id,
    class: classNames('fjs-form-field-label', {
      'fjs-incollapsible-label': !collapseOnEmpty
    }, props['class']),
    children: [props.children, evaluatedLabel, required && jsx("span", {
      class: "fjs-asterix",
      children: "*"
    })]
  });
}

const type$b = 'checkbox';
function Checkbox(props) {
  const {
    disabled,
    errors = [],
    onBlur,
    field,
    readonly,
    value = false
  } = props;
  const {
    description,
    id,
    label,
    validate = {}
  } = field;
  const {
    required
  } = validate;
  const onChange = ({
    target
  }) => {
    props.onChange({
      field,
      value: target.checked
    });
  };
  const {
    formId
  } = useContext(FormContext$1);
  const errorMessageId = errors.length === 0 ? undefined : `${prefixId(id, formId)}-error-message`;
  return jsxs("div", {
    class: classNames(formFieldClasses(type$b, {
      errors,
      disabled,
      readonly
    }), {
      'fjs-checked': value
    }),
    children: [jsx(Label, {
      id: prefixId(id, formId),
      label: label,
      required: required,
      children: jsx("input", {
        checked: value,
        class: "fjs-input",
        disabled: disabled,
        readOnly: readonly,
        id: prefixId(id, formId),
        type: "checkbox",
        onChange: onChange,
        onBlur: onBlur,
        "aria-describedby": errorMessageId
      })
    }), jsx(Description, {
      description: description
    }), jsx(Errors, {
      errors: errors,
      id: errorMessageId
    })]
  });
}
Checkbox.config = {
  type: type$b,
  keyed: true,
  label: 'Checkbox',
  group: 'basic-input',
  emptyValue: false,
  sanitizeValue: ({
    value
  }) => value === true,
  create: (options = {}) => ({
    ...options
  })
};

// parses the options data from the provided form field and form data
function getValuesData(formField, formData) {
  const {
    valuesKey,
    values
  } = formField;
  return valuesKey ? get(formData, [valuesKey]) : values;
}

// transforms the provided options into a normalized format, trimming invalid options
function normalizeValuesData(valuesData) {
  return valuesData.filter(_isValueSomething).map(v => _normalizeValueData(v)).filter(v => v);
}
function _normalizeValueData(valueData) {
  if (_isAllowedValue(valueData)) {
    // if a primitive is provided, use it as label and value
    return {
      value: valueData,
      label: `${valueData}`
    };
  }
  if (typeof valueData === 'object') {
    if (!valueData.label && _isAllowedValue(valueData.value)) {
      // if no label is provided, use the value as label
      return {
        value: valueData.value,
        label: `${valueData.value}`
      };
    }
    if (_isValueSomething(valueData.value) && _isAllowedValue(valueData.label)) {
      // if both value and label are provided, use them as is, in this scenario, the value may also be an object
      return valueData;
    }
  }
  return null;
}
function _isAllowedValue(value) {
  return _isReadableType(value) && _isValueSomething(value);
}
function _isReadableType(value) {
  return ['number', 'string', 'boolean'].includes(typeof value);
}
function _isValueSomething(value) {
  return value || value === 0 || value === false;
}
function createEmptyOptions(options = {}) {
  const defaults = {};

  // provide default values if valuesKey and valuesExpression are not set
  if (!options.valuesKey && !options.valuesExpression && !options.valuesApi) {
    defaults.values = [{
      label: 'Value',
      value: 'value'
    }];
  }
  return {
    ...defaults,
    ...options
  };
}

/**
 * @enum { String }
 */
const LOAD_STATES = {
  LOADING: 'loading',
  LOADED: 'loaded',
  ERROR: 'error'
};

/**
 * @typedef {Object} ValuesGetter
 * @property {Object[]} values - The values data
 * @property {(LOAD_STATES)} state - The values data's loading state, to use for conditional rendering
 */

/**
 * A hook to load values for single and multiselect components.
 *
 * @param {Object} field - The form field to handle values for
 * @return {ValuesGetter} valuesGetter - A values getter object providing loading state and values
 */
function useValuesAsync(field) {
  const {
    valuesApi,
    valuesExpression,
    valuesKey,
    values: staticValues
  } = field;
  const [valuesGetter, setValuesGetter] = useState({
    values: [],
    error: undefined,
    state: LOAD_STATES.LOADING
  });
  const initialData = useService('form')._getState().initialData;
  const expressionEvaluation = useExpressionEvaluation(valuesExpression);
  const evaluatedValues = useDeepCompareState(expressionEvaluation || [], []);

  useEffect(() => {
    let values = [];

    // dynamic values
    if (valuesKey !== undefined) {
      const keyedValues = (initialData || {})[valuesKey];
      if (keyedValues && Array.isArray(keyedValues)) {
        values = keyedValues;
      }

      // static values
    } else if (staticValues !== undefined) {
      values = Array.isArray(staticValues) ? staticValues : [];

      // expression
    } else if (valuesExpression) {
      if (evaluatedValues && Array.isArray(evaluatedValues)) {
        values = evaluatedValues;
      }
    }

    else {
      setValuesGetter(buildErrorState('No values source defined in the form definition'));
      return;
    }

    // normalize data to support primitives and partially defined objects
    values = normalizeValuesData(values);
    setValuesGetter(buildLoadedState(values));
  }, [valuesKey, staticValues, initialData, valuesExpression, valuesApi, evaluatedValues]);
  return valuesGetter;
}
const buildErrorState = error => ({
  values: [],
  error,
  state: LOAD_STATES.ERROR
});
const buildLoadedState = values => ({
  values,
  error: undefined,
  state: LOAD_STATES.LOADED
});

const ENTER_KEYDOWN_EVENT = new KeyboardEvent('keydown', {
  code: 'Enter',
  key: 'Enter',
  charCode: 13,
  keyCode: 13,
  view: window,
  bubbles: true
});
function focusRelevantFlatpickerDay(flatpickrInstance) {
  if (!flatpickrInstance) return;
  !flatpickrInstance.isOpen && flatpickrInstance.open();
  const container = flatpickrInstance.calendarContainer;
  const dayToFocus = container.querySelector('.flatpickr-day.selected') || container.querySelector('.flatpickr-day.today') || container.querySelector('.flatpickr-day');
  dayToFocus && dayToFocus.focus();
}
function formatTime(use24h, minutes) {
  if (minutes === null) return null;
  const wrappedMinutes = minutes % (24 * 60);
  const minute = minutes % 60;
  let hour = Math.floor(wrappedMinutes / 60);
  if (use24h) {
    return _getZeroPaddedString(hour) + ':' + _getZeroPaddedString(minute);
  }
  hour = hour % 12 || 12;
  const isPM = wrappedMinutes >= 12 * 60;
  return _getZeroPaddedString(hour) + ':' + _getZeroPaddedString(minute) + ' ' + (isPM ? 'PM' : 'AM');
}
function parseInputTime(stringTime) {
  let workingString = stringTime.toLowerCase();
  const is12h = workingString.includes('am') || workingString.includes('pm');
  if (is12h) {
    const isPM = workingString.includes('pm');
    const digits = workingString.match(/\d+/g);
    const displayHour = parseInt(digits && digits[0]);
    const minute = parseInt(digits && digits[1]) || 0;
    const isValidDisplayHour = isNumber(displayHour) && displayHour >= 1 && displayHour <= 12;
    const isValidMinute = minute >= 0 && minute <= 59;
    if (!isValidDisplayHour || !isValidMinute) return null;
    const hour = displayHour % 12 + (isPM ? 12 : 0);
    return hour * 60 + minute;
  } else {
    const digits = workingString.match(/\d+/g);
    const hour = parseInt(digits && digits[0]);
    const minute = parseInt(digits && digits[1]);
    const isValidHour = isNumber(hour) && hour >= 0 && hour <= 23;
    const isValidMinute = isNumber(minute) && minute >= 0 && minute <= 59;
    if (!isValidHour || !isValidMinute) return null;
    return hour * 60 + minute;
  }
}
function serializeTime(minutes, offset, timeSerializingFormat) {
  if (timeSerializingFormat === TIME_SERIALISING_FORMATS.UTC_NORMALIZED) {
    const normalizedMinutes = (minutes + offset + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    return _getZeroPaddedString(Math.floor(normalizedMinutes / 60)) + ':' + _getZeroPaddedString(normalizedMinutes % 60) + 'Z';
  }
  const baseTime = _getZeroPaddedString(Math.floor(minutes / 60)) + ':' + _getZeroPaddedString(minutes % 60);
  const addUTCOffset = timeSerializingFormat === TIME_SERIALISING_FORMATS.UTC_OFFSET;
  return baseTime + (addUTCOffset ? formatTimezoneOffset(offset) : '');
}
function parseIsoTime(isoTimeString) {
  if (!isoTimeString) return null;
  const parseBasicMinutes = timeString => {
    const timeSegments = timeString.split(':');
    const hour = parseInt(timeSegments[0]);
    const minute = timeSegments.length > 1 ? parseInt(timeSegments[1]) : 0;
    if (isNaN(hour) || hour < 0 || hour > 24 || isNaN(minute) || minute < 0 || minute > 60) return null;
    return hour * 60 + minute;
  };
  const localOffset = new Date().getTimezoneOffset();

  // Parse normalized time
  if (isoTimeString.includes('Z')) {
    isoTimeString = isoTimeString.replace('Z', '');
    const minutes = parseBasicMinutes(isoTimeString);
    if (minutes === null) return null;
    return (minutes - localOffset + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  }

  // Parse offset positive time
  else if (isoTimeString.includes('+')) {
    const [timeString, offsetString] = isoTimeString.split('+');
    const minutes = parseBasicMinutes(timeString);
    let inboundOffset = parseBasicMinutes(offsetString);
    if (minutes === null || inboundOffset === null) return null;

    // The offset is flipped for consistency with javascript
    inboundOffset = -inboundOffset;
    return (minutes + inboundOffset - localOffset + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  }

  // Parse offset negative time
  else if (isoTimeString.includes('-')) {
    const [timeString, offsetString] = isoTimeString.split('-');
    const minutes = parseBasicMinutes(timeString);
    let inboundOffset = parseBasicMinutes(offsetString);
    if (minutes === null || inboundOffset === null) return null;
    return (minutes + inboundOffset - localOffset + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  }

  // Default to local parsing
  else {
    return parseBasicMinutes(isoTimeString);
  }
}
function serializeDate(date) {
  var d = new Date(date),
    month = '' + (d.getMonth() + 1),
    day = '' + d.getDate(),
    year = d.getFullYear();
  if (month.length < 2) month = '0' + month;
  if (day.length < 2) day = '0' + day;
  return [year, month, day].join('-');
}

// this method is used to make the `new Date(value)` parsing behavior stricter
function isDateTimeInputInformationSufficient(value) {
  if (!value || typeof value !== 'string') return false;
  const segments = value.split('T');
  if (segments.length != 2) return false;
  const dateNumbers = segments[0].split('-');
  if (dateNumbers.length != 3) return false;
  return true;
}

// this method checks if the date isn't a datetime, or a partial date
function isDateInputInformationMatching(value) {
  if (!value || typeof value !== 'string') return false;
  if (value.includes('T')) return false;
  const dateNumbers = value.split('-');
  if (dateNumbers.length != 3) return false;
  return true;
}

// function serializeDateTime(date, time, timeSerializingFormat) {
//   const workingDate = new Date();
//   workingDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
//   workingDate.setHours(Math.floor(time / 60), time % 60, 0, 0);
//   if (timeSerializingFormat === TIME_SERIALISING_FORMATS.UTC_NORMALIZED) {
//     const timezoneOffsetMinutes = workingDate.getTimezoneOffset();
//     const dayOffset = time + timezoneOffsetMinutes < 0 ? -1 : time + timezoneOffsetMinutes > MINUTES_IN_DAY ? 1 : 0;

//     // Apply the date rollover pre-emptively
//     workingDate.setHours(workingDate.getHours() + dayOffset * 24);
//   }
//   return serializeDate(workingDate) + 'T' + serializeTime(time, workingDate.getTimezoneOffset(), timeSerializingFormat);
// }

function serializeDateTime(date, timeSerializingFormat) {
  const workingDate = new Date();
  const totalMinutes = date.getHours() * 60 + date.getMinutes();
  workingDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());

  workingDate.setHours(date.getHours(), date.getMinutes(), 0, 0);
  if (timeSerializingFormat === TIME_SERIALISING_FORMATS.UTC_NORMALIZED) {
    const timezoneOffsetMinutes = workingDate.getTimezoneOffset();
    const dayOffset = totalMinutes + timezoneOffsetMinutes < 0 ? -1 : totalMinutes + timezoneOffsetMinutes > MINUTES_IN_DAY ? 1 : 0;

    // Apply the date rollover pre-emptively
    workingDate.setHours(workingDate.getHours() + dayOffset * 24);
  }
  return serializeDate(workingDate) + 'T' + serializeTime(totalMinutes, workingDate.getTimezoneOffset(), timeSerializingFormat);
}

function formatTimezoneOffset(minutes) {
  return _getSignedPaddedHours(minutes) + ':' + _getZeroPaddedString(Math.abs(minutes % 60));
}
function isInvalidDateString(value) {
  return isNaN(new Date(Date.parse(value)).getTime());
}
function _getSignedPaddedHours(minutes) {
  if (minutes > 0) {
    return '-' + _getZeroPaddedString(Math.floor(minutes / 60));
  } else {
    return '+' + _getZeroPaddedString(Math.floor((0 - minutes) / 60));
  }
}
function _getZeroPaddedString(time) {
  return time.toString().padStart(2, '0');
}

function sanitizeDateTimePickerValue(options) {
  const {
    formField,
    value
  } = options;
  const {
    subtype
  } = formField;
  if (typeof value !== 'string') return null;
  if (subtype === DATETIME_SUBTYPES.DATE && (isInvalidDateString(value) || !isDateInputInformationMatching(value))) return null;
  if (subtype === DATETIME_SUBTYPES.TIME && parseIsoTime(value) === null) return null;
  if (subtype === DATETIME_SUBTYPES.DATETIME && (isInvalidDateString(value) || !isDateTimeInputInformationSufficient(value))) return null;
  return value;
}
function sanitizeSingleSelectValue(options) {
  const {
    formField,
    data,
    value
  } = options;

  try {
    const validValues = formField.valuesApi ? [value] : normalizeValuesData(getValuesData(formField, data)).map(v => v.value);
    return validValues.includes(value) ? value : null;
  } catch (error) {
    // use default value in case of formatting error
    // TODO(@Skaiir): log a warning when this happens - https://github.com/bpmn-io/form-js/issues/289
    return null;
  }
}
function sanitizeMultiSelectValue(options) {
  const {
    formField,
    data,
    value
  } = options;
  try {
    const validValues = formField.valuesApi ? [...value] : normalizeValuesData(getValuesData(formField, data)).map(v => v.value);
    return value.filter(v => validValues.includes(v));
  } catch (error) {
    // use default value in case of formatting error
    // TODO(@Skaiir): log a warning when this happens - https://github.com/bpmn-io/form-js/issues/289
    return [];
  }
}
// Ex: 1w 2d 3h 40m ==> seconds
function convertTimeStringToSeconds(timeString) {
  if (!timeString || typeof timeString !== 'string') return 0;
  let seconds = 0;
  const seconds_per_unit = { "s": 1, "m": 60, "h": 3600, "d": 86400, "w": 604800 };
  const arr = timeString.trim().toLocaleLowerCase().split(' ');
  arr.forEach(str => {
    const timeUnit = str.substring(str.length - 1, str.length);
    const timeUnitValue = +str.substring(0, str.length - 1);
    seconds += (timeUnitValue * seconds_per_unit[timeUnit]);
  });
  return seconds;
}

// Ex: seconds ==> 1w 2d 3h 40m 
function convertSecondsToTimeString(inputSeconds) {
  if (inputSeconds == 0) {
    return "0";
  }
  let result = "";
  if (inputSeconds < 0) {
    inputSeconds = inputSeconds * (-1);
    result = "-";
  }
  const weeks = Math.floor(inputSeconds / (7 * 24 * 3600));
  result += weeks ? weeks + "w " : "";
  const days = Math.floor(inputSeconds / (3600 * 24)) - (weeks * 7);
  result += days ? days + "d " : "";
  const hours = Math.floor(inputSeconds / 3600) - (weeks * 7 * 24) - (days * 24);
  result += hours ? hours + "h " : "";
  const minutes = Math.floor(inputSeconds / 60) - (weeks * 7 * 24 * 60) - (days * 24 * 60) - (hours * 60);
  result += minutes ? minutes + "m " : "";
  const seconds = Math.floor(inputSeconds) - (weeks * 7 * 24 * 3600) - (days * 24 * 3600) - (hours * 3600) - (minutes * 60);
  result += seconds ? seconds + "s " : "";
  return (result.trim());
}

const type$a = 'checklist';
function Checklist(props) {
  const {
    disabled,
    errors = [],
    onBlur,
    field,
    readonly,
    value = []
  } = props;
  const {
    description,
    id,
    label,
    validate = {}
  } = field;
  const outerDivRef = useRef();
  const {
    required
  } = validate;
  const toggleCheckbox = v => {
    let newValue = [...value];
    if (!newValue.includes(v)) {
      newValue.push(v);
    } else {
      newValue = newValue.filter(x => x != v);
    }
    props.onChange({
      field,
      value: newValue
    });
  };
  const onCheckboxBlur = e => {
    if (outerDivRef.current.contains(e.relatedTarget)) {
      return;
    }
    onBlur();
  };
  const {
    state: loadState,
    values: options
  } = useValuesAsync(field);
  const {
    formId
  } = useContext(FormContext$1);
  const errorMessageId = errors.length === 0 ? undefined : `${prefixId(id, formId)}-error-message`;
  return jsxs("div", {
    class: classNames(formFieldClasses(type$a, {
      errors,
      disabled,
      readonly
    })),
    ref: outerDivRef,
    children: [jsx(Label, {
      label: label,
      required: required
    }), loadState == LOAD_STATES.LOADED && options.map((v, index) => {
      return jsx(Label, {
        id: prefixId(`${id}-${index}`, formId),
        label: v.label,
        class: classNames({
          'fjs-checked': value.includes(v.value)
        }),
        required: false,
        children: jsx("input", {
          checked: value.includes(v.value),
          class: "fjs-input",
          disabled: disabled,
          readOnly: readonly,
          id: prefixId(`${id}-${index}`, formId),
          type: "checkbox",
          onClick: () => toggleCheckbox(v.value),
          onBlur: onCheckboxBlur,
          "aria-describedby": errorMessageId
        })
      }, `${id}-${index}`);
    }), jsx(Description, {
      description: description
    }), jsx(Errors, {
      errors: errors,
      id: errorMessageId
    })]
  });
}
Checklist.config = {
  type: type$a,
  keyed: true,
  label: 'Multi-Choice',
  group: 'basic-input',
  emptyValue: [],
  sanitizeValue: sanitizeMultiSelectValue,
  create: createEmptyOptions
};

const noop$1 = () => false;
function FormField(props) {
  const {
    field,
    onChange
  } = props;
  const formFields = useService('formFields'),
    viewerCommands = useService('viewerCommands', false),
    pathRegistry = useService('pathRegistry'),
    form = useService('form');
  const expressionLanguage = useService('expressionLanguage');
  const {
    initialData,
    data,
    errors,
    properties
  } = form._getState();
  const {
    Element,
    Empty,
    Column
  } = useContext(FormRenderContext$1);
  const FormFieldComponent = formFields.get(field.type);
  if (!FormFieldComponent) {
    throw new Error(`cannot render field <${field.type}>`);
  }
  const valuePath = useMemo(() => pathRegistry.getValuePath(field), [field, pathRegistry]);
  const initialValue = useMemo(() => get(initialData, valuePath), [initialData, valuePath]);
  const readonly = useReadonly(field, properties);
  const value = get(data, valuePath);

  // add precedence: global readonly > form field disabled
  const disabled = !properties.readOnly && (properties.disabled || field.disabled || false);
  const onBlur = useCallback(() => {
    if (viewerCommands) {
      viewerCommands.updateFieldValidation(field, value);
    }
  }, [viewerCommands, field, value]);

  useEffect(() => {
    if (viewerCommands && initialValue) {
      viewerCommands.updateFieldValidation(field, initialValue);
    }
  }, [viewerCommands, field, initialValue]);

  // apply logics (hide, disabled, read-only and required logics)
  generateFeelExperssionFromLogics(field, data);
  const hidden = useCondition(field.conditional && field.conditional.hide || null);
  field.hide = hidden;

  const conditionalDisabled = useCondition(field.conditional && field.conditional.disabled || null);
  const conditionalReadonly = useCondition(field.conditional && field.conditional.readonly || null);
  const conditionalRequired = useCondition(field.conditional && field.conditional.required);

  if (field.conditional && (field.conditional.required !== undefined)) {
    if (!field.validate) {
      field.validate = {};
    }
    field.validate.required = conditionalRequired;
  }

  // calculate logic
  let calculatedValue = applyCalculateLogic(field, data);

  // validate logic
  applyValidateLogic(field, data);

  // filter options logic
  //applyFilterOptionsLogic(form, field, data);
  applyManualFilterOptionsLogic(form, field, data);


  const [autoFillValue, setAutoFillValue] = useState('');
  if (form._id) {
    applyAutoFillLogic(field, data, setAutoFillValue);
  }
  const [ticketAutoFillValue, setTicketAutoFillValue] = useState('');
  if (form._id) {
    applyTicketAutoFillLogic(field, data, setTicketAutoFillValue);
  }

  if (hidden) {
    return jsx(Empty, {});
  }
  return jsx(Column, {
    field: field,
    class: gridColumnClasses(field),
    children: jsx(Element, {
      class: "fjs-element",
      field: field,
      children: jsx(FormFieldComponent, {
        ...props,
        disabled: disabled || conditionalDisabled,
        errors: errors[field.id],
        onChange: disabled || readonly ? noop$1 : onChange,
        onBlur: disabled || readonly ? noop$1 : onBlur,
        readonly: readonly || conditionalReadonly,
        value: calculatedValue || autoFillValue || ticketAutoFillValue || value
      })
    })
  });
}

function generateFeelExperssionFromLogics(field, data) {

  if (!field.conditional) {
    field.conditional = {};
  } else {
    delete field.conditional['hide'];
    delete field.conditional['required'];
    delete field.conditional['disabled'];
    delete field.conditional['readonly'];
  }

  field?.logics?.forEach(logic => {
    let feelExperssion = "";
    const logicType = logic.logicType?.toLowerCase() || '';

    if (['hide', 'required', 'disabled', 'readonly'].includes(logicType)) {
      logic?.experssions?.forEach(experssion => {
        feelExperssion += "( "
        experssion?.conditions?.forEach(condition => {

          const firstFieldKey = condition.firstFieldKey;
          const operator = condition.secondOperator?.symbol;
          //   const value = (isNaN(+(condition.value || '')) && !['true', 'false'].includes((condition.value || '').toLowerCase())) ? '"' + condition.value + '"' : condition.value;
          const value = condition.value;
          if (!['contains', 'starts with', 'is blank', 'is fill', 'contains any', 'not contains any', 'contains all'].includes(operator)) {

            if (data[firstFieldKey] || data[firstFieldKey] == 0) {
              switch (operator) {
                case "<":
                  {
                    if (data[firstFieldKey] < value) {
                      feelExperssion += "(true) and ";
                    }
                    else {
                      feelExperssion += "(false) and ";
                    }
                    break;
                  }
                case "<=":
                  {
                    if (data[firstFieldKey] <= value) {
                      feelExperssion += "(true) and ";
                    }
                    else {
                      feelExperssion += "(false) and ";
                    }
                    break;
                  }
                case "=":
                  {
                    if (data[firstFieldKey] == value) {
                      feelExperssion += "(true) and ";
                    }
                    else {
                      feelExperssion += "(false) and ";
                    }
                    break;
                  }
                case "!=":
                  {
                    if (data[firstFieldKey] !== value) {
                      feelExperssion += "(true) and ";
                    }
                    else {
                      feelExperssion += "(false) and ";
                    }
                    break;
                  }
                case ">":
                  {
                    if (data[firstFieldKey] > value) {
                      feelExperssion += "(true) and ";
                    }
                    else {
                      feelExperssion += "(false) and ";
                    }
                    break;
                  }
                case ">=":
                  {
                    if (data[firstFieldKey] >= value) {
                      feelExperssion += "(true) and ";
                    }
                    else {
                      feelExperssion += "(false) and ";
                    }
                    break;
                  }
                default: {
                  feelExperssion += "(false) and ";
                }
              }
            }
            else {
              feelExperssion += "(false) and ";
            }
          }
          else {
            if (operator == 'is fill') {
              if ((!data[firstFieldKey] && data[firstFieldKey] !== 0) || data[firstFieldKey]?.length == 0) {
                feelExperssion += "(false) and ";
              }
              else {
                feelExperssion += "(true) and ";
              }
            }
            else if (operator == 'is blank') {
              if ((!data[firstFieldKey] && data[firstFieldKey] !== 0) || data[firstFieldKey]?.length == 0) {
                feelExperssion += "(true) and ";
              }
              else {
                feelExperssion += "(false) and ";
              }
            }
            else if (operator == 'contains any') {
              //single choice
              if (condition.firstField?.type == 'radio' || (condition.firstField?.type == 'select' && !condition.firstField.isMulti)) {
                if (condition.values?.includes(data[firstFieldKey])) {
                  feelExperssion += "(true) and ";
                } else {
                  feelExperssion += "(false) and ";
                }
              }
              //multi choise
              else if (condition.firstField?.type == 'checklist' || (condition.firstField?.type == 'select' && condition.firstField.isMulti)) {
                if (condition.values.some(r => data[firstFieldKey]?.includes(r))) {
                  feelExperssion += "(true) and ";
                } else {
                  feelExperssion += "(false) and ";
                }
              }
            }
            else if (operator == 'not contains any') {
              //single choice
              if (condition.firstField?.type == 'radio' || (condition.firstField?.type == 'select' && !condition.firstField.isMulti)) {
                if (condition.values?.includes(data[firstFieldKey])) {
                  feelExperssion += "(false) and ";
                } else {
                  feelExperssion += "(true) and ";
                }
              }
              //multi choise
              else if (condition.firstField?.type == 'checklist' || (condition.firstField?.type == 'select' && condition.firstField.isMulti)) {
                if (condition.values.some(r => data[firstFieldKey]?.includes(r))) {
                  feelExperssion += "(false) and ";
                } else {
                  feelExperssion += "(true) and ";
                }
              }
            }
            else if (operator == 'contains all') {
              if (['select', 'checklist'].includes(condition.firstField?.type)) {
                const isSubset = !(condition?.values?.some((string) => data[firstFieldKey]?.indexOf(string) == -1));
                if (isSubset) {
                  feelExperssion += "(true) and ";
                } else {
                  feelExperssion += "(false) and ";
                }
              }
            }
            else if (operator == 'contains') {
              if (data[firstFieldKey]) {
                if (data[firstFieldKey].includes(condition.value)) {
                  feelExperssion += "(true) and ";
                } else {
                  feelExperssion += "(false) and ";
                }
              }
            }
            else if (operator == 'starts with') {
              if (data[firstFieldKey]) {
                if (data[firstFieldKey].startsWith(condition.value)) {
                  feelExperssion += "(true) and ";
                } else {
                  feelExperssion += "(false) and ";
                }
              }
            }
          }
        });
        feelExperssion = feelExperssion.slice(0, -5);
        feelExperssion += " ) or "
      });
      feelExperssion = feelExperssion.slice(0, -4);

      field.conditional[logicType] = "= " + feelExperssion;
    }

  });
}

function applyCalculateLogic(field, data) {
  let result;

  const calculateLogic = field.logics?.filter(x => x.logicType?.toLowerCase() == 'calculate')[0];

  if (calculateLogic) {
    if (!field.conditional) {
      field.conditional = {};
    }
    // calculate logic has only one experssion and condition
    const condition = calculateLogic?.experssions[0]?.conditions[0];
    const firstKey = condition?.firstFieldKey;
    const operator = condition?.secondOperator?.symbol;
    const secondKey = condition?.secondFieldKey;

    if (condition?.firstField?.type == 'number') {
      field.conditional.calculate = "number calculateLogic";
    }
    else if (condition?.firstField?.type == 'datetime') {
      if (condition.firstField.subtype == 'time') {
        field.conditional.calculate = "time calculateLogic";
      }
      else {
        field.conditional.calculate = "date calculateLogic";
      }
    }

    let calculateType = field.conditional?.calculate?.split(" ")[0];

    if (calculateType == "number") {
      const feelExp = firstKey + " " + operator + " " + secondKey;
      result = evaluate(feelExp, data);
    }
    else if (calculateType == "date") {
      const date1 = new Date(data[firstKey]);
      const date2 = new Date(data[secondKey]);
      if (date1 & date2 && (operator == "-")) {
        if (date1 >= date2) {
          result = convertSecondsToTimeString((date1.getTime() - date2.getTime()) / 1000);
        } else {
          result = convertSecondsToTimeString(((date2.getTime() - date1.getTime()) / 1000) * (-1));
        }
      }
    }
    else if (calculateType == "time") {
      //time in minutes
      let time1 = -1;
      let time2 = -1;
      if (data[firstKey]) {
        time1 = parseInputTime(data[firstKey]);
      }
      if (data[secondKey]) {
        time2 = parseInputTime(data[secondKey]);
      }
      if (time1 >= 0 & time2 >= 0 && (operator == "-")) {
        if (time1 >= time2) {
          result = convertSecondsToTimeString((time1 - time2) * 60);
        } else {
          result = convertSecondsToTimeString((time2 - time1) * 60 * (-1));
        }
      }
    }
  }
  else {
    delete field.conditional?.calculate;
  }
  return result;
}

function applyValidateLogic(field, data) {

  const validateLogic = field.logics?.filter(x => x.logicType?.toLowerCase() == 'validate')[0];
  if (validateLogic) {
    if (field.type == 'datetime') {
      const experssion = validateLogic?.experssions[0];
      experssion?.conditions?.forEach(condition => {
        let seconds = 0;

        const operator = condition.firstOperator?.symbol;
        const key = condition.firstFieldKey;
        const secondOperator = condition.secondOperator?.symbol;
        const value = condition.value;

        if (secondOperator) {
          const timeString = value;
          seconds = convertTimeStringToSeconds(timeString);
          seconds = secondOperator == '-' ? (seconds * (-1)) : seconds;
        }

        let date;
        if (key === 'now') {
          date = new Date(Date.now());
        }
        else if (!isInvalidDateString(data[key])) {
          date = new Date(data[key]);
        }

        if (!isInvalidDateString(date)) {
          date.setTime(date.getTime() + (seconds * 1000));

          if (!field.validate) {
            field.validate = {};
          }
          switch (operator) {
            case "<":
              field.validate.lessThan = date.toISOString();
              break;
            case "<=":
              field.validate.lessThanOrEqual = date.toISOString();
              break;
            case "=":
              field.validate.equal = date.toISOString();
              break;
            case "!=":
              field.validate.notEqual = date.toISOString();
              break;
            case ">":
              field.validate.greaterThan = date.toISOString();
              break;
            case ">=":
              field.validate.greaterThanOrEqual = date.toISOString();
              break;
          }
        }
      });

    } else if (field.type == 'number') {
      const experssion = validateLogic?.experssions[0];
      experssion?.conditions?.forEach(condition => {

        const operator = condition.firstOperator?.symbol;
        const key = condition.firstFieldKey;
        const secondOperator = condition.secondOperator?.symbol;
        const value = condition.value;

        let calValue;
        if (value || value == 0) {
          const feelExp = key + " " + secondOperator + " " + value;
          calValue = evaluate(feelExp, data);
        } else {
          calValue = data[key];
        }

        if (calValue !== undefined && calValue !== null) {
          if (!field.validate) {
            field.validate = {};
          }

          switch (operator) {
            case "<":
              field.validate.lessThan = calValue;
              break;
            case "<=":
              field.validate.lessThanOrEqual = calValue;
              break;
            case "=":
              field.validate.equal = calValue;
              break;
            case "!=":
              field.validate.notEqual = calValue;
              break;
            case ">":
              field.validate.greaterThan = calValue;
              break;
            case ">=":
              field.validate.greaterThanOrEqual = calValue;
              break;
          }
        }
      });
    }
  }
  else {
    delete field.conditional?.validate;
  }
}

function applyApiFilterOptionsLogic(form, field, data) {
  let result = { hasFilterOptions: false, queryString: '' };
  if (field.conditional && (field.conditional['filter options'] !== undefined) && field.valuesApi) {
    //api filter option
    result.hasFilterOptions = true;
    if (form._id) {
      // let filterParameter = ''
      // let filterValue = ''
      field.filterOptionsLogics?.forEach(filterOptionsLogic => {
        filterOptionsLogic.conditions?.forEach(condition => {
          let filterParameter = ''
          let filterValue = ''
          const key = condition.secondFieldKey;
          filterParameter = condition.filterParameter;
          const operator = condition.secondOperator.symbol;
          //static value
          if (operator == '==') {
            filterValue = condition.apiFilterOptionValue || null;
          }
          else {
            filterValue = data[key];
          }
          if (filterParameter) {
            result.queryString += `${filterParameter}=${filterValue}&`;
          }
        });

        // const condition = filterOptionsLogic.conditions[0];
        // const key = condition.secondFieldKey;
        // filterParameter = condition.filterParameter;

        // const operator = condition.secondOperator.symbol;
        // //static value
        // if (operator == '==') {
        //   filterValue = condition.apiFilterOptionValue || null;
        // }
        // else {
        //   filterValue = data[key];
        // }

      });

      if (result.queryString) {
        result.queryString = result.queryString.slice(0, -1);
      }

    }
  }
  return result;
}

function applyManualFilterOptionsLogic(form, field, data) {
  if (field.conditional && (field.conditional['filter options'] !== undefined) && (!field.valuesApi)) {
    field.values = field.allValues.filter(x => x);
    if (form._id) { // if form preview
      let shouldSkip = false;
      field.filterOptionsLogics.forEach(filterOptionsLogic => {
        if (shouldSkip) {
          return;
        }
        let allConditions = true;
        filterOptionsLogic.conditions.forEach(condition => {
          const key = condition.firstFieldKey;
          const value = condition.value;
          allConditions = allConditions && (data[key] == value);
        });
        if (allConditions) {
          field.values = field.allValues.filter(x => filterOptionsLogic.filteredOptions.includes(x.value));

          shouldSkip = true;
          return;
        } else {
          field.values = [];
          data[field.key] = null;
        }
      });
    }
  }
}

async function applyAutoFillLogic(field, data, setAutoFillValue) {
  let result;

  const logic = field.logics?.filter(x => x.logicType?.toLowerCase() == 'auto fill')[0];

  if (logic) {
    if (!field.conditional) {
      field.conditional = {};
    }
    const api = logic.autoFillLogic?.api;
    const filterFieldKey = logic.autoFillLogic?.filterFieldKey;
    const property = logic.autoFillLogic?.property;
    const filterParameter = logic.autoFillLogic?.filterParameter;


    if (api && filterFieldKey && property && data[filterFieldKey]) {
      const token = window.localStorage.getItem('ngx-app.current-user');
      const myHeaders = new Headers();
      const CSRFToken = getCookie('csrftoken');
      myHeaders.append('Authorization', JSON.parse(token).auth_token);
      myHeaders.append('X-CSRFToken', CSRFToken);
      const options = {
        headers: myHeaders
      };

      //const requestURL = api.endpoint + `?${api.value}=${data[filterField]}`;
      let requestURL = api.endpoint;
      if (filterParameter) {
        requestURL += `?${filterParameter}=${data[filterFieldKey]}`;
      } else {
        requestURL += `?${api.value}=${data[filterFieldKey]}`;
      }
      const apiRequest = await new Request(requestURL, options);

      fetch(apiRequest)
        .then((response) => response.json())
        .then((res) => {
          if (res && res?.results && res?.results.length == 1) {
            result = res?.results[0][property];
            setAutoFillValue(result);
            data[field.key] = result;
          }
          else {
            setAutoFillValue("");
            data[field.key] = "";
          }
        });
    }
    else {
      setAutoFillValue("");
      data[field.key] = "";
    }
  }
  else {
    delete field.conditional['auto fill'];
  }
  return result;
}

async function applyTicketAutoFillLogic(field, data, setTicketAutoFillValue) {
  let result;

  const logic = field.logics?.filter(x => x.logicType?.toLowerCase() == 'ticket auto fill')[0];

  if (logic) {
    if (!field.conditional) {
      field.conditional = {};
    }

    let ticketId;
    if (logic.ticketAutoFillLogic?.isCurrentTicket) {
      const urlArr = window.location.href.split('/');
      ticketId = +urlArr[urlArr.length - 1];
    } else {
      ticketId = data[logic.ticketAutoFillLogic.ticketFieldKey];
    }
    const phase = logic.ticketAutoFillLogic?.phase;
    const property = logic.ticketAutoFillLogic?.property;

    if (ticketId && phase && property) {
      const token = window.localStorage.getItem('ngx-app.current-user');
      const myHeaders = new Headers();
      const CSRFToken = getCookie('csrftoken');
      myHeaders.append('Authorization', JSON.parse(token).auth_token);
      myHeaders.append('X-CSRFToken', CSRFToken);
      myHeaders.append('Accept', 'application/json');
      myHeaders.append('Content-Type', 'application/json');


      const requestURL = `api/ticket-instance/${ticketId}/details/`;
      const apiRequest = await new Request(requestURL);

      fetch(apiRequest, {
        method: 'POST',
        headers: myHeaders,
        body: JSON.stringify({
          "phases": [
            {
              "phase": phase.name
            }
          ]
        })
      })
        .then((response) => response.json())
        .then((res) => {
          if (res) {
            result = res[phase.name][property];
            setTicketAutoFillValue(result);
            data[field.key] = result;
          }
          else {
            setTicketAutoFillValue(null);
            data[field.key] = null;
          }
        });
    }
    else {
      setTicketAutoFillValue(null);
      data[field.key] = null;
    }
  }
  else {
    delete field.conditional['ticket auto fill'];
  }
  return result;
}


function getCookie(name) {
  let match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  if (match) {
    return match[2]
  }
  else {
    return ''
  }
}

let optionFilterValues = [];
async function fetchValuesByApiCall(field, url, queryString, setOptionsList, setLoading) {

  const token = window.localStorage.getItem('ngx-app.current-user');
  const myHeaders = new Headers();
  const CSRFToken = getCookie('csrftoken');

  myHeaders.append('Authorization', JSON.parse(token).auth_token);
  myHeaders.append('X-CSRFToken', CSRFToken);
  const options = {
    headers: myHeaders
  };

  let result = [];
  let megaDropdownResult = [];
  //const requestURL = queryString ? url + queryString + "&&page_size=50" : url + "?page_size=50";
  const requestURL = queryString ? url + queryString : url;

  if (url && url !== '<none>') {
    const apiRequest = await new Request(requestURL, options);
    if (setLoading) {
      setLoading(true);
    }
    fetch(apiRequest)
      .then((response) => response.json())
      .then((res) => {
        if (res) {
          megaDropdownResult = res?.results || [];
          field.currentPage = res?.current_page || 1;
          field.nextPage = res?.next;
          res?.results?.map((item) => {
            result.push({
              value: item[field.apiDetails?.value],
              label: `${item[field.apiDetails?.label]}`,
            });
          });
        }
        optionFilterValues = result;

        field.values = [];
        if (field.megaDropdownView) {
          field.megaDropdownValues = megaDropdownResult;
        }
        result.forEach(element => {
          field.values.push({ label: element.label, value: element.value });
        });

        if (setOptionsList) {
          setOptionsList(old => [...result]);
        }
        if (setLoading) {
          setLoading(false);
        }
      });

  }
}

async function loadMoreValuesByApiCall(field, url, queryString, setOptionsList) {
  const token = window.localStorage.getItem('ngx-app.current-user');
  const myHeaders = new Headers();
  const CSRFToken = getCookie('csrftoken');

  myHeaders.append('Authorization', JSON.parse(token).auth_token);
  myHeaders.append('X-CSRFToken', CSRFToken);
  const options = {
    headers: myHeaders
  };

  let result = [];
  let megaDropdownResult = [];
  //const requestURL = queryString ? url + queryString + "&&page_size=50" : url + "?page_size=50";
  const requestURL = queryString ? url + queryString : url;
  if (url && url !== '<none>') {
    const apiRequest = await new Request(requestURL, options);

    fetch(apiRequest)
      .then((response) => response.json())
      .then((res) => {
        if (res) {
          megaDropdownResult = res?.results || [];
          field.currentPage = res?.current_page;
          field.nextPage = res?.next;
          res?.results?.map((item) => {
            result.push({
              value: item[field.apiDetails?.value],
              label: `${item[field.apiDetails?.label]}`,
            });
          });
        }
        optionFilterValues = result;
        field.values = [];
        if (field.megaDropdownView) {
          field.megaDropdownValues = megaDropdownResult;
        }
        result.forEach(element => {
          field.values.push({ label: element.label, value: element.value });
        });

        setOptionsList(oldArray => [...oldArray, ...result]);
      });

  }

}

async function uploadFileByApiCall(files, field, props, setUploadedList, setUploadingList, showToast, folderGroup = 'files') {

  let url = "api/attachments/create/";
  const sub_group = new Date().toLocaleDateString();
  const token = window.localStorage.getItem('ngx-app.current-user');
  const myHeaders = new Headers();
  const CSRFToken = getCookie('csrftoken');
  myHeaders.append('Authorization', JSON.parse(token).auth_token)
  myHeaders.append('X-CSRFToken', CSRFToken)
  const requestURL = url;

  let newValue = [...props.value];

  let readyForUploadFiles = [...files];
  readyForUploadFiles.sort(function (a, b) { return a.size - b.size });
  if (files && files.length > 1) {
    let tempFiles = [];
    files.sort(function (a, b) { return a.size - b.size });
    const numberOfUploaded = field.numberOfFiles || 0;

    if (numberOfUploaded + files.length > field.validate?.maxFileNumber) {
      const extraFiles = files.slice(field.validate?.maxFileNumber - numberOfUploaded);
      extraFiles.forEach(item => {
        setUploadingList(oldArray => {
          oldArray.filter(x => x.id === item.id)[0].errorMessage = `The maximum number of files is ${field.validate?.maxFileNumber}.`;
          const newArray = oldArray.map(x => x);
          return newArray;
        });
        readyForUploadFiles = readyForUploadFiles.filter(x => x.id !== item.id);
        setTimeout(() => {
          showToast(`${item.name}: The maximum number of files is ${field.validate?.maxFileNumber}.`, 'error', item);
        }, 10);
      });
    }

    let totalUploadedSize = field.totalUploadedSize || 0;
    tempFiles = [...readyForUploadFiles]
    tempFiles.forEach(item => {
      if ((totalUploadedSize + item.size) > (field.validate?.maxTotalSize * 1024 * 1024)) {
        setUploadingList(oldArray => {
          oldArray.filter(x => x.id === item.id)[0].errorMessage = `The maximum allowed total size is ${field.validate?.maxTotalSize} MB.`;
          const newArray = oldArray.map(x => x);
          return newArray;
        });
        readyForUploadFiles = readyForUploadFiles.filter(x => x.id !== item.id);
        setTimeout(() => {
          showToast(`${item.name}: The maximum allowed total size is ${field.validate?.maxTotalSize} MB.`, 'error', item);
        }, 10);
      }
      else {
        totalUploadedSize = totalUploadedSize + item.size;
      }
    });
  }

  for (let file of readyForUploadFiles) {
    const isValid = validateFile(field, file, setUploadingList, showToast);
    if (isValid) {
      let formData = new FormData();
      let body = {};
      formData.append('file_object', file);
      formData.append('file_name', file.name);
      formData.append('group', folderGroup);
      formData.append('sub_group', sub_group);

      body = formData;
      const options = {
        method: 'POST',
        headers: myHeaders,
        body: body
      };
      const apiRequest = await new Request(requestURL, options);
      fetch(apiRequest)
        .then((response) => response.json())
        .then((res) => {
          //success
          if (res.id) {
            field.fileURL = res.url;
            field.value = res.url;
            field.numberOfFiles = field.numberOfFiles !== undefined ? field.numberOfFiles + 1 : 1;
            field.totalUploadedSize = field.totalUploadedSize !== undefined ? field.totalUploadedSize + file.size : file.size;

            const attachmentString = `${field.fileURL}*${file.id}*${file.type}*${file.name}*${file.size}`
            newValue.push(attachmentString);
            //  newValue.push(field.fileURL);
            props.onChange({
              field,
              value: newValue
            });

            //setUploadedList
            file.url = res.url;
            setUploadedList(oldArray => [...oldArray, file]);
            setUploadingList(oldArray => {
              const newArray = oldArray.filter(x => file.id !== x.id);
              return newArray;
            });
          }
          else {
            setUploadingList(oldArray => {
              oldArray.filter(x => x.id === file.id)[0].errorMessage = res.detail;
              const newArray = oldArray.map(x => x);
              return newArray;
            });

            showToast(file.name + ": " + res.detail, 'error', file);
          }
        });
    }
  }
}

function validateFile(field, file, setUploadingList, showToast) {

  // validate number of files
  if ((field.numberOfFiles || 0) + 1 > (field.validate?.maxFileNumber)) {
    setUploadingList(oldArray => {
      oldArray.filter(x => x.id === file.id)[0].errorMessage = `The maximum number of files is ${field.validate?.maxFileNumber}.`;
      const newArray = oldArray.map(x => x);
      return newArray;
    });

    showToast(`${file.name}: The maximum number of files is ${field.validate?.maxFileNumber}.`, 'error', file);
    return false;
  }

  // validate totalUploadedSize
  if (((field.totalUploadedSize || 0) + file.size) > (field.validate?.maxTotalSize * 1024 * 1024)) {
    setUploadingList(oldArray => {
      oldArray.filter(x => x.id === file.id)[0].errorMessage = `The maximum allowed total size is ${field.validate?.maxTotalSize} MB.`;
      const newArray = oldArray.map(x => x);
      return newArray;
    });

    showToast(`${file.name}: The maximum allowed total size is ${field.validate?.maxTotalSize} MB.`, 'error', file);
    return false;
  }

  //black list
  if (field.validate?.attachedValidationType == 'Blacklist' && field.validate?.blacklistAttachment) {
    const blackList = field.validate?.blacklistAttachment.trim().replaceAll(' ', '').split(',');
    const fileNameArray = file.name?.split('.');
    const fileExtension = fileNameArray[fileNameArray.length - 1];
    const isBlackList = blackList.findIndex(item => { return item == fileExtension });
    if (isBlackList > -1) {
      setUploadingList(oldArray => {
        oldArray.filter(x => x.id === file.id)[0].errorMessage = `'${fileExtension}' format is not allowed.`;
        const newArray = oldArray.map(x => x);
        return newArray;
      });
      showToast(`${file.name}: '${fileExtension}' format is not allowed.`, 'error', file);
      return false;
    }
  }

  //white list
  if (field.validate?.attachedValidationType == 'Whitelist' && field.validate?.whitelistAttachment) {
    const whiteList = field.validate?.whitelistAttachment.trim().replaceAll(' ', '').split(',');
    const fileNameArray = file.name?.split('.');
    const fileExtension = fileNameArray[fileNameArray.length - 1];
    const isWhiteList = whiteList.findIndex(file => { return file == fileExtension });
    if (isWhiteList == -1) {
      setUploadingList(oldArray => {
        oldArray.filter(x => x.id === file.id)[0].errorMessage = `'${fileExtension}' format is not allowed.`;
        const newArray = oldArray.map(x => x);
        return newArray;
      });
      showToast(`${file.name}: '${fileExtension}' format is not allowed.`, 'error', file);
      return false;
    }
  }

  return true;
}

function Grid(props) {
  const {
    Children,
    Row
  } = useContext(FormRenderContext$1);
  const {
    field,
    Empty
  } = props;
  const {
    id,
    components = []
  } = field;
  const formLayouter = useService('formLayouter');
  const formFieldRegistry = useService('formFieldRegistry');
  const rows = formLayouter.getRows(id);
  return jsxs(Children, {
    class: "fjs-vertical-layout fjs-children cds--grid cds--grid--condensed",
    field: field,
    children: [rows.map(row => {
      const {
        components = []
      } = row;
      if (!components.length) {
        return null;
      }
      return jsx(Row, {
        row: row,
        class: "fjs-layout-row cds--row",
        children: components.map(id => {
          const childField = formFieldRegistry.get(id);
          if (!childField) {
            return null;
          }
          return createElement(FormField, {
            ...props,
            key: childField.id,
            field: childField
          });
        })
      });
    }), components.length ? null : jsx(Empty, {})]
  });
}

function FormComponent$1(props) {
  const {
    EmptyRoot
  } = useContext(FormRenderContext$1);
  const fullProps = {
    ...props,
    Empty: EmptyRoot
  };
  return jsx(Grid, {
    ...fullProps
  });
}
FormComponent$1.config = {
  type: 'default',
  keyed: false,
  label: null,
  group: null,
  create: (options = {}) => ({
    components: [],
    ...options
  })
};

var _path$h;
function _extends$k() { _extends$k = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$k.apply(this, arguments); }
var SvgCalendar = function SvgCalendar(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$k({
    xmlns: "http://www.w3.org/2000/svg",
    width: 14,
    height: 15,
    fill: "none",
    viewBox: "0 0 28 30"
  }, props), _path$h || (_path$h = /*#__PURE__*/React.createElement("path", {
    fill: "currentColor",
    fillRule: "evenodd",
    d: "M19 2H9V0H7v2H2a2 2 0 0 0-2 2v24a2 2 0 0 0 2 2h24a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-5V0h-2v2ZM7 7V4H2v5h24V4h-5v3h-2V4H9v3H7Zm-5 4v17h24V11H2Z",
    clipRule: "evenodd"
  })));
};
var CalendarIcon = SvgCalendar;

/**
 * Returns date format for the provided locale.
 * If the locale is not provided, uses the browser's locale.
 *
 * @param {string} [locale] - The locale to get date format for.
 * @returns {string} The date format for the locale.
 */
function getLocaleDateFormat(locale = 'default') {
  const parts = new Intl.DateTimeFormat(locale).formatToParts(new Date(Date.UTC(2020, 5, 5)));
  return parts.map(part => {
    const len = part.value.length;
    switch (part.type) {
      case 'day':
        return 'd'.repeat(len);
      case 'month':
        return 'M'.repeat(len);
      case 'year':
        return 'y'.repeat(len);
      default:
        return part.value;
    }
  }).join('');
}

/**
 * Returns readable date format for the provided locale.
 * If the locale is not provided, uses the browser's locale.
 *
 * @param {string} [locale] - The locale to get readable date format for.
 * @returns {string} The readable date format for the locale.
 */
function getLocaleReadableDateFormat(locale) {
  let format = getLocaleDateFormat(locale).toLowerCase();

  // Ensure month is in 'mm' format
  if (!format.includes('mm')) {
    format = format.replace('m', 'mm');
  }

  // Ensure day is in 'dd' format
  if (!format.includes('dd')) {
    format = format.replace('d', 'dd');
  }

  return format;
}

/**
 * Returns flatpickr config for the provided locale.
 * If the locale is not provided, uses the browser's locale.
 *
 * @param {string} [locale] - The locale to get flatpickr config for.
 * @returns {object} The flatpickr config for the locale.
 */
function getLocaleDateFlatpickrConfig(locale) {
  return flatpickerizeDateFormat(getLocaleDateFormat(locale));
}
function flatpickerizeDateFormat(dateFormat) {
  const useLeadingZero = {
    day: dateFormat.includes('dd'),
    month: dateFormat.includes('MM'),
    year: dateFormat.includes('yyyy')
  };
  dateFormat = useLeadingZero.day ? dateFormat.replace('dd', 'd') : dateFormat.replace('d', 'j');
  dateFormat = useLeadingZero.month ? dateFormat.replace('MM', 'm') : dateFormat.replace('M', 'n');
  dateFormat = useLeadingZero.year ? dateFormat.replace('yyyy', 'Y') : dateFormat.replace('yy', 'y');
  return dateFormat;
}

function InputAdorner(props) {
  const {
    pre,
    post,
    rootRef,
    inputRef,
    children,
    disabled,
    readonly,
    hasErrors
  } = props;
  const onAdornmentClick = () => inputRef && inputRef.current && inputRef.current.focus();
  return jsxs("div", {
    class: classNames('fjs-input-group', {
      'fjs-disabled': disabled,
      'fjs-readonly': readonly
    }, {
      'hasErrors': hasErrors
    }),
    ref: rootRef,
    children: [pre && jsxs("span", {
      class: "fjs-input-adornment border-right border-radius-left",
      onClick: onAdornmentClick,
      children: [" ", isString(pre) ? jsx("span", {
        class: "fjs-input-adornment-text",
        children: pre
      }) : pre, " "]
    }), children, post && jsxs("span", {
      class: "fjs-input-adornment border-left border-radius-right",
      onClick: onAdornmentClick,
      children: [" ", isString(post) ? jsx("span", {
        class: "fjs-input-adornment-text",
        children: post
      }) : post, " "]
    })]
  });
}

function Datepicker(props) {
  const {
    id,
    label,
    collapseLabelOnEmpty,
    onDateTimeBlur,
    formId,
    required,
    disabled,
    disallowPassedDates,
    date,
    readonly,
    setDate,


    subtype,
    use24h,
    timeInterval,
    time,
    setTime

  } = props;
  const dateInputRef = useRef();
  const focusScopeRef = useRef();
  const [flatpickrInstance, setFlatpickrInstance] = useState(null);
  const [isInputDirty, setIsInputDirty] = useState(false);
  const [forceFocusCalendar, setForceFocusCalendar] = useState(false);

  const [latestSelectedDate, setLatestSelectedDate] = useState('');
  const [isSave, setIsSave] = useState(false);

  const useDateMode = useMemo(() => subtype === DATETIME_SUBTYPES.DATE);
  const useDateTimeMode = useMemo(() => subtype === DATETIME_SUBTYPES.DATETIME);

  // shorts the date value back to the source
  useEffect(() => {
    if (!flatpickrInstance || !flatpickrInstance.config) return;
    flatpickrInstance.setDate(date, true);

    setIsInputDirty(false);
  }, [flatpickrInstance, date.toString()]);

  useEffect(() => {
    if (!forceFocusCalendar) return;
    focusRelevantFlatpickerDay(flatpickrInstance);
    setForceFocusCalendar(false);
  }, [flatpickrInstance, forceFocusCalendar]);

  // setup flatpickr instance
  useEffect(() => {
    let config;

    if (useDateMode) {
      config = {
        allowInput: false,
        //dateFormat: getLocaleDateFlatpickrConfig(),
        dateFormat: "Y-m-d",
        static: true,
        clickOpens: false,
        // TODO: support dates prior to 1900 (https://github.com/bpmn-io/form-js/issues/533)
        minDate: disallowPassedDates ? 'today' : '01/01/1900',
        errorHandler: () => {/* do nothing, we expect the values to sometimes be erronous and we don't want warnings polluting the console */ }
      };
    }
    else if (useDateTimeMode) {
      config = {
        allowInput: false,
        static: true,
        clickOpens: false,
        // TODO: support dates prior to 1900 (https://github.com/bpmn-io/form-js/issues/533)
        minDate: disallowPassedDates ? 'today' : '01/01/1900',

        enableTime: true,
        dateFormat: "Y-m-d H:i",
        time_24hr: true,
        minuteIncrement: 1,
        enableSeconds: false,

        plugins: [
          ShortcutButtonsPlugin({
            button: [
              { label: 'Now', attributes: { class: "btn btn-link me-auto" } },
              { label: 'Cancel', attributes: { class: "btn btn-secondary c-mx-1" } },
              { label: 'Save', attributes: { class: "btn btn-primary" } }
            ],
            onClick(index, fp) {
              switch (index) {
                case 0:
                  {

                    let date = new Date(Date.now());
                    fp.setDate(date, true);
                    //updateIsSave(true);
                    // fp.close();
                    break;
                  }
                case 1:
                  {
                    let date = new Date(Date.parse(latestSelectedDate));
                    fp.setDate(date, true);
                    fp.close();
                    break;
                  }
                case 2:
                  {
                    //updateIsSave(true);
                    fp.close();
                    break;
                  }
                default:
                  break;
              }

            }
          })
        ],
        errorHandler: () => {/* do nothing, we expect the values to sometimes be erronous and we don't want warnings polluting the console */ },
      };
    }

    const instance = flatpickr(dateInputRef.current, config);

    setFlatpickrInstance(instance);
    const onCalendarFocusOut = e => {
      if (!instance.calendarContainer.contains(e.relatedTarget) && e.relatedTarget != dateInputRef.current) {
        //instance.close();
      }
    };

    // remove dirty tag to have mouse day selection prioritize input blur
    const onCalendarMouseDown = e => {
      if (e.target.classList.contains('flatpickr-day')) {
        setIsInputDirty(false);
      }
    };

    const updateLatestSelectedDate = latestDate => {
      const latestDateString = latestDate?.toString() || '';
      setLatestSelectedDate(latestDateString);
    };

    const updateIsSave = bool => {
      setIsSave(bool);
    };

    // when the dropdown of the datepickr opens, we register a few event handlers to re-implement some of the
    // flatpicker logic that was lost when setting allowInput to true

    instance.config.onOpen = [
      () => instance.calendarContainer.addEventListener('focusout', onCalendarFocusOut),
      () => {
        updateLatestSelectedDate(instance.latestSelectedDateObj);
      },
      () => instance.calendarContainer.addEventListener('mousedown', onCalendarMouseDown)];
    instance.config.onClose = [
      () => instance.calendarContainer.removeEventListener('focusout', onCalendarFocusOut),
      () => instance.calendarContainer.removeEventListener('mousedown', onCalendarMouseDown)
    ];
  }, [disallowPassedDates, setLatestSelectedDate, latestSelectedDate, setIsSave, isSave]);


  // onChange is updated dynamically, so not to re-render the flatpicker every time it changes
  useEffect(() => {
    if (!flatpickrInstance || !flatpickrInstance.config) return;
    flatpickrInstance.config.onChange = [date => setDate(new Date(date)), () => setIsInputDirty(false)];

  }, [flatpickrInstance, setDate]);


  const onInputKeyDown = useCallback(e => {
    if (!flatpickrInstance) return;
    if (e.code === 'Escape') {
      flatpickrInstance.close();
    }
    if (e.code === 'ArrowDown') {
      if (isInputDirty) {
        // trigger an enter keypress to submit the new input, then focus calendar day on the next render cycle
        dateInputRef.current.dispatchEvent(ENTER_KEYDOWN_EVENT);
        setIsInputDirty(false);
        setForceFocusCalendar(true);
      } else {
        // focus calendar day immediately
        focusRelevantFlatpickerDay(flatpickrInstance);
      }
      e.preventDefault();
    }
    if (e.code === 'Enter') {
      setIsInputDirty(false);
    }
  }, [flatpickrInstance, isInputDirty]);


  const onInputFocus = useCallback(e => {
    if (!flatpickrInstance || focusScopeRef.current.contains(e.relatedTarget) || readonly) return;
    flatpickrInstance.open();
  }, [flatpickrInstance, readonly]);

  // simulate an enter press on blur to make sure the date value is submitted in all scenarios
  const onInputBlur = useCallback(e => {
    if (!isInputDirty || e.relatedTarget && e.relatedTarget.classList.contains('flatpickr-day')) return;

    dateInputRef.current.dispatchEvent(ENTER_KEYDOWN_EVENT);
    setIsInputDirty(false);
    onDateTimeBlur(e);
  }, [isInputDirty, onDateTimeBlur]);

  const onInput = useCallback(e => {
    if (!isInputDirty || e.relatedTarget && e.relatedTarget.classList.contains('flatpickr-day')) return;

    setIsInputDirty(false);
  }, [isInputDirty]);

  const fullId = `${prefixId(id, formId)}--date`;


  return jsxs("div", {
    class: "fjs-datetime-subsection",
    children: [jsx(Label, {
      id: fullId,
      label: label,
      collapseOnEmpty: collapseLabelOnEmpty,
      required: required
    }), jsx(InputAdorner, {
      pre: jsx(CalendarIcon, {}),
      post: jsx("a",
        {
          class: "input-btn bg-white",
          onClick: (e) => { e.stopPropagation(); if (!disabled) { flatpickrInstance.clear(); } },
          children: jsx("i", { class: "icon-close" })
        }),
      disabled: disabled,
      readonly: readonly,
      rootRef: focusScopeRef,
      inputRef: dateInputRef,
      children: jsx("div", {
        class: "fjs-datepicker",
        style: {
          width: '100%'
        },
        children:

          jsx("input", {
            ref: dateInputRef,
            type: "text",
            id: fullId,
            class: "fjs-input",
            disabled: disabled,
            readOnly: readonly,
            placeholder: (subtype == DATETIME_SUBTYPES.DATETIME ? "YYYY-MM-DD    HH:MM:SS" : (subtype == DATETIME_SUBTYPES.TIME ? "HH:MM:SS" : "YYYY-MM-DD")),
            autoComplete: "off",
            onFocus: onInputFocus,
            onKeyDown: onInputKeyDown,
            onMouseDown: () => !flatpickrInstance.isOpen && !readonly && flatpickrInstance.open(),
            onBlur: onInputBlur,
            onInput: () => onInput,
            "data-input": true,
            "aria-describedby": props['aria-describedby']
          })

      })
    })]
  });
}

var _path$g, _path2$4;
function _extends$j() { _extends$j = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$j.apply(this, arguments); }
var SvgClock = function SvgClock(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$j({
    xmlns: "http://www.w3.org/2000/svg",
    width: 16,
    height: 16,
    fill: "none",
    viewBox: "0 0 28 29"
  }, props), _path$g || (_path$g = /*#__PURE__*/React.createElement("path", {
    fill: "currentColor",
    d: "M13 14.41 18.59 20 20 18.59l-5-5.01V5h-2v9.41Z"
  })), _path2$4 || (_path2$4 = /*#__PURE__*/React.createElement("path", {
    fill: "currentColor",
    fillRule: "evenodd",
    d: "M6.222 25.64A14 14 0 1 0 21.778 2.36 14 14 0 0 0 6.222 25.64ZM7.333 4.023a12 12 0 1 1 13.334 19.955A12 12 0 0 1 7.333 4.022Z",
    clipRule: "evenodd"
  })));
};
var ClockIcon = SvgClock;

const DEFAULT_LABEL_GETTER = value => value;
const NOOP = () => { };
function DropdownList(props) {
  const {
    listenerElement = window,
    values = [],
    getLabel = DEFAULT_LABEL_GETTER,
    onValueSelected = NOOP,
    height = 235,
    emptyListMessage = 'No results',
    initialFocusIndex = 0,
    searchabel = false,
  } = props;
  const [mouseControl, setMouseControl] = useState(false);
  const [focusedValueIndex, setFocusedValueIndex] = useState(initialFocusIndex);
  const [smoothScrolling, setSmoothScrolling] = useState(false);
  const dropdownContainer = useRef();
  const mouseScreenPos = useRef();
  const focusedItem = useMemo(() => values.length ? values[focusedValueIndex] : null, [focusedValueIndex, values]);
  const changeFocusedValueIndex = useCallback(delta => {
    setFocusedValueIndex(x => Math.min(Math.max(0, x + delta), values.length - 1));
  }, [values.length]);
  useEffect(() => {
    if (focusedValueIndex === 0) return;
    if (!focusedValueIndex || !values.length) {
      setFocusedValueIndex(0);
    } else if (focusedValueIndex >= values.length) {
      setFocusedValueIndex(values.length - 1);
    }
  }, [focusedValueIndex, values.length]);
  useKeyDownAction('ArrowUp', () => {
    if (values.length) {
      changeFocusedValueIndex(-1);
      setMouseControl(false);
    }
  }, listenerElement);
  useKeyDownAction('ArrowDown', () => {
    if (values.length) {
      changeFocusedValueIndex(1);
      setMouseControl(false);
    }
  }, listenerElement);
  useKeyDownAction('Enter', () => {
    if (focusedItem) {
      onValueSelected(focusedItem);
    }
  }, listenerElement);
  useEffect(() => {
    const individualEntries = dropdownContainer.current.children;
    if (individualEntries.length && !mouseControl) {
      const focusedEntry = individualEntries[focusedValueIndex];
      focusedEntry && focusedEntry.scrollIntoView({
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [focusedValueIndex, mouseControl]);
  useEffect(() => {
    setSmoothScrolling(true);
  }, []);
  const onMouseMovedInKeyboardMode = (event, valueIndex) => {
    const userMovedCursor = !mouseScreenPos.current || mouseScreenPos.current.x !== event.screenX && mouseScreenPos.current.y !== event.screenY;
    if (userMovedCursor) {
      mouseScreenPos.current = {
        x: event.screenX,
        y: event.screenY
      };
      setMouseControl(true);
      setFocusedValueIndex(valueIndex);
    }
  };
  const [filterdOptions, setFilterOptions] = useState(values)
  const filteredOptions = (val) => {
    if (val !== '') {
      const filtedOptions = values.filter(data => data.label.toLowerCase().includes(val.toLowerCase()))
      return setFilterOptions(filtedOptions)
    }
    return setFilterOptions(values)
  }

  //const setValues

  return jsxs("div", {
    ref: dropdownContainer,
    tabIndex: -1,
    class: "fjs-dropdownlist p-2",
    // onMouseDown: e => e.preventDefault(),
    style: {
      maxHeight: height,
      scrollBehavior: smoothScrolling ? 'smooth' : 'auto'
    },
    children: [
      searchabel && jsx("input", {
        type: "text",
        onChange: (e) => {
          filteredOptions(e.target.value)
        },
        placeholder: 'Search',
        class: "form-control w-100 mb-2",
      }),
      filterdOptions.length > 0 && filterdOptions.map((v, i) => {
        return jsx("div", {
          class: classNames('fjs-dropdownlist-item', {
            'focused': focusedValueIndex === i
          }),
          onMouseMove: mouseControl ? undefined : e => onMouseMovedInKeyboardMode(e, i),
          onMouseEnter: mouseControl ? () => setFocusedValueIndex(i) : undefined,
          onMouseDown: e => onValueSelected(v),
          children: getLabel(v)
        });
      }), !filterdOptions.length && jsx("div", {
        class: "fjs-dropdownlist-empty",
        children: emptyListMessage
      })]
  });
}


// function Timepicker(props) {
//   const {
//     id,
//     label,
//     collapseLabelOnEmpty,
//     onDateTimeBlur,
//     formId,
//     required,
//     disabled,
//     readonly,
//     use24h = false,
//     timeInterval,
//     time,
//     setTime
//   } = props;
//   const safeTimeInterval = useMemo(() => {
//     const allowedIntervals = [1, 5, 10, 15, 30, 60];
//     if (allowedIntervals.includes(timeInterval)) {
//       return timeInterval;
//     }
//     return 15;
//   }, [timeInterval]);
//   const timeInputRef = useRef();
//   const [dropdownIsOpen, setDropdownIsOpen] = useState(false);
//   const useDropdown = useMemo(() => safeTimeInterval !== 1, [safeTimeInterval]);
//   const [rawValue, setRawValue] = useState('');

//   // populates values from source
//   useEffect(() => {
//     if (time === null) {
//       setRawValue('');
//       return;
//     }
//     const intervalAdjustedTime = time - time % safeTimeInterval;
//     setRawValue(formatTime(use24h, intervalAdjustedTime));
//     if (intervalAdjustedTime != time) {
//       setTime(intervalAdjustedTime);
//     }
//   }, [time, setTime, use24h, safeTimeInterval]);
//   const propagateRawToMinute = useCallback(newRawValue => {
//     const localRawValue = newRawValue || rawValue;

//     // If no raw value exists, set the minute to null
//     if (!localRawValue) {
//       setTime(null);
//       return;
//     }
//     const minutes = parseInputTime(localRawValue);

//     // If raw string couldn't be parsed, clean everything up
//     if (!isNumber(minutes)) {
//       setRawValue('');
//       setTime(null);
//       return;
//     }

//     // Enforce the minutes to match the timeInterval
//     const correctedMinutes = minutes - minutes % safeTimeInterval;

//     // Enforce the raw text to be formatted properly
//     setRawValue(formatTime(use24h, correctedMinutes));
//     setTime(correctedMinutes);
//   }, [rawValue, safeTimeInterval, use24h, setTime]);
//   const timeOptions = useMemo(() => {
//     const minutesInDay = 24 * 60;
//     const intervalCount = Math.floor(minutesInDay / safeTimeInterval);
//     return [...Array(intervalCount).keys()].map(intervalIndex => formatTime(use24h, intervalIndex * safeTimeInterval));
//   }, [safeTimeInterval, use24h]);
//   const initialFocusIndex = useMemo(() => {
//     // if there are no options, there will not be any focusing
//     if (!timeOptions || !safeTimeInterval) return null;

//     // if there is a set minute value, we focus it in the dropdown
//     if (time) return time / safeTimeInterval;
//     const cacheTime = parseInputTime(rawValue);

//     // if there is a valid value in the input cache, we try and focus close to it
//     if (cacheTime) {
//       const flooredCacheTime = cacheTime - cacheTime % safeTimeInterval;
//       return flooredCacheTime / safeTimeInterval;
//     }

//     // If there is no set value, simply focus the middle of the dropdown (12:00)
//     return Math.floor(timeOptions.length / 2);
//   }, [rawValue, time, safeTimeInterval, timeOptions]);
//   const onInputKeyDown = e => {
//     switch (e.key) {
//       case 'ArrowUp':
//         e.preventDefault();
//         break;
//       case 'ArrowDown':
//         useDropdown && setDropdownIsOpen(true);
//         e.preventDefault();
//         break;
//       case 'Escape':
//         useDropdown && setDropdownIsOpen(false);
//         break;
//       case 'Enter':
//         !dropdownIsOpen && propagateRawToMinute();
//         break;
//     }
//   };
//   const onInputBlur = e => {
//     setDropdownIsOpen(false);
//     propagateRawToMinute();
//     onDateTimeBlur(e);
//   };
//   const onDropdownValueSelected = value => {
//    // setDropdownIsOpen(false);
//     propagateRawToMinute(value);
//   };
//   const fullId = `${prefixId(id, formId)}--time`;
//   return jsxs("div", {
//     class: "fjs-datetime-subsection",
//     children: [jsx(Label, {
//       id: fullId,
//       label: label,
//       collapseOnEmpty: collapseLabelOnEmpty,
//       required: required
//     }), jsx(InputAdorner, {
//       pre: jsx(ClockIcon, {}),
//       inputRef: timeInputRef,
//       disabled: disabled,
//       readonly: readonly,
//       children: jsxs("div", {
//         class: "fjs-timepicker fjs-timepicker-anchor",
//         children: [jsx("input", {
//           ref: timeInputRef,
//           type: "text",
//           id: fullId,
//           class: "fjs-input",
//           value: rawValue,
//           disabled: disabled,
//           readOnly: readonly,
//           placeholder: use24h ? 'hh:mm' : 'hh:mm ?m',
//           autoComplete: "off",
//           onFocus: () => !readonly && useDropdown && setDropdownIsOpen(true),
//           onClick: () => !readonly && useDropdown && setDropdownIsOpen(true)

//           // @ts-ignore
//           ,
//           onInput: e => {
//             setRawValue(e.target.value);
//             useDropdown && setDropdownIsOpen(false);
//           },
//           onBlur: onInputBlur,
//           onKeyDown: onInputKeyDown,
//           "data-input": true,
//           "aria-describedby": props['aria-describedby']
//         }), dropdownIsOpen && jsx(DropdownList, {
//           values: timeOptions,
//           height: 150,
//           onValueSelected: onDropdownValueSelected,
//           listenerElement: timeInputRef.current,
//           initialFocusIndex: initialFocusIndex
//         })]
//       })
//     })]
//   });
// }

const type$9 = 'datetime';
function Datetime(props) {
  const {
    disabled,
    errors = [],
    onBlur,
    field,
    onChange,
    readonly,
    value = null
  } = props;
  const {
    description,
    id,
    // dateLabel,
    //timeLabel,
    label,
    validate = {},
    subtype,
    use24h,
    disallowPassedDates,
    timeInterval,
    timeSerializingFormat
  } = field;
  const {
    required
  } = validate;
  const {
    formId
  } = useContext(FormContext$1);
  const dateTimeGroupRef = useRef();
  const getNullDateTime = () => ({
    date: new Date(Date.parse(null)),
    time: null
  });
  const [dateTime, setDateTime] = useState(getNullDateTime());
  const [dateTimeUpdateRequest, setDateTimeUpdateRequest] = useState(null);
  const isValidDate = date => date && !isNaN(date.getTime());
  const isValidTime = time => !isNaN(parseInt(time));


  const onDateTimeBlur = useCallback(e => {
    if (e.relatedTarget && dateTimeGroupRef.current.contains(e.relatedTarget)) {
      return;
    }
    onBlur();
  }, [onBlur]);


  useEffect(() => {

    let {
      date,
      time
    } = getNullDateTime();

    switch (subtype) {
      case DATETIME_SUBTYPES.DATE:
        {
          date = new Date(Date.parse(value));
          break;
        }
      case DATETIME_SUBTYPES.TIME:
        {
          time = parseIsoTime(value);
          break;
        }
      case DATETIME_SUBTYPES.DATETIME:
        {
          date = new Date(Date.parse(value));
          time = isValidDate(date) ? 60 * date.getHours() + date.getMinutes() : null;
          break;
        }
    }
    setDateTime({
      date,
      time
    });

  }, [subtype, value]);


  const computeAndSetState = useCallback(({
    date,
    time
  }) => {
    let newDateTimeValue = null;
    if (subtype === DATETIME_SUBTYPES.DATE && isValidDate(date)) {
      newDateTimeValue = serializeDate(date);
    } else if (subtype === DATETIME_SUBTYPES.TIME && isValidTime(time)) {
      newDateTimeValue = serializeTime(time, new Date().getTimezoneOffset(), timeSerializingFormat);
    }
    else if (subtype === DATETIME_SUBTYPES.DATETIME && isValidDate(date)) {
      newDateTimeValue = serializeDateTime(date, timeSerializingFormat);
    }
    onChange({
      value: newDateTimeValue,
      field
    });

  }, [field, onChange, subtype, timeSerializingFormat]);


  useEffect(() => {
    if (dateTimeUpdateRequest) {
      if (dateTimeUpdateRequest.refreshOnly) {
        if (dateTime.date && isValidDate(dateTime.date)) {
          computeAndSetState(dateTime);
        }
      } else {
        const newDateTime = {
          ...dateTime,
          ...dateTimeUpdateRequest
        };
        computeAndSetState(newDateTime);
      }
      setDateTimeUpdateRequest(null);
    }
  }, [computeAndSetState, dateTime, dateTimeUpdateRequest]);


  useEffect(() => {
    setDateTimeUpdateRequest({
      refreshOnly: true
    });
  }, [timeSerializingFormat]);


  const allErrors = useMemo(() => {
    if (required || subtype !== DATETIME_SUBTYPES.DATETIME) return errors;
    //  const isOnlyOneFieldSet = isValidDate(dateTime.date) && !isValidTime(dateTime.time) || !isValidDate(dateTime.date) && isValidTime(dateTime.time);
    // return isOnlyOneFieldSet ? ['Date and time must both be entered.', ...errors] : errors;
    return errors;
  }, [required, subtype, dateTime, errors]);


  const setDate = useCallback(date => {
    setDateTimeUpdateRequest(prev => prev ? {
      ...prev,
      date
    } : {
      date
    });
  }, []);


  const setTime = useCallback(time => {
    setDateTimeUpdateRequest(prev => prev ? {
      ...prev,
      time
    } : {
      time
    });
  }, []);


  const errorMessageId = allErrors.length === 0 ? undefined : `${prefixId(id, formId)}-error-message`;

  const dateTimePickerProps = {
    id,
    label,
    // collapseLabelOnEmpty: !timeLabel,
    onDateTimeBlur,
    formId,
    required,
    disabled,
    readonly,
    disallowPassedDates,
    date: dateTime.date,
    setDate,

    subtype,
    use24h,
    timeInterval,
    time: dateTime.time,
    setTime,

    'aria-describedby': errorMessageId
  };


  return jsxs("div", {
    class: formFieldClasses(type$9, {
      errors: allErrors,
      disabled,
      readonly
    }),
    children: [jsxs("div", {
      class: classNames('fjs-vertical-group'),
      ref: dateTimeGroupRef,
      // children: [useDatePicker && jsx(Datepicker, {
      //   ...dateTimePickerProps
      // }), useTimePicker && useDatePicker && jsx("div", {
      //   class: "fjs-datetime-separator"
      // }), useTimePicker && jsx(Timepicker, {
      //   ...timePickerProps
      // })]

      children: [jsx(Datepicker, {
        ...dateTimePickerProps
      })]

    }), jsx(Description, {
      description: description
    }), jsx(Errors, {
      errors: allErrors,
      id: errorMessageId
    })]
  });
}

Datetime.config = {
  type: type$9,
  keyed: true,
  label: 'Date-Time',
  group: 'basic-input',
  emptyValue: null,
  sanitizeValue: sanitizeDateTimePickerValue,

  // create: (options = {}) => {
  //   const defaults = {};
  //   set(defaults, DATETIME_SUBTYPE_PATH, DATETIME_SUBTYPES.DATE);
  //   set(defaults, DATE_LABEL_PATH, 'Date');
  //   return {
  //     ...defaults,
  //     ...options
  //   };
  // }

  create: (options = {}) => ({
    ...options
  })
};



/**
 * This file must not be changed or exchanged.
 *
 * @see http://bpmn.io/license for more information.
 */
function Logo() {
  return jsxs("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 14.02 5.57",
    width: "53",
    height: "21",
    style: "vertical-align:middle",
    children: [jsx("path", {
      fill: "currentColor",
      d: "M1.88.92v.14c0 .41-.13.68-.4.8.33.14.46.44.46.86v.33c0 .61-.33.95-.95.95H0V0h.95c.65 0 .93.3.93.92zM.63.57v1.06h.24c.24 0 .38-.1.38-.43V.98c0-.28-.1-.4-.32-.4zm0 1.63v1.22h.36c.2 0 .32-.1.32-.39v-.35c0-.37-.12-.48-.4-.48H.63zM4.18.99v.52c0 .64-.31.98-.94.98h-.3V4h-.62V0h.92c.63 0 .94.35.94.99zM2.94.57v1.35h.3c.2 0 .3-.09.3-.37v-.6c0-.29-.1-.38-.3-.38h-.3zm2.89 2.27L6.25 0h.88v4h-.6V1.12L6.1 3.99h-.6l-.46-2.82v2.82h-.55V0h.87zM8.14 1.1V4h-.56V0h.79L9 2.4V0h.56v4h-.64zm2.49 2.29v.6h-.6v-.6zM12.12 1c0-.63.33-1 .95-1 .61 0 .95.37.95 1v2.04c0 .64-.34 1-.95 1-.62 0-.95-.37-.95-1zm.62 2.08c0 .28.13.39.33.39s.32-.1.32-.4V.98c0-.29-.12-.4-.32-.4s-.33.11-.33.4z"
    }), jsx("path", {
      fill: "currentColor",
      d: "M0 4.53h14.02v1.04H0zM11.08 0h.63v.62h-.63zm.63 4V1h-.63v2.98z"
    })]
  });
}
function Lightbox(props) {
  const {
    open
  } = props;
  if (!open) {
    return null;
  }
  return jsxs("div", {
    class: "fjs-powered-by-lightbox",
    style: "z-index: 100; position: fixed; top: 0; left: 0;right: 0; bottom: 0",
    children: [jsx("div", {
      class: "backdrop",
      style: "width: 100%; height: 100%; background: rgba(40 40 40 / 20%)",
      onClick: props.onBackdropClick
    }), jsxs("div", {
      class: "notice",
      style: "position: absolute; left: 50%; top: 40%; transform: translate(-50%); width: 260px; padding: 10px; background: white; box-shadow: 0  1px 4px rgba(0 0 0 / 30%); font-family: Helvetica, Arial, sans-serif; font-size: 14px; display: flex; line-height: 1.3",
      children: [jsx("a", {
        href: "https://bpmn.io",
        target: "_blank",
        rel: "noopener",
        style: "margin: 15px 20px 15px 10px; align-self: center; color: var(--cds-icon-primary, #404040)",
        children: jsx(Logo, {})
      }), jsxs("span", {
        children: ["Web-based tooling for BPMN, DMN, and forms powered by ", jsx("a", {
          href: "https://bpmn.io",
          target: "_blank",
          rel: "noopener",
          children: "bpmn.io"
        }), "."]
      })]
    })]
  });
}
function Link(props) {
  return jsx("div", {
    class: "fjs-powered-by fjs-form-field",
    style: "text-align: right",
    children: jsx("a", {
      href: "https://bpmn.io",
      target: "_blank",
      rel: "noopener",
      class: "fjs-powered-by-link",
      title: "Powered by bpmn.io",
      style: "color: var(--cds-text-primary, #404040)",
      onClick: props.onClick,
      children: jsx(Logo, {})
    })
  });
}
function PoweredBy(props) {
  const [open, setOpen] = useState(false);
  function toggleOpen(open) {
    return event => {
      event.preventDefault();
      setOpen(open);
    };
  }
  return jsxs(Fragment, {
    children: [createPortal(jsx(Lightbox, {
      open: open,
      onBackdropClick: toggleOpen(false)
    }), document.body), jsx(Link, {
      onClick: toggleOpen(true)
    })]
  });
}

const noop = () => { };
function FormComponent(props) {
  const form = useService('form');
  const {
    schema,
    properties
  } = form._getState();
  const {
    ariaLabel
  } = properties;
  const {
    onSubmit = noop,
    onReset = noop,
    onChange = noop
  } = props;
  const handleSubmit = event => {
    event.preventDefault();
    onSubmit();
  };
  const handleReset = event => {
    event.preventDefault();
    onReset();
  };
  return jsxs("form", {
    class: "fjs-form",
    //style: "width:500px; margin:auto",
    onSubmit: handleSubmit,
    onReset: handleReset,
    "aria-label": ariaLabel,
    noValidate: true,
    children: [jsx(FormField, {
      field: schema,
      onChange: onChange
    }), jsx(PoweredBy, {})]
  });
}

function Group(props) {
  const {
    field
  } = props;
  const {
    label,
    id,
    type,
    showOutline,
    gird_view,
    repeatable,
    removable,
    source,
    repeatedCount
  } = field;
  const {
    formId
  } = useContext(FormContext$1);
  const {
    Empty
  } = useContext(FormRenderContext$1);
  const fullProps = {
    ...props,
    Empty
  };

  const form = useService('form');
  //const importer = useService('importer', false);

  return jsxs("div", {
    className: classNames(formFieldClasses(type), {
      'fjs-outlined': showOutline
    }),
    role: "group",
    "aria-labelledby": prefixId(id, formId),
    children: [
      jsx(Label, {
        id: prefixId(id, formId),
        label: label
      }),
      jsxs("div", {
        class: 'd-flex justify-content-between pl-2',
        style: "font-size:2rem",
        children: [
          repeatable &&
          jsx("button", {
            class: "btn icon icon-add ms-auto c-mt-n3",
            type: "button",
            style: "font-size:1.1rem",
            "aria-label": "Repeat",
            onClick: () => repaetSectionHandler(form, field),
            tabIndex: -1
          }),
          removable &&
          jsx("button", {
            class: "btn icon icon-trash-01 text-error ms-auto c-mt-n3",
            type: "button",
            style: "font-size:1.1rem",
            "aria-label": "Remove",
            onClick: () => removeSectionHandler(form, field),
            tabIndex: -1
          })
        ]
      }),

      jsx(Grid, {
        ...fullProps
      })]
  });
}
Group.config = {
  type: 'group',
  pathed: true,
  label: 'Section',
  group: 'basic-input',
  create: (options = {}) => ({
    components: [],
    showOutline: true,
    repeatable: false,
    grid_view: false,
    ...options
  })
};

function repaetSectionHandler(form, section) {
  if (form._id) {
    const importer = form.get('importer');

    const {
      schema,
      data
    } = form._getState();
    const formId = schema.id;

    if (!section.repeatedCount) {
      section.repeatedCount = 0;
    }
    section.repeatedCount++;

    const repeatedSection = clone(section);
    repeatedSection.repeatable = false;
    repeatedSection.removable = true;
    repeatedSection.source = section.id;
    repeatedSection.repeatedIndex = section.repeatedCount;
    delete repeatedSection.repeatedCount;
    repeatedSection.id = generateIdForType(repeatedSection.type);

    let newRow = {
      components: [repeatedSection.id],
      id: "Row_" + repeatedSection.id
    }
    repeatedSection.layout.row = newRow.id;

    repeatedSection.components.map((component) => {
      component.id = generateIdForType(component.type);
      component.sourceKy = component.key;
      //component.key = component.key + "__" + section.id + "__" + generateIndexForType(repeatedSection.type);
      component.key = component.key + "__" + section.id + "__" + repeatedSection.repeatedIndex;
    });

    // Repeat conditional
    repeatedSection.components.map((component) => {
      if (component.conditional) {
        for (let key in component.conditional) {
          let condition = component.conditional[key];
          let conditionalArr = condition.trim().split(" ");
          for (let i = 0; i < conditionalArr.length; i++) {
            const filtered = repeatedSection.components.filter(x => x.sourceKy == conditionalArr[i])[0];
            if (filtered) {
              conditionalArr[i] = filtered.key;
              continue;
            }
          }
          component.conditional[key] = conditionalArr.join(" ");
        }
      }
    });

    // Repeat logics
    repeatedSection.components.map((component) => {
      for (let i = 0; i < component?.logics?.length; i++) {
        const logic = component.logics[i];
        for (let j = 0; j < logic.conditions.length; j++) {
          let condition = logic.conditions[j];
          const firstFieldKey = condition["firstFieldKey"];
          if (firstFieldKey) {
            const filtered = repeatedSection.components.filter(x => x.sourceKy == firstFieldKey)[0];
            if (filtered) {
              condition["firstFieldKey"] = filtered.key;
              condition["firstField"] = clone(filtered);
            }
          }
          const secondFieldKey = condition["secondFieldKey"];
          if (secondFieldKey) {
            const filtered = repeatedSection.components.filter(x => x.sourceKy == secondFieldKey)[0];
            if (filtered) {
              condition["secondFieldKey"] = filtered.key;
              condition["secondField"] = clone(filtered);
            }
          }
        }
      }
    });

    // Repeat filterOption logics
    repeatedSection.components.map((component) => {
      for (let i = 0; i < component?.logics?.length; i++) {
        const logic = component.logics[i];
        for (let j = 0; j < logic?.filterOptionsLogics?.length; j++) {
          const filterOptionsLogic = logic.filterOptionsLogics[j];
          for (let k = 0; k < filterOptionsLogic.conditions.length; k++) {
            let condition = filterOptionsLogic.conditions[k];
            const firstFieldKey = condition["firstFieldKey"];
            if (firstFieldKey) {
              const filtered = repeatedSection.components.filter(x => x.sourceKy == firstFieldKey)[0];
              if (filtered) {
                condition["firstFieldKey"] = filtered.key;
                condition["firstField"] = clone(filtered);
              }
            }
            const secondFieldKey = condition["secondFieldKey"];
            if (secondFieldKey) {
              const filtered = repeatedSection.components.filter(x => x.sourceKy == secondFieldKey)[0];
              if (filtered) {
                condition["secondFieldKey"] = filtered.key;
                condition["secondField"] = clone(filtered);
              }
            }
          }
        }
      }
    });
    repeatedSection.components.map((component) => {
      for (let j = 0; j < component?.filterOptionsLogics?.length; j++) {
        const filterOptionsLogic = component.filterOptionsLogics[j];
        for (let k = 0; k < filterOptionsLogic.conditions.length; k++) {
          let condition = filterOptionsLogic.conditions[k];
          const firstFieldKey = condition["firstFieldKey"];
          if (firstFieldKey) {
            const filtered = repeatedSection.components.filter(x => x.sourceKy == firstFieldKey)[0];
            if (filtered) {
              condition["firstFieldKey"] = filtered.key;
              condition["firstField"] = clone(filtered);
            }
          }
          const secondFieldKey = condition["secondFieldKey"];
          if (secondFieldKey) {
            const filtered = repeatedSection.components.filter(x => x.sourceKy == secondFieldKey)[0];
            if (filtered) {
              condition["secondFieldKey"] = filtered.key;
              condition["secondField"] = clone(filtered);
            }
          }
        }
      }
    });

    const importedSection = importer.importFormField(repeatedSection, formId, 1);

    // importedSection.components.map((component) => {
    //   component.key += "__" + importedSection._path[importedSection._path.length - 1];
    // });

    let parentId, parent;
    if (importedSection.type == 'group') {
      parentId = formId;
    }
    if (parentId) {
      parent = importer._formFieldRegistry.get(parentId);
      const index = parent.components.findIndex(x => x.id === section.id);
      if (parent) {
        parent.components.splice(index + section.repeatedCount, 0, importedSection);
      }
    }
    form.importSchema(schema, data);
  }
}

function removeSectionHandler(form, section) {
  const importer = form.get('importer');

  const {
    schema,
    data
  } = form._getState();
  const formId = schema.id;
  const parentId = formId;
  let repeatedCount = 0;

  section.components.forEach((component) => {
    importer._formFieldRegistry.remove(component);
    delete data[component.key]
  });

  if (parentId) {
    parent = importer._formFieldRegistry.get(parentId);
    if (parent) {
      parent.components.map(component => {
        if (component.id == section.source) {
          component.repeatedCount--;
          repeatedCount = component.repeatedCount;
        }
        if (component.source == section.source && component.repeatedIndex > section.repeatedIndex) {
          component.repeatedIndex--;
          component.components.map(field => {
            const keyArr = field.key.split("__");
            field.key = keyArr[0] + "__" + keyArr[1] + "__" + component.repeatedIndex;
            const nextKey = keyArr[0] + "__" + keyArr[1] + "__" + (component.repeatedIndex + 1);
            data[field.key] = data[nextKey];
            if (component.repeatedIndex + 1 > repeatedCount) {
              delete data[nextKey]
            }
          });
        }
      });
      parent.components = parent.components.filter(x => x.id !== section.id);
    }
  }

  form.importSchema(schema, data);
}

const NODE_TYPE_TEXT = 3,
  NODE_TYPE_ELEMENT = 1;
const ALLOWED_NODES = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'em', 'a', 'p', 'div', 'ul', 'ol', 'li', 'hr', 'blockquote', 'img', 'pre', 'code', 'br', 'strong', 'table', 'thead', 'tbody', 'tr', 'th', 'td'];
const ALLOWED_ATTRIBUTES = ['align', 'alt', 'class', 'href', 'id', 'name', 'rel', 'target', 'src'];
const ALLOWED_URI_PATTERN = /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i; // eslint-disable-line no-useless-escape
const ALLOWED_IMAGE_SRC_PATTERN = /^(https?|data):.*/i; // eslint-disable-line no-useless-escape
const ATTR_WHITESPACE_PATTERN = /[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g; // eslint-disable-line no-control-regex

const FORM_ELEMENT = document.createElement('form');

/**
 * Sanitize a HTML string and return the cleaned, safe version.
 *
 * @param {string} html
 * @return {string}
 */

// see https://github.com/developit/snarkdown/issues/70
function sanitizeHTML(html) {
  const doc = new DOMParser().parseFromString(`<!DOCTYPE html>\n<html><body><div>${html}`, 'text/html');
  doc.normalize();
  const element = doc.body.firstChild;
  if (element) {
    sanitizeNode( /** @type Element */element);
    return new XMLSerializer().serializeToString(element);
  } else {
    // handle the case that document parsing
    // does not work at all, due to HTML gibberish
    return '';
  }
}

/**
 * Sanitizes an image source to ensure we only allow for data URI and links
 * that start with http(s).
 *
 * Note: Most browsers anyway do not support script execution in <img> elements.
 *
 * @param {string} src
 * @returns {string}
 */
function sanitizeImageSource(src) {
  const valid = ALLOWED_IMAGE_SRC_PATTERN.test(src);
  return valid ? src : '';
}

/**
 * Recursively sanitize a HTML node, potentially
 * removing it, its children or attributes.
 *
 * Inspired by https://github.com/developit/snarkdown/issues/70
 * and https://github.com/cure53/DOMPurify. Simplified
 * for our use-case.
 *
 * @param {Element} node
 */
function sanitizeNode(node) {
  // allow text nodes
  if (node.nodeType === NODE_TYPE_TEXT) {
    return;
  }

  // disallow all other nodes but Element
  if (node.nodeType !== NODE_TYPE_ELEMENT) {
    return node.remove();
  }
  const lcTag = node.tagName.toLowerCase();

  // disallow non-whitelisted tags
  if (!ALLOWED_NODES.includes(lcTag)) {
    return node.remove();
  }
  const attributes = node.attributes;

  // clean attributes
  for (let i = attributes.length; i--;) {
    const attribute = attributes[i];
    const name = attribute.name;
    const lcName = name.toLowerCase();

    // normalize node value
    const value = attribute.value.trim();
    node.removeAttribute(name);
    const valid = isValidAttribute(lcTag, lcName, value);
    if (valid) {
      node.setAttribute(name, value);
    }
  }

  // force noopener on target="_blank" links
  if (lcTag === 'a' && node.getAttribute('target') === '_blank' && node.getAttribute('rel') !== 'noopener') {
    node.setAttribute('rel', 'noopener');
  }
  for (let i = node.childNodes.length; i--;) {
    sanitizeNode( /** @type Element */node.childNodes[i]);
  }
}

/**
 * Validates attributes for validity.
 *
 * @param {string} lcTag
 * @param {string} lcName
 * @param {string} value
 * @return {boolean}
 */
function isValidAttribute(lcTag, lcName, value) {
  // disallow most attributes based on whitelist
  if (!ALLOWED_ATTRIBUTES.includes(lcName)) {
    return false;
  }

  // disallow "DOM clobbering" / polution of document and wrapping form elements
  if ((lcName === 'id' || lcName === 'name') && (value in document || value in FORM_ELEMENT)) {
    return false;
  }
  if (lcName === 'target' && value !== '_blank') {
    return false;
  }

  // allow valid url links only
  if (lcName === 'href' && !ALLOWED_URI_PATTERN.test(value.replace(ATTR_WHITESPACE_PATTERN, ''))) {
    return false;
  }
  return true;
}

function _extends$i() { _extends$i = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$i.apply(this, arguments); }
var SvgImagePlaceholder = function SvgImagePlaceholder(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$i({
    xmlns: "http://www.w3.org/2000/svg",
    xmlSpace: "preserve",
    width: 64,
    height: 64,
    style: {
      fillRule: "evenodd",
      clipRule: "evenodd",
      strokeLinejoin: "round",
      strokeMiterlimit: 2
    },
    viewBox: "0 0 1280 1280"
  }, props), /*#__PURE__*/React.createElement("path", {
    d: "M0 0h1280v1280H0z",
    style: {
      fill: "#e5e9ed"
    }
  }), /*#__PURE__*/React.createElement("path", {
    d: "M910 410H370v470h540V410Zm-57.333 57.333v355.334H427.333V467.333h425.334Z",
    style: {
      fill: "#cad3db"
    }
  }), /*#__PURE__*/React.createElement("path", {
    d: "M810 770H480v-60l100-170 130 170 100-65v125Z",
    style: {
      fill: "#cad3db"
    }
  }), /*#__PURE__*/React.createElement("circle", {
    cx: 750,
    cy: 550,
    r: 50,
    style: {
      fill: "#cad3db"
    },
    transform: "translate(10 10)"
  }));
};
var ImagePlaceholder = SvgImagePlaceholder;

const type$8 = 'image';
function Image(props) {
  const {
    field
  } = props;
  const {
    alt,
    id,
    source,
    label,
    validate = {}
  } = field;
  const {
    required
  } = validate;
  const evaluatedImageSource = useSingleLineTemplateEvaluation(source, {
    debug: true
  });
  const safeSource = useMemo(() => sanitizeImageSource(evaluatedImageSource), [evaluatedImageSource]);
  const altText = useSingleLineTemplateEvaluation(alt, {
    debug: true
  });
  const {
    formId
  } = useContext(FormContext$1);
  return jsxs("div", {
    class: formFieldClasses(type$8),
    children: [
      jsx(Label, {
        id: prefixId(id, formId),
        label: label,
        required: required
      }),
      jsxs("div", {
        class: "fjs-image-container",
        children: [safeSource && jsx("img", {
          alt: altText,
          src: safeSource,
          class: "fjs-image",
          id: prefixId(id, formId)
        }), !safeSource && jsx("div", {
          class: "fjs-image-placeholder",
          children: jsx(ImagePlaceholder, {
            alt: "This is an image placeholder"
          })
        })]
      })]
  });
}
Image.config = {
  type: type$8,
  keyed: true,
  label: 'Image view',
  //group: 'presentation',
  group: 'basic-input',
  create: (options = {}) => ({
    ...options
  })
};

const type$k = 'obstacle';
function Obstacle(props) {
  const {
    field
  } = props;
  const {
    id,
    label,
    validate = {}
  } = field;
  const {
    required
  } = validate;
  const {
    formId
  } = useContext(FormContext$1);
  return jsxs("div", {
    class: formFieldClasses(type$k),
    children: [
      jsx(Label, {
        id: prefixId(id, formId),
        label: label,
        required: required
      }),
      jsxs("div", {
        class: "fjs-obstacle",
        children: [jsx("div", {
          class: "icon icon-add",
          id: prefixId(id, formId)
        })]
      })]
  });
}
Obstacle.config = {
  type: type$k,
  keyed: true,
  label: 'Obstacle',
  group: 'basic-input',
  create: (options = {}) => ({
    ...options
  })
};

const type$l = 'map';
function Map(props) {
  const {
    field
  } = props;
  const {
    id,
    label,
    validate = {}
  } = field;
  const {
    required
  } = validate;
  const {
    formId
  } = useContext(FormContext$1);
  return jsxs("div", {
    class: formFieldClasses(type$l),
    children: [
      jsx(Label, {
        id: prefixId(id, formId),
        label: label,
        required: required
      }),
      jsxs("div", {
        class: "fjs-map",
        children: [jsx("div", {
          children: 'MAP',
          id: prefixId(id, formId)
        })]
      })]
  });
}
Map.config = {
  type: type$l,
  keyed: true,
  label: 'Map',
  group: 'basic-input',
  create: (options = {}) => ({
    ...options
  })
};

function TemplatedInputAdorner(props) {
  const {
    pre,
    post
  } = props;
  const evaluatedPre = useSingleLineTemplateEvaluation(pre, {
    debug: true
  });
  const evaluatedPost = useSingleLineTemplateEvaluation(post, {
    debug: true
  });
  return jsx(InputAdorner, {
    ...props,
    pre: evaluatedPre,
    post: evaluatedPost
  });
}

var _path$f;
function _extends$h() { _extends$h = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$h.apply(this, arguments); }
var SvgAngelDown = function SvgAngelDown(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$h({
    xmlns: "http://www.w3.org/2000/svg",
    width: 8,
    height: 8
  }, props), _path$f || (_path$f = /*#__PURE__*/React.createElement("path", {
    fill: "currentColor",
    fillRule: "evenodd",
    stroke: "currentColor",
    strokeWidth: 0.5,
    d: "M7.75 1.336 4 6.125.258 1.335 0 1.54l4 5.125L8 1.54Zm0 0",
    clipRule: "evenodd"
  })));
};
var AngelDownIcon = SvgAngelDown;

var _path$e;
function _extends$g() { _extends$g = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$g.apply(this, arguments); }
var SvgAngelUp = function SvgAngelUp(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$g({
    xmlns: "http://www.w3.org/2000/svg",
    width: 8,
    height: 8
  }, props), _path$e || (_path$e = /*#__PURE__*/React.createElement("path", {
    fill: "currentColor",
    fillRule: "evenodd",
    stroke: "currentColor",
    strokeWidth: 0.5,
    d: "M7.75 6.664 4 1.875.258 6.665 0 6.46l4-5.125L8 6.46Zm0 0",
    clipRule: "evenodd"
  })));
};
var AngelUpIcon = SvgAngelUp;

const type$7 = 'number';
function Numberfield(props) {
  const {
    disabled,
    errors = [],
    onBlur,
    field,
    value,
    readonly,
    onChange
  } = props;
  const {
    description,
    id,
    label,
    appearance = {},
    validate = {},
    decimalDigits,
    serializeToString = false,
    increment: incrementValue
  } = field;
  const {
    prefixAdorner,
    suffixAdorner
  } = appearance;
  const {
    required
  } = validate;
  const inputRef = useRef();
  const [stringValueCache, setStringValueCache] = useState('');

  // checks whether the value currently in the form data is practically different from the one in the input field cache
  // this allows us to guarantee the field always displays valid form data, but without auto-simplifying values like 1.000 to 1
  const cacheValueMatchesState = useMemo(() => Numberfield.config.sanitizeValue({
    value,
    formField: field
  }) === Numberfield.config.sanitizeValue({
    value: stringValueCache,
    formField: field
  }), [stringValueCache, value, field]);
  const displayValue = useMemo(() => {
    if (value === 'NaN') return 'NaN';
    if (stringValueCache === '-') return '-';
    return cacheValueMatchesState ? stringValueCache : value || value === 0 ? Big(value).toFixed() : '';
  }, [stringValueCache, value, cacheValueMatchesState]);
  const arrowIncrementValue = useMemo(() => {
    if (incrementValue) return Big(incrementValue);
    if (decimalDigits) return Big(`1e-${decimalDigits}`);
    return Big('1');
  }, [decimalDigits, incrementValue]);
  const setValue = useCallback(stringValue => {
    if (isNullEquivalentValue(stringValue)) {
      setStringValueCache('');
      onChange({
        field,
        value: null
      });
      return;
    }

    // treat commas as dots
    stringValue = stringValue.replaceAll(',', '.');
    if (stringValue === '-') {
      setStringValueCache('-');
      return;
    }
    if (isNaN(Number(stringValue))) {
      setStringValueCache('NaN');
      onChange({
        field,
        value: 'NaN'
      });
      return;
    }
    setStringValueCache(stringValue);
    onChange({
      field,
      value: serializeToString ? stringValue : Number(stringValue)
    });
  }, [field, onChange, serializeToString]);
  const increment = () => {
    if (readonly) {
      return;
    }
    const base = isValidNumber(value) ? Big(value) : Big(0);
    const stepFlooredValue = base.minus(base.mod(arrowIncrementValue));

    // note: toFixed() behaves differently in big.js
    setValue(stepFlooredValue.plus(arrowIncrementValue).toFixed());
  };
  const decrement = () => {
    if (readonly) {
      return;
    }
    const base = isValidNumber(value) ? Big(value) : Big(0);
    const offset = base.mod(arrowIncrementValue);
    if (offset.cmp(0) === 0) {
      // if we're already on a valid step, decrement
      setValue(base.minus(arrowIncrementValue).toFixed());
    } else {
      // otherwise floor to the step
      const stepFlooredValue = base.minus(base.mod(arrowIncrementValue));
      setValue(stepFlooredValue.toFixed());
    }
  };
  const onKeyDown = e => {
    // delete the NaN state all at once on backspace or delete
    if (value === 'NaN' && (e.code === 'Backspace' || e.code === 'Delete')) {
      setValue(null);
      e.preventDefault();
      return;
    }
    if (e.code === 'ArrowUp') {
      increment();
      e.preventDefault();
      return;
    }
    if (e.code === 'ArrowDown') {
      decrement();
      e.preventDefault();
      return;
    }
  };

  // intercept key presses which would lead to an invalid number
  const onKeyPress = e => {
    const caretIndex = inputRef.current.selectionStart;
    const selectionWidth = inputRef.current.selectionStart - inputRef.current.selectionEnd;
    const previousValue = inputRef.current.value;
    if (!willKeyProduceValidNumber(e.key, previousValue, caretIndex, selectionWidth, decimalDigits)) {
      e.preventDefault();
    }
  };
  const {
    formId
  } = useContext(FormContext$1);
  const errorMessageId = errors.length === 0 ? undefined : `${prefixId(id, formId)}-error-message`;
  return jsxs("div", {
    class: formFieldClasses(type$7, {
      errors,
      disabled,
      readonly
    }),
    children: [jsx(Label, {
      id: prefixId(id, formId),
      label: label,
      required: required
    }), jsx(TemplatedInputAdorner, {
      disabled: disabled,
      readonly: readonly,
      pre: prefixAdorner,
      post: suffixAdorner,
      children: jsxs("div", {
        class: classNames('fjs-vertical-group', {
          'fjs-disabled': disabled,
          'fjs-readonly': readonly
        }, {
          'hasErrors': errors.length
        }),
        children: [jsx("input", {
          ref: inputRef,
          class: "fjs-input",
          disabled: disabled,
          readOnly: readonly,
          id: prefixId(id, formId),
          onKeyDown: onKeyDown,
          onKeyPress: onKeyPress,
          onBlur: onBlur

          // @ts-ignore
          ,
          onInput: e => setValue(e.target.value),
          type: "text",
          autoComplete: "off",
          step: arrowIncrementValue,
          value: displayValue,
          "aria-describedby": errorMessageId
        }), jsxs("div", {
          class: classNames('fjs-number-arrow-container', {
            'fjs-disabled': disabled,
            'fjs-readonly': readonly
          }),
          children: [jsx("button", {
            class: "fjs-number-arrow-up",
            type: "button",
            "aria-label": "Increment",
            onClick: () => increment(),
            tabIndex: -1,
            children: jsx(AngelUpIcon, {})
          }), jsx("div", {
            class: "fjs-number-arrow-separator"
          }), jsx("button", {
            class: "fjs-number-arrow-down",
            type: "button",
            "aria-label": "Decrement",
            onClick: () => decrement(),
            tabIndex: -1,
            children: jsx(AngelDownIcon, {})
          })]
        })]
      })
    }), jsx(Description, {
      description: description
    }), jsx(Errors, {
      errors: errors,
      id: errorMessageId
    })]
  });
}
Numberfield.config = {
  type: type$7,
  keyed: true,
  label: 'Number',
  group: 'basic-input',
  emptyValue: null,
  sanitizeValue: ({
    value,
    formField
  }) => {
    // null state is allowed
    if (isNullEquivalentValue(value)) return null;

    // if data cannot be parsed as a valid number, go into invalid NaN state
    if (!isValidNumber(value)) return 'NaN';

    // otherwise parse to formatting type
    return formField.serializeToString ? value.toString() : Number(value);
  },
  create: (options = {}) => ({
    ...options
  })
};

const type$6 = 'radio';
function Radio(props) {
  const {
    disabled,
    errors = [],
    onBlur,
    field,
    readonly,
    value
  } = props;
  const {
    description,
    id,
    label,
    validate = {}
  } = field;
  const outerDivRef = useRef();
  const {
    required
  } = validate;
  const onChange = v => {
    props.onChange({
      field,
      value: v
    });
  };
  const onRadioBlur = e => {
    if (outerDivRef.current.contains(e.relatedTarget)) {
      return;
    }
    onBlur();
  };
  const {
    state: loadState,
    values: options
  } = useValuesAsync(field);
  const {
    formId
  } = useContext(FormContext$1);
  const errorMessageId = errors.length === 0 ? undefined : `${prefixId(id, formId)}-error-message`;
  return jsxs("div", {
    class: formFieldClasses(type$6, {
      errors,
      disabled,
      readonly
    }),
    ref: outerDivRef,
    children: [jsx(Label, {
      label: label,
      required: required
    }), loadState == LOAD_STATES.LOADED && options.map((option, index) => {
      return jsx(Label, {
        id: prefixId(`${id}-${index}`, formId),
        label: option.label,
        class: classNames({
          'fjs-checked': option.value === value
        }),
        required: false,
        children: jsx("input", {
          checked: option.value === value,
          class: "fjs-input",
          disabled: disabled,
          readOnly: readonly,
          id: prefixId(`${id}-${index}`, formId),
          type: "radio",
          onClick: () => onChange(option.value),
          onBlur: onRadioBlur,
          "aria-describedby": errorMessageId
        })
      }, `${id}-${index}`);
    }), jsx(Description, {
      description: description
    }), jsx(Errors, {
      errors: errors,
      id: errorMessageId
    })]
  });
}
Radio.config = {
  type: type$6,
  keyed: true,
  label: 'Single-Choice',
  group: 'basic-input',
  emptyValue: null,
  sanitizeValue: sanitizeSingleSelectValue,
  create: createEmptyOptions
};

var _path$d;
function _extends$f() { _extends$f = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$f.apply(this, arguments); }
var SvgXMark = function SvgXMark(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$f({
    xmlns: "http://www.w3.org/2000/svg",
    width: 8,
    height: 8
  }, props), _path$d || (_path$d = /*#__PURE__*/React.createElement("path", {
    fill: "currentColor",
    fillRule: "evenodd",
    stroke: "currentColor",
    strokeWidth: 0.5,
    d: "M4 3.766 7.43.336l.234.234L4.234 4l3.43 3.43-.234.234L4 4.234.57 7.664.336 7.43 3.766 4 .336.57.57.336Zm0 0",
    clipRule: "evenodd"
  })));
};
var XMarkIcon = SvgXMark;


//simple select
function StaticSimpleSingleSelect(props) {
  const {
    id,
    disabled,
    errors,
    onBlur,
    field,
    readonly,
    value
  } = props;
  const {
    formId
  } = useContext(FormContext$1);
  const [isDropdownExpanded, setIsDropdownExpanded] = useState(false);
  const selectRef = useRef();
  const searchApiSingleRef = useRef();
  const {
    state: loadState,
    values: options
  } = useValuesAsync(field);

  // We cache a map of option values to their index so that we don't need to search the whole options array every time to correlate the label
  const valueToOptionMap = useMemo(() => Object.assign({}, ...options.map((o, x) => ({
    [o.value]: options[x]
  }))), [options]);
  const valueLabel = useMemo(() => value && valueToOptionMap[value] && valueToOptionMap[value].label || '', [value, valueToOptionMap]);
  const setValue = useCallback(option => {
    props.onChange({
      value: option && option.value || null,
      field
    });
  }, [field, props]);
  const displayState = useMemo(() => {
    const ds = {};
    ds.componentReady = !disabled && !readonly && loadState === LOAD_STATES.LOADED;
    ds.displayCross = ds.componentReady && value !== null && value !== undefined;
    ds.displayDropdown = !disabled && !readonly && isDropdownExpanded;
    return ds;
  }, [disabled, isDropdownExpanded, loadState, value]);
  const onMouseDown = useCallback(e => {
    const select = selectRef.current;
    setIsDropdownExpanded(!isDropdownExpanded);
    if (isDropdownExpanded) {
      select.blur();
    } else {
      select.focus();
    }
    e.preventDefault();
  }, [isDropdownExpanded]);

  document.addEventListener('click', (e) => {
    // if (!selectRef?.current?.contains(e.target)) {
    //   setIsDropdownExpanded(false);
    // }
    if (selectRef.current && !selectRef.current.contains(e.target)) {
      setIsDropdownExpanded(false);
    }
    if (searchApiSingleRef.current && searchApiSingleRef.current.contains(e.target)) {
      setIsDropdownExpanded(true);
    }
  });

  const initialFocusIndex = useMemo(() => value && findIndex(options, o => o.value === value) || 0, [options, value]);

  const onValueSelected = (o) => {
    setValue(o);
    setIsDropdownExpanded(false);
  };

  const getLabel = (o) => {
    return o.label
  };

  return jsxs(Fragment$1, {
    children: [jsxs("div", {
      ref: selectRef,
      id: prefixId(`${id}`, formId),
      class: classNames('fjs-input-group', {
        disabled,
        readonly
      }, {
        'hasErrors': errors.length
      }),
      // onFocus: () => setIsDropdownExpanded(true),
      // onBlur: () => {
      //   setIsDropdownExpanded(false);
      //   onBlur();
      // },
      // onMouseDown: onMouseDown,
      children: [jsx("input", {
        // class: classNames('fjs-select-display', {
        //   'fjs-select-placeholder': !value
        // }),
        class: "fjs-input px-2",
        id: prefixId(`${id}-display`, formId),
        placeholder: 'Select',
        value: valueLabel,
        readOnly: true,
        onMouseDown: () => {
          // setIsEscapeClose(false);
          setIsDropdownExpanded(!isDropdownExpanded);
          // filterValues('')
          // setShouldApplyFilter(false);
        },
        onBlur: () => {
          //setIsDropdownExpanded(false);
          //   setFilter(valueLabel);
          onBlur();
        },
        // children: valueLabel || 'Select'
      }),

      //  !disabled && jsx("input", {
      //   id: prefixId(`${id}-search`, formId),
      //   class: "fjs-select-hidden-input",
      //   value: valueLabel,
      //   onFocus: () => !readonly && setIsDropdownExpanded(true),
      //   onBlur: () => !readonly && setIsDropdownExpanded(false),
      //   "aria-describedby": props['aria-describedby']
      // }), 
      displayState.displayCross && jsx("span", {
        class: "fjs-select-cross",
        onclick: e => {
          setValue(null);
          e.preventDefault();
        },
        children: jsx(XMarkIcon, {}, " ")
      }), jsx("span", {
        class: "fjs-select-arrow",
        onMouseDown: () => {
          setIsDropdownExpanded(!isDropdownExpanded);
        },
        children: displayState.displayDropdown ? jsx(AngelUpIcon, {}) : jsx(AngelDownIcon, {})
      })]
    }), jsx("div", {
      class: "fjs-select-anchor",
      ref: searchApiSingleRef,
      children: displayState.displayDropdown &&
        jsxs("div", {
          tabIndex: -1,
          class: "fjs-dropdownlist",
          //onMouseDown: e => e.preventDefault(),
          onScroll: e => handleOnScrollEnd(e),
          style: {
            maxHeight: 300,
            // scrollBehavior: smoothScrolling ? 'smooth' : 'auto'
          },
          children: [
            options.length > 0 && options.map((v, i) => {
              return jsxs("div", {
                class: classNames('fjs-dropdownlist-item', {
                  // 'focused': focusedValueIndex === i
                }),
                // onMouseMove: mouseControl ? undefined : e => { setMouseControl(true); setFocusedValueIndex(i) },
                // onMouseEnter: mouseControl ? () => setFocusedValueIndex(i) : undefined,
                onMouseDown: e => { onValueSelected(v); },
                children: [
                  // jsx("input", {
                  //   type: "checkbox",
                  //   checked: value?.includes(v.value),
                  //   onClick: (e) => { e.preventDefault() }
                  // }),
                  getLabel(v)]
              });
            }), !options.length && jsx("div", {
              class: "fjs-dropdownlist-empty",
              children: 'No results'
            })]
        })
      // children: displayState.displayDropdown && jsx(DropdownList, {
      //   values: options,
      //   getLabel: o => o.label,
      //   initialFocusIndex: initialFocusIndex,
      //   onValueSelected: o => {
      //     setValue(o);
      //     setIsDropdownExpanded(false);
      //   },
      //   listenerElement: selectRef.current
      // })
    })]
  });
}

//SearchableSelect
function StaticSearchableSingleSelect(props) {
  const {
    id,
    disabled,
    errors,
    onBlur,
    field,
    readonly,
    value
  } = props;
  const {
    formId
  } = useContext(FormContext$1);
  const [filter, setFilter] = useState('');
  const [isDropdownExpanded, setIsDropdownExpanded] = useState(false);
  const [shouldApplyFilter, setShouldApplyFilter] = useState(true);
  const [isEscapeClosed, setIsEscapeClose] = useState(false);
  const searchbarRef = useRef();
  const searchStaticSearchableSingleRef = useRef();
  const selectStaticSearchableSingleRef = useRef();
  const {
    state: loadState,
    values: options
  } = useValuesAsync(field);

  // We cache a map of option values to their index so that we don't need to search the whole options array every time to correlate the label
  const valueToOptionMap = useMemo(() => Object.assign({}, ...options.map((o, x) => ({
    [o.value]: options[x]
  }))), [options]);
  const valueLabel = useMemo(() => value && valueToOptionMap[value] && valueToOptionMap[value].label || '', [value, valueToOptionMap]);

  // whenever we change the underlying value, set the label to it
  useEffect(() => {
    setFilter(valueLabel);
  }, [valueLabel]);
  // const filteredOptions = useMemo(() => {
  //   if (loadState === LOAD_STATES.LOADED) {
  //     return shouldApplyFilter ? options.filter(o => o.label && o.value && o.label.toLowerCase().includes(filter.toLowerCase())) : options;
  //   }
  //   return [];
  // }, [filter, loadState, options, shouldApplyFilter]);
  const onChange = ({
    target
  }) => {
    setIsEscapeClose(false);
    setIsDropdownExpanded(true);
    setShouldApplyFilter(true);
    setFilter(target.value || '');
  };
  const setValue = useCallback(option => {
    setFilter(option && option.label || '');
    props.onChange({
      value: option && option.value || null,
      field
    });
  }, [field, props]);
  const onInputKeyDown = useCallback(keyDownEvent => {
    switch (keyDownEvent.key) {
      case 'ArrowUp':
        keyDownEvent.preventDefault();
        break;
      case 'ArrowDown':
        {
          if (!isDropdownExpanded) {
            setIsDropdownExpanded(true);
            setShouldApplyFilter(false);
          }
          keyDownEvent.preventDefault();
          break;
        }
      case 'Escape':
        setIsEscapeClose(true);
        break;
      case 'Enter':
        if (isEscapeClosed) {
          setIsEscapeClose(false);
        }
        break;
    }
  }, [isDropdownExpanded, isEscapeClosed]);
  const displayState = useMemo(() => {
    const ds = {};
    ds.componentReady = !disabled && !readonly && loadState === LOAD_STATES.LOADED;
    ds.displayCross = ds.componentReady && value !== null && value !== undefined;
    ds.displayDropdown = !disabled && !readonly && isDropdownExpanded && !isEscapeClosed;
    return ds;
  }, [disabled, isDropdownExpanded, isEscapeClosed, loadState, readonly, value]);
  const onAngelMouseDown = useCallback(e => {
    setIsEscapeClose(false);
    setIsDropdownExpanded(!isDropdownExpanded);
    const searchbar = searchbarRef.current;
    isDropdownExpanded ? searchbar.blur() : searchbar.focus();
    e.preventDefault();
  }, [isDropdownExpanded]);

  document.addEventListener('click', (e) => {
    ;
    if (!selectStaticSearchableSingleRef?.current?.contains(e.target)) {
      setIsDropdownExpanded(false);
    }
    if (searchStaticSearchableSingleRef?.current && searchStaticSearchableSingleRef?.current?.contains(e.target)) {
      setIsDropdownExpanded(true);
    }
  })

  const emptyListMessage = 'No results';
  const [filterdOptions, setFilterOptions] = useState(options)
  const filteredOptions = (val) => {
    if (val !== '') {
      const filtedOptions = options.filter(data => data.label.toLowerCase().includes(val.toLowerCase()))
      return setFilterOptions(filtedOptions)
    }
    return setFilterOptions(options)
  }

  useEffect(() => { setFilterOptions(options) }, [options])

  const getLabel = (o) => {
    return o.label
  };

  const onValueSelected = (o) => {
    setValue(o);
    setIsDropdownExpanded(false);
  };

  return jsxs(Fragment$1, {
    children: [jsxs("div", {
      id: prefixId(`${id}`, formId),
      ref: selectStaticSearchableSingleRef,
      class: classNames('fjs-input-group', {
        'disabled': disabled,
        'readonly': readonly
      }, {
        'hasErrors': errors.length
      }),

      children: [jsx("input", {
        disabled: false,
        readOnly: true,
        class: "fjs-input",
        ref: searchbarRef,
        id: prefixId(`${id}-search`, formId),
        onChange: onChange,
        type: "text",
        value: filter,
        placeholder: 'Select',
        // autoComplete: "off",
        onKeyDown: e => onInputKeyDown(e),
        onMouseDown: () => {
          setIsEscapeClose(false);
          setIsDropdownExpanded(!isDropdownExpanded);
          setShouldApplyFilter(false);
        },
        onFocus: () => {
          setIsDropdownExpanded(true);
          setShouldApplyFilter(false);
        },
        // onBlur: () => {
        //   setIsDropdownExpanded(false);
        //   setFilter(valueLabel);
        //   onBlur();
        // },
        "aria-describedby": props['aria-describedby']
      }), displayState.displayCross && jsxs("span", {
        class: "fjs-select-cross",
        onclick: e => {
          setValue(null);
          e.preventDefault();
        },
        children: [jsx(XMarkIcon, {}, " ")]
      }), jsx("span", {
        class: "fjs-select-arrow",
        onMouseDown: e => onAngelMouseDown(e),
        children: displayState.displayDropdown ? jsx(AngelUpIcon, {}) : jsx(AngelDownIcon, {})
      })]
    }), jsx("div", {
      class: "fjs-select-anchor",
      ref: searchStaticSearchableSingleRef,
      children: [
        displayState.displayDropdown && jsxs("div", {
          // ref: dropdownContainer,
          tabIndex: -1,
          class: "fjs-dropdownlist p-2",
          // onMouseDown: e => e.preventDefault(),
          style: {
            maxHeight: 235,
            // scrollBehavior: smoothScrolling ? 'smooth' : 'auto'
          },
          children: [
            jsx("input", {
              type: "text",
              onChange: (e) => {
                filteredOptions(e.target.value)
              },
              placeholder: 'Search',
              class: "form-control w-100 mb-2",
            })
            ,
            filterdOptions.length > 0 && filterdOptions.map((v, i) => {
              return jsx("div", {
                class: classNames('fjs-dropdownlist-item', {
                  // 'focused': focusedValueIndex === i
                }),
                // onMouseMove: mouseControl ? undefined : e => onMouseMovedInKeyboardMode(e, i),
                // onMouseEnter: mouseControl ? () => setFocusedValueIndex(i) : undefined,
                onMouseDown: e => onValueSelected(v),
                children: getLabel(v)
              });
            }), !filterdOptions.length && jsx("div", {
              class: "fjs-dropdownlist-empty",
              children: emptyListMessage
            })]
        })
      ]
      // children: displayState.displayDropdown && jsx(DropdownList, {
      //   values: filteredOptions,
      //   getLabel: o => o.label,
      //   onValueSelected: o => {
      //     setValue(o);
      //     setIsDropdownExpanded(false);
      //   },
      //   searchInputRef: o => {
      //     if(o){
      //       searchStaticSearchableSingleRef = o
      //     }
      //   },
      //   listenerElement: searchbarRef.current,
      //   searchabel: true
      // })
    })]
  });
}

//multi select
function StaticSimpleMultiSelect(props) {
  const {
    id,
    disabled,
    errors,
    onBlur,
    field,
    readonly,
    value = []
  } = props;
  const {
    formId
  } = useContext(FormContext$1);
  const [isDropdownExpanded, setIsDropdownExpanded] = useState(false);
  const selectMultiRef = useRef();
  const searchStaticMultiRef = useRef();
  const selectStaticMultiRef = useRef();
  // let containerMultiselectOptionsRef = useRef();
  const {
    state: loadState,
    values: options
  } = useValuesAsync(field);

  // We cache a map of option values to their index so that we don't need to search the whole options array every time to correlate the label
  const valueToOptionMap = useMemo(() => Object.assign({}, ...options.map((o, x) => ({
    [o.value]: options[x]
  }))), [options]);
  const [valueSelected, setValueSelected] = useState([]);
  // useEffect(() => { 
  //   if(value){
  //     let result = '';
  //     value?.forEach(element => {
  //       if (valueToOptionMap[element]) {
  //         result += (valueToOptionMap[element].label || '') + ", ";
  //       }
  //     });
  //    return setValueSelected(result)
  //   }
  // }, [value,valueToOptionMap])
  // const valueLabel = useMemo(() => {
  //   let result = '';
  //   value?.forEach(element => {
  //     if (valueToOptionMap[element]) {
  //       
  //       result += (valueToOptionMap[element].label || '') + ", ";
  //     }
  //   });
  //   setValueSelected(result.slice(0, -2))
  //   // return result.slice(0, -2);
  // }, [value, valueToOptionMap]);

  // const setValue = useCallback(option => {
  //   props.onChange({
  //     value: option && option.value || null,
  //     field
  //   });
  // }, [field, props]);

  // const setValue = v => {
  //   let newValue = [];
  //   if (value) {
  //     newValue = [...value];
  //   }
  //   if (!newValue.includes(v)) {
  //     newValue.push(v);
  //   } else {
  //     newValue = newValue.filter(x => x != v);
  //   }
  //   setValueSelected(newValue);
  //   props.onChange({
  //     field,
  //     value: newValue
  //   });
  // };

  // const clearValue = () => {
  //   //setSelectedValue([]);
  //   props.onChange({
  //     field,
  //     value: []
  //   });
  // };
  const setValue = v => {

    let newValue = [];
    if (value) {
      newValue = [...value];
    }

    // let newSelected = [];
    // if (selectedValue) {
    //   newSelected = [...selectedValue]
    // }

    if (!newValue.includes(v)) {
      newValue.push(v);
      // newSelected.push(v);
    } else {
      newValue = newValue.filter(x => x != v);
      // newSelected = newSelected.filter(x => x.value != v.value);
    }
    setValueSelected(newValue);
    props.onChange({
      field,
      value: newValue
    });
  };

  const clearValue = () => {
    setValueSelected([]);
    props.onChange({
      field,
      value: []
    });
  };

  const displayState = useMemo(() => {
    const ds = {};
    ds.componentReady = !disabled && !readonly && loadState === LOAD_STATES.LOADED;
    ds.displayCross = ds.componentReady && value !== null && value !== undefined && value?.length > 0;
    ds.displayDropdown = !disabled && !readonly && isDropdownExpanded;
    return ds;
  }, [disabled, isDropdownExpanded, loadState, value]);
  const onMouseDown = useCallback(e => {
    const select = selectStaticMultiRef.current;
    setIsDropdownExpanded(!isDropdownExpanded);
    if (isDropdownExpanded) {
      select.blur();
    } else {
      select.focus();
    }
    e.preventDefault();
  }, [isDropdownExpanded]);
  // const initialFocusIndex = useMemo(() => value && findIndex(options, o => o.value === value) || 0, [options, value]);
  // window.onmouseup = e => {
  //   if(!selectMultiRef.current.contains(e.target)){
  //     setIsDropdownExpanded(false);
  //   }
  // }
  // window.onmousedown = e => {
  //   if(!selectStaticMultiRef.current.contains(e.target)){
  //     setIsDropdownExpanded(false);
  //   }
  //   if(searchStaticMultiRef.current && searchStaticMultiRef.current.contains(e.target)){
  //     setIsDropdownExpanded(true);
  //   }
  // }

  document.addEventListener('click', (e) => {
    ;
    if (!selectStaticMultiRef?.current?.contains(e.target)) {
      setIsDropdownExpanded(false);
    }
    if (searchStaticMultiRef?.current && searchStaticMultiRef?.current?.contains(e.target)) {
      setIsDropdownExpanded(true);
    }
  })

  const getLabel = (o) => {
    return o.label
  };

  const onValueSelected = (o) => {
    setValue(o.value);
    // setIsDropdownExpanded(false);
  };
  const emptyListMessage = 'No results';

  return jsxs(Fragment$1, {
    children: [jsxs("div", {
      ref: selectStaticMultiRef,
      id: prefixId(`${id}`, formId),
      class: classNames('fjs-input-group', {
        disabled,
        readonly
      }, {
        'hasErrors': errors.length
      }),
      onFocus: () => setIsDropdownExpanded(true),
      onBlur: () => {
        setIsDropdownExpanded(false);
        onBlur();
      },
      onMouseDown: onMouseDown,
      children: [jsx("input", {
        // class: classNames('fjs-select-display', {
        //   'fjs-select-placeholder': !value
        // }),
        class: "fjs-input px-2",
        id: prefixId(`${id}-display`, formId),
        placeholder: 'Select',
        value: valueSelected.map(function (item) { return item; }),
      }),
      //  !disabled && jsx("input", {
      //   id: prefixId(`${id}-search`, formId),
      //   class: "fjs-select-hidden-input",
      //   value: valueSelected,
      //   placeholder: 'Multi select dropdown',
      //   onFocus: () => !readonly && setIsDropdownExpanded(true),
      //   onBlur: () => !readonly && setIsDropdownExpanded(false),
      //   "aria-describedby": props['aria-describedby']
      // }), 
      displayState.displayCross && jsx("span", {
        class: "fjs-select-cross",
        onclick: e => {
          clearValue();
          e.preventDefault();
        },
        children: jsx(XMarkIcon, {}, " ")
      }), jsx("span", {
        class: "fjs-select-arrow",
        children: displayState.displayDropdown ? jsx(AngelUpIcon, {}) : jsx(AngelDownIcon, {})
      })]
    }), jsx("div", {
      class: "fjs-select-anchor",
      ref: searchStaticMultiRef,
      children: [
        displayState.displayDropdown && jsxs("div", {
          tabIndex: -1,
          class: "fjs-dropdownlist p-2",
          // onMouseDown: e => e.preventDefault(),
          style: {
            maxHeight: 235,
            // scrollBehavior: smoothScrolling ? 'smooth' : 'auto'
          },
          children: [
            options.length > 0 && options.map((v, i) => {
              return jsxs("div", {
                class: classNames('fjs-dropdownlist-item', {
                  // 'focused': focusedValueIndex === i
                }),
                // ref:multiselectContainerListRef,
                // onMouseMove: mouseControl ? undefined : e => onMouseMovedInKeyboardMode(e, i),
                // onMouseEnter: mouseControl ? () => setFocusedValueIndex(i) : undefined,
                onMouseDown: e => { onValueSelected(v); },
                children: [
                  jsx("input", {
                    type: "checkbox",
                    checked: value?.includes(v.value),
                    onClick: (e) => { e.preventDefault() }
                  }),
                  getLabel(v)]
              });
            }), !options.length && jsx("div", {
              class: "fjs-dropdownlist-empty",
              children: emptyListMessage
            })]
        })
      ]
      // children: displayState.displayDropdown && jsx(MultiSelectDropdownList, {
      //   values: options,
      //   value: value,
      //   getLabel: o => o.label,
      //   initialFocusIndex: initialFocusIndex,
      //   onValueSelected: o => {
      //     setValue(o.value);
      //     setIsDropdownExpanded(true);
      //   },
      //   listenerElement: selectMultiRef.current
      // })
    })]
  });
}

//multi select
function StaticSearchableMultiSelect(props) {
  const {
    id,
    disabled,
    errors,
    onBlur,
    field,
    readonly,
    value = []
  } = props;
  const {
    formId
  } = useContext(FormContext$1);
  const [isDropdownExpanded, setIsDropdownExpanded] = useState(false);
  const selectRef = useRef();
  const searchStaticSearchableMultiRef = useRef();
  const selectStaticSearchableMultiRef = useRef();
  const {
    state: loadState,
    values: options
  } = useValuesAsync(field);

  // We cache a map of option values to their index so that we don't need to search the whole options array every time to correlate the label
  const valueToOptionMap = useMemo(() => Object.assign({}, ...options.map((o, x) => ({
    [o.value]: options[x]
  }))), [options]);
  // const valueLabel = useMemo(() => {
  //   let result = '';
  //   value?.forEach(element => {
  //     if (valueToOptionMap[element]) {
  //       result += (valueToOptionMap[element].label || '') + ", ";
  //     }
  //   });
  //   return result.slice(0, -2);
  // }, [value, valueToOptionMap]);
  const [valueSelected, setValueSelected] = useState([]);
  // useEffect(() => { 
  //   if(value){
  //     let result = '';
  //     value?.forEach(element => {
  //       if (valueToOptionMap[element]) {
  //         result += (valueToOptionMap[element].label || '') + ", ";
  //       }
  //     });
  //      return setValueSelected(result)
  //     
  //   }
  // }, [value,valueToOptionMap,valueSelected])
  // const setValue = useCallback(option => {
  //   props.onChange({
  //     value: option && option.value || null,
  //     field
  //   });
  // }, [field, props]);

  const setValue = v => {
    let newValue = [];
    if (v !== null) {
      if (value) {
        newValue = [...value];
      }
      if (!newValue.includes(v)) {
        newValue.push(v);
      } else {
        newValue = newValue.filter(x => x != v);
      }
    }
    setValueSelected(newValue);
    props.onChange({
      field,
      value: newValue
    });
  };

  const clearValue = () => {
    setValueSelected([]);
    props.onChange({
      field,
      value: []
    });
  };

  const displayState = useMemo(() => {
    const ds = {};
    ds.componentReady = !disabled && !readonly && loadState === LOAD_STATES.LOADED;
    ds.displayCross = ds.componentReady && value !== null && value !== undefined && value?.length > 0;
    ds.displayDropdown = !disabled && !readonly && isDropdownExpanded;
    return ds;
  }, [disabled, isDropdownExpanded, loadState, value]);
  const onMouseDown = useCallback(e => {
    const select = selectStaticSearchableMultiRef.current;
    setIsDropdownExpanded(!isDropdownExpanded);
    if (isDropdownExpanded) {
      select.blur();
    } else {
      select.focus();
    }
    e.preventDefault();
  }, [isDropdownExpanded]);
  const emptyListMessage = 'No results';
  const [filterdOptions, setFilterOptions] = useState(options)
  const filteredOptions = (val) => {
    if (val !== '') {
      const filtedOptions = options.filter(data => data.label.toLowerCase().includes(val.toLowerCase()))
      return setFilterOptions(filtedOptions)
    }
    return setFilterOptions(options)
  }

  useEffect(() => { setFilterOptions(options) }, [options])

  const getLabel = (o) => {
    return o.label
  };

  const onValueSelected = (o) => {
    setValue(o.value);
    // setIsDropdownExpanded(false);
  };

  // window.onclick = e => {
  //   if(!selectStaticSearchableMultiRef.current.contains(e.target)){
  //     setIsDropdownExpanded(false);
  //   }
  //   if(searchStaticSearchableMultiRef.current && searchStaticSearchableMultiRef.current.contains(e.target)){
  //     setIsDropdownExpanded(true);
  //   }
  // }

  document.addEventListener('click', (e) => {
    ;
    if (!selectStaticSearchableMultiRef?.current?.contains(e.target)) {
      setIsDropdownExpanded(false);
    }
    if (searchStaticSearchableMultiRef?.current && searchStaticSearchableMultiRef?.current?.contains(e.target)) {
      setIsDropdownExpanded(true);
    }
  })

  return jsxs(Fragment$1, {
    children: [jsxs("div", {
      ref: selectStaticSearchableMultiRef,
      id: prefixId(`${id}`, formId),
      class: classNames('fjs-input-group', {
        disabled,
        readonly
      }, {
        'hasErrors': errors.length
      }),
      // onFocus: () => setIsDropdownExpanded(true),
      // onBlur: () => {
      //   setIsDropdownExpanded(false);
      //   onBlur();
      // },
      onMouseDown: onMouseDown,
      children: [jsx("input", {
        class: "fjs-input",
        // class: classNames('fjs-select-display', {
        //   'fjs-select-placeholder': !value
        // }),
        id: prefixId(`${id}-display`, formId),
        // children: valueSelected || 'Select',
        placeholder: 'Select',
        value: valueSelected.map(function (item) { return item; }),
      }),
      //  !disabled && jsx("input", {
      //   id: prefixId(`${id}-search`, formId),
      //   class: "fjs-select-hidden-input",
      //   value: valueSelected,
      //   placeholder: 'Multi select dropdown',
      //   onFocus: () => !readonly && setIsDropdownExpanded(true),
      //   onBlur: () => !readonly && setIsDropdownExpanded(false),
      //   "aria-describedby": props['aria-describedby']
      // }),
      displayState.displayCross && jsx("span", {
        class: "fjs-select-cross",
        onclick: e => {
          clearValue();
          e.preventDefault();
        },
        children: jsx(XMarkIcon, {}, " ")
      }), jsx("span", {
        class: "fjs-select-arrow",
        children: displayState.displayDropdown ? jsx(AngelUpIcon, {}) : jsx(AngelDownIcon, {})
      })]
    }), jsx("div", {
      class: "fjs-select-anchor",
      ref: searchStaticSearchableMultiRef,
      children: [
        displayState.displayDropdown && jsxs("div", {
          // ref: dropdownContainer,
          tabIndex: -1,
          class: "fjs-dropdownlist p-2",
          // onMouseDown: e => e.preventDefault(),
          style: {
            maxHeight: 235,
            // scrollBehavior: smoothScrolling ? 'smooth' : 'auto'
          },
          children: [
            jsx("input", {
              type: "text",
              onChange: (e) => {
                filteredOptions(e.target.value)
              },
              placeholder: 'Search',
              class: "form-control w-100 mb-2"
            })
            ,
            filterdOptions.length > 0 && filterdOptions.map((v, i) => {
              return jsxs("div", {
                class: classNames('fjs-dropdownlist-item', {
                  // 'focused': focusedValueIndex === i
                }),
                // ref:multiselectContainerListRef,
                // onMouseMove: mouseControl ? undefined : e => onMouseMovedInKeyboardMode(e, i),
                // onMouseEnter: mouseControl ? () => setFocusedValueIndex(i) : undefined,
                onMouseDown: e => { onValueSelected(v) },
                children: [
                  jsx("input", {
                    type: "checkbox",
                    checked: value?.includes(v.value),
                    onClick: (e) => { e.preventDefault() }
                  }),
                  getLabel(v)]
              });
            }), !options.length && jsx("div", {
              class: "fjs-dropdownlist-empty",
              children: emptyListMessage
            })]
        })

      ]
    })]
  });
}

//copy SearchableSelect
function ApiSingleSelect(props) {
  const {
    id,
    disabled,
    errors,
    onBlur,
    field,
    readonly,
    value = ''
  } = props;
  const {
    formId
  } = useContext(FormContext$1);
  const [filter, setFilter] = useState('');
  const [selectedValue, setSelectedValue] = useState('');
  const [selectedLabel, setSelectedLabel] = useState('');
  const [isDropdownExpanded, setIsDropdownExpanded] = useState(false);
  const [shouldApplyFilter, setShouldApplyFilter] = useState(true);
  const [isEscapeClosed, setIsEscapeClose] = useState(false);
  const searchbarRef = useRef();
  const searchApiSingleRef = useRef();
  const selectApiSingleRef = useRef();
  const {
    state: loadState,
    values: options
  } = useValuesAsync(field);

  const [mouseControl, setMouseControl] = useState(false);
  const initialFocusIndex = useMemo(() => value && findIndex(options, o => o.value === value) || 0, [options, value]);
  const [focusedValueIndex, setFocusedValueIndex] = useState(initialFocusIndex);
  const [optionsList, setOptionsList] = useState([]);
  const [searchString, setSearchString] = useState('');
  const [intialLoaded, setintialLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  //setOptionsList(oldArray => [...oldArray, ...newArr]);


  const form = useService('form');
  let filterOptionsLogic = applyApiFilterOptionsLogic(form, field, form._getState().data);

  if (!intialLoaded) {
    setintialLoaded(true);
    if (form._id) {
      if (filterOptionsLogic.hasFilterOptions) {
        const val = filterOptionsLogic.queryString.split("=")[1];
        if (val && val !== 'null' && val !== null) {
          loadMoreValuesByApiCall(field, field.valuesApi, `?${filterOptionsLogic.queryString}`, setOptionsList);
        }
      }
      else {
        loadMoreValuesByApiCall(field, field.valuesApi, '', setOptionsList);
      }
    }
  }

  // We cache a map of option values to their index so that we don't need to search the whole options array every time to correlate the label
  // const valueToOptionMap = useMemo(() => Object.assign({}, ...options.map((o, x) => ({
  //   [o.value]: options[x]
  // }))), [options]);
  // const valueLabel = useMemo(() => value && valueToOptionMap[value] && valueToOptionMap[value].label || '', [value, valueToOptionMap]);

  const valueToOptionMap = useMemo(() => Object.assign({}, ...optionsList.map((o, x) => ({
    [o.value]: optionsList[x]
  }))), [optionsList]);
  const valueLabel = useMemo(() => value && valueToOptionMap[value] && valueToOptionMap[value].label || '', [value, valueToOptionMap]);


  // whenever we change the underlying value, set the label to it
  useEffect(() => {
    setFilter(valueLabel);
    if (value && !selectedLabel) {
      setLabel(valueLabel || value);
    }
    if (!value && selectedLabel) {
      setLabel('')
    }

  }, [valueLabel, selectedLabel, value]);

  const filteredOptions = useMemo(() => {
    if (loadState === LOAD_STATES.LOADED) {
      return shouldApplyFilter ? options.filter(o => o.label && o.value && o.label.toLowerCase().includes(filter.toLowerCase())) : options;
    }
    return [];
  }, [filter, loadState, options, shouldApplyFilter]);

  const onChange = ({
    target
  }) => {
    setIsEscapeClose(false);
    setIsDropdownExpanded(true);
    setShouldApplyFilter(true);
    setFilter(target.value || '');
  };

  const setValue = v => {
    setSelectedValue(v);
    props.onChange({
      field,
      value: v
    });

    nullRelatedFilteredSelect();
  };

  const fields = form._getState().schema.components;
  const nullRelatedFilteredSelect = () => {
    const data = form._getState().data;
    fields.forEach((component) => {
      if (component.type !== 'group') {
        if (component.filterOptionsLogics && component.filterOptionsLogics[0].conditions.filter(x => x.secondFieldKey == field.key)?.length > 0) {
          data[component.key] = null;
        }
      }
      else {
        component.components.forEach((com) => {
          if (com.filterOptionsLogics && com.filterOptionsLogics[0].conditions.filter(x => x.secondFieldKey == field.key)?.length > 0) {
            data[com.key] = null;
          }
        })
      }
    })
  }

  const clearValue = () => {
    setSelectedValue('');
    //selectedLabel('');
    setLabel('');
    props.onChange({
      field,
      value: null
    });

    nullRelatedFilteredSelect();
  };

  const setLabel = l => {
    setSelectedLabel(l);
  }

  const displayState = useMemo(() => {
    const ds = {};
    ds.componentReady = !disabled && !readonly && loadState === LOAD_STATES.LOADED;
    ds.displayCross = ds.componentReady && value !== null && value !== undefined;
    ds.displayDropdown = !disabled && !readonly && isDropdownExpanded && !isEscapeClosed;
    return ds;
  }, [disabled, isDropdownExpanded, isEscapeClosed, loadState, readonly, value]);

  const onAngelMouseDown = useCallback(e => {
    setIsEscapeClose(false);
    setIsDropdownExpanded(!isDropdownExpanded);
    // const searchbar = searchbarRef.current;
    //  isDropdownExpanded ? searchbar.blur() : searchbar.focus();
    e.preventDefault();
  }, [isDropdownExpanded]);

  const onValueSelected = (o) => {
    setValue(o?.value);
    setLabel(o?.label);
    //setIsDropdownExpanded(false);
  };

  const getLabel = (o) => {
    return o.label
  };


  const handleOnScrollEnd = (event) => {
    if (form._id) {
      if (field.nextPage && event.target.scrollTop + event.target.offsetHeight > event.target.scrollHeight - 1) {
        if (filterOptionsLogic.hasFilterOptions) {
          const val = filterOptionsLogic.queryString.split("=")[1];
          if (val && val !== 'null' && val !== null) {
            loadMoreValuesByApiCall(field, field.valuesApi, `?${filterOptionsLogic.queryString}&${field.apiDetails.label}=${searchString}&page=${field.currentPage ? field.currentPage + 1 : 1}`, setOptionsList);
          }
        }
        else {
          loadMoreValuesByApiCall(field, field.valuesApi, `?${field.apiDetails.label}=${searchString}&page=${field.currentPage ? field.currentPage + 1 : 1}`, setOptionsList);
        }
      }
    }
  }


  const filterValues = (searchString) => {
    filterOptionsLogic = applyApiFilterOptionsLogic(form, field, form._getState().data);
    setSearchString(searchString);
    if (form._id) {
      //setOptionsList([]);
      if (filterOptionsLogic.hasFilterOptions) {
        const val = filterOptionsLogic.queryString.split("=")[1];
        if (val && val !== 'null' && val !== null) {
          fetchValuesByApiCall(field, field.valuesApi, `?${filterOptionsLogic.queryString}&${field.apiDetails.label}=${searchString}`, setOptionsList, setLoading);
        }
      }
      else {
        fetchValuesByApiCall(field, field.valuesApi, `?${field.apiDetails.label}=${searchString}`, setOptionsList, setLoading);
      }
    }
  }

  document.addEventListener('click', (e) => {
    if (selectApiSingleRef.current && !selectApiSingleRef.current.contains(e.target)) {
      setIsDropdownExpanded(false);
    }
    if (searchApiSingleRef.current && searchApiSingleRef.current.contains(e.target)) {
      setIsDropdownExpanded(true);
    }
  });


  const allowedItemsPattern = /.+/
  const isItemValid = (item) => {
    return allowedItemsPattern.test(item);
  }
  const splitString = (itemsString) => {
    let items = itemsString.split(/[,\t\n\r]+/);
    return items.filter((item) => item && isItemValid(item));
  }

  ///////////////////////////////////

  return jsxs(Fragment$1, {
    children: [jsxs("div", {
      ref: selectApiSingleRef,
      id: prefixId(`${id}`, formId),
      class: classNames('fjs-input-group', {
        'disabled': disabled,
        'readonly': readonly
      }, {
        'hasErrors': errors.length
      }),
      children: [jsx("input", {
        // disabled: disabled,
        readOnly: true,
        class: "fjs-input",
        //  ref: searchbarRef,
        id: prefixId(`${id}`, formId),
        // onChange: onChange,
        type: "text",
        // value: filter,
        //value: valueLabel,
        value: selectedLabel,
        placeholder: "Select",

        //  autoComplete: "off",
        // onKeyDown: e => onInputKeyDown(e),
        onMouseDown: () => {
          setIsEscapeClose(false);
          if (!isDropdownExpanded) {
            filterValues('');
          }
          setIsDropdownExpanded(!isDropdownExpanded);
          setShouldApplyFilter(false);
        },
        onFocus: () => {
          //  setIsDropdownExpanded(true);
          //setShouldApplyFilter(false);
        },
        onBlur: () => {
          //setIsDropdownExpanded(false);
          //   setFilter(valueLabel);
          onBlur();
        },
        "aria-describedby": props['aria-describedby']
      }), displayState.displayCross && jsxs("span", {
        class: "fjs-select-cross",
        onclick: e => {
          clearValue();
          e.preventDefault();
        },
        children: [jsx(XMarkIcon, {}, " ")]
      }), jsx("span", {
        class: "fjs-select-arrow",
        onMouseDown: e => onAngelMouseDown(e),
        children: displayState.displayDropdown ? jsx(AngelUpIcon, {}) : jsx(AngelDownIcon, {})
      })]
    }), jsx("div", {
      class: "fjs-select-anchor",
      ref: searchApiSingleRef,
      children: displayState.displayDropdown &&
        jsxs("div", {
          tabIndex: -1,
          class: "fjs-dropdownlist",
          //onMouseDown: e => e.preventDefault(),
          onScroll: e => handleOnScrollEnd(e),
          style: {
            maxHeight: 300,
            // scrollBehavior: smoothScrolling ? 'smooth' : 'auto'
          },
          children: [
            jsx("div", {
              class: "c-p-1",
              //  onMouseDown: e => e.preventDefault(),
              children: jsx("input", {
                class: "form-control w-100",
                placeholder: "Search",
                id: prefixId(`${id}-search1`, formId),
                onKeyUp: (e) => {
                  const searchChars = e.target.value;
                  setTimeout(() => {
                    if (searchChars == e.target.value) {
                      filterValues(e.target.value);
                    }
                  }, 600);
                },
                onMouseDown: e => {
                  //   setValue(null);
                  //e.preventDefault();
                },
                onPaste: (e) => {
                  let clipboardData = e.clipboardData;
                  let pastedString = clipboardData.getData('text/plain');
                  const pastedArray = splitString(pastedString);
                  const oldPastedData = pastedArray.join(',');
                  e.preventDefault();
                  filterValues(oldPastedData);
                  //setFilter(oldPastedData)
                },
                type: "text",
                value: searchString
              })
            }),
            (loading) && jsx("div", {
              class: "d-flex c-w-100 h-100 justify-content-center align-items-center",
              children: jsx("div", {
                class: "loader"
              })
            }),
            (!loading) && optionsList.length > 0 && optionsList.map((v, i) => {
              return jsxs("div", {
                class: classNames('fjs-dropdownlist-item', {
                  'focused': focusedValueIndex === i
                }),
                onMouseMove: mouseControl ? undefined : e => { setMouseControl(true); setFocusedValueIndex(i) },
                onMouseEnter: mouseControl ? () => setFocusedValueIndex(i) : undefined,
                onMouseDown: e => { onValueSelected(v); setIsDropdownExpanded(false); filterValues('') },
                children: [
                  // jsx("input", {
                  //   type: "checkbox",
                  //   checked: value?.includes(v.value),
                  //   onClick: (e) => { e.preventDefault() }
                  // }),
                  getLabel(v)]
              });
            }), !optionsList.length && jsx("div", {
              class: "fjs-dropdownlist-empty",
              children: 'No results'
            })]
        })
    })]
  });

}

//copy SearchableSelect
function ApiMultiSelect(props) {
  const {
    id,
    disabled,
    errors,
    onBlur,
    field,
    readonly,
    value = []
  } = props;
  const {
    formId
  } = useContext(FormContext$1);
  const [filter, setFilter] = useState('');
  const [selectedValue, setSelectedValue] = useState([]);
  const [isDropdownExpanded, setIsDropdownExpanded] = useState(false);
  const [shouldApplyFilter, setShouldApplyFilter] = useState(true);
  const [isEscapeClosed, setIsEscapeClose] = useState(false);
  const searchbarRef = useRef();
  const searchApiMultiRef = useRef();
  const selectApiMultiRef = useRef();
  const {
    state: loadState,
    values: options
  } = useValuesAsync(field);

  const [optionsList, setOptionsList] = useState([]);
  const [searchString, setSearchString] = useState('');
  const [intialLoaded, setintialLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  //setOptionsList(oldArray => [...oldArray, ...newArr]);

  const form = useService('form');
  let filterOptionsLogic = applyApiFilterOptionsLogic(form, field, form._getState().data);
  if (!intialLoaded) {
    setintialLoaded(true)
    if (form._id) {
      // loadMoreValuesByApiCall(field, field.valuesApi, '', setOptionsList);
      if (filterOptionsLogic.hasFilterOptions) {
        const val = filterOptionsLogic.queryString.split("=")[1];
        if (val && val !== 'null' && val !== null) {
          loadMoreValuesByApiCall(field, field.valuesApi, `?${filterOptionsLogic.queryString}`, setOptionsList);
        }
      }
      else {
        loadMoreValuesByApiCall(field, field.valuesApi, '', setOptionsList);
      }
    }
  }

  // We cache a map of option values to their index so that we don't need to search the whole options array every time to correlate the label
  const valueToOptionMap = useMemo(() => Object.assign({}, ...options.map((o, x) => ({
    [o.value]: options[x]
  }))), [options]);
  const valueLabel = useMemo(() => value && valueToOptionMap[value] && valueToOptionMap[value].label || '', [value, valueToOptionMap]);

  // whenever we change the underlying value, set the label to it
  useEffect(() => {
    if (value && value.length && (!selectedValue || selectedValue.length < 1)) {
      const arr = value.map((str) => ({ value: str, label: str }));
      setSelectedValue([...arr]);
    }
    if (selectedValue && selectedValue.length && (!value || value.length < 1)) {
      setSelectedValue([])
    }
    setFilter(valueLabel);
  }, [valueLabel, selectedValue, value, setSelectedValue]);

  const filteredOptions = useMemo(() => {
    if (loadState === LOAD_STATES.LOADED) {
      return shouldApplyFilter ? options.filter(o => o.label && o.value && o.label.toLowerCase().includes(filter.toLowerCase())) : options;
    }
    return [];
  }, [filter, loadState, options, shouldApplyFilter]);

  const onChange = ({
    target
  }) => {
    setIsEscapeClose(false);
    setIsDropdownExpanded(true);
    setShouldApplyFilter(true);
    setFilter(target.value || '');
  };

  const setValue = v => {

    let newValue = [];
    if (value) {
      newValue = [...value];
    }

    let newSelected = [];
    if (selectedValue) {
      newSelected = [...selectedValue]
    }

    if (!newValue.includes(v.value)) {
      newValue.push(v.value);
      newSelected.push(v);
    } else {
      newValue = newValue.filter(x => x != v.value);
      newSelected = newSelected.filter(x => x.value != v.value);
    }
    setSelectedValue(newSelected);
    props.onChange({
      field,
      value: newValue
    });
  };

  const clearValue = () => {
    setSelectedValue([]);
    props.onChange({
      field,
      value: []
    });
  };

  document.addEventListener('click', (e) => {
    if (selectApiMultiRef.current && !selectApiMultiRef.current.contains(e.target)) {
      setIsDropdownExpanded(false);
    }
    if (searchApiMultiRef.current && searchApiMultiRef.current?.contains(e.target)) {
      setIsDropdownExpanded(true);
    }
  })

  const onInputKeyDown = useCallback(keyDownEvent => {
    switch (keyDownEvent.key) {
      case 'ArrowUp':
        keyDownEvent.preventDefault();
        break;
      case 'ArrowDown':
        {
          if (!isDropdownExpanded) {
            setIsDropdownExpanded(true);
            setShouldApplyFilter(false);
          }
          keyDownEvent.preventDefault();
          break;
        }
      case 'Escape':
        setIsEscapeClose(true);
        break;
      case 'Enter':
        if (isEscapeClosed) {
          setIsEscapeClose(false);
        }
        break;
    }
  }, [isDropdownExpanded, isEscapeClosed]);

  const displayState = useMemo(() => {
    const ds = {};
    ds.componentReady = !disabled && !readonly && loadState === LOAD_STATES.LOADED;
    ds.displayCross = ds.componentReady && value !== null && value !== undefined && value?.length > 0;
    ds.displayDropdown = !disabled && !readonly && isDropdownExpanded && !isEscapeClosed;
    return ds;
  }, [disabled, isDropdownExpanded, isEscapeClosed, loadState, readonly, value]);

  const onAngelMouseDown = useCallback(e => {
    setIsEscapeClose(false);
    setIsDropdownExpanded(!isDropdownExpanded);
    // const searchbar = searchbarRef.current;
    //  isDropdownExpanded ? searchbar.blur() : searchbar.focus();
    e.preventDefault();
  }, [isDropdownExpanded]);

  const onValueSelected = (o) => {
    setValue(o);
    // setIsDropdownExpanded(false);
  };

  const onRemoveSelectedValue = (o) => {
    setValue(o);
    // setIsDropdownExpanded(false);
  };

  const getLabel = (o) => {
    return o.label
  };

  const handleOnScrollEnd = (event) => {
    if (form._id) {
      if (field.nextPage && event.target.scrollTop + event.target.offsetHeight > event.target.scrollHeight - 1) {
        if (filterOptionsLogic.hasFilterOptions) {
          const val = filterOptionsLogic.queryString.split("=")[1];
          if (val && val !== 'null' && val !== null) {
            loadMoreValuesByApiCall(field, field.valuesApi, `?${filterOptionsLogic.queryString}&${field.apiDetails.label}=${searchString}&page=${field.currentPage ? field.currentPage + 1 : 1}`, setOptionsList);
          }
        }
        else {
          loadMoreValuesByApiCall(field, field.valuesApi, `?${field.apiDetails.label}=${searchString}&page=${field.currentPage ? field.currentPage + 1 : 1}`, setOptionsList);
        }
      }
    }
  }

  const filterValues = (searchString) => {
    filterOptionsLogic = applyApiFilterOptionsLogic(form, field, form._getState().data);
    setSearchString(searchString);
    if (form._id) {
      if (filterOptionsLogic.hasFilterOptions) {
        const val = filterOptionsLogic.queryString.split("=")[1];
        if (val && val !== 'null' && val !== null) {
          fetchValuesByApiCall(field, field.valuesApi, `?${filterOptionsLogic.queryString}&${field.apiDetails.label}=${searchString}`, setOptionsList, setLoading);
        }
      } else {
        fetchValuesByApiCall(field, field.valuesApi, `?${field.apiDetails.label}=${searchString}`, setOptionsList, setLoading);
      }
    }
  }

  const allowedItemsPattern = /.+/
  const isItemValid = (item) => {
    return allowedItemsPattern.test(item);
  }
  const splitString = (itemsString) => {
    let items = itemsString.split(/[,\t\n\r]+/);
    return items.filter((item) => item && isItemValid(item));
  }


  ///////////////////////////////////

  return jsxs(Fragment$1, {
    children: [jsxs("div", {
      id: prefixId(`${id}`, formId),
      ref: selectApiMultiRef,
      class: classNames('fjs-input-group', {
        'disabled': disabled,
        'readonly': readonly
      }, {
        'hasErrors': errors.length
      }),
      children: [jsx("input", {
        disabled: disabled,
        readOnly: readonly,
        class: "fjs-input",
        //  ref: searchbarRef,
        id: prefixId(`${id}`, formId),
        onChange: onChange,
        type: "text",
        // value: filter,
        // value: selectedValue,
        value: selectedValue.map(function (item) { return item['label']; }),
        placeholder: "Select",

        //  autoComplete: "off",
        onKeyDown: e => onInputKeyDown(e),
        onMouseDown: () => {
          setIsEscapeClose(false);
          if (!isDropdownExpanded) {
            filterValues('');
          }
          setIsDropdownExpanded(!isDropdownExpanded);
          setShouldApplyFilter(false);
        },
        onFocus: () => {
          //  setIsDropdownExpanded(true);
          //setShouldApplyFilter(false);
        },
        onBlur: () => {
          //setIsDropdownExpanded(false);
          //   setFilter(valueLabel);
          onBlur();
        },
        "aria-describedby": props['aria-describedby']
      }), displayState.displayCross && jsxs("span", {
        class: "fjs-select-cross",
        onclick: e => {
          clearValue();
          e.preventDefault();
        },
        children: [jsx(XMarkIcon, {}), " "]
      }), jsx("span", {
        class: "fjs-select-arrow",
        onMouseDown: e => onAngelMouseDown(e),
        children: displayState.displayDropdown ? jsx(AngelUpIcon, {}) : jsx(AngelDownIcon, {})
      })]
    }), jsx("div", {
      class: "fjs-select-anchor",
      ref: searchApiMultiRef,
      children: displayState.displayDropdown && jsxs("div", {
        //  ref: dropdownContainer,
        tabIndex: -1,
        class: "fjs-dropdownlist",
        //onMouseDown: e => e.preventDefault(),
        onScroll: e => handleOnScrollEnd(e),
        style: {
          maxHeight: 300,
          // scrollBehavior: smoothScrolling ? 'smooth' : 'auto'
        },
        children: [
          jsxs("div", {
            class: "selected-items",
            children: [
              jsxs("div", {
                class: "show-selected-items d-flex justify-content-between",
                children: ["Show selected items",
                  jsx("span", {
                    class: "ml-auto",
                    children: ">"
                  })
                ]
              }),
              jsxs("div", {
                class: "selected-items-overlay",
                children: [
                  selectedValue.length > 0 && selectedValue.map((v, i) => {
                    return jsxs("div", {
                      class: "item",
                      onMouseDown: e => onRemoveSelectedValue(v),
                      children: [
                        jsx("input", {
                          class: "pe-2",
                          type: "checkbox",
                          checked: true,
                          onClick: (e) => { e.preventDefault() }
                        }),
                        v.label
                      ]
                    })
                  })
                ]
              }),
            ]
          }),
          jsx("div", {
            class: "c-p-1",
            //  onMouseDown: e => e.preventDefault(),
            children: jsx("input", {
              class: "form-control w-100",
              placeholder: "Search",
              id: prefixId(`${id}-search1`, formId),
              onKeyUp: (e) => {
                const searchChars = e.target.value;
                setTimeout(() => {
                  if (searchChars == e.target.value) {
                    filterValues(e.target.value);
                  }
                }, 600);
              },
              onMouseDown: e => {
                //   setValue(null);
                //e.preventDefault();
              },
              onPaste: (e) => {
                let clipboardData = e.clipboardData;
                let pastedString = clipboardData.getData('text/plain');
                const pastedArray = splitString(pastedString);
                const oldPastedData = pastedArray.join(',');
                e.preventDefault();
                filterValues(oldPastedData);
                //setFilter(oldPastedData)
              },
              type: "text",
              value: searchString,
            })
          }),
          (loading) && jsx("div", {
            class: "d-flex c-w-100 h-100 justify-content-center align-items-center",
            children: jsx("div", {
              class: "loader"
            })
          }),
          (!loading) && optionsList.length > 0 && optionsList.map((v, i) => {
            return jsxs("div", {
              class: classNames('fjs-dropdownlist-item', {
                // 'focused': focusedValueIndex === i
              }),
              // onMouseMove: mouseControl ? undefined : e => onMouseMovedInKeyboardMode(e, i),
              //onMouseEnter: mouseControl ? () => setFocusedValueIndex(i) : undefined,
              onMouseDown: e => onValueSelected(v),
              children: [
                jsx("input", {
                  type: "checkbox",
                  checked: value?.includes(v.value),
                  // onClick: (e) => { e.preventDefault() }
                }),
                getLabel(v)]
            });
          }), !optionsList.length && jsx("div", {
            class: "fjs-dropdownlist-empty",
            children: 'No results'
          })]
      })
    })]
  });

}

function MegaDropdownSingleSelect(props) {
  const {
    id,
    disabled,
    errors,
    field,
    readonly,
    value = ''
  } = props;
  const {
    formId
  } = useContext(FormContext$1);
  let megaDropdownValues = [];
  const [checkedState, setCheckedState] = useState([]);
  const [megaList, setMegaList] = useState(megaDropdownValues)
  const [allMegaList, setAllMegaList] = useState(megaDropdownValues)
  let [newDataSelected, SetNewDataSelected] = useState([]);
  let [selectedLabel, setSelectedLabel] = useState('');
  let [selectedItem, setSelectedItem] = useState({});
  const [filter, setFilter] = useState('');
  let [notFoundItems, setNotFoundItems] = useState([]);
  const [isDropdownExpanded, setIsDropdownExpanded] = useState(false);
  const [shouldApplyFilter, setShouldApplyFilter] = useState(true);
  const [isEscapeClosed, setIsEscapeClose] = useState(false);
  const [dataSelected, SetDateSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const {
    state: loadState,
    values: options,
  } = useValuesAsync(field);
  let arrDataSelectedSender = value || [];

  const listenerElement = window;
  const onValueSelected = NOOP;
  const emptyListMessage = 'No results';
  const initialFocusIndex = 0;
  // let test = [1,2,3,4]
  let page_size = 10;
  const [arrOfPages, setArrOfPages] = useState([]);
  const [rangeOfPages, setRangeOfPage] = useState([]);
  const [lastPage, setLastPage] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [countItems, setCountItems] = useState(0);
  const [totalpage, setTotalpage] = useState(1);
  const searchRef = useRef();
  const [focusedValueIndex, setFocusedValueIndex] = useState(initialFocusIndex);
  const focusedItem = useMemo(() => megaList.length ? megaList[focusedValueIndex] : null, [focusedValueIndex, megaList]);
  const changeFocusedValueIndex = useCallback(delta => {
    setFocusedValueIndex(x => Math.min(Math.max(0, x + delta), megaList.length - 1));
  }, [megaList.length]);

  const form = useService('form');

  //const controller = new AbortController();
  //const signal = controller.signal;

  let getListData = async (searchText, currentPage, page_size, isFirstCall) => {
    setFilter(searchText);
    const token = window.localStorage.getItem('ngx-app.current-user');
    const myHeaders = new Headers();
    const CSRFToken = getCookie('csrftoken');

    myHeaders.append('Authorization', JSON.parse(token).auth_token);
    myHeaders.append('X-CSRFToken', CSRFToken);
    const options = {
      headers: myHeaders
    };

    let requestURL = searchText ? `${field.valuesApi}?page=${currentPage}&page_size=${page_size}&${field.apiDetails.label}=${searchText}` :
      `${field.valuesApi}?page=${currentPage}&page_size=${page_size}`;

    let filterOptionsLogic = applyApiFilterOptionsLogic(form, field, form._getState().data);
    if (filterOptionsLogic.hasFilterOptions) {
      const val = filterOptionsLogic.queryString.split("=")[1];
      if (val && val !== 'null' && val !== null) {
        requestURL += `&${filterOptionsLogic.queryString}`;
      }
    }

    setLoading(true);
    const apiRequest = await new Request(requestURL, options);

    //fetch(apiRequest, { signal })
    fetch(apiRequest)
      .then((response) => response.json())
      .then((res) => {
        if (res) {

          res?.results?.map(value => {
            // const findTempOption = arrTemp.find(res => res == value[field.apiDetails.label]);
            // const findNewOption = newDataSelected.find(res => res[field.apiDetails.label] == value[field.apiDetails.label])
            // if (findTempOption) {
            //   value.checked = true
            // }
            // else {
            //   value.checked = false
            // }
            // if (findNewOption) {
            //   value.checked = findNewOption.checked
            // }
          })
          megaDropdownValues = res?.results;
          setCountItems(res.count);
          const totalPage = Math.ceil(res.count / page_size)
          const pages = [...Array(totalPage).keys()].map(i => i + 1)
          setArrOfPages(pages)
          let range = pages.slice(1, 3);
          if (currentPage > 2 && currentPage !== lastPage) {
            range = pages.slice(currentPage - 2, currentPage + 1)
          } else if (currentPage > 2 && currentPage == lastPage) {
            range = pages.slice(currentPage - 2, currentPage - 1)
          }
          setRangeOfPage(range)
          setLastPage(totalPage)
          setTotalpage(totalPage);
          setMegaList(megaDropdownValues);
          //setCheckedState(megaDropdownValues);

          //not found single
          //  const filterArr = filter.split(',').filter(Boolean);
          const filterArr = searchText.split(',').filter(Boolean);
          if (filterArr.length > 1) {
            const diff = filterArr.filter(val => !res?.results.find(arr1Obj => arr1Obj[field.apiDetails.label] === val));
            setNotFounds(diff || []);
          }
          else {
            setNotFoundItems([]);
          }
        }
        setLoading(false);
      });

    // if (true) {
    //   controller.abort();
    // }
  }

  const setNotFounds = (arr) => {
    setNotFoundItems([]);
    setNotFoundItems(old => [...arr]);
  }


  const allowedItemsPattern = /.+/
  const isItemValid = (item) => {
    return allowedItemsPattern.test(item);
  }

  const splitString = (itemsString) => {
    let items = itemsString.split(/[,\t\n\r]+/);
    return items.filter((item) => item && isItemValid(item));
  }

  useEffect(() => {
    if (value && !selectedLabel) {
      setSelectedLabel(value);
    }
    if (!value && selectedLabel) {
      setSelectedLabel('');
      setCurrentPage(1);
    }
  }, [newDataSelected, checkedState, value, selectedLabel, currentPage])
  useEffect(() => {
    if (megaList.length == 0) {
      getListData('', currentPage, page_size, false)
    }
  }, []);

  const setValue = useCallback(option => {
    props.onChange({
      value: option,
      field
    });

    nullRelatedFilteredSelect();
  }, [field, props]);

  const fields = form._getState().schema.components;
  const nullRelatedFilteredSelect = () => {
    const data = form._getState().data;
    fields.forEach((component) => {
      if (component.type !== 'group') {
        if (component.filterOptionsLogics && component.filterOptionsLogics[0].conditions.filter(x => x.secondFieldKey == field.key)?.length > 0) {
          data[component.key] = null;
        }
      }
      else {
        component.components.forEach((com) => {
          if (com.filterOptionsLogics && com.filterOptionsLogics[0].conditions.filter(x => x.secondFieldKey == field.key)?.length > 0) {
            data[com.key] = null;
          }
        })
      }
    })
  }

  const toggleSelectedItem = (item) => {

    if (selectedItem[field.apiDetails.label] == item[field.apiDetails.label]) {
      setSelectedItem({});
    } else {
      setSelectedItem(item);
    }
  }

  const displayState = useMemo(() => {
    const ds = {};
    ds.componentReady = !disabled && !readonly && loadState === LOAD_STATES.LOADED;
    ds.displayCross = ds.componentReady && value !== null && value !== undefined;
    ds.displayDropdown = !disabled && !readonly && isDropdownExpanded && !isEscapeClosed;
    return ds;
  }, [disabled, isDropdownExpanded, isEscapeClosed, loadState, readonly, value]);
  useEffect(() => {
    if (focusedValueIndex === 0) return;
    if (!focusedValueIndex || !megaList.length) {
      setFocusedValueIndex(0);
    } else if (focusedValueIndex >= megaList.length) {
      setFocusedValueIndex(megaList.length - 1);
    }
  }, [focusedValueIndex, megaList.length]);
  useKeyDownAction('ArrowUp', () => {
    if (megaList.length) {
      changeFocusedValueIndex(-1);
      setMouseControl(false);
    }
  }, listenerElement);
  useKeyDownAction('ArrowDown', () => {
    if (megaList.length) {
      changeFocusedValueIndex(1);
      setMouseControl(false);
    }
  }, listenerElement);
  useKeyDownAction('Enter', () => {
    if (focusedItem) {
      onValueSelected(focusedItem);
    }
  }, listenerElement);
  return jsxs(Fragment$1, {
    children: [
      jsxs("div", {
        id: prefixId(`${id}`, formId),
        class: classNames('fjs-input-group', {
          'disabled': disabled,
          'readonly': readonly
        }, {
          'hasErrors': errors.length
        }),
        children: [
          jsx("input", {
            readOnly: true,
            class: "fjs-input",
            id: prefixId(`${id}-mega`, formId),
            type: "text",
            placeholder: 'Mega dropdown',
            value: selectedLabel,

            onMouseDown: () => {
              setIsEscapeClose(false);
              setIsDropdownExpanded(true);
              setShouldApplyFilter(false);
              //setCurrentPage(1);

              getListData('', currentPage, page_size, false);

            },
            "aria-describedby": props['aria-describedby']
          }),
          displayState.displayCross && jsxs("span", {
            class: "fjs-select-cross",
            children: [jsx(XMarkIcon, {}), " "]
          }), jsx("span", {
            class: "fjs-select-arrow",
            onMouseDown: () => {
              setIsEscapeClose(false);
              setIsDropdownExpanded(true);
              setShouldApplyFilter(false);
            },
            children: displayState.displayDropdown ? jsx(AngelUpIcon, {}) : jsx(AngelDownIcon, {})
          })]
      }),
      displayState.displayDropdown && jsx("div", {
        class: "modal-megadropdown",
        children: [
          jsx("div", {
            class: 'modal-content-megadropdown',
            children: [
              jsxs("div", {
                class: 'd-flex justify-content-between',
                children: [
                  jsx("span", {
                    class: 'fw-bold fs-6',
                    children: field.label || '',
                  }),
                  jsx("span", {
                    class: 'material-icons close-modal-megadropdown mb-3',
                    children: 'close',
                    onMouseDown: () => {
                      setIsEscapeClose(true);
                      setIsDropdownExpanded(false);
                      setShouldApplyFilter(false);
                    }
                  }),
                ],
              }),

              jsxs("div", {
                class: "c-mb-3",
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                },
                children: [
                  jsxs("div", {
                    class: "d-flex align-items-center",
                    style: "flex-basis: 70%",
                    children: [
                      jsx("input", {
                        class: "form-control",
                        placeholder: "Search",
                        id: prefixId(`${id}-mega-search1`, formId),
                        onKeyUp: (e) => {
                          setFilter(e.target.value)
                          // if (e.target.value !== '') {
                          setCurrentPage(1)
                          const searchChars = e.target.value;
                          setTimeout(() => {
                            // signal.reason = 'add'
                            // controller.abort();
                            if (searchChars == e.target.value) {
                              getListData(e.target.value, currentPage, page_size, false)
                            }
                          }, 600);
                          // } 
                        },
                        onPaste: (e) => {
                          let clipboardData = e.clipboardData;
                          let pastedString = clipboardData.getData('text/plain');
                          const pastedArray = splitString(pastedString);
                          const oldPastedData = pastedArray.join(',');
                          e.preventDefault();
                          setFilter(oldPastedData)
                        },
                        type: "text",
                        value: filter,
                        ref: searchRef
                        // autoComplete: "off",
                      })
                    ]
                  }),
                  (selectedItem && Object.keys(selectedItem).length > 0) && jsx("div", {
                    children: `Clear selected item`,
                    class: classNames('btn', 'btn-link', {
                      'disabled': loading
                    }),
                    style: {
                      cursor: 'pointer',
                      color: '#0077B6',
                    },
                    onClick: () => {
                      setSelectedItem({});
                    }
                  })
                ]
              }),
              (loading) && jsx("div", {
                class: "d-flex c-w-100 h-100 justify-content-center align-items-center",
                children: jsx("div", {
                  class: "loader"
                })
              }),
              (!loading && megaList.length > 0) && jsx("div", {
                style: {
                  height: '76%',
                  overflow: 'auto',
                },
                class: 'mb-3',
                children: jsx("table", {
                  class: "table table-hover",
                  children: [
                    jsx("thead", {
                      children: [
                        jsx("tr", {
                          class: "c-border-tabel",
                          children: [
                            jsx("th", {
                              class: "",
                              style: "width:38px"
                            }),
                            megaList && megaList.length > 0 && Object.keys(megaList[0])?.map((key1, index) => {
                              if (key1 !== 'checked') {
                                return (
                                  jsx("th", {
                                    dataField: key1.toString(),
                                    dataFilterControl: "input",
                                    dataSortable: "true",
                                    children: key1.toString()
                                  })
                                )
                              }
                            })
                          ]
                        }),
                      ]
                    }),
                    jsx("tbody", {
                      children: [
                        megaList && megaList.length > 0 && megaList.map((listValue, index) => {
                          return (
                            jsx("tr", {
                              class: "c-border-tabel",
                              key: index,
                              onClick: () => {
                                toggleSelectedItem(listValue)
                              },
                              children: [
                                jsx("td", {
                                  class: (selectedItem && listValue[field.apiDetails.label] == selectedItem[field.apiDetails.label]) && "selected-item",
                                  class: classNames('cursor-pointer', {
                                    "selected-item": (selectedItem && listValue[field.apiDetails.label] == selectedItem[field.apiDetails.label])
                                  }),
                                  children: (selectedItem && listValue[field.apiDetails.label] == selectedItem[field.apiDetails.label]) && CheckedIcon()
                                }),
                                Object.keys(listValue) && Object.keys(listValue).map((key2, index) => {
                                  if (key2 !== 'checked') {
                                    return (
                                      jsx("td", {
                                        class: classNames('cursor-pointer', {
                                          "selected-item": (selectedItem && listValue[field.apiDetails.label] == selectedItem[field.apiDetails.label])
                                        }),
                                        children: listValue[key2],
                                      })
                                    )
                                  }
                                })
                              ],
                            })
                          );
                        })
                      ]
                    })
                  ]
                }),
              }),
              (!loading && !megaList.length) && jsx("div", {
                class: "d-flex justify-content-center align-items-center",
                style: {
                  height: 'inherit'
                },
                children: emptyListMessage
              }),

              // todo: not found
              (!loading && notFoundItems && notFoundItems.length > 0) && jsxs("div", {
                class: "not-found-search",
                children: [
                  jsx("div", {
                    class: "fw-bold mb-1",
                    children: "Not found items"
                  }),
                  jsx("div", {
                    class: "scrollable",
                    children: notFoundItems.join(", ")
                  })
                ]
              }),

              jsx("div", {
                class: "pagination d-flex align-items-center",
                children: [
                  jsx("span", {
                    children: 'Total ' + (loading ? '' : countItems) + ' items',
                    style: {
                      textWrap: 'nowrap'
                    }
                  }),
                  jsx("div", {
                    class: "pagination-container w-100 d-flex justify-content-center",
                    children: [
                      jsx("button", {
                        class: classNames('btn-pagination', 'next-prev-btn', {
                          'btn-pagination-disable': loading || currentPage == 1
                        }),
                        children: [jsx("i", {
                          class: "material-icons",
                          children: 'chevron_left'
                        })],
                        onClick: () => {
                          if (currentPage != 1) {
                            setCurrentPage(currentPage - 1)
                            getListData(filter, currentPage - 1, page_size, false)
                          }
                        }
                      }),
                      (countItems > 0) && jsx("button", {
                        class: classNames('btn-pagination', {
                          'btn-pagination-active': currentPage == 1
                        }, { 'btn-pagination-disable': loading }),
                        children: [jsx("span", {
                          class: "page-number",
                          children: 1
                        })],
                        onClick: () => {
                          setCurrentPage(1)
                          getListData(filter, 1, page_size, false)
                        }
                      }),
                      (currentPage > 3) && jsx("button", {
                        class: "btn-more-page",
                        children: [jsx("i", {
                          class: "material-icons",
                          children: 'more_horiz'
                        }),]
                      }),
                      rangeOfPages?.map(page => {
                        if (page !== lastPage) {
                          return jsx("button", {
                            class: classNames('btn-pagination', {
                              'btn-pagination-active': page == currentPage
                            }, { 'btn-pagination-disable': loading }),
                            children: [jsx("span", {
                              class: "page-number",
                              children: page
                            })],
                            onClick: () => {
                              setCurrentPage(page)

                              getListData(filter, page, page_size, false)
                            }
                          })
                        }
                      }),
                      (lastPage - currentPage > 2) && jsx("button", {
                        class: "btn-more-page",
                        children: [jsx("i", {
                          class: "material-icons",
                          children: 'more_horiz'
                        }),]
                      }),
                      (lastPage > 1) && jsx("button", {
                        class: classNames('btn-pagination', {
                          'btn-pagination-active': lastPage == currentPage
                        }, { 'btn-pagination-disable': loading }),
                        children: [jsx("span", {
                          class: "page-number",
                          children: lastPage
                        })],
                        onClick: () => {
                          setCurrentPage(lastPage)
                          getListData(filter, lastPage, page_size, false)
                        }
                      }),
                      jsx("button", {
                        // class:"btn-pagination next-prev-btn",
                        class: classNames('btn-pagination', 'next-prev-btn', {
                          'btn-pagination-disable': loading || countItems < 1 || currentPage == lastPage
                        }),
                        children: [jsx("i", {
                          class: "material-icons",
                          children: 'chevron_right'
                        })],
                        onClick: () => {
                          if (countItems >= 1 && currentPage != lastPage) {
                            setCurrentPage(currentPage + 1)
                            getListData(filter, currentPage + 1, page_size, false)
                          }
                        }
                      }),
                    ]
                  })
                ]
              }),
              jsx("div", {
                class: 'actions-modal-megadropdown',
                children: [
                  jsx("button", {
                    class: classNames('btn', 'btn-primary', {
                      'disabled': loading
                    }),
                    children: 'Apply',
                    onclick: () => {
                      setSelectedLabel(selectedItem[field.apiDetails.label] || '');
                      setValue(selectedItem[field.apiDetails.value] || null);
                      setIsEscapeClose(true);
                      setIsDropdownExpanded(false);
                    }
                  }),
                  jsx("button", {
                    class: 'btn btn-secoundary',
                    children: 'Cancel',
                    onclick: () => {
                      setSelectedItem({ [field.apiDetails.label]: selectedLabel, [field.apiDetails.value]: value })
                      setIsEscapeClose(true);
                      setIsDropdownExpanded(false);
                    }
                  })
                ]
              })
            ]
          })
        ]
      })]
  });
}

function MegaDropdownMultiSelect(props) {
  const {
    id,
    disabled,
    errors,
    field,
    readonly,
    value = []
  } = props;
  const {
    formId
  } = useContext(FormContext$1);
  let megaDropdownValues = [];
  const [checkedState, setCheckedState] = useState([]);
  const [megaList, setMegaList] = useState(megaDropdownValues)
  let [newDataSelected, SetNewDataSelected] = useState([]);
  let [tempDataSelected, SetTempDataSelected] = useState([]);
  const [filter, setFilter] = useState('');
  let [notFoundItems, setNotFoundItems] = useState([]);
  const [isDropdownExpanded, setIsDropdownExpanded] = useState(false);
  const [shouldApplyFilter, setShouldApplyFilter] = useState(true);
  const [isEscapeClosed, setIsEscapeClose] = useState(false);
  const [dataSelected, SetDateSelected] = useState('');
  const [selectedLabel, setSelectedLabel] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSelectAll, setIsSelectAll] = useState(false);
  const [showSelectAll, setShowSelectAll] = useState(false);
  const {
    state: loadState,
    values: options,
  } = useValuesAsync(field);


  const listenerElement = window;
  const onValueSelected = NOOP;
  const emptyListMessage = 'No results';
  const initialFocusIndex = 0;
  // let test = [1,2,3,4]
  let page_size = 10;
  const [arrOfPages, setArrOfPages] = useState([]);
  const [rangeOfPages, setRangeOfPage] = useState([]);
  const [lastPage, setLastPage] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [countItems, setCountItems] = useState(0);
  const [totalpage, setTotalpage] = useState(1);
  const searchRef = useRef();
  const [focusedValueIndex, setFocusedValueIndex] = useState(initialFocusIndex);
  const focusedItem = useMemo(() => megaList.length ? megaList[focusedValueIndex] : null, [focusedValueIndex, megaList]);
  const changeFocusedValueIndex = useCallback(delta => {
    setFocusedValueIndex(x => Math.min(Math.max(0, x + delta), megaList.length - 1));
  }, [megaList.length]);


  const form = useService('form');

  let getListData = async (searchText, currentPage, page_size, isFirstCall, selectAll) => {
    setFilter(searchText);
    const token = window.localStorage.getItem('ngx-app.current-user');
    const myHeaders = new Headers();
    const CSRFToken = getCookie('csrftoken');

    myHeaders.append('Authorization', JSON.parse(token).auth_token);
    myHeaders.append('X-CSRFToken', CSRFToken);
    const options = {
      headers: myHeaders
    };

    // let requestURL = searchText ? `${field.valuesApi}?page=${currentPage}&page_size=${page_size}&filter_${field.apiDetails.label}=${searchText}` :
    //   `${field.valuesApi}?page=${currentPage}&page_size=${page_size}`;
    let requestURL = searchText ? `${field.valuesApi}?page=${currentPage}&page_size=${page_size}&${field.apiDetails.label}=${searchText}` :
      `${field.valuesApi}?page=${currentPage}&page_size=${page_size}`;

    // setIsSelectAll(!!selectAll);
    //requestURL = !selectAll ? requestURL : requestURL + '&all=1';


    let filterOptionsLogic = applyApiFilterOptionsLogic(form, field, form._getState().data);
    if (filterOptionsLogic.hasFilterOptions) {
      const val = filterOptionsLogic.queryString.split("=")[1];
      if (val && val !== 'null' && val !== null) {
        requestURL += `&${filterOptionsLogic.queryString}`;
      }
    }

    setLoading(true);
    const apiRequest = await new Request(requestURL, options);
    fetch(apiRequest)
      .then((response) => response.json())
      .then((res) => {
        if (res) {
          const arrTemp = tempDataSelected || []
          res?.results?.map(value => {

            const findTempOption = arrTemp.find(res => res[field.apiDetails.value] == value[field.apiDetails.value]);
            const findNewOption = newDataSelected.find(res => res[field.apiDetails.value] == value[field.apiDetails.value]);

            if (findTempOption) {
              value.checked = true
            }
            else {
              value.checked = false
            }
            if (findNewOption) {
              value.checked = findNewOption.checked
            }
          })
          megaDropdownValues = res?.results;
          setCountItems(res.count);
          const totalPage = Math.ceil(res.count / page_size)
          const pages = [...Array(totalPage).keys()].map(i => i + 1)
          setArrOfPages(pages)
          let range = pages.slice(1, 3);
          if (currentPage > 2 && currentPage !== lastPage) {
            range = pages.slice(currentPage - 2, currentPage + 1)
          } else if (currentPage > 2 && currentPage == lastPage) {
            range = pages.slice(currentPage - 2, currentPage - 1)
          }
          setRangeOfPage(range)
          setLastPage(totalPage)
          setTotalpage(totalPage);
          setMegaList(megaDropdownValues);
          setCheckedState(megaDropdownValues);

          //not found 
          //const filterArr = filter.split(',').filter(Boolean);
          const filterArr = searchText.split(',').filter(Boolean);
          if (filterArr.length > 1) {
            const diff = filterArr.filter(val => !res?.results.find(arr1Obj => arr1Obj[field.apiDetails.label] === val));
            setNotFounds(diff || []);
          }
          else {
            setNotFoundItems([]);
          }


          // setNotFounds(res.missing || []);

          //   if (selectAll) {
          // let updatedCheckedState = []
          // let newData = []
          // checkedState.map((item, index2) => {
          //   item.checked = true;
          //   newData.push(item)
          //   updatedCheckedState.push(item)
          // }
          // );
          // const uniqueArrNewDataSelected = [...new Set([...newDataSelected, ...newData])];
          // SetNewDataSelected([...uniqueArrNewDataSelected]);
          // setCheckedState(updatedCheckedState)

          // if (e.target.checked && countItems > page_size) {
          //   setShowSelectAll(true);
          // } else {
          //   setShowSelectAll(false);
          // }
          //}

        }
        setLoading(false);
      });
  }

  const setNotFounds = (arr) => {
    setNotFoundItems([]);
    setNotFoundItems(old => [...arr]);
  }

  const allowedItemsPattern = /.+/
  const isItemValid = (item) => {
    return allowedItemsPattern.test(item);
  }

  const splitString = (itemsString) => {
    let items = itemsString.split(/[,\t\n\r]+/);
    return items.filter((item) => item && isItemValid(item));
  }

  useEffect(() => {
    if (value && value.length && (!selectedLabel || selectedLabel.length < 1)) {
      setSelectedLabel(value);
    }
    if (selectedLabel && selectedLabel.length && (!value || value.length < 1)) {
      SetTempDataSelected([]);
      SetDateSelected('');
      setSelectedLabel([]);
      SetNewDataSelected([]);
      setCurrentPage(1);
    }
  }, [newDataSelected, checkedState, value, selectedLabel, dataSelected, tempDataSelected, currentPage])

  useEffect(() => {
    if (megaList.length == 0) {
      getListData('', currentPage, page_size, false)
    }
  }, []);

  const setValue = useCallback(option => {
    props.onChange({
      value: option || [],
      field
    });
  }, [field, props]);


  const displayState = useMemo(() => {
    const ds = {};
    ds.componentReady = !disabled && !readonly && loadState === LOAD_STATES.LOADED;
    ds.displayCross = ds.componentReady && value !== null && value !== undefined;
    ds.displayDropdown = !disabled && !readonly && isDropdownExpanded && !isEscapeClosed;
    return ds;
  }, [disabled, isDropdownExpanded, isEscapeClosed, loadState, readonly, value]);
  useEffect(() => {
    if (focusedValueIndex === 0) return;
    if (!focusedValueIndex || !megaList.length) {
      setFocusedValueIndex(0);
    } else if (focusedValueIndex >= megaList.length) {
      setFocusedValueIndex(megaList.length - 1);
    }
  }, [focusedValueIndex, megaList.length]);
  useKeyDownAction('ArrowUp', () => {
    if (megaList.length) {
      changeFocusedValueIndex(-1);
      setMouseControl(false);
    }
  }, listenerElement);
  useKeyDownAction('ArrowDown', () => {
    if (megaList.length) {
      changeFocusedValueIndex(1);
      setMouseControl(false);
    }
  }, listenerElement);
  useKeyDownAction('Enter', () => {
    if (focusedItem) {
      onValueSelected(focusedItem);
    }
  }, listenerElement);
  return jsxs(Fragment$1, {
    children: [
      jsxs("div", {
        id: prefixId(`${id}`, formId),
        class: classNames('fjs-input-group', {
          'disabled': disabled,
          'readonly': readonly
        }, {
          'hasErrors': errors.length
        }),
        children: [
          jsx("input", {
            readOnly: true,
            class: "fjs-input",
            id: prefixId(`${id}-mega`, formId),
            type: "text",
            placeholder: 'Mega dropdown',

            value: selectedLabel,

            onMouseDown: () => {
              setIsEscapeClose(false);
              setIsDropdownExpanded(true);
              setShouldApplyFilter(false);
              //SetNewDataSelected([]);
              getListData('', currentPage, page_size, false);
            },
            "aria-describedby": props['aria-describedby']
          }),
          displayState.displayCross && jsxs("span", {
            class: "fjs-select-cross",
            children: [jsx(XMarkIcon, {}), " "]
          }), jsx("span", {
            class: "fjs-select-arrow",
            onMouseDown: () => {
              setIsEscapeClose(false);
              setIsDropdownExpanded(true);
              setShouldApplyFilter(false);
            },
            children: displayState.displayDropdown ? jsx(AngelUpIcon, {}) : jsx(AngelDownIcon, {})
          })]
      }),
      displayState.displayDropdown && jsx("div", {
        class: "modal-megadropdown",
        children: [
          jsx("div", {
            class: 'modal-content-megadropdown',
            children: [
              jsxs("div", {
                class: 'd-flex justify-content-between',
                children: [
                  jsx("span", {
                    class: 'fw-bold fs-6',
                    children: field.label || '',
                  }),
                  jsx("span", {
                    class: 'material-icons close-modal-megadropdown mb-3',
                    children: 'close',
                    onMouseDown: () => {
                      newDataSelected?.map(data => {
                        data.checked = !data.checked
                      })
                      let findOldFromNew = dataSelected;
                      SetDateSelected(findOldFromNew);
                      setIsEscapeClose(true);
                      setIsDropdownExpanded(false);
                      setShouldApplyFilter(false);
                    }
                  }),
                ],
              }),
              jsx("div", {
                class: "c-mb-3",
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                },
                children: [
                  jsxs("div", {
                    class: "d-flex align-items-center",
                    style: "flex-basis: 70%",
                    children: [
                      jsx("input", {
                        class: "form-control",
                        placeholder: "Search",
                        id: prefixId(`${id}-mega-search`, formId),
                        onKeyUp: (e) => {
                          setFilter(e.target.value)
                          // if (e.target.value !== '') {
                          setCurrentPage(1);
                          const searchChars = e.target.value;
                          setTimeout(() => {
                            if (searchChars == e.target.value) {
                              getListData(e.target.value, currentPage, page_size, false)
                            }
                          }, 600);
                          // } 
                        },
                        onPaste: (e) => {
                          let clipboardData = e.clipboardData;
                          let pastedString = clipboardData.getData('text/plain');
                          const pastedArray = splitString(pastedString);
                          const oldPastedData = pastedArray.join(',');
                          e.preventDefault();
                          setFilter(oldPastedData)
                        },
                        type: "text",
                        value: filter,
                        ref: searchRef
                        // autoComplete: "off",
                      }),
                      // jsx("div", {
                      //   class: "text-muted flex-fill flex-grow-0 flex-shrink-0 c-mx-2",
                      //   children: (dataSelected.length || 0 + newDataSelected.length || 0) + ' items selected'
                      // }),
                      // showSelectAll && !isSelectAll && jsx("div", {
                      //   class: "flex-fill flex-grow-0 flex-shrink-0 c-mx-2",
                      //   children: `Select all ${countItems} items`,
                      //   style: {
                      //     cursor: 'pointer',
                      //     color: '#0077B6',
                      //   },
                      //   onClick: () => {
                      //     //toggleSelectAll();
                      //     setIsSelectAll(true);

                      //     setTimeout(() => {
                      //       getListData(filter, currentPage, page_size, false, true)
                      //     }, 200);
                      //   }
                      // }),
                      // isSelectAll && jsx("div", {
                      //   class: "flex-fill flex-grow-0 flex-shrink-0 c-mx-2",
                      //   children: `Unselect all ${countItems} items`,
                      //   style: {
                      //     cursor: 'pointer',
                      //     color: '#0077B6',
                      //   },
                      //   onClick: () => {
                      //     //toggleSelectAll();
                      //     setIsSelectAll(false);

                      //     setTimeout(() => {
                      //       getListData(filter, currentPage, page_size, false, false)
                      //     }, 200);
                      //   }
                      // })

                      ////////////////////
                    ]
                  }),
                  jsx("button", {
                    children: 'Clear all selections',
                    class: classNames('btn', 'btn-link', {
                      'disabled': loading
                    }),
                    style: {
                      cursor: 'pointer',
                      color: '#0077B6',
                    },
                    onClick: () => {
                      SetNewDataSelected([])
                      let updatedCheckedState = []
                      let newData = [];
                      newDataSelected.map((item, index2) => {
                        if (item?.checked) {
                          item.checked = false
                          newData.push(item)
                        }
                        // updatedCheckedState.push(item)
                      }
                      );
                      checkedState.map((item, index2) => {
                        if (item?.checked) {
                          item.checked = false
                          newData.push(item)
                        }
                        updatedCheckedState.push(item)
                      }
                      );
                      SetTempDataSelected([])
                      SetNewDataSelected([...newData]);
                      setCheckedState(updatedCheckedState);
                    }
                  })
                ]
              }),
              (loading) && jsx("div", {
                class: "d-flex c-w-100 h-100 justify-content-center align-items-center",
                children: jsx("div", {
                  class: "loader"
                })
              }),
              (!loading && megaList.length > 0) && jsx("div", {
                style: {
                  height: '76%',
                  overflow: 'auto',
                },
                class: 'mb-3',
                children: jsx("table", {
                  class: "table table-hover",
                  children: [
                    jsx("thead", {
                      children: [
                        jsx("tr", {
                          class: "c-border-tabel",
                          children: [
                            jsx("th", {
                              children: jsx("input", {
                                type: 'checkbox',
                                id: `select-all-checkbox`,
                                checked: checkedState.filter(ch => ch.checked == true).length == checkedState.length,
                                onChange: (e) => {
                                  let updatedCheckedState = []
                                  let newData = []
                                  checkedState.map((item, index2) => {
                                    item.checked = e.target.checked
                                    newData.push(item)
                                    updatedCheckedState.push(item)
                                  }
                                  );
                                  const uniqueArrNewDataSelected = [...new Set([...newDataSelected, ...newData])];
                                  SetNewDataSelected([...uniqueArrNewDataSelected]);
                                  setCheckedState(updatedCheckedState);
                                  // arrDataSelected = updatedCheckedState.filter(data => data.checked == true).map(({ site_name }) => site_name);
                                  // arrDataSelectedSender = updatedCheckedState.filter(data => data.checked == true).map(({ site_name }) => site_name);
                                  //arrDataSelected = updatedCheckedState.filter(data => data.checked == true).map((x) => x[field.apiDetails.value]);
                                  //arrDataSelectedSender = updatedCheckedState.filter(data => data.checked == true).map((x) => x[field.apiDetails.value]);

                                  if (e.target.checked && countItems > page_size) {
                                    setShowSelectAll(true);
                                  } else {
                                    setShowSelectAll(false);
                                  }
                                }
                              }),
                            }),
                            megaList && megaList.length > 0 && Object.keys(megaList[0])?.map((key1, index) => {
                              if (key1 !== 'checked') {
                                return (
                                  jsx("th", {
                                    dataField: key1.toString(),
                                    dataFilterControl: "input",
                                    dataSortable: "true",
                                    children: key1.toString()
                                  })
                                )
                              }
                            })
                          ]
                        }),
                      ]
                    }),
                    jsx("tbody", {
                      children: [
                        megaList && megaList.length > 0 && megaList.map((listValue, index) => {
                          return (
                            jsx("tr", {
                              class: "c-border-tabel",
                              key: index,
                              onClick: () => {
                                let updatedCheckedState = []
                                let newData = []
                                checkedState.map((item, index2) => {
                                  if (item == listValue) {
                                    item.checked = !item.checked
                                    newData.push(item)
                                  }
                                  updatedCheckedState.push(item)
                                }
                                );
                                const uniqueArrNewDataSelected = [...new Set([...newDataSelected, ...newData])];
                                SetNewDataSelected([...uniqueArrNewDataSelected]);
                                setCheckedState(updatedCheckedState);
                              },
                              children: [
                                jsx("td", {
                                  children: jsx("input", {
                                    type: 'checkbox',
                                    id: `custom-checkbox-${index}`,
                                    className: ['mt-1'],
                                    checked: checkedState.find(ch => ch[field.apiDetails.value] == listValue[field.apiDetails.value]).checked,
                                    key: index,
                                  }),
                                }),
                                Object.keys(listValue) && Object.keys(listValue).map((key2, index) => {
                                  if (key2 !== 'checked') {
                                    return (
                                      jsx("td", {
                                        children: listValue[key2],
                                      })
                                    )
                                  }
                                })
                              ],
                            })
                          );
                        })
                      ]
                    })
                  ]
                }),
              }),
              (!loading && !megaList.length) && jsx("div", {
                class: "d-flex justify-content-center align-items-center",
                style: {
                  height: 'inherit'
                },
                children: emptyListMessage
              }),

              // todo: not found
              (!loading && notFoundItems && notFoundItems.length > 0) && jsxs("div", {
                class: "not-found-search",
                children: [
                  jsx("div", {
                    class: "fw-bold mb-1",
                    children: "Not found items"
                  }),
                  jsx("div", {
                    class: "scrollable",
                    children: notFoundItems.join(", ")
                  })
                ]
              }),

              jsx("div", {
                class: "pagination d-flex align-items-center",
                children: [
                  jsx("span", {
                    children: 'Total ' + (loading ? '' : countItems) + ' items',
                    style: {
                      textWrap: 'nowrap'
                    }
                  }),
                  jsx("div", {
                    class: "pagination-container w-100 d-flex justify-content-center",
                    children: [
                      jsx("button", {
                        class: classNames('btn-pagination', 'next-prev-btn', {
                          'btn-pagination-disable': loading || currentPage == 1
                        }),
                        children: [jsx("i", {
                          class: "material-icons",
                          children: 'chevron_left'
                        })],
                        onClick: () => {
                          if (currentPage != 1) {
                            setCurrentPage(currentPage - 1)
                            getListData(filter, currentPage - 1, page_size, false)
                          }
                        }
                      }),
                      (countItems > 0) && jsx("button", {
                        class: classNames('btn-pagination', {
                          'btn-pagination-active': currentPage == 1
                        }, { 'btn-pagination-disable': loading }),
                        children: [jsx("span", {
                          class: "page-number",
                          children: 1
                        })],
                        onClick: () => {
                          setCurrentPage(1)
                          getListData(filter, 1, page_size, false)
                        }
                      }),
                      (currentPage > 3) && jsx("button", {
                        class: "btn-more-page",
                        children: [jsx("i", {
                          class: "material-icons",
                          children: 'more_horiz'
                        }),]
                      }),
                      rangeOfPages.map(page => {
                        if (page !== lastPage) {
                          return jsx("button", {
                            class: classNames('btn-pagination', {
                              'btn-pagination-active': page == currentPage
                            }, { 'btn-pagination-disable': loading }),
                            children: [jsx("span", {
                              class: "page-number",
                              children: page
                            })],
                            onClick: () => {
                              setCurrentPage(page)

                              getListData(filter, page, page_size, false)
                            }
                          })
                        }
                      }),
                      (lastPage - currentPage > 2) && jsx("button", {
                        class: "btn-more-page",
                        children: [jsx("i", {
                          class: "material-icons",
                          children: 'more_horiz'
                        }),]
                      }),
                      (lastPage > 1) && jsx("button", {
                        class: classNames('btn-pagination', {
                          'btn-pagination-active': lastPage == currentPage
                        }, { 'btn-pagination-disable': loading }),
                        children: [jsx("span", {
                          class: "page-number",
                          children: lastPage
                        })],
                        onClick: () => {
                          setCurrentPage(lastPage)
                          getListData(filter, lastPage, page_size, false)
                        }
                      }),
                      jsx("button", {
                        // class:"btn-pagination next-prev-btn",
                        class: classNames('btn-pagination', 'next-prev-btn', {
                          'btn-pagination-disable': loading || countItems < 1 || currentPage == lastPage
                        }),
                        children: [jsx("i", {
                          class: "material-icons",
                          children: 'chevron_right'
                        })],
                        onClick: () => {
                          if (countItems >= 1 && currentPage != lastPage) {
                            setCurrentPage(currentPage + 1)
                            getListData(filter, currentPage + 1, page_size, false)
                          }
                          // if(filter){
                          //   getListData(filter,currentPage,page_size,false)
                          // }else{
                          //   getListData('',currentPage,page_size,false)
                          // }
                        }
                      }),
                    ]
                  })
                ]
              }),
              jsx("div", {
                class: 'actions-modal-megadropdown',
                children: [
                  jsx("button", {
                    class: classNames('btn', 'btn-primary', { 'disabled': loading }),
                    children: 'Apply',
                    onclick: () => {
                      let newData = newDataSelected;
                      //const showedData = newData.filter(data => data.checked == true).map(({ site_name }) => site_name).join(',')
                      const showedData = newData.filter(data => data.checked == true);
                      let findOldFromNew = tempDataSelected.filter(res => !newData.map(data => data[field.apiDetails.value]).includes(res[field.apiDetails.value]));
                      // const finalyData = (showedData && `${showedData}`) + (findOldFromNew && (showedData ? `,${findOldFromNew}` : `${findOldFromNew}`));
                      const finalyData = [...showedData, ...findOldFromNew];


                      setSelectedLabel(finalyData.map(x => x[field.apiDetails.label]));
                      SetTempDataSelected(finalyData);
                      setValue(finalyData.map(x => x[field.apiDetails.value]));
                      SetDateSelected(finalyData);
                      SetNewDataSelected([]);
                      setIsEscapeClose(true);
                      setIsDropdownExpanded(false);
                      setShouldApplyFilter(false);
                    }
                  }),
                  jsx("button", {
                    class: 'btn btn-secoundary',
                    children: 'Cancel',
                    onclick: () => {
                      newDataSelected.map(data => {
                        data.checked = !data.checked
                      })
                      let findOldFromNew = dataSelected;
                      SetDateSelected(findOldFromNew);
                      setIsEscapeClose(true);
                      setIsDropdownExpanded(false);
                    }
                  })
                ]
              })
            ]
          })
        ]
      })]
  });
}

const type$5 = 'select';
function Select(props) {
  const {
    disabled,
    errors = [],
    onBlur,
    field,
    onChange,
    readonly,
    value
  } = props;
  const {
    description,
    id,
    label,
    searchable = false,
    isMulti = false,
    megaDropdownView,
    valuesApi,
    validate = {}
  } = field;
  const {
    required
  } = validate;
  const {
    formId
  } = useContext(FormContext$1);
  const errorMessageId = errors.length === 0 ? undefined : `${prefixId(id, formId)}-error-message`;
  const selectProps = useMemo(() => ({
    id,
    disabled,
    errors,
    onBlur,
    field,
    value,
    onChange,
    readonly,
    'aria-describedby': errorMessageId
  }), [disabled, errors, field, id, value, onChange, onBlur, readonly, errorMessageId]);
  return jsxs("div", {
    class: formFieldClasses(type$5, {
      errors,
      disabled,
      readonly
    }),
    onKeyDown: event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    children: [jsx(Label, {
      id: prefixId(`${id}-search`, formId),
      label: label,
      required: required
    }),

    megaDropdownView ? (isMulti ? jsx(MegaDropdownMultiSelect, { ...selectProps }) : jsx(MegaDropdownSingleSelect, { ...selectProps }))
      :
      (
        valuesApi ?
          (isMulti ? jsx(ApiMultiSelect, { ...selectProps }) : jsx(ApiSingleSelect, { ...selectProps }))
          :
          (
            isMulti ?
              (searchable ? jsx(StaticSearchableMultiSelect, { ...selectProps }) : jsx(StaticSimpleMultiSelect, { ...selectProps }))
              :
              (searchable ? jsx(StaticSearchableSingleSelect, { ...selectProps }) : jsx(StaticSimpleSingleSelect, { ...selectProps }))
          )
      ),


    /////////////////////////////////////////////
    jsx(Description, {
      description: description
    }), jsx(Errors, {
      errors: errors,
      id: errorMessageId
    })]
  });
}
Select.config = {
  type: type$5,
  keyed: true,
  label: 'Dropdown',
  group: 'basic-input',
  emptyValue: null,
  // sanitizeValue: sanitizeSingleSelectValue,
  sanitizeValue: ({ formField, data, value }) => {
    if (formField.isMulti) return sanitizeMultiSelectValue({ formField, data, value });
    return sanitizeSingleSelectValue({ formField, data, value });
  },
  create: createEmptyOptions
};

const type$4 = 'spacer';
function Spacer(props) {
  const {
    field
  } = props;
  const {
    height = 60
  } = field;
  return jsx("div", {
    class: formFieldClasses(type$4),
    style: {
      height: height
    }
  });
}
Spacer.config = {
  type: type$4,
  keyed: false,
  label: 'Spacer',
  group: 'presentation',
  create: (options = {}) => ({
    height: 60,
    ...options
  })
};

const type$j = 'seperator';
function Seperator(props) {
  const {
    field
  } = props;
  const {
    height = 60
  } = field;
  return jsx("hr", {
    class: formFieldClasses(type$j),
    style: {
      //height: height
    }
  });
}
Seperator.config = {
  type: type$j,
  keyed: false,
  label: 'Seperator',
  group: 'basic-input',
  create: (options = {}) => ({
    height: 60,
    ...options
  })
};

const type$3 = 'taglist';
function Taglist(props) {
  const {
    disabled,
    errors = [],
    onBlur,
    field,
    readonly,
    value: values = []
  } = props;
  const {
    description,
    id,
    label,
    validate = {}
  } = field;
  const {
    required
  } = validate;
  const {
    formId
  } = useContext(FormContext$1);
  const errorMessageId = errors.length === 0 ? undefined : `${prefixId(id, formId)}-error-message`;
  const [filter, setFilter] = useState('');
  const [filteredOptions, setFilteredOptions] = useState([]);
  const [isDropdownExpanded, setIsDropdownExpanded] = useState(false);
  const [hasOptionsLeft, setHasOptionsLeft] = useState(true);
  const [isEscapeClosed, setIsEscapeClose] = useState(false);
  const searchbarRef = useRef();
  const {
    state: loadState,
    values: options
  } = useValuesAsync(field);

  // We cache a map of option values to their index so that we don't need to search the whole options array every time to correlate the label
  const valueToOptionMap = useMemo(() => Object.assign({}, ...options.map((o, x) => ({
    [o.value]: options[x]
  }))), [options]);

  // Usage of stringify is necessary here because we want this effect to only trigger when there is a value change to the array
  useEffect(() => {
    if (loadState === LOAD_STATES.LOADED) {
      setFilteredOptions(options.filter(o => o.label && o.value && o.label.toLowerCase().includes(filter.toLowerCase()) && !values.includes(o.value)));
    } else {
      setFilteredOptions([]);
    }
  }, [filter, JSON.stringify(values), options, loadState]);
  useEffect(() => {
    setHasOptionsLeft(options.length > values.length);
  }, [options.length, values.length]);
  const onFilterChange = ({
    target
  }) => {
    setIsEscapeClose(false);
    setFilter(target.value);
  };
  const selectValue = value => {
    if (filter) {
      setFilter('');
    }

    // Ensure values cannot be double selected due to latency
    if (values.at(-1) === value) {
      return;
    }
    props.onChange({
      value: [...values, value],
      field
    });
  };
  const deselectValue = value => {
    props.onChange({
      value: values.filter(v => v != value),
      field
    });
  };
  const onInputKeyDown = e => {
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowDown':
        // We do not want the cursor to seek in the search field when we press up and down
        e.preventDefault();
        break;
      case 'Backspace':
        if (!filter && values.length) {
          deselectValue(values[values.length - 1]);
        }
        break;
      case 'Escape':
        setIsEscapeClose(true);
        break;
      case 'Enter':
        if (isEscapeClosed) {
          setIsEscapeClose(false);
        }
        break;
    }
  };
  const onComponentBlur = () => {
    setIsDropdownExpanded(false);
    setFilter('');
    onBlur();
  };
  const onTagRemoveClick = (event, value) => {
    const {
      target
    } = event;
    deselectValue(value);

    // restore focus if there is no next sibling to focus
    const nextTag = target.closest('.fjs-taglist-tag').nextSibling;
    if (!nextTag) {
      searchbarRef.current.focus();
    }
  };
  const shouldDisplayDropdown = useMemo(() => !disabled && loadState === LOAD_STATES.LOADED && isDropdownExpanded && !isEscapeClosed, [disabled, isDropdownExpanded, isEscapeClosed, loadState]);
  return jsxs("div", {
    class: formFieldClasses(type$3, {
      errors,
      disabled,
      readonly
    }),
    onKeyDown: event => {
      if (event.key === 'Enter') {
        event.stopPropagation();
        event.preventDefault();
      }
    },
    children: [jsx(Label, {
      label: label,
      required: required,
      id: prefixId(`${id}-search`, formId)
    }), jsxs("div", {
      class: classNames('fjs-taglist', {
        'fjs-disabled': disabled,
        'fjs-readonly': readonly
      }),
      children: [loadState === LOAD_STATES.LOADED && jsx("div", {
        class: "fjs-taglist-tags",
        children: values.map(v => {
          return jsxs("div", {
            class: classNames('fjs-taglist-tag', {
              'fjs-disabled': disabled,
              'fjs-readonly': readonly
            }),
            onMouseDown: e => e.preventDefault(),
            children: [jsx("span", {
              class: "fjs-taglist-tag-label",
              children: valueToOptionMap[v] ? valueToOptionMap[v].label : `unexpected value{${v}}`
            }), !disabled && !readonly && jsx("button", {
              type: "button",
              title: "Remove tag",
              class: "fjs-taglist-tag-remove",
              onClick: event => onTagRemoveClick(event, v),
              children: jsx(XMarkIcon, {})
            })]
          });
        })
      }), jsx("input", {
        disabled: disabled,
        readOnly: readonly,
        class: "fjs-taglist-input",
        ref: searchbarRef,
        id: prefixId(`${id}-search`, formId),
        onChange: onFilterChange,
        type: "text",
        value: filter,
        placeholder: disabled || readonly ? undefined : 'Search',
        autoComplete: "off",
        onKeyDown: onInputKeyDown,
        onMouseDown: () => setIsEscapeClose(false),
        onFocus: () => !readonly && setIsDropdownExpanded(true),
        onBlur: () => !readonly && onComponentBlur(),
        "aria-describedby": errorMessageId
      })]
    }), jsx("div", {
      class: "fjs-taglist-anchor",
      children: shouldDisplayDropdown && jsx(DropdownList, {
        values: filteredOptions,
        getLabel: o => o.label,
        onValueSelected: o => selectValue(o.value),
        emptyListMessage: hasOptionsLeft ? 'No results' : 'All values selected',
        listenerElement: searchbarRef.current
      })
    }), jsx(Description, {
      description: description
    }), jsx(Errors, {
      errors: errors,
      id: errorMessageId
    })]
  });
}
Taglist.config = {
  type: type$3,
  keyed: true,
  label: 'Tag list',
  group: 'selection',
  emptyValue: [],
  sanitizeValue: sanitizeMultiSelectValue,
  create: createEmptyOptions
};

const type$2 = 'text';
function Text(props) {
  const form = useService('form');
  const {
    textLinkTarget
  } = form._getState().properties;
  const {
    field,
    disableLinks
  } = props;
  const {
    text = '',
    strict = false
  } = field;
  const markdownRenderer = useService('markdownRenderer');

  // feelers => pure markdown
  const markdown = useTemplateEvaluation(text, {
    debug: true,
    strict
  });

  // markdown => safe HTML
  const safeHtml = useMemo(() => {
    const html = markdownRenderer.render(markdown);
    return sanitizeHTML(html);
  }, [markdownRenderer, markdown]);
  const OverridenTargetLink = useMemo(() => BuildOverridenTargetLink(textLinkTarget), [textLinkTarget]);
  const componentOverrides = useMemo(() => {
    if (disableLinks) {
      return {
        'a': DisabledLink
      };
    }
    if (textLinkTarget) {
      return {
        'a': OverridenTargetLink
      };
    }
    return {};
  }, [disableLinks, OverridenTargetLink, textLinkTarget]);
  return jsx("div", {
    class: formFieldClasses(type$2),
    children: jsx(Markup, {
      markup: safeHtml,
      components: componentOverrides,
      trim: false
    })
  });
}
Text.config = {
  type: type$2,
  keyed: false,
  label: 'Text view',
  group: 'basic-input',
  create: (options = {}) => ({
    text: '# Text',
    ...options
  })
};
function BuildOverridenTargetLink(target) {
  return function ({
    children,
    ...rest
  }) {
    return jsx("a", {
      ...rest,
      target: target,
      children: children
    });
  };
}
function DisabledLink({
  children,
  ...rest
}) {
  return jsx("a", {
    ...rest,
    class: "fjs-disabled-link",
    tabIndex: -1,
    children: children
  });
}

const type$1 = 'textfield';
function Textfield(props) {
  const {
    disabled,
    errors = [],
    onBlur,
    field,
    readonly,
    value = ''
  } = props;
  const {
    description,
    id,
    label,
    appearance = {},
    validate = {}
  } = field;
  const {
    prefixAdorner,
    suffixAdorner
  } = appearance;
  const {
    required
  } = validate;
  const onChange = ({
    target
  }) => {
    props.onChange({
      field,
      value: target.value
    });
  };
  const {
    formId
  } = useContext(FormContext$1);
  const errorMessageId = errors.length === 0 ? undefined : `${prefixId(id, formId)}-error-message`;
  return jsxs("div", {
    class: formFieldClasses(type$1, {
      errors,
      disabled,
      readonly
    }),
    children: [jsx(Label, {
      id: prefixId(id, formId),
      label: label,
      required: required
    }), jsx(TemplatedInputAdorner, {
      disabled: disabled,
      readonly: readonly,
      pre: prefixAdorner,
      post: suffixAdorner,
      children: jsx("input", {
        class: "fjs-input",
        disabled: disabled,
        readOnly: readonly,
        id: prefixId(id, formId),
        onInput: onChange,
        onBlur: onBlur,
        type: "text",
        value: value,
        "aria-describedby": errorMessageId
      })
    }), jsx(Description, {
      description: description
    }), jsx(Errors, {
      errors: errors,
      id: errorMessageId
    })]
  });
}
Textfield.config = {
  type: type$1,
  keyed: true,
  label: 'Short Text',
  group: 'basic-input',
  emptyValue: '',
  sanitizeValue: ({
    value
  }) => {
    if (isArray(value) || isObject(value)) {
      return '';
    }

    // sanitize newlines to spaces
    if (typeof value === 'string') {
      return value.replace(/[\r\n\t]/g, ' ');
    }
    return String(value);
  },
  create: (options = {}) => ({
    ...options
  })
};


const type$e = 'latlong';
function Latlong(props) {
  const {
    disabled,
    errors = [],
    onBlur,
    field,
    value,
    readonly,
    onChange
  } = props;
  const {
    description,
    id,
    label,
    appearance = {},
    validate = {},
    decimalDigits,
    serializeToString = false,
    increment: incrementValue
  } = field;
  const {
    prefixAdorner,
    suffixAdorner
  } = appearance;
  const {
    required
  } = validate;
  const inputRef = useRef();
  const [stringValueCache, setStringValueCache] = useState('');

  // checks whether the value currently in the form data is practically different from the one in the input field cache
  // this allows us to guarantee the field always displays valid form data, but without auto-simplifying values like 1.000 to 1
  const cacheValueMatchesState = useMemo(() => Numberfield.config.sanitizeValue({
    value,
    formField: field
  }) === Numberfield.config.sanitizeValue({
    value: stringValueCache,
    formField: field
  }), [stringValueCache, value, field]);
  const displayValue = useMemo(() => {
    if (value === 'NaN') return 'NaN';
    if (stringValueCache === '-') return '-';
    return cacheValueMatchesState ? stringValueCache : value || value === 0 ? Big(value).toFixed() : '';
  }, [stringValueCache, value, cacheValueMatchesState]);
  const arrowIncrementValue = useMemo(() => {
    if (incrementValue) return Big(incrementValue);
    if (decimalDigits) return Big(`1e-${decimalDigits}`);
    return Big('1');
  }, [decimalDigits, incrementValue]);
  const setValue = useCallback(stringValue => {
    if (isNullEquivalentValue(stringValue)) {
      setStringValueCache('');
      onChange({
        field,
        value: null
      });
      return;
    }

    // treat commas as dots
    stringValue = stringValue.replaceAll(',', '.');
    if (stringValue === '-') {
      setStringValueCache('-');
      return;
    }
    if (isNaN(Number(stringValue))) {
      setStringValueCache('NaN');
      onChange({
        field,
        value: 'NaN'
      });
      return;
    }
    setStringValueCache(stringValue);
    onChange({
      field,
      value: serializeToString ? stringValue : Number(stringValue)
    });
  }, [field, onChange, serializeToString]);
  const increment = () => {
    if (readonly) {
      return;
    }
    const base = isValidNumber(value) ? Big(value) : Big(0);
    const stepFlooredValue = base.minus(base.mod(arrowIncrementValue));

    // note: toFixed() behaves differently in big.js
    setValue(stepFlooredValue.plus(arrowIncrementValue).toFixed());
  };
  const decrement = () => {
    if (readonly) {
      return;
    }
    const base = isValidNumber(value) ? Big(value) : Big(0);
    const offset = base.mod(arrowIncrementValue);
    if (offset.cmp(0) === 0) {
      // if we're already on a valid step, decrement
      setValue(base.minus(arrowIncrementValue).toFixed());
    } else {
      // otherwise floor to the step
      const stepFlooredValue = base.minus(base.mod(arrowIncrementValue));
      setValue(stepFlooredValue.toFixed());
    }
  };
  const onKeyDown = e => {
    // delete the NaN state all at once on backspace or delete
    if (value === 'NaN' && (e.code === 'Backspace' || e.code === 'Delete')) {
      setValue(null);
      e.preventDefault();
      return;
    }
    if (e.code === 'ArrowUp') {
      increment();
      e.preventDefault();
      return;
    }
    if (e.code === 'ArrowDown') {
      decrement();
      e.preventDefault();
      return;
    }
  };

  // intercept key presses which would lead to an invalid number
  const onKeyPress = e => {
    const caretIndex = inputRef.current.selectionStart;
    const selectionWidth = inputRef.current.selectionStart - inputRef.current.selectionEnd;
    const previousValue = inputRef.current.value;
    if (!willKeyProduceValidNumber(e.key, previousValue, caretIndex, selectionWidth, decimalDigits)) {
      e.preventDefault();
    }
  };
  const {
    formId
  } = useContext(FormContext$1);
  const errorMessageId = errors.length === 0 ? undefined : `${prefixId(id, formId)}-error-message`;
  return jsxs("div", {
    class: formFieldClasses(type$e, {
      errors,
      disabled,
      readonly
    }),
    children: [jsx(Label, {
      id: prefixId(id, formId),
      label: label,
      required: required,
    }), jsx(TemplatedInputAdorner, {
      disabled: disabled,
      readonly: readonly,
      pre: prefixAdorner,
      post: suffixAdorner,
      children: jsxs("div", {
        class: classNames('fjs-vertical-group', {
          'fjs-disabled': disabled,
          'fjs-readonly': readonly
        }, {
          'hasErrors': errors.length
        }),
        children: [jsx("input", {
          ref: inputRef,
          class: "fjs-input",
          disabled: disabled,
          readOnly: readonly,
          id: prefixId(id, formId),
          onKeyDown: onKeyDown,
          onKeyPress: onKeyPress,
          onBlur: onBlur

          // @ts-ignore
          ,
          onInput: e => setValue(e.target.value),
          type: "text",
          autoComplete: "off",
          step: arrowIncrementValue,
          value: displayValue,
          "aria-describedby": errorMessageId
        }), jsxs("div", {
          class: classNames('fjs-number-arrow-container', {
            'fjs-disabled': disabled,
            'fjs-readonly': readonly
          }),
          children: [jsx("button", {
            class: "fjs-number-arrow-up",
            type: "button",
            "aria-label": "Increment",
            onClick: () => increment(),
            tabIndex: -1,
            children: jsx(AngelUpIcon, {})
          }), jsx("div", {
            class: "fjs-number-arrow-separator"
          }), jsx("button", {
            class: "fjs-number-arrow-down",
            type: "button",
            "aria-label": "Decrement",
            onClick: () => decrement(),
            tabIndex: -1,
            children: jsx(AngelDownIcon, {})
          })]
        }),
        ]
      })
    }),
    jsx(Description, {
      description: description
    }), jsx(Errors, {
      errors: errors,
      id: errorMessageId
    })]
  });
}
Latlong.config = {
  type: type$e,
  keyed: true,
  label: 'Lat & Long',
  group: 'basic-input',
  emptyValue: null,
  sanitizeValue: ({
    value,
    formField
  }) => {
    // null state is allowed
    if (isNullEquivalentValue(value)) return null;

    // if data cannot be parsed as a valid number, go into invalid NaN state
    if (!isValidNumber(value)) return 'NaN';

    // otherwise parse to formatting type
    return formField.serializeToString ? value.toString() : Number(value);
  },
  create: (options = {}) => ({
    ...options
  })
};


const type$d = 'fileupload';
function Fileupload(props) {
  const {
    disabled,
    errors = [],
    onBlur,
    field,
    readonly,
    value = []
  } = props;
  const {
    description,
    id,
    label,
    appearance = {},
    validate = {}
  } = field;
  const {
  } = appearance;
  const {
    required
  } = validate;
  const onChange = (files) => {
    uploadFileByApiCall(files, field, props, setUploadedList, setUploadingList, showToast);
  };

  const [uploadingList, setUploadingList] = useState([]);
  const [uploadedList, setUploadedList] = useState([]);

  useEffect(() => {
    if (value && value.length > 0 && uploadedList.length < value.length) {
      let attachedList = [];
      value.forEach(item => {
        const attachedProperties = item.split('*');
        const attached = { url: attachedProperties[0], id: attachedProperties[1], type: attachedProperties[2], name: attachedProperties[3], size: attachedProperties[4] };
        attachedList.push(attached);
      });
      setUploadedList(attachedList);
    }
  }, [value]);

  const allowDrop = (ev) => {
    ev.preventDefault();
  }

  const dragover = (ev) => {
    ev.preventDefault();
    const parent = ev.target.closest('.fjs-drop-zone');
    parent.classList.add("hovered");
  }

  const dragleave = (ev) => {
    ev.preventDefault();
    const parent = ev.target?.closest('.fjs-drop-zone');
    parent?.classList?.remove("hovered");
  }

  const drop = (ev) => {
    let files = [];
    if (ev.dataTransfer.items) {
      // Use DataTransferItemList interface to access the file(s)
      [...ev.dataTransfer.items].forEach((item, i) => {
        // If dropped items aren't files, reject them
        if (item.kind === "file") {
          const file = item.getAsFile();
          file.id = Math.floor(Math.random() * (1000000 - 1) + 1);
          files.push(file);
        }
      });
    } else {
      // Use DataTransfer interface to access the file(s)
      [...ev.dataTransfer?.files].forEach((file, i) => {
      });
    }
    setUploadingList(oldArray => [...oldArray, ...files]);
    ev.preventDefault();
    const parent = ev.target?.closest('.fjs-drop-zone');
    parent?.classList?.remove("hovered");
    onChange(files);
  }

  //const form = useService('form');
  const browseFile = (ev) => {
    const files = ev.target?.files;
    files[0].id = Math.floor(Math.random() * (1000000 - 1) + 1);
    setUploadingList(oldArray => [...oldArray, ...files]);
    onChange(files);
  }

  const removeUploadingItem = (file) => {
    setUploadingList(oldArray => {
      const newArray = oldArray.filter(x => x.id !== file.id);
      return newArray;
    });

    setToasts((prevToasts) => prevToasts.filter((toast) => toast.file.id !== file.id));
  }

  const removeUploadedItem = (file) => {
    setUploadedList(oldArray => {
      const newArray = oldArray.filter(x => x.id !== file.id);
      return newArray;
    });
    field.numberOfFiles--;
    field.totalUploadedSize -= file.size;
    let newValue = [...props.value];
    newValue = newValue.filter(x => !x.includes(file.url));
    props.onChange({
      field,
      value: newValue
    });
  }

  const downloadItem = (file) => {
    window.open(file.url);
  }

  const performClick = (elemId) => {
    var elem = document.getElementById(elemId);
    if (elem && document.createEvent) {
      var evt = document.createEvent("MouseEvents");
      evt.initEvent("click", true, false);
      elem.dispatchEvent(evt);
    }
  }

  const {
    formId
  } = useContext(FormContext$1);

  const errorMessageId = errors.length === 0 ? undefined : `${prefixId(id, formId)}-error-message`;

  const [toasts, setToasts] = useState([]);

  const removeToast = (tt) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== tt.id));

    setUploadingList(oldArray => {
      const newArray = oldArray.filter(x => tt.file.id !== x.id);
      return newArray;
    });

  };

  const showToast = (message, type, file) => {
    const toast = {
      id: Date.now(),
      file: file,
      message,
      type,
    };

    setToasts((prevToasts) => [...prevToasts, toast]);

    //  const autoClose = true;
    // const autoCloseDuration = 500;
    // if (autoClose) {
    //   setTimeout(() => {
    //     removeToast(toast);
    //   }, autoCloseDuration * 1000);
    // }
  };

  return jsxs("div", {
    class: formFieldClasses(type$d, {
      errors,
      disabled,
      readonly
    }),
    children: [jsx(Label, {
      id: prefixId(id, formId),
      label: label,
      required: required
    }), jsxs("div", {
      class: "fjs-drop-zone",
      id: 'drop-zone' + prefixId(id, formId),
      // disabled: disabled,
      // readonly: readonly,
      disabled: false,
      readonly: false,
      ondrop: drop,
      ondragover: allowDrop,
      ondragover: dragover,
      ondragleave: dragleave,
      onBlur: onBlur,
      value: value,
      children: [
        jsxs("div", {
          class: "fjs-drop-zone-browse",
          id: 'fjs-drop-zone-browse' + prefixId(id, formId),
          children: [
            jsxs("a", {
              class: "c-w-100 d-block text-center",
              children: [
                UploadIcon(),
                ' Browse file'
              ],
              onClick: () => performClick(`fileinput${prefixId(id, formId)}`)
            }),
            jsx("input", {
              id: `fileinput${prefixId(id, formId)}`,
              type: "file",
              onInput: browseFile
            }),
            jsx("div", {
              class: "c-w-100 text-center c-mt-n2 c-ps-1",
              children: 'Drag and drop file here'
            }),
          ]
        }),
        jsx("div", {
          class: "fjs-dropped-list",
          children: [
            uploadedList.length > 0 && uploadedList.map((fileItem, i) => {
              return jsxs("div", {
                class: "attached-item",
                children: [
                  renderIconBasedOnFileType(fileItem?.type),
                  jsxs("div", {
                    class: "c-ms-1 uploaded",
                    children: [
                      jsx("div", {
                        class: "file-name",
                        children: fileItem.name,
                        onClick: () => downloadItem(fileItem),
                      }),
                      jsx("div", {
                        children: (fileItem.size / (1024 * 1024)).toFixed(2) + " MB",
                        onClick: () => downloadItem(fileItem),
                      })
                    ]
                  }),
                  jsx("button", {
                    class: "btn icon icon-trash-01 text-error ms-auto",
                    type: "button",
                    style: "font-size:1.1rem",
                    "aria-label": "Remove",
                    onClick: () => removeUploadedItem(fileItem),
                    tabIndex: -1
                  })
                ]
              })
            }),

            uploadingList.length > 0 && uploadingList.map((fileItem, i) => {
              return jsxs("div", {
                class: "uploading-list",
                children: [
                  jsxs("div", {
                    class: "attached-item",
                    children: [
                      renderIconBasedOnFileType(fileItem?.type),
                      jsxs("div", {
                        class: "c-ms-1 uploading",
                        children: [
                          jsx("div", {
                            class: "file-name",
                            children: fileItem.name
                          }),
                          jsx("div", {
                            children: (fileItem.size / (1024 * 1024)).toFixed(2) + " MB"
                          })
                        ]
                      }),
                      !fileItem?.errorMessage && jsxs("div", {
                        class: "loader-close ms-auto",
                        "aria-label": "Loading",
                        onClick: () => removeUploadingItem(fileItem),
                        children: [
                          jsx("div", {
                            class: "loader",
                          }),
                          jsx("div", {
                            class: "icon icon-close close",
                          })
                        ]
                      }),
                      fileItem?.errorMessage && jsx("div", {
                        class: "ms-auto",
                        "aria-label": "Close",
                        onClick: () => removeUploadingItem(fileItem),
                        children:
                          jsx("div", {
                            class: "icon icon-close close",
                          })
                      })
                    ]
                  }),
                  jsx("div", {
                    class: "text-error error-message c-ms-2 c-mt-n1",
                    children: fileItem?.errorMessage
                  })
                ]
              })
            })
          ]
        })
      ]
    }), jsx(Description, {
      description: description
    }), jsx(Errors, {
      errors: errors,
      id: errorMessageId
    }),

    toasts && toasts.length > 0 && ToastList({ data: toasts || [], position: 'top-left', removeToast: removeToast })

    ]
  });
}
Fileupload.config = {
  type: type$d,
  keyed: true,
  label: 'Attachment',
  group: 'basic-input',
  emptyValue: [],
  sanitizeValue: ({
    value
  }) => {
    if (isArray(value) || isObject(value)) {
      // return '';
      return value;
    }
    if (typeof value === 'string') {
      return value.replace(/[\r\n\t]/g, ' ');
    }
    return String(value);
  },
  create: (options = {}) => ({
    ...options
  })
};

const type$h = 'gridfield';
function Gridfield(props) {
  const {
    disabled,
    errors = [],
    onBlur,
    field,
    readonly,
    value = []
  } = props;
  const {
    description,
    id,
    label,
    appearance = {},
    validate = {}
  } = field;
  const {
  } = appearance;
  const {
    required
  } = validate;
  const onChange = (files) => {
  };

  useEffect(() => {
  }, [value]);

  //const form = useService('form');

  const addRow = () => {
  }

  const removeRow = () => {
  }

  const {
    formId
  } = useContext(FormContext$1);
  const errorMessageId = errors.length === 0 ? undefined : `${prefixId(id, formId)}-error-message`;

  return jsxs("div", {
    class: formFieldClasses(type$h, {
      errors,
      disabled,
      readonly
    }),
    children: [jsx(Label, {
      id: prefixId(id, formId),
      label: label,
      required: required
    }), jsxs("div", {
      class: "fjs-grid-field",
      id: 'fjs-grid-field' + prefixId(id, formId),
      // disabled: disabled,
      // readonly: readonly,
      disabled: false,
      readonly: false,
      onBlur: onBlur,
      value: value,
      children:
        jsxs("table", {
          class: "fjs-table",
          id: 'fjs-tabel' + prefixId(id, formId),
          children: [
            jsxs("thead", {
              class: "thead",
              id: 'thead' + prefixId(id, formId),
              children: [
                jsxs("tr", {
                  class: "tr",
                  id: 'htr' + prefixId(id, formId),
                  children: [
                    jsxs("th", {
                      class: "th",
                      id: 'th1' + prefixId(id, formId),
                      children: []
                    }),
                    jsxs("th", {
                      class: "th",
                      id: 'th2' + prefixId(id, formId),
                      children: []
                    }),
                    jsxs("th", {
                      class: "th",
                      id: 'th3' + prefixId(id, formId),
                      children: []
                    })
                  ]
                })
              ]
            }),
            jsxs("tbody", {
              class: "tbody",
              id: 'tbody' + prefixId(id, formId),
              children: [
                jsxs("tr", {
                  class: "tr",
                  id: 'btr' + prefixId(id, formId),
                  children: [
                    jsxs("td", {
                      class: "td",
                      id: 'td1' + prefixId(id, formId),
                      children: []
                    }),
                    jsxs("td", {
                      class: "td",
                      id: 'td2' + prefixId(id, formId),
                      children: []
                    }),
                    jsxs("td", {
                      class: "td",
                      id: 'td3' + prefixId(id, formId),
                      children: []
                    })
                  ]
                })
              ]
            })
          ]
        })
    }), jsx(Description, {
      description: description
    }), jsx(Errors, {
      errors: errors,
      id: errorMessageId
    })
    ]
  });
}
Gridfield.config = {
  type: type$h,
  keyed: true,
  label: 'Grid',
  group: 'basic-input',
  emptyValue: [],
  sanitizeValue: ({
    value
  }) => {
    if (isArray(value) || isObject(value)) {
      // return '';
      return value;
    }
    if (typeof value === 'string') {
      return value.replace(/[\r\n\t]/g, ' ');
    }
    return String(value);
  },
  create: (options = {}) => ({
    ...options
  })
};


const type$f = 'email';
function Email(props) {
  const {
    disabled,
    errors = [],
    onBlur,
    field,
    readonly,
    value = ''
  } = props;
  const {
    description,
    id,
    label,
    appearance = {},
    validate = {}
  } = field;
  const {
    prefixAdorner,
    suffixAdorner
  } = appearance;
  const {
    required
  } = validate;
  const onChange = ({
    target
  }) => {
    props.onChange({
      field,
      value: target.value
    });
  };
  const {
    formId
  } = useContext(FormContext$1);
  const errorMessageId = errors.length === 0 ? undefined : `${prefixId(id, formId)}-error-message`;
  if (!field.validate) {
    field.validate = {};
  }
  field.validate.validationType = 'email';
  return jsxs("div", {
    class: formFieldClasses(type$f, {
      errors,
      disabled,
      readonly
    }),
    children: [jsx(Label, {
      id: prefixId(id, formId),
      label: label,
      required: required
    }), jsx(TemplatedInputAdorner, {
      disabled: disabled,
      readonly: readonly,
      pre: prefixAdorner,
      post: suffixAdorner,
      children: jsx("input", {
        class: "fjs-input",
        disabled: disabled,
        readOnly: readonly,
        id: prefixId(id, formId),
        onInput: onChange,
        onBlur: onBlur,
        type: "mail",
        value: value,
        "aria-describedby": errorMessageId
      })
    }), jsx(Description, {
      description: description
    }), jsx(Errors, {
      errors: errors,
      id: errorMessageId
    })]
  });
}
Email.config = {
  type: type$f,
  keyed: true,
  label: 'Email',
  group: 'basic-input',
  emptyValue: '',
  sanitizeValue: ({
    value
  }) => {
    if (isArray(value) || isObject(value)) {
      return '';
    }

    // sanitize newlines to spaces
    if (typeof value === 'string') {
      return value.replace(/[\r\n\t]/g, ' ');
    }
    return String(value);
  },
  create: (options = {}) => ({
    ...options
  })
};

const type$g = 'phone';
function Phone(props) {
  const {
    disabled,
    errors = [],
    onBlur,
    field,
    readonly,
    value = ''
  } = props;
  const {
    description,
    id,
    label,
    appearance = {},
    validate = {}
  } = field;
  const {
    prefixAdorner,
    suffixAdorner
  } = appearance;
  const {
    required
  } = validate;
  const onChange = ({
    target
  }) => {

    props.onChange({
      field,
      value: target.value
    });
  };
  const {
    formId
  } = useContext(FormContext$1);
  const errorMessageId = errors.length === 0 ? undefined : `${prefixId(id, formId)}-error-message`;
  if (!field.validate) {
    field.validate = {};
  }
  field.validate.validationType = 'phone';
  return jsxs("div", {
    class: formFieldClasses(type$g, {
      errors,
      disabled,
      readonly
    }),
    children: [jsx(Label, {
      id: prefixId(id, formId),
      label: label,
      required: required
    }), jsx(TemplatedInputAdorner, {
      disabled: disabled,
      readonly: readonly,
      pre: prefixAdorner,
      post: suffixAdorner,
      children: jsx("input", {
        class: "fjs-input",
        disabled: disabled,
        readOnly: readonly,
        id: prefixId(id, formId),
        onKeyDown: (e) => {
          phoneOnlyMask(e, value)
        },
        onInput: onChange,
        onBlur: onBlur,
        type: "phone",
        value: value,
        "aria-describedby": errorMessageId
      })
    }), jsx(Description, {
      description: description
    }), jsx(Errors, {
      errors: errors,
      id: errorMessageId
    })]
  });
}
Phone.config = {
  type: type$g,
  keyed: true,
  label: 'Phone',
  group: 'basic-input',
  emptyValue: '',
  sanitizeValue: ({
    value
  }) => {
    if (isArray(value) || isObject(value)) {
      return '';
    }

    // sanitize newlines to spaces
    if (typeof value === 'string') {
      return value.replace(/[\r\n\t]/g, ' ');
    }
    return String(value);
  },
  create: (options = {}) => ({
    ...options
  })
};

function phoneOnlyMask(e, value) {
  const regex = new RegExp("^[0-9]+$");
  //var str = String.fromCharCode(!e.charCode ? e.which : e.charCode);
  if (regex.test(e.key) && value.length < 15) {
    return true;
  }
  //backspace, enter and arrow keys
  if ([8, 37, 38, 39, 40, 13].includes(e.which)) {
    return true;
  }
  e.preventDefault();
  return false;
}

const type = 'textarea';
function Textarea(props) {
  const {
    disabled,
    errors = [],
    onBlur,
    field,
    readonly,
    value = ''
  } = props;
  const {
    description,
    id,
    label,
    validate = {}
  } = field;
  const {
    required
  } = validate;
  const textareaRef = useRef();
  const onInput = ({
    target
  }) => {
    props.onChange({
      field,
      value: target.value
    });
  };
  useLayoutEffect(() => {
    autoSizeTextarea(textareaRef.current);
  }, [value]);
  useEffect(() => {
    autoSizeTextarea(textareaRef.current);
  }, []);
  const {
    formId
  } = useContext(FormContext$1);
  const errorMessageId = errors.length === 0 ? undefined : `${prefixId(id, formId)}-error-message`;
  return jsxs("div", {
    class: formFieldClasses(type, {
      errors,
      disabled,
      readonly
    }),
    children: [jsx(Label, {
      id: prefixId(id, formId),
      label: label,
      required: required
    }), jsx("textarea", {
      class: "fjs-textarea",
      disabled: disabled,
      readonly: readonly,
      id: prefixId(id, formId),
      onInput: onInput,
      onBlur: onBlur,
      value: value,
      ref: textareaRef,
      "aria-describedby": errorMessageId
    }), jsx(Description, {
      description: description
    }), jsx(Errors, {
      errors: errors,
      id: errorMessageId
    })]
  });
}
Textarea.config = {
  type,
  keyed: true,
  label: 'Long Text',
  group: 'basic-input',
  emptyValue: '',
  sanitizeValue: ({
    value
  }) => isArray(value) || isObject(value) ? '' : String(value),
  create: (options = {}) => ({
    ...options
  })
};
const autoSizeTextarea = textarea => {
  // Ensures the textarea shrinks back, and improves resizing behavior consistency
  textarea.style.height = '0px';
  const computed = window.getComputedStyle(textarea);
  const heightFromLines = () => {
    const lineHeight = parseInt(computed.getPropertyValue('line-height').replace('px', '')) || 0;
    const lines = textarea.value ? textarea.value.toString().split('\n').length : 0;
    return lines * lineHeight;
  };
  const calculatedHeight = parseInt(computed.getPropertyValue('border-top-width')) + parseInt(computed.getPropertyValue('padding-top')) + (textarea.scrollHeight || heightFromLines()) + parseInt(computed.getPropertyValue('padding-bottom')) + parseInt(computed.getPropertyValue('border-bottom-width'));
  const minHeight = 75;
  const maxHeight = 350;
  const displayHeight = Math.max(Math.min(calculatedHeight || 0, maxHeight), minHeight);
  textarea.style.height = `${displayHeight}px`;

  // Overflow is hidden by default to hide scrollbar flickering
  textarea.style.overflow = calculatedHeight > maxHeight ? 'visible' : 'hidden';
};

var _path$c;
function _extends$e() { _extends$e = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$e.apply(this, arguments); }
var SvgButton = function SvgButton(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$e({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$c || (_path$c = /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M45 17a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V20a3 3 0 0 1 3-3h36zm-9 8.889H18v2.222h18v-2.222z"
  })));
};
var ButtonIcon = SvgButton;


var SvgCheckbox = function SvgCheckbox() {
  return jsx("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 25 24",
    width: "25",
    height: "36",
    fill: "none",
    style: "vertical-align:middle; margin: 0 auto",
    children:
      jsx("path", {
        id: 'Icon',
        stroke: "#666666",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        d: "M8 12L11 15L17 9M8.3 21H16.7C18.3802 21 19.2202 21 19.862 20.673C20.4265 20.3854 20.8854 19.9265 21.173 19.362C21.5 18.7202 21.5 17.8802 21.5 16.2V7.8C21.5 6.11984 21.5 5.27976 21.173 4.63803C20.8854 4.07354 20.4265 3.6146 19.862 3.32698C19.2202 3 18.3802 3 16.7 3H8.3C6.61984 3 5.77976 3 5.13803 3.32698C4.57354 3.6146 4.1146 4.07354 3.82698 4.63803C3.5 5.27976 3.5 6.11984 3.5 7.8V16.2C3.5 17.8802 3.5 18.7202 3.82698 19.362C4.1146 19.9265 4.57354 20.3854 5.13803 20.673C5.77976 21 6.61984 21 8.3 21Z"
      })
  });
}
var CheckboxIcon = SvgCheckbox;


var SvgChecklist = function SvgChecklist() {
  return jsx("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 25 24",
    width: "25",
    height: "36",
    fill: "none",
    style: "vertical-align:middle; margin: 0 auto",
    children:
      jsx("path", {
        id: 'Icon',
        stroke: "#666666",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        d: "M8 12L11 15L17 9M8.3 21H16.7C18.3802 21 19.2202 21 19.862 20.673C20.4265 20.3854 20.8854 19.9265 21.173 19.362C21.5 18.7202 21.5 17.8802 21.5 16.2V7.8C21.5 6.11984 21.5 5.27976 21.173 4.63803C20.8854 4.07354 20.4265 3.6146 19.862 3.32698C19.2202 3 18.3802 3 16.7 3H8.3C6.61984 3 5.77976 3 5.13803 3.32698C4.57354 3.6146 4.1146 4.07354 3.82698 4.63803C3.5 5.27976 3.5 6.11984 3.5 7.8V16.2C3.5 17.8802 3.5 18.7202 3.82698 19.362C4.1146 19.9265 4.57354 20.3854 5.13803 20.673C5.77976 21 6.61984 21 8.3 21Z"
      })
  });
}
var ChecklistIcon = SvgChecklist;


var SvgDatetime = function SvgDatetime() {
  return jsxs("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 25 24",
    width: "25",
    height: "36",
    fill: "none",
    style: "vertical-align:middle; margin: 0 auto",
    children: [
      jsx("path", {
        stroke: "#666666",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        d: "M21.5 10H3.5M16.5 2V6M8.5 2V6M8.3 22H16.7C18.3802 22 19.2202 22 19.862 21.673C20.4265 21.3854 20.8854 20.9265 21.173 20.362C21.5 19.7202 21.5 18.8802 21.5 17.2V8.8C21.5 7.11984 21.5 6.27976 21.173 5.63803C20.8854 5.07354 20.4265 4.6146 19.862 4.32698C19.2202 4 18.3802 4 16.7 4H8.3C6.61984 4 5.77976 4 5.13803 4.32698C4.57354 4.6146 4.1146 5.07354 3.82698 5.63803C3.5 6.27976 3.5 7.11984 3.5 8.8V17.2C3.5 18.8802 3.5 19.7202 3.82698 20.362C4.1146 20.9265 4.57354 21.3854 5.13803 21.673C5.77976 22 6.61984 22 8.3 22Z"
      }),
      jsx("path", {
        stroke: "#666666",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        d: "M12 13.5V17.25L15 18.5"
      })
    ]
  });
}
var DatetimeIcon = SvgDatetime;


var _path$9, _path2$2;
function _extends$a() { _extends$a = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$a.apply(this, arguments); }
var SvgTaglist = function SvgTaglist(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$a({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$9 || (_path$9 = /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M45 16a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V19a3 3 0 0 1 3-3h36Zm0 2H9a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h36a1 1 0 0 0 1-1V19a1 1 0 0 0-1-1Z"
  })), _path2$2 || (_path2$2 = /*#__PURE__*/React.createElement("path", {
    d: "M11 22a1 1 0 0 1 1-1h19a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H12a1 1 0 0 1-1-1V22Z"
  })));
};
var TaglistIcon = SvgTaglist;

var _rect, _rect2, _rect3;
function _extends$9() { _extends$9 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$9.apply(this, arguments); }
var SvgForm = function SvgForm(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$9({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54
  }, props), _rect || (_rect = /*#__PURE__*/React.createElement("rect", {
    width: 24,
    height: 4,
    x: 15,
    y: 17,
    rx: 1
  })), _rect2 || (_rect2 = /*#__PURE__*/React.createElement("rect", {
    width: 24,
    height: 4,
    x: 15,
    y: 25,
    rx: 1
  })), _rect3 || (_rect3 = /*#__PURE__*/React.createElement("rect", {
    width: 13,
    height: 4,
    x: 15,
    y: 33,
    rx: 1
  })));
};
var FormIcon = SvgForm;


var SvgGroup = function SvgGroup() {
  return jsxs("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 25 24",
    width: "25",
    height: "36",
    fill: "none",
    style: "vertical-align:middle; margin: 0 auto",
    children: [
      jsx("rect", {
        x: "4.25",
        y: "4.43994",
        width: "16.5",
        height: "6",
        rx: "2.25",
        stroke: "#666666",
        strokeWidth: "1.5"
      }),
      jsx("path", {
        fill: "#666666",
        d: "M5.1875 13.7524C5.1875 13.4418 5.43934 13.1899 5.75 13.1899H6.875C7.18566 13.1899 7.4375 13.4418 7.4375 13.7524C7.4375 14.0631 7.18566 14.3149 6.875 14.3149H5.75C5.43934 14.3149 5.1875 14.0631 5.1875 13.7524Z"
      }),
      jsx("path", {
        fill: "#666666",
        d: "M8.1875 13.7524C8.1875 13.4418 8.43934 13.1899 8.75 13.1899H9.875C10.1857 13.1899 10.4375 13.4418 10.4375 13.7524C10.4375 14.0631 10.1857 14.3149 9.875 14.3149H8.75C8.43934 14.3149 8.1875 14.0631 8.1875 13.7524Z"
      }),
      jsx("path", {
        fill: "#666666",
        d: "M11.1875 13.7524C11.1875 13.4418 11.4393 13.1899 11.75 13.1899H12.875C13.1857 13.1899 13.4375 13.4418 13.4375 13.7524C13.4375 14.0631 13.1857 14.3149 12.875 14.3149H11.75C11.4393 14.3149 11.1875 14.0631 11.1875 13.7524Z"
      }),
      jsx("path", {
        fill: "#666666",
        d: "M14.1875 13.7524C14.1875 13.4418 14.4393 13.1899 14.75 13.1899H15.875C16.1857 13.1899 16.4375 13.4418 16.4375 13.7524C16.4375 14.0631 16.1857 14.3149 15.875 14.3149H14.75C14.4393 14.3149 14.1875 14.0631 14.1875 13.7524Z"
      }),
      jsx("path", {
        fill: "#666666",
        d: "M17.1875 13.7524C17.1875 13.4418 17.4393 13.1899 17.75 13.1899H18.875C19.1857 13.1899 19.4375 13.4418 19.4375 13.7524C19.4375 14.0631 19.1857 14.3149 18.875 14.3149H17.75C17.4393 14.3149 17.1875 14.0631 17.1875 13.7524Z"
      }),
      jsx("path", {
        fill: "#666666",
        d: "M5.1875 19.7524C5.1875 19.4418 5.43934 19.1899 5.75 19.1899H6.875C7.18566 19.1899 7.4375 19.4418 7.4375 19.7524C7.4375 20.0631 7.18566 20.3149 6.875 20.3149H5.75C5.43934 20.3149 5.1875 20.0631 5.1875 19.7524Z"
      }),
      jsx("path", {
        fill: "#666666",
        d: "M8.1875 19.7524C8.1875 19.4418 8.43934 19.1899 8.75 19.1899H9.875C10.1857 19.1899 10.4375 19.4418 10.4375 19.7524C10.4375 20.0631 10.1857 20.3149 9.875 20.3149H8.75C8.43934 20.3149 8.1875 20.0631 8.1875 19.7524Z"
      }),
      jsx("path", {
        fill: "#666666",
        d: "M11.1875 19.7524C11.1875 19.4418 11.4393 19.1899 11.75 19.1899H12.875C13.1857 19.1899 13.4375 19.4418 13.4375 19.7524C13.4375 20.0631 13.1857 20.3149 12.875 20.3149H11.75C11.4393 20.3149 11.1875 20.0631 11.1875 19.7524Z"
      }),
      jsx("path", {
        fill: "#666666",
        d: "M14.1875 19.7524C14.1875 19.4418 14.4393 19.1899 14.75 19.1899H15.875C16.1857 19.1899 16.4375 19.4418 16.4375 19.7524C16.4375 20.0631 16.1857 20.3149 15.875 20.3149H14.75C14.4393 20.3149 14.1875 20.0631 14.1875 19.7524Z"
      }),
      jsx("path", {
        fill: "#666666",
        d: "M17.1875 19.7524C17.1875 19.4418 17.4393 19.1899 17.75 19.1899H18.875C19.1857 19.1899 19.4375 19.4418 19.4375 19.7524C19.4375 20.0631 19.1857 20.3149 18.875 20.3149H17.75C17.4393 20.3149 17.1875 20.0631 17.1875 19.7524Z"
      }),
      jsx("path", {
        fill: "#666666",
        d: "M20.5625 19.5632C20.2518 19.5632 20 19.3114 20 19.0007V17.8757C20 17.565 20.2518 17.3132 20.5625 17.3132C20.8732 17.3132 21.125 17.565 21.125 17.8757V19.0007C21.125 19.3114 20.8732 19.5632 20.5625 19.5632Z"
      }),
      jsx("path", {
        fill: "#666666",
        d: "M4.0625 19.5632C3.75184 19.5632 3.5 19.3114 3.5 19.0007L3.5 17.8757C3.5 17.565 3.75184 17.3132 4.0625 17.3132C4.37316 17.3132 4.625 17.565 4.625 17.8757L4.625 19.0007C4.625 19.3114 4.37316 19.5632 4.0625 19.5632Z"
      }),
      jsx("path", {
        fill: "#666666",
        d: "M20.5625 16.5632C20.2518 16.5632 20 16.3114 20 16.0007V14.8757C20 14.565 20.2518 14.3132 20.5625 14.3132C20.8732 14.3132 21.125 14.565 21.125 14.8757V16.0007C21.125 16.3114 20.8732 16.5632 20.5625 16.5632Z"
      }),
      jsx("path", {
        fill: "#666666",
        d: "M4.0625 16.5632C3.75184 16.5632 3.5 16.3114 3.5 16.0007L3.5 14.8757C3.5 14.565 3.75184 14.3132 4.0625 14.3132C4.37316 14.3132 4.625 14.565 4.625 14.8757L4.625 16.0007C4.625 16.3114 4.37316 16.5632 4.0625 16.5632Z"
      })
    ]
  });
}
var GroupIcon = SvgGroup;


var SvgNumber = function SvgNumber() {
  return jsx("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 21 20",
    width: "21",
    height: "36",
    fill: "none",
    style: "vertical-align:middle; margin: 0 auto",
    children:
      jsxs("g", {
        id: "email-01",
        children: [
          jsx("path", {
            id: 'Icon',
            stroke: "#666666",
            strokeWidth: "1.5",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            d: "M14.7 1H6.3C4.61984 1 3.77976 1 3.13803 1.39238C2.57354 1.73752 2.1146 2.28825 1.82698 2.96563C1.5 3.73572 1.5 4.74381 1.5 6.76V14.2C1.5 15.316 1.5 15.8739 1.60222 16.3317C1.87962 17.5741 2.68827 18.5445 3.72354 18.8773C4.10504 19 4.57001 19 5.49996 19H5.5H12.1837H14.7C16.3802 19 17.2202 19 17.862 18.6076C18.4265 18.2625 18.8854 17.7118 19.173 17.0344C19.5 16.2643 19.5 15.2562 19.5 13.24V6.76C19.5 4.74381 19.5 3.73572 19.173 2.96563C18.8854 2.28825 18.4265 1.73752 17.862 1.39238C17.2202 1 16.3802 1 14.7 1Z"
          }),
          jsx("path", {
            id: '2',
            fill: "#666666",
            d: "M9.01401 8.34851C8.88492 8.53427 8.73002 8.64734 8.54929 8.68772C8.37718 8.72811 8.20936 8.71599 8.04585 8.65138C7.88234 8.58677 7.74465 8.48177 7.63278 8.33639C7.52951 8.18294 7.48648 8.00929 7.50369 7.81545C7.51229 7.68623 7.54672 7.54489 7.60696 7.39143C7.6672 7.23798 7.74035 7.0926 7.82641 6.9553C7.92107 6.80992 8.02004 6.67666 8.12331 6.55551C8.23518 6.42628 8.34706 6.31725 8.45893 6.22841C8.66547 6.07495 8.89783 5.94169 9.156 5.82862C9.42278 5.71554 9.69817 5.63074 9.98216 5.5742C10.2748 5.51767 10.5631 5.49344 10.847 5.50151C11.1396 5.50959 11.4107 5.54997 11.6603 5.62266C12.3488 5.82458 12.8823 6.1436 13.261 6.57974C13.6396 7.01587 13.829 7.58123 13.829 8.27582C13.829 8.60696 13.7945 8.90579 13.7257 9.17232C13.6654 9.43077 13.5536 9.68114 13.3901 9.92344C13.2352 10.1657 13.0243 10.4121 12.7575 10.6624C12.4994 10.9128 12.1766 11.1874 11.7894 11.4863C11.6603 11.5913 11.5269 11.6962 11.3892 11.8012C11.2515 11.9062 11.1138 12.0112 10.9761 12.1162C10.9331 12.1485 10.8513 12.197 10.7309 12.2616C10.6104 12.3262 10.5028 12.3908 10.4081 12.4554C10.3135 12.5201 10.2575 12.5806 10.2403 12.6372C10.2231 12.6937 10.292 12.726 10.4469 12.7341C10.6362 12.7502 10.7868 12.7543 10.8987 12.7462C11.0106 12.7381 11.1612 12.7341 11.3505 12.7341C11.5742 12.7341 11.7937 12.73 12.0088 12.722C12.224 12.7139 12.4391 12.7179 12.6543 12.7341C12.7403 12.7422 12.835 12.7462 12.9383 12.7462C13.0415 12.7381 13.1448 12.7381 13.2481 12.7462C13.3513 12.7462 13.4503 12.7583 13.545 12.7825C13.6396 12.7987 13.7214 12.835 13.7902 12.8916C13.8591 12.9481 13.9107 13.0248 13.9451 13.1218C13.9796 13.2187 13.9968 13.3237 13.9968 13.4367C14.0054 13.5417 13.9968 13.6467 13.971 13.7517C13.9451 13.8487 13.9021 13.9254 13.8419 13.9819C13.73 14.1031 13.5923 14.1636 13.4288 14.1636C13.2653 14.1556 13.1104 14.1515 12.9641 14.1515H8.32985C8.24379 14.1515 8.14912 14.1556 8.04585 14.1636C7.95119 14.1717 7.86513 14.1636 7.78768 14.1394C7.63278 14.099 7.55532 14.0223 7.55532 13.9092C7.56393 13.7962 7.56823 13.679 7.56823 13.5579C7.56823 13.356 7.61987 13.1702 7.72314 13.0006C7.82641 12.8229 7.95549 12.6614 8.1104 12.516C8.27391 12.3626 8.44602 12.2212 8.62675 12.092C8.80747 11.9628 8.97528 11.8376 9.13019 11.7164C9.35394 11.5307 9.5949 11.3449 9.85307 11.1592C10.1112 10.9734 10.3565 10.7876 10.5889 10.6019C10.8901 10.3676 11.1439 10.1536 11.3505 9.95978C11.5656 9.76594 11.7377 9.58422 11.8668 9.41461C11.9959 9.24501 12.0906 9.07944 12.1508 8.9179C12.2111 8.7483 12.2412 8.57061 12.2412 8.38485C12.2412 7.97295 12.1078 7.65796 11.841 7.43989C11.5742 7.21375 11.2343 7.10068 10.8212 7.10068C10.52 7.10068 10.236 7.16125 9.96925 7.2824C9.71108 7.40355 9.49593 7.58123 9.32382 7.81545C9.27218 7.90429 9.22055 7.99718 9.16891 8.09409C9.12588 8.18294 9.07425 8.26774 9.01401 8.34851Z"
          })
        ]
      })
  });
}
var NumberIcon = SvgNumber;


var SvgRadio = function SvgRadio() {
  return jsxs("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 25 24",
    width: "25",
    height: "36",
    fill: "none",
    style: "vertical-align:middle; margin: 0 auto",
    children: [
      jsx("circle", {
        stroke: "#666666",
        strokeWidth: "1.5",
        cx: "12.5",
        cy: "11.8721",
        r: "4.25"
      }),
      jsx("circle", {
        stroke: "#666666",
        strokeWidth: "1.5",
        cx: "12.5",
        cy: "11.8721",
        r: "9.25"
      })
    ]
  });
}
var RadioIcon = SvgRadio;


var SvgSelect = function SvgSelect() {
  return jsxs("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 25 24",
    width: "25",
    height: "36",
    fill: "none",
    style: "vertical-align:middle; margin: 0 auto",
    children: [
      jsx("path", {
        id: 'Icon',
        stroke: "#666666",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        d: "M16.7 3H8.3C6.61984 3 5.77976 3 5.13803 3.21799C4.57354 3.40973 4.1146 3.71569 3.82698 4.09202C3.5 4.51984 3.5 5.0799 3.5 6.2V10.3333C3.5 10.9533 3.5 11.2633 3.60222 11.5176C3.87962 12.2078 4.68827 12.7469 5.72354 12.9319C6.10504 13 6.57002 13 7.49996 13H7.5H14.1837H16.7H16.7C18.3802 13 19.2202 13 19.862 12.782C20.4265 12.5903 20.8854 12.2843 21.173 11.908C21.5 11.4802 21.5 10.9201 21.5 9.8V6.2C21.5 5.0799 21.5 4.51984 21.173 4.09202C20.8854 3.71569 20.4265 3.40973 19.862 3.21799C19.2202 3 18.3802 3 16.7 3Z"
      }),
      jsx("path", {
        id: 'Icon',
        stroke: "#666666",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        d: "M12.5 6.63623L15.5 9.3635L18.5 6.63623"
      }),
      jsx("path", {
        id: 'Icon',
        stroke: "#666666",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        d: "M3.5 17H13.5"
      }),
      jsx("path", {
        id: 'Icon',
        stroke: "#666666",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        d: "M3.5 21H10.5"
      })
    ]
  });
}
var SelectIcon = SvgSelect;


var _path$4, _path2$1;
function _extends$4() { _extends$4 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$4.apply(this, arguments); }
var SvgSpacer = function SvgSpacer(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$4({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$4 || (_path$4 = /*#__PURE__*/React.createElement("path", {
    stroke: "currentcolor",
    strokeLinecap: "square",
    strokeWidth: 2,
    d: "M9 23h36M9 31h36"
  })), _path2$1 || (_path2$1 = /*#__PURE__*/React.createElement("path", {
    stroke: "currentcolor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 2,
    d: "m23 17 4-4 4 4M31 37l-4 4-4-4"
  })));
};
var SpacerIcon = SvgSpacer;

var _path$3;
function _extends$3() { _extends$3 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$3.apply(this, arguments); }
var SvgText = function SvgText(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$3({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$3 || (_path$3 = /*#__PURE__*/React.createElement("path", {
    d: "M20.58 33.77h-3l-1.18-3.08H11l-1.1 3.08H7l5.27-13.54h2.89zm-5-5.36-1.86-5-1.83 5zM22 20.23h5.41a15.47 15.47 0 0 1 2.4.14 3.42 3.42 0 0 1 1.41.55 3.47 3.47 0 0 1 1 1.14 3 3 0 0 1 .42 1.58 3.26 3.26 0 0 1-1.91 2.94 3.63 3.63 0 0 1 1.91 1.22 3.28 3.28 0 0 1 .66 2 4 4 0 0 1-.43 1.8 3.63 3.63 0 0 1-1.09 1.4 3.89 3.89 0 0 1-1.83.65q-.69.07-3.3.09H22zm2.73 2.25v3.13h3.8a1.79 1.79 0 0 0 1.1-.49 1.41 1.41 0 0 0 .41-1 1.49 1.49 0 0 0-.35-1 1.54 1.54 0 0 0-1-.48c-.27 0-1.05-.05-2.34-.05zm0 5.39v3.62h2.57a11.52 11.52 0 0 0 1.88-.09 1.65 1.65 0 0 0 1-.54 1.6 1.6 0 0 0 .38-1.14 1.75 1.75 0 0 0-.29-1 1.69 1.69 0 0 0-.86-.62 9.28 9.28 0 0 0-2.41-.23zm19.62.92 2.65.84a5.94 5.94 0 0 1-2 3.29A5.74 5.74 0 0 1 41.38 34a5.87 5.87 0 0 1-4.44-1.84 7.09 7.09 0 0 1-1.73-5A7.43 7.43 0 0 1 37 21.87 6 6 0 0 1 41.54 20a5.64 5.64 0 0 1 4 1.47A5.33 5.33 0 0 1 47 24l-2.7.65a2.8 2.8 0 0 0-2.86-2.27A3.09 3.09 0 0 0 39 23.42a5.31 5.31 0 0 0-.93 3.5 5.62 5.62 0 0 0 .93 3.65 3 3 0 0 0 2.4 1.09 2.72 2.72 0 0 0 1.82-.66 4 4 0 0 0 1.13-2.21z"
  })));
};
var TextIcon = SvgText;

var SvgTextfield = function SvgTextfield() {
  return jsx("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 21 20",
    width: "21",
    height: "36",
    fill: "none",
    style: "vertical-align:middle; margin: 0 auto",
    children:
      jsxs("g", {
        id: "SvgTextfield_01",
        children: [
          jsx("path", {
            id: 'Icon',
            stroke: "#666666",
            strokeWidth: "1.5",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            d: "M14.7 1H6.3C4.61984 1 3.77976 1 3.13803 1.39238C2.57354 1.73752 2.1146 2.28825 1.82698 2.96563C1.5 3.73572 1.5 4.74381 1.5 6.76V14.2C1.5 15.316 1.5 15.8739 1.60222 16.3317C1.87962 17.5741 2.68827 18.5445 3.72354 18.8773C4.10504 19 4.57001 19 5.49996 19H5.5H12.1837H14.7C16.3802 19 17.2202 19 17.862 18.6076C18.4265 18.2625 18.8854 17.7118 19.173 17.0344C19.5 16.2643 19.5 15.2562 19.5 13.24V6.76C19.5 4.74381 19.5 3.73572 19.173 2.96563C18.8854 2.28825 18.4265 1.73752 17.862 1.39238C17.2202 1 16.3802 1 14.7 1Z"
          }),
          jsx("path", {
            id: 'Icon',
            stroke: "#666666",
            strokeWidth: "1.5",
            strokeLinecap: "round",
            d: "M7.5 6.75H13.5M10.5 6.75L10.5 13.25"
          })
        ]
      })
  });
}
var TextfieldIcon = SvgTextfield;


var SvgTextarea = function SvgTextarea() {
  return jsxs("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 25 24",
    width: "25",
    height: "36",
    fill: "none",
    style: "vertical-align:middle; margin: 0 auto",
    children: [
      jsx("path", {
        stroke: "#666666",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        d: "M16.7 3H8.3C6.61984 3 5.77976 3 5.13803 3.39238C4.57354 3.73752 4.1146 4.28825 3.82698 4.96563C3.5 5.73572 3.5 6.74381 3.5 8.76V16.2C3.5 17.316 3.5 17.8739 3.60222 18.3317C3.87962 19.5741 4.68827 20.5445 5.72354 20.8773C6.10504 21 6.57001 21 7.49996 21H7.5H14.1837H16.7C18.3802 21 19.2202 21 19.862 20.6076C20.4265 20.2625 20.8854 19.7118 21.173 19.0344C21.5 18.2643 21.5 17.2562 21.5 15.24V8.76C21.5 6.74381 21.5 5.73572 21.173 4.96563C20.8854 4.28825 20.4265 3.73752 19.862 3.39238C19.2202 3 18.3802 3 16.7 3Z"
      }),
      jsx("path", {
        stroke: "#666666",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        d: "M7.5 8H12.5"
      }),
      jsx("path", {
        stroke: "#666666",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        d: "M7.5 12H17.5"
      }),
      jsx("path", {
        stroke: "#666666",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        d: "M7.5 16H14.5"
      })
    ]
  });
}
var TextareaIcon = SvgTextarea;

var _path, _path2;
function _extends() { _extends = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }
var SvgImage = function SvgImage(props) {
  return /*#__PURE__*/React.createElement("svg", _extends({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path || (_path = /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M34.636 21.91A3.818 3.818 0 1 1 27 21.908a3.818 3.818 0 0 1 7.636 0Zm-2 0A1.818 1.818 0 1 1 29 21.908a1.818 1.818 0 0 1 3.636 0Z",
    clipRule: "evenodd"
  })), _path2 || (_path2 = /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M15 13a2 2 0 0 0-2 2v24a2 2 0 0 0 2 2h24a2 2 0 0 0 2-2V15a2 2 0 0 0-2-2H15Zm24 2H15v12.45l4.71-4.709a1.91 1.91 0 0 1 2.702 0l6.695 6.695 2.656-1.77a1.91 1.91 0 0 1 2.411.239L39 32.73V15ZM15 39v-8.754a.975.975 0 0 0 .168-.135l5.893-5.893 6.684 6.685a1.911 1.911 0 0 0 2.41.238l2.657-1.77 6.02 6.02c.052.051.108.097.168.135V39H15Z",
    clipRule: "evenodd"
  })));
};
var ImageIcon = SvgImage;

var SvgObstacle = function SvgObstacle(props) {
  return /*#__PURE__*/React.createElement("svg", _extends({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path || (_path = /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M34.636 21.91A3.818 3.818 0 1 1 27 21.908a3.818 3.818 0 0 1 7.636 0Zm-2 0A1.818 1.818 0 1 1 29 21.908a1.818 1.818 0 0 1 3.636 0Z",
    clipRule: "evenodd"
  })), _path2 || (_path2 = /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M15 13a2 2 0 0 0-2 2v24a2 2 0 0 0 2 2h24a2 2 0 0 0 2-2V15a2 2 0 0 0-2-2H15Zm24 2H15v12.45l4.71-4.709a1.91 1.91 0 0 1 2.702 0l6.695 6.695 2.656-1.77a1.91 1.91 0 0 1 2.411.239L39 32.73V15ZM15 39v-8.754a.975.975 0 0 0 .168-.135l5.893-5.893 6.684 6.685a1.911 1.911 0 0 0 2.41.238l2.657-1.77 6.02 6.02c.052.051.108.097.168.135V39H15Z",
    clipRule: "evenodd"
  })));
};
var ObstacleIcon = SvgObstacle;

var SvgMap = function SvgMap(props) {
  return /*#__PURE__*/React.createElement("svg", _extends({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path || (_path = /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M34.636 21.91A3.818 3.818 0 1 1 27 21.908a3.818 3.818 0 0 1 7.636 0Zm-2 0A1.818 1.818 0 1 1 29 21.908a1.818 1.818 0 0 1 3.636 0Z",
    clipRule: "evenodd"
  })), _path2 || (_path2 = /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M15 13a2 2 0 0 0-2 2v24a2 2 0 0 0 2 2h24a2 2 0 0 0 2-2V15a2 2 0 0 0-2-2H15Zm24 2H15v12.45l4.71-4.709a1.91 1.91 0 0 1 2.702 0l6.695 6.695 2.656-1.77a1.91 1.91 0 0 1 2.411.239L39 32.73V15ZM15 39v-8.754a.975.975 0 0 0 .168-.135l5.893-5.893 6.684 6.685a1.911 1.911 0 0 0 2.41.238l2.657-1.77 6.02 6.02c.052.051.108.097.168.135V39H15Z",
    clipRule: "evenodd"
  })));
};
var MapIcon = SvgMap;


var SvgFileupload = function SvgFileupload() {
  return jsx("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 25 24",
    width: "25",
    height: "36",
    fill: "none",
    style: "vertical-align:middle; margin: 0 auto",
    children:
      jsx("path", {
        id: 'Icon',
        stroke: "#666666",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        d: "M21.6527 10.8995L12.6371 19.9151C10.5869 21.9653 7.26275 21.9653 5.21249 19.9151C3.16224 17.8648 3.16224 14.5407 5.21249 12.4904L14.2281 3.47483C15.5949 2.108 17.811 2.108 19.1779 3.47483C20.5447 4.84167 20.5447 7.05775 19.1779 8.42458L10.5158 17.0866C9.83238 17.7701 8.72434 17.7701 8.04092 17.0866C7.3575 16.4032 7.3575 15.2952 8.04092 14.6118L15.6423 7.01037"
      })
  });
}
var FileuploadIcon = SvgFileupload;

var SvgGridfield = function SvgGridfield() {
  return jsxs("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    width: "24",
    height: "36",
    fill: "none",
    style: "vertical-align:middle; margin: 0 auto",
    children: [
      jsx("path", {
        id: 'Icon1',
        stroke: "#666666",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        d: "M22 8.52V3.98C22 2.57 21.36 2 19.77 2H15.73C14.14 2 13.5 2.57 13.5 3.98V8.51C13.5 9.93 14.14 10.49 15.73 10.49H19.77C21.36 10.5 22 9.93 22 8.52Z"
      }),
      jsx("path", {
        id: 'Icon2',
        stroke: "#666666",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        d: "M22 19.77V15.73C22 14.14 21.36 13.5 19.77 13.5H15.73C14.14 13.5 13.5 14.14 13.5 15.73V19.77C13.5 21.36 14.14 22 15.73 22H19.77C21.36 22 22 21.36 22 19.77Z"
      }),
      jsx("path", {
        id: 'Icon3',
        stroke: "#666666",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        d: "M10.5 8.52V3.98C10.5 2.57 9.86 2 8.27 2H4.23C2.64 2 2 2.57 2 3.98V8.51C2 9.93 2.64 10.49 4.23 10.49H8.27C9.86 10.5 10.5 9.93 10.5 8.52Z"
      }),
      jsx("path", {
        id: 'Icon4',
        stroke: "#666666",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        d: "M10.5 19.77V15.73C10.5 14.14 9.86 13.5 8.27 13.5H4.23C2.64 13.5 2 14.14 2 15.73V19.77C2 21.36 2.64 22 4.23 22H8.27C9.86 22 10.5 21.36 10.5 19.77Z"
      })
    ]
  });
}
var GridfieldIcon = SvgGridfield;


var SvgLatlong = function SvgLatlong() {
  return jsx("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 25 24",
    width: "25",
    height: "36",
    fill: "none",
    style: "vertical-align:middle; margin: 0 auto",
    children:
      jsx("g", {
        id: "marker-pin-01",
        children:
          jsxs("g", {
            id: "email-01",
            children: [
              jsx("path", {
                id: 'Icon',
                stroke: "#666666",
                strokeWidth: "1.5",
                strokeLinecap: "round",
                strokeLinejoin: "round",
                d: "M12.5 13C14.1569 13 15.5 11.6569 15.5 10C15.5 8.34315 14.1569 7 12.5 7C10.8431 7 9.5 8.34315 9.5 10C9.5 11.6569 10.8431 13 12.5 13Z"
              }),
              jsx("path", {
                id: 'Icon',
                stroke: "#666666",
                strokeWidth: "1.5",
                strokeLinecap: "round",
                strokeLinejoin: "round",
                d: "M12.5 22C16.5 18 20.5 14.4183 20.5 10C20.5 5.58172 16.9183 2 12.5 2C8.08172 2 4.5 5.58172 4.5 10C4.5 14.4183 8.5 18 12.5 22Z"
              }),
            ]
          })
      })
  });
}
var LatlongIcon = SvgLatlong;


var SvgEmail = function SvgEmail() {
  return jsx("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 25 24",
    width: "25",
    height: "36",
    fill: "none",
    style: "vertical-align:middle; margin: 0 auto",
    children:
      jsx("g", {
        id: "email-01",
        children:
          jsx("path", {
            id: 'Icon',
            stroke: "#666666",
            strokeWidth: "1.5",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            d: "M2.5 7L10.6649 12.7154C11.3261 13.1783 11.6567 13.4097 12.0163 13.4993C12.3339 13.5785 12.6661 13.5785 12.9837 13.4993C13.3433 13.4097 13.6739 13.1783 14.3351 12.7154L22.5 7M7.3 20H17.7C19.3802 20 20.2202 20 20.862 19.673C21.4265 19.3854 21.8854 18.9265 22.173 18.362C22.5 17.7202 22.5 16.8802 22.5 15.2V8.8C22.5 7.11984 22.5 6.27976 22.173 5.63803C21.8854 5.07354 21.4265 4.6146 20.862 4.32698C20.2202 4 19.3802 4 17.7 4H7.3C5.61984 4 4.77976 4 4.13803 4.32698C3.57354 4.6146 3.1146 5.07354 2.82698 5.63803C2.5 6.27976 2.5 7.11984 2.5 8.8V15.2C2.5 16.8802 2.5 17.7202 2.82698 18.362C3.1146 18.9265 3.57354 19.3854 4.13803 19.673C4.77976 20 5.61984 20 7.3 20Z"
          })
      })
  });
}
var EmailIcon = SvgEmail;


var SvgPhone = function SvgPhone() {
  return jsx("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 25 24",
    width: "25",
    height: "36",
    fill: "none",
    style: "vertical-align:middle; margin: 0 auto",
    children:
      jsx("g", {
        id: "phone-01",
        children:
          jsx("path", {
            id: 'Icon',
            stroke: "#666666",
            strokeWidth: "1.5",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            d: "M8.88028 8.85335C9.57627 10.303 10.5251 11.6616 11.7266 12.8632C12.9282 14.0648 14.2869 15.0136 15.7365 15.7096C15.8612 15.7694 15.9235 15.7994 16.0024 15.8224C16.2828 15.9041 16.627 15.8454 16.8644 15.6754C16.9313 15.6275 16.9884 15.5704 17.1027 15.4561C17.4523 15.1064 17.6271 14.9316 17.8029 14.8174C18.4658 14.3864 19.3204 14.3864 19.9833 14.8174C20.1591 14.9316 20.3339 15.1064 20.6835 15.4561L20.8783 15.6509C21.4098 16.1824 21.6755 16.4481 21.8198 16.7335C22.1069 17.301 22.1069 17.9713 21.8198 18.5389C21.6755 18.8242 21.4098 19.09 20.8783 19.6214L20.7207 19.779C20.1911 20.3087 19.9263 20.5735 19.5662 20.7757C19.1667 21.0001 18.5462 21.1615 18.088 21.1601C17.6751 21.1589 17.3928 21.0788 16.8284 20.9186C13.795 20.0576 10.9326 18.4332 8.54466 16.0452C6.15668 13.6572 4.53221 10.7948 3.67124 7.76144C3.51103 7.19699 3.43092 6.91477 3.4297 6.50182C3.42833 6.0436 3.58969 5.42311 3.81411 5.0236C4.01636 4.66357 4.28117 4.39876 4.8108 3.86913L4.96843 3.7115C5.49987 3.18006 5.7656 2.91433 6.05098 2.76999C6.61854 2.48292 7.2888 2.48292 7.85636 2.76999C8.14174 2.91433 8.40747 3.18006 8.93891 3.7115L9.13378 3.90637C9.48338 4.25597 9.65819 4.43078 9.77247 4.60655C10.2035 5.26945 10.2035 6.12403 9.77247 6.78692C9.65819 6.96269 9.48338 7.1375 9.13378 7.4871C9.01947 7.60142 8.96231 7.65857 8.91447 7.72538C8.74446 7.96281 8.68576 8.30707 8.76748 8.58743C8.79048 8.66632 8.82041 8.72866 8.88028 8.85335Z"
          })
      })
  });
}
var PhoneIcon = SvgPhone;


const iconsByType = type => {
  return {
    button: ButtonIcon,
    checkbox: CheckboxIcon,
    checklist: ChecklistIcon,
    columns: GroupIcon,
    datetime: DatetimeIcon,
    group: GroupIcon,
    image: ImageIcon,
    obstacle: ObstacleIcon,
    map: MapIcon,
    number: NumberIcon,
    radio: RadioIcon,
    select: SelectIcon,
    spacer: SpacerIcon,
    seperator: SpacerIcon,
    taglist: TaglistIcon,
    text: TextIcon,
    textfield: TextfieldIcon,
    textarea: TextareaIcon,
    latlong: LatlongIcon,
    email: EmailIcon,
    phone: PhoneIcon,
    fileupload: FileuploadIcon,
    gridfield: GridfieldIcon,
    default: FormIcon
  }[type];
};

const formFields = [Button, FormComponent$1, Text, Spacer, Seperator, Taglist, Textfield, Textarea, Numberfield, Phone, Latlong, Email, Select, Datetime, Radio, Checklist, Checkbox, Fileupload, Image, Group, Gridfield, Obstacle, Map];

class FormFields {
  constructor() {
    this._formFields = {};
    formFields.forEach(formField => {
      this.register(formField.config.type, formField);
    });
  }
  register(type, formField) {
    this._formFields[type] = formField;
  }
  get(type) {
    return this._formFields[type];
  }
}

function Renderer(config, eventBus, form, injector) {
  const App = () => {
    const [state, setState] = useState(form._getState());
    const formContext = {
      getService(type, strict = true) {
        return injector.get(type, strict);
      },
      formId: form._id
    };
    eventBus.on('changed', newState => {
      setState(newState);
    });
    const onChange = useCallback(update => form._update(update), [form]);
    const {
      properties
    } = state;
    const {
      readOnly
    } = properties;
    const onSubmit = useCallback(() => {
      if (!readOnly) {
        form.submit();
      }
    }, [form, readOnly]);
    const onReset = useCallback(() => form.reset(), [form]);
    const {
      schema
    } = state;
    if (!schema) {
      return null;
    }
    return jsx(FormContext$1.Provider, {
      value: formContext,
      children: jsx(FormComponent, {
        onChange: onChange,
        onSubmit: onSubmit,
        onReset: onReset
      })
    });
  };
  const {
    container
  } = config;
  eventBus.on('form.init', () => {
    render(jsx(App, {}), container);
  });
  eventBus.on('form.destroy', () => {
    render(null, container);
  });
}
Renderer.$inject = ['config.renderer', 'eventBus', 'form', 'injector'];

var renderModule = {
  __init__: ['formFields', 'renderer'],
  formFields: ['type', FormFields],
  renderer: ['type', Renderer]
};

var core = {
  __depends__: [renderModule],
  eventBus: ['type', EventBus],
  importer: ['type', Importer],
  fieldFactory: ['type', FieldFactory],
  formFieldRegistry: ['type', FormFieldRegistry],
  pathRegistry: ['type', PathRegistry],
  formLayouter: ['type', FormLayouter],
  validator: ['type', Validator]
};

/**
 * @typedef { import('./types').Injector } Injector
 * @typedef { import('./types').Data } Data
 * @typedef { import('./types').Errors } Errors
 * @typedef { import('./types').Schema } Schema
 * @typedef { import('./types').FormProperties } FormProperties
 * @typedef { import('./types').FormProperty } FormProperty
 * @typedef { import('./types').FormEvent } FormEvent
 * @typedef { import('./types').FormOptions } FormOptions
 *
 * @typedef { {
 *   data: Data,
 *   initialData: Data,
 *   errors: Errors,
 *   properties: FormProperties,
 *   schema: Schema
 * } } State
 *
 * @typedef { (type:FormEvent, priority:number, handler:Function) => void } OnEventWithPriority
 * @typedef { (type:FormEvent, handler:Function) => void } OnEventWithOutPriority
 * @typedef { OnEventWithPriority & OnEventWithOutPriority } OnEventType
 */

const ids = new Ids([32, 36, 1]);

/**
 * The form.
 */
class Form {
  /**
   * @constructor
   * @param {FormOptions} options
   */
  constructor(options = {}) {
    /**
     * @public
     * @type {OnEventType}
     */
    this.on = this._onEvent;

    /**
     * @public
     * @type {String}
     */
    this._id = ids.next();

    /**
     * @private
     * @type {Element}
     */
    this._container = createFormContainer();
    const {
      container,
      injector = this._createInjector(options, this._container),
      properties = {}
    } = options;

    /**
     * @private
     * @type {State}
     */
    this._state = {
      initialData: null,
      data: null,
      properties,
      errors: {},
      schema: null
    };
    this.get = injector.get;
    this.invoke = injector.invoke;
    this.get('eventBus').fire('form.init');
    if (container) {
      this.attachTo(container);
    }
  }
  clear() {
    // clear form services
    this._emit('diagram.clear');

    // clear diagram services (e.g. EventBus)
    this._emit('form.clear');
  }

  /**
   * Destroy the form, removing it from DOM,
   * if attached.
   */
  destroy() {
    // destroy form services
    this.get('eventBus').fire('form.destroy');

    // destroy diagram services (e.g. EventBus)
    this.get('eventBus').fire('diagram.destroy');
    this._detach(false);
  }

  /**
   * Open a form schema with the given initial data.
   *
   * @param {Schema} schema
   * @param {Data} [data]
   *
   * @return Promise<{ warnings: Array<any> }>
   */
  importSchema(schema, data = {}) {
    return new Promise((resolve, reject) => {
      try {
        this.clear();
        const {
          schema: importedSchema,
          warnings
        } = this.get('importer').importSchema(schema);
        const initializedData = this._initializeFieldData(clone(data));
        this._setState({
          data: initializedData,
          errors: {},
          schema: importedSchema,
          initialData: clone(initializedData)
        });
        this._emit('import.done', {
          warnings
        });
        return resolve({
          warnings
        });
      } catch (error) {
        this._emit('import.done', {
          error,
          warnings: error.warnings || []
        });
        return reject(error);
      }
    });
  }

  /**
   * Submit the form, triggering all field validations.
   *
   * @returns { { data: Data, errors: Errors } }
   */
  submit() {
    const {
      properties
    } = this._getState();
    if (properties.readOnly || properties.disabled) {
      throw new Error('form is read-only');
    }
    const data = this._getSubmitData();
    const errors = this.validate();
    const filteredErrors = this._applyConditions(errors, data);
    const result = {
      data,
      errors: filteredErrors
    };
    this._emit('submit', result);
    return result;
  }
  reset() {
    this._emit('reset');
    this._setState({
      data: clone(this._state.initialData),
      errors: {}
    });
  }

  /**
   * @returns {Errors}
   */
  validate() {
    const formFieldRegistry = this.get('formFieldRegistry'),
      pathRegistry = this.get('pathRegistry'),
      validator = this.get('validator');
    const {
      data
    } = this._getState();

    const allFields = formFieldRegistry.getAll();
    const filteredFields = formFieldRegistry.getAll().filter(x => !(allFields.some(s => s.hide && (x._parent == s.id)))).filter(x => !x.hide);

    const errors = filteredFields.reduce((errors, field) => {
      const {
        disabled
      } = field;
      if (disabled) {
        return errors;
      }
      const value = get(data, pathRegistry.getValuePath(field));
      const fieldErrors = validator.validateField(field, value);
      return set(errors, [field.id], fieldErrors.length ? fieldErrors : undefined);
    }, /** @type {Errors} */{});
    this._setState({
      errors
    });
    return errors;
  }

  /**
   * @param {Element|string} parentNode
   */
  attachTo(parentNode) {
    if (!parentNode) {
      throw new Error('parentNode required');
    }
    this.detach();
    if (isString(parentNode)) {
      parentNode = document.querySelector(parentNode);
    }
    const container = this._container;
    parentNode.appendChild(container);
    this._emit('attach');
  }
  detach() {
    this._detach();
  }

  /**
   * @private
   *
   * @param {boolean} [emit]
   */
  _detach(emit = true) {
    const container = this._container,
      parentNode = container.parentNode;
    if (!parentNode) {
      return;
    }
    if (emit) {
      this._emit('detach');
    }
    parentNode.removeChild(container);
  }

  /**
   * @param {FormProperty} property
   * @param {any} value
   */
  setProperty(property, value) {
    const properties = set(this._getState().properties, [property], value);
    this._setState({
      properties
    });
  }

  /**
   * @param {FormEvent} type
   * @param {Function} handler
   */
  off(type, handler) {
    this.get('eventBus').off(type, handler);
  }

  /**
   * @private
   *
   * @param {FormOptions} options
   * @param {Element} container
   *
   * @returns {Injector}
   */
  _createInjector(options, container) {
    const {
      additionalModules = [],
      modules = this._getModules()
    } = options;
    const config = {
      renderer: {
        container
      }
    };
    return createInjector([{
      config: ['value', config]
    }, {
      form: ['value', this]
    }, core, ...modules, ...additionalModules]);
  }

  /**
   * @private
   */
  _emit(type, data) {
    this.get('eventBus').fire(type, data);
  }

  /**
   * @internal
   *
   * @param { { add?: boolean, field: any, remove?: number, value?: any } } update
   */
  _update(update) {
    const {
      field,
      value
    } = update;
    const {
      data,
      errors
    } = this._getState();
    const validator = this.get('validator'),
      pathRegistry = this.get('pathRegistry');

    const fieldErrors = validator.validateField(field, value);
    set(data, pathRegistry.getValuePath(field), value);
    set(errors, [field.id], fieldErrors.length ? fieldErrors : undefined);
    this._setState({
      data: clone(data),
      errors: clone(errors)
    });
  }

  /**
   * @internal
   */
  _getState() {
    return this._state;
  }

  /**
   * @internal
   */
  _setState(state) {
    this._state = {
      ...this._state,
      ...state
    };
    this._emit('changed', this._getState());
  }

  /**
  * @internal
  */
  _getModules() {
    return [ExpressionLanguageModule, MarkdownModule, ViewerCommandsModule];
  }

  /**
   * @internal
   */
  _onEvent(type, priority, handler) {
    this.get('eventBus').on(type, priority, handler);
  }

  /**
   * @internal
   */
  _getSubmitData() {
    const formFieldRegistry = this.get('formFieldRegistry'),
      pathRegistry = this.get('pathRegistry'),
      formFields = this.get('formFields');
    const formData = this._getState().data;
    const submitData = formFieldRegistry.getAll().reduce((previous, field) => {
      const {
        disabled,
        type
      } = field;
      const {
        config: fieldConfig
      } = formFields.get(type);

      // do not submit disabled form fields or routing fields
      if (disabled || !fieldConfig.keyed) {
        return previous;
      }
      const valuePath = pathRegistry.getValuePath(field);
      const value = get(formData, valuePath);
      return set(previous, valuePath, value);
    }, {});
    const filteredSubmitData = this._applyConditions(submitData, formData);
    return filteredSubmitData;
  }

  /**
   * @internal
   */
  _applyConditions(toFilter, data) {
    const conditionChecker = this.get('conditionChecker');
    return conditionChecker.applyConditions(toFilter, data);
  }

  /**
   * @internal
   */
  _initializeFieldData(data) {
    const formFieldRegistry = this.get('formFieldRegistry'),
      formFields = this.get('formFields'),
      pathRegistry = this.get('pathRegistry');
    return formFieldRegistry.getAll().reduce((initializedData, formField) => {
      const {
        defaultValue,
        type
      } = formField;

      // try to get value from data
      // if unavailable - try to get default value from form field
      // if unavailable - get empty value from form field

      const valuePath = pathRegistry.getValuePath(formField);
      if (valuePath) {
        const {
          config: fieldConfig
        } = formFields.get(type);
        let valueData = get(data, valuePath);
        if (!isUndefined(valueData) && fieldConfig.sanitizeValue) {
          valueData = fieldConfig.sanitizeValue({
            formField,
            data,
            value: valueData
          });
        }
        const initializedFieldValue = !isUndefined(valueData) ? valueData : !isUndefined(defaultValue) ? defaultValue : fieldConfig.emptyValue;
        return set(initializedData, valuePath, initializedFieldValue);
      }
      return initializedData;
    }, data);
  }
}

const schemaVersion = 11;

/**
 * @typedef { import('./types').CreateFormOptions } CreateFormOptions
 */

/**
 * Create a form.
 *
 * @param {CreateFormOptions} options
 *
 * @return {Promise<Form>}
 */
function createForm(options) {
  const {
    data,
    schema,
    ...rest
  } = options;
  const form = new Form(rest);
  return form.importSchema(schema, data).then(function () {
    return form;
  });
}


//Attachment SVG Icon list
var SvgUpload = function SvgUpload() {
  return jsxs("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 25 24",
    width: "25",
    height: "24",
    fill: "none",
    style: "vertical-align:middle",
    children: [
      jsx("g", {
        id: "upload-cloud-01",
        children:
          jsx("path", {
            id: "Icon",
            stroke: "#666666",
            strokeWidth: "1.5",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            d: "M4.5 16.2422C3.29401 15.435 2.5 14.0602 2.5 12.5C2.5 10.1564 4.29151 8.23129 6.57974 8.01937C7.04781 5.17213 9.52024 3 12.5 3C15.4798 3 17.9522 5.17213 18.4203 8.01937C20.7085 8.23129 22.5 10.1564 22.5 12.5C22.5 14.0602 21.706 15.435 20.5 16.2422M8.5 16L12.5 12M12.5 12L16.5 16M12.5 12V21"
          })
      })
    ]
  });
}
var UploadIcon = SvgUpload;


var SvgExcelFormat = function SvgExcelFormat() {
  return jsxs("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 32 33",
    width: "33",
    height: "32",
    fill: "none",
    style: "vertical-align:middle",
    children: [
      jsx("path", {
        fill: "#169154",
        d: "M19.333 4.35864H10.4957C9.85367 4.35864 9.33301 4.87931 9.33301 5.52131V10.3606H19.333V4.35864Z"
      }),
      jsx("path", {
        fill: "#18482A",
        d: "M9.33301 22.3945V27.1959C9.33301 27.8379 9.85367 28.3585 10.495 28.3585H19.333V22.3945H9.33301Z"
      }),
      jsx("path", {
        fill: "#0C8045",
        d: "M9.33301 10.3606H19.333V16.3619H9.33301V10.3606Z"
      }),
      jsx("path", {
        fill: "#17472A",
        d: "M9.33301 16.3621H19.333V22.3954H9.33301V16.3621Z"
      }),
      jsx("path", {
        fill: "#29C27F",
        d: "M28.1703 4.35864H19.333V10.3606H29.333V5.52131C29.333 4.87931 28.8123 4.35864 28.1703 4.35864Z"
      }),
      jsx("path", {
        fill: "#27663F",
        d: "M19.333 22.3945V28.3585H28.171C28.8123 28.3585 29.333 27.8379 29.333 27.1965V22.3952L19.333 22.3945Z"
      }),
      jsx("path", {
        fill: "#19AC65",
        d: "M19.333 10.3606H29.333V16.3619H19.333V10.3606Z"
      }),
      jsx("path", {
        fill: "#129652",
        d: "M19.333 16.3621H29.333V22.3954H19.333V16.3621Z"
      }),
      jsx("path", {
        fill: "#0C7238",
        d: "M14.8797 23.0252H3.78766C3.16899 23.0252 2.66699 22.5232 2.66699 21.9046V10.8126C2.66699 10.1939 3.16899 9.69189 3.78766 9.69189H14.8797C15.4983 9.69189 16.0003 10.1939 16.0003 10.8126V21.9046C16.0003 22.5232 15.4983 23.0252 14.8797 23.0252Z"
      }),
      jsx("path", {
        fill: "white",
        d: "M6.53792 13.0254H8.12859L9.41925 15.5281L10.7833 13.0254H12.2693L10.2219 16.3587L12.3159 19.6921H10.7486L9.34192 17.0721L7.94125 19.6921H6.35059L8.47925 16.3467L6.53792 13.0254Z"
      }),
    ]
  });
}
var ExcelIcon = SvgExcelFormat;


var SvgWordFormat = function SvgWordFormat() {
  return jsxs("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 32 32",
    width: "32",
    height: "32",
    fill: "none",
    style: "vertical-align:middle",
    children: [
      jsx("path", {
        fill: "#2D92D4",
        d: "M28.1713 4H10.4967C9.85465 4 9.33398 4.52067 9.33398 5.16267V10.002H29.334V5.16267C29.334 4.52067 28.8133 4 28.1713 4Z"
      }),
      jsx("path", {
        fill: "#2150A9",
        d: "M9.33398 22.0361V26.8375C9.33398 27.4795 9.85465 28.0001 10.496 28.0001H28.1713C28.8133 28.0001 29.334 27.4795 29.334 26.8375V22.0361H9.33398Z"
      }),
      jsx("path", {
        fill: "#2D83D4",
        d: "M9.33398 10.002H29.334V16.0033H9.33398V10.002Z"
      }),
      jsx("path", {
        fill: "#2E70C9",
        d: "M9.33398 16.0034H29.334V22.0368H9.33398V16.0034Z"
      }),
      jsx("path", {
        fill: "#00488D",
        d: "M14.8787 22.6668H3.78668C3.16802 22.6668 2.66602 22.1648 2.66602 21.5462V10.4542C2.66602 9.8355 3.16802 9.3335 3.78668 9.3335H14.8787C15.4973 9.3335 15.9993 9.8355 15.9993 10.4542V21.5462C15.9993 22.1648 15.4973 22.6668 14.8787 22.6668Z"
      }),
      jsx("path", {
        fill: "white",
        d: "M12.2684 12.6665L11.2378 17.5092L10.0958 12.6665H8.63775L7.45975 17.6592L6.39775 12.6665H5.09375L6.65642 19.3332H8.22442L9.36642 14.2072L10.5091 19.3332H12.0097L13.5724 12.6665H12.2684Z"
      })
    ]
  });
}
var WordIcon = SvgWordFormat;


var SvgPresentationFormat = function SvgPresentationFormat() {
  return jsxs("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 32 32",
    width: "32",
    height: "32",
    fill: "none",
    style: "vertical-align:middle",
    children: [
      jsx("path", {
        fill: "#D35230",
        d: "M5.33398 16C5.33398 22.6273 10.7067 28 17.334 28C23.9613 28 29.334 22.6273 29.334 16H17.334H5.33398Z"
      }),
      jsx("path", {
        fill: "#FF8F6B",
        d: "M17.334 4V16H29.334C29.334 9.37267 23.9613 4 17.334 4Z"
      }),
      jsx("path", {
        fill: "#ED6C47",
        d: "M17.334 4C10.7067 4 5.33398 9.37267 5.33398 16H17.334V4Z"
      }),
      jsx("path", {
        fill: "black",
        opacity: "0.05",
        d: "M17.334 11.1205C17.334 9.76517 16.2353 8.6665 14.88 8.6665H7.84998C6.27865 10.6958 5.33398 13.2345 5.33398 15.9998C5.33398 19.4105 6.76398 22.4818 9.04798 24.6665H14.8793C16.2353 24.6665 17.334 23.5678 17.334 22.2125V11.1205Z"
      }),
      jsx("path", {
        fill: "black",
        opacity: "0.07",
        d: "M14.8093 8.88867H7.68398C6.21398 10.8807 5.33398 13.3347 5.33398 16C5.33398 19.078 6.50265 21.876 8.40798 24H14.8093C15.9587 24 16.89 23.0687 16.89 21.9193V10.9693C16.8893 9.82067 15.958 8.88867 14.8093 8.88867Z"
      }),
      jsx("path", {
        fill: "black",
        opacity: "0.09",
        d: "M14.738 9.11133H7.51798C6.14598 11.062 5.33398 13.434 5.33398 16C5.33398 18.7653 6.27865 21.304 7.84998 23.3333H14.738C15.6807 23.3333 16.4447 22.5693 16.4447 21.6267V10.818C16.4453 9.87533 15.6807 9.11133 14.738 9.11133Z"
      }),
      jsx("path", {
        fill: "url(#paint0_linear_5825_65714)",
        d: "M14.666 22.6668H3.99935C3.26268 22.6668 2.66602 22.0702 2.66602 21.3335V10.6668C2.66602 9.93016 3.26268 9.3335 3.99935 9.3335H14.666C15.4027 9.3335 15.9993 9.93016 15.9993 10.6668V21.3335C15.9993 22.0702 15.4027 22.6668 14.666 22.6668Z"
      }),
      jsx("path", {
        fill: "white",
        d: "M9.78135 12.6748H6.66602V19.3415H8.01535V16.9941H9.53268C10.7833 16.9941 11.7973 15.9801 11.7973 14.7295V14.6908C11.7973 13.5775 10.8947 12.6748 9.78135 12.6748ZM10.3793 14.9055C10.3793 15.4781 9.91468 15.9428 9.34202 15.9428H8.01535V13.7261H9.34202C9.91468 13.7261 10.3793 14.1908 10.3793 14.7635V14.9055Z"
      }),
      jsx("defs", {
        children: jsxs("linearGradient", {
          id: "paint0_linear_5825_65714",
          x1: "3.05668",
          y1: "9.72416",
          x2: "15.1793",
          y2: "21.8468",
          gradientUnits: "userSpaceOnUse",
          children: [
            jsx("stop", {
              stopColor: "#CA4E2A"
            }),
            jsx("stop", {
              offset: "1",
              stopColor: "#B63016"
            })
          ]
        })
      })
    ]
  });
}
var PresentationIcon = SvgPresentationFormat;


var SvgPdfFormat = function SvgPdfFormat() {
  return jsxs("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 32 32",
    width: "32",
    height: "32",
    fill: "none",
    style: "vertical-align:middle",
    children: [
      jsx("path", {
        fill: "#E5252A",
        d: "M4 5.33333C4 2.38782 6.38781 0 9.33333 0H18.6667L28 9.33333V26.6667C28 29.6122 25.6122 32 22.6667 32H9.33333C6.38781 32 4 29.6122 4 26.6667V5.33333Z"
      }),
      jsx("path", {
        fill: "#ED676A",
        d: "M18.6667 0L28 9.33333H20.6667C19.5621 9.33333 18.6667 8.4379 18.6667 7.33333V0Z"
      }),
      jsx("path", {
        fill: "white",
        d: "M9.49809 24V18.9091H11.6011C11.9822 18.9091 12.3112 18.9837 12.5879 19.1328C12.8663 19.2803 13.081 19.4866 13.2318 19.7518C13.3826 20.0153 13.458 20.3219 13.458 20.6715C13.458 21.0228 13.3809 21.3303 13.2268 21.5938C13.0743 21.8556 12.8564 22.0586 12.573 22.2028C12.2896 22.3469 11.9532 22.419 11.5638 22.419H10.2662V21.4496H11.3351C11.5207 21.4496 11.6756 21.4173 11.7999 21.3526C11.9259 21.288 12.0212 21.1977 12.0858 21.0817C12.1504 20.964 12.1828 20.8273 12.1828 20.6715C12.1828 20.5141 12.1504 20.3782 12.0858 20.2638C12.0212 20.1478 11.9259 20.0584 11.7999 19.9954C11.674 19.9324 11.519 19.9009 11.3351 19.9009H10.7286V24H9.49809ZM15.9462 24H14.0645V18.9091H15.9438C16.4625 18.9091 16.9091 19.011 17.2836 19.2148C17.6598 19.417 17.9498 19.7087 18.1536 20.0898C18.3575 20.4693 18.4594 20.9234 18.4594 21.4521C18.4594 21.9824 18.3575 22.4381 18.1536 22.8192C17.9515 23.2004 17.6623 23.4929 17.2861 23.6967C16.9099 23.8989 16.4633 24 15.9462 24ZM15.295 22.951H15.899C16.1841 22.951 16.4252 22.9029 16.6224 22.8068C16.8212 22.709 16.9712 22.5508 17.0723 22.332C17.1751 22.1116 17.2264 21.8183 17.2264 21.4521C17.2264 21.0858 17.1751 20.7942 17.0723 20.5771C16.9696 20.3583 16.8179 20.2009 16.6174 20.1048C16.4185 20.007 16.1733 19.9581 15.8816 19.9581H15.295V22.951ZM19.1778 24V18.9091H22.6529V19.9084H20.4082V20.9524H22.4317V21.9542H20.4082V24H19.1778Z"
      })
    ]
  });
}
var PdfIcon = SvgPdfFormat;


var SvgJsonFormat = function SvgJsonFormat() {
  return jsxs("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 32 32",
    width: "32",
    height: "32",
    fill: "none",
    style: "vertical-align:middle",
    children: [
      jsx("path", {
        fill: "#404040",
        d: "M4 5C4 2.23858 6.23858 0 9 0H23C25.7614 0 28 2.23858 28 5V27C28 29.7614 25.7614 32 23 32H9C6.23858 32 4 29.7614 4 27V5Z"
      }),
      jsx("path", {
        fill: "white",
        d: "M10.8042 10.7031V10.1172C11.2443 10.1172 11.5516 10.0273 11.7261 9.84766C11.9006 9.66536 11.9878 9.36458 11.9878 8.94531V7.82422C11.9878 7.42578 12.0321 7.09115 12.1206 6.82031C12.2118 6.54687 12.3498 6.32812 12.5347 6.16406C12.7196 6 12.9539 5.88151 13.2378 5.80859C13.5216 5.73568 13.8563 5.69922 14.2417 5.69922V6.625C13.9396 6.625 13.7039 6.66927 13.5347 6.75781C13.3654 6.84635 13.2469 6.98438 13.1792 7.17188C13.1141 7.35677 13.0815 7.59375 13.0815 7.88281V9.30469C13.0815 9.50521 13.0516 9.69141 12.9917 9.86328C12.9318 10.0326 12.8211 10.1797 12.6597 10.3047C12.4982 10.4297 12.2677 10.5273 11.9683 10.5977C11.6688 10.668 11.2808 10.7031 10.8042 10.7031ZM14.2417 15.6641C13.8563 15.6641 13.5216 15.6276 13.2378 15.5547C12.9539 15.4818 12.7196 15.3633 12.5347 15.1992C12.3498 15.0352 12.2118 14.8164 12.1206 14.543C12.0321 14.2721 11.9878 13.9375 11.9878 13.5391V12.4141C11.9878 11.9974 11.9006 11.6979 11.7261 11.5156C11.5516 11.3333 11.2443 11.2422 10.8042 11.2422V10.6602C11.2808 10.6602 11.6688 10.6953 11.9683 10.7656C12.2677 10.8333 12.4982 10.931 12.6597 11.0586C12.8211 11.1836 12.9318 11.332 12.9917 11.5039C13.0516 11.6732 13.0815 11.8581 13.0815 12.0586V13.4805C13.0815 13.7669 13.1141 14.0026 13.1792 14.1875C13.2469 14.375 13.3654 14.513 13.5347 14.6016C13.7039 14.6927 13.9396 14.7383 14.2417 14.7383V15.6641ZM10.8042 11.2422V10.1172H11.8862V11.2422H10.8042Z"
      }),
      jsx("path", {
        fill: "white",
        d: "M21.1948 10.6602V11.2422C20.7547 11.2422 20.4474 11.3333 20.2729 11.5156C20.0985 11.6979 20.0112 11.9974 20.0112 12.4141V13.5391C20.0112 13.9375 19.9657 14.2721 19.8745 14.543C19.786 14.8164 19.6493 15.0352 19.4644 15.1992C19.2795 15.3633 19.0451 15.4818 18.7612 15.5547C18.4774 15.6276 18.1427 15.6641 17.7573 15.6641V14.7383C18.0594 14.7383 18.2951 14.6927 18.4644 14.6016C18.6336 14.513 18.7508 14.375 18.8159 14.1875C18.8836 14.0026 18.9175 13.7669 18.9175 13.4805V12.0586C18.9175 11.8581 18.9474 11.6732 19.0073 11.5039C19.0672 11.332 19.1779 11.1836 19.3394 11.0586C19.5008 10.931 19.7313 10.8333 20.0308 10.7656C20.3302 10.6953 20.7183 10.6602 21.1948 10.6602ZM17.7573 5.69922C18.1427 5.69922 18.4774 5.73568 18.7612 5.80859C19.0451 5.88151 19.2795 6 19.4644 6.16406C19.6493 6.32812 19.786 6.54687 19.8745 6.82031C19.9657 7.09115 20.0112 7.42578 20.0112 7.82422V8.94531C20.0112 9.36458 20.0985 9.66536 20.2729 9.84766C20.4474 10.0273 20.7547 10.1172 21.1948 10.1172V10.7031C20.7183 10.7031 20.3302 10.668 20.0308 10.5977C19.7313 10.5273 19.5008 10.4297 19.3394 10.3047C19.1779 10.1797 19.0672 10.0326 19.0073 9.86328C18.9474 9.69141 18.9175 9.50521 18.9175 9.30469V7.88281C18.9175 7.59375 18.8836 7.35677 18.8159 7.17188C18.7508 6.98438 18.6336 6.84635 18.4644 6.75781C18.2951 6.66927 18.0594 6.625 17.7573 6.625V5.69922ZM21.1948 10.1172V11.2422H20.1128V10.1172H21.1948Z"
      }),
      jsx("path", {
        fill: "white",
        d: "M8.80114 21.9091H10.0142V25.429C10.0125 25.7588 9.93383 26.0471 9.77805 26.294C9.62228 26.5393 9.40684 26.7299 9.13175 26.8658C8.85831 27.0017 8.54179 27.0696 8.18217 27.0696C7.86399 27.0696 7.57481 27.0141 7.31463 26.9031C7.05611 26.792 6.84979 26.6197 6.69567 26.386C6.54321 26.1523 6.4678 25.8532 6.46946 25.4886H7.69496C7.69993 25.6196 7.72479 25.7314 7.76953 25.8242C7.81593 25.9154 7.87973 25.9841 7.96094 26.0305C8.04214 26.0769 8.13909 26.1001 8.25178 26.1001C8.36944 26.1001 8.46887 26.0753 8.55007 26.0256C8.63127 25.9742 8.69259 25.8988 8.73402 25.7994C8.77711 25.6999 8.79948 25.5765 8.80114 25.429V21.9091ZM13.5384 23.4354C13.5219 23.2531 13.4481 23.1114 13.3172 23.0103C13.1879 22.9076 13.0032 22.8562 12.7629 22.8562C12.6038 22.8562 12.4712 22.8769 12.3651 22.9183C12.2591 22.9598 12.1795 23.0169 12.1265 23.0898C12.0735 23.1611 12.0461 23.2431 12.0445 23.3359C12.0412 23.4122 12.0561 23.4793 12.0892 23.5373C12.124 23.5953 12.1737 23.6467 12.2384 23.6914C12.3047 23.7345 12.3842 23.7726 12.477 23.8058C12.5698 23.8389 12.6742 23.8679 12.7902 23.8928L13.2277 23.9922C13.4796 24.0469 13.7017 24.1198 13.8939 24.2109C14.0878 24.3021 14.2502 24.4106 14.3811 24.5366C14.5137 24.6625 14.614 24.8075 14.6819 24.9716C14.7499 25.1357 14.7847 25.3196 14.7863 25.5234C14.7847 25.8449 14.7035 26.1209 14.5427 26.3512C14.382 26.5816 14.1508 26.758 13.8492 26.8807C13.5492 27.0033 13.1871 27.0646 12.7629 27.0646C12.337 27.0646 11.9658 27.0008 11.6492 26.8732C11.3327 26.7456 11.0866 26.5517 10.911 26.2915C10.7353 26.0314 10.645 25.7024 10.64 25.3047H11.8183C11.8282 25.4688 11.8721 25.6055 11.95 25.7148C12.0279 25.8242 12.1348 25.9071 12.2707 25.9634C12.4082 26.0198 12.5673 26.0479 12.748 26.0479C12.9137 26.0479 13.0545 26.0256 13.1705 25.9808C13.2882 25.9361 13.3785 25.8739 13.4415 25.7944C13.5045 25.7148 13.5368 25.6237 13.5384 25.521C13.5368 25.4248 13.507 25.3428 13.449 25.2749C13.391 25.2053 13.3015 25.1456 13.1805 25.0959C13.0612 25.0445 12.9087 24.9973 12.7231 24.9542L12.1911 24.8299C11.7503 24.7288 11.4031 24.5656 11.1496 24.3402C10.896 24.1132 10.7701 23.8066 10.7718 23.4205C10.7701 23.1056 10.8546 22.8297 11.0253 22.5927C11.196 22.3557 11.4321 22.1709 11.7338 22.0384C12.0354 21.9058 12.3792 21.8395 12.7654 21.8395C13.1598 21.8395 13.502 21.9066 13.792 22.0408C14.0837 22.1734 14.3099 22.3598 14.4706 22.6001C14.6314 22.8404 14.7134 23.1188 14.7167 23.4354H13.5384ZM20.2128 24.4545C20.2128 25.0147 20.1051 25.4895 19.8896 25.8789C19.6742 26.2683 19.3825 26.5642 19.0146 26.7663C18.6484 26.9685 18.2374 27.0696 17.7817 27.0696C17.3243 27.0696 16.9125 26.9677 16.5463 26.7638C16.18 26.56 15.8892 26.2642 15.6737 25.8764C15.46 25.487 15.3531 25.013 15.3531 24.4545C15.3531 23.8944 15.46 23.4196 15.6737 23.0302C15.8892 22.6407 16.18 22.3449 16.5463 22.1428C16.9125 21.9406 17.3243 21.8395 17.7817 21.8395C18.2374 21.8395 18.6484 21.9406 19.0146 22.1428C19.3825 22.3449 19.6742 22.6407 19.8896 23.0302C20.1051 23.4196 20.2128 23.8944 20.2128 24.4545ZM18.955 24.4545C18.955 24.1231 18.9078 23.843 18.8133 23.6143C18.7205 23.3857 18.5863 23.2125 18.4106 23.0948C18.2366 22.9772 18.027 22.9183 17.7817 22.9183C17.5381 22.9183 17.3285 22.9772 17.1528 23.0948C16.9771 23.2125 16.8421 23.3857 16.7476 23.6143C16.6548 23.843 16.6084 24.1231 16.6084 24.4545C16.6084 24.786 16.6548 25.0661 16.7476 25.2947C16.8421 25.5234 16.9771 25.6966 17.1528 25.8143C17.3285 25.9319 17.5381 25.9908 17.7817 25.9908C18.027 25.9908 18.2366 25.9319 18.4106 25.8143C18.5863 25.6966 18.7205 25.5234 18.8133 25.2947C18.9078 25.0661 18.955 24.786 18.955 24.4545ZM25.2639 21.9091V27H24.2199L22.194 24.0618H22.1617V27H20.9312V21.9091H21.9901L23.9937 24.8423H24.036V21.9091H25.2639Z"
      })
    ]
  });
}
var JsonIcon = SvgJsonFormat;

var SvgTxtFormat = function SvgTxtFormat() {
  return jsxs("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 32 32",
    width: "32",
    height: "32",
    fill: "none",
    style: "vertical-align:middle",
    children: [
      jsx("path", {
        fill: "#404040",
        d: "M4 5.33333C4 2.38782 6.38781 0 9.33333 0H18.6667L28 9.33333V26.6667C28 29.6122 25.6122 32 22.6667 32H9.33333C6.38781 32 4 29.6122 4 26.6667V5.33333Z"
      }),
      jsx("path", {
        fill: "#8A8A8A",
        d: "M18.6667 0L28 9.33333H20.6667C19.5621 9.33333 18.6667 8.4379 18.6667 7.33333V0Z"
      }),
      jsx("path", {
        fill: "white",
        d: "M8.611 19.9084V18.9091H12.9139V19.9084H11.3702V24H10.1572V19.9084H8.611ZM14.7459 24.0721C14.3466 24.0721 14.0019 23.9934 13.7119 23.8359C13.4235 23.6768 13.2014 23.4506 13.0457 23.1573C12.8915 22.8623 12.8145 22.5118 12.8145 22.1058C12.8145 21.7114 12.8924 21.3667 13.0481 21.0717C13.2039 20.7751 13.4235 20.5447 13.7069 20.3807C13.9903 20.215 14.3242 20.1321 14.7087 20.1321C14.9804 20.1321 15.229 20.1744 15.4544 20.2589C15.6798 20.3434 15.8745 20.4685 16.0386 20.6342C16.2026 20.8 16.3302 21.0046 16.4214 21.2482C16.5125 21.4902 16.5581 21.7678 16.5581 22.081V22.3842H13.2396V21.6783H15.4271C15.4254 21.549 15.3947 21.4338 15.3351 21.3327C15.2754 21.2317 15.1934 21.1529 15.089 21.0966C14.9862 21.0386 14.8678 21.0096 14.7335 21.0096C14.5976 21.0096 14.4758 21.0402 14.3681 21.1016C14.2604 21.1612 14.175 21.2433 14.1121 21.3477C14.0491 21.4504 14.016 21.5672 14.0126 21.6982V22.4165C14.0126 22.5723 14.0433 22.709 14.1046 22.8267C14.1659 22.9427 14.2529 23.033 14.3656 23.0977C14.4783 23.1623 14.6125 23.1946 14.7683 23.1946C14.876 23.1946 14.9738 23.1797 15.0616 23.1499C15.1495 23.12 15.2249 23.0761 15.2878 23.0181C15.3508 22.9601 15.3981 22.8888 15.4295 22.8043L16.5457 22.8366C16.4993 23.0869 16.3973 23.3048 16.2399 23.4904C16.0841 23.6744 15.8795 23.8177 15.6259 23.9205C15.3724 24.0215 15.079 24.0721 14.7459 24.0721ZM18.1583 20.1818L18.7872 21.4396L19.4385 20.1818H20.664L19.5976 22.0909L20.7038 24H19.4882L18.7872 22.7322L18.1036 24H16.8707L17.9793 22.0909L16.9254 20.1818H18.1583ZM23.3741 20.1818V21.0767H20.9654V20.1818H23.3741ZM21.47 19.267H22.6856V22.7994C22.6856 22.8739 22.6972 22.9344 22.7204 22.9808C22.7452 23.0256 22.7809 23.0579 22.8273 23.0778C22.8737 23.096 22.9292 23.1051 22.9938 23.1051C23.0402 23.1051 23.0891 23.101 23.1405 23.0927C23.1935 23.0827 23.2333 23.0745 23.2598 23.0678L23.4437 23.9453C23.3857 23.9619 23.3037 23.9826 23.1977 24.0075C23.0932 24.0323 22.9681 24.0481 22.8223 24.0547C22.5373 24.0679 22.2928 24.0348 22.089 23.9553C21.8868 23.8741 21.7319 23.7481 21.6241 23.5774C21.5181 23.4067 21.4667 23.1921 21.47 22.9336V19.267Z"
      })
    ]
  });
}
var TxtIcon = SvgTxtFormat;


var PngFormat = function PngFormat() {
  return jsxs("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 32 32",
    width: "32",
    height: "32",
    fill: "none",
    style: "vertical-align:middle",
    children: [
      jsx("path", {
        fill: "#E6E6E6",
        d: "M4 5C4 2.23858 6.23858 0 9 0H23C25.7614 0 28 2.23858 28 5V27C28 29.7614 25.7614 32 23 32H9C6.23858 32 4 29.7614 4 27V5Z"
      }),
      jsx("rect", {
        x: "8",
        y: "4.5",
        width: "16",
        height: "12.1364",
        rx: "1.5",
        stroke: "#404040"
      }),
      jsx("path", {
        fill: "#666666",
        d: "M8 13.4541L11.7342 11.2834C12.8517 10.6338 14.276 10.8981 15.0861 11.9053V11.9053C15.8223 12.8206 17.0785 13.1327 18.1575 12.6683L24 10.1538"
      }),
      jsx("path", {
        fill: "#666666",
        d: "M18.9959 8.81646C18.9959 9.48732 18.4433 10.0421 17.748 10.0421C17.0527 10.0421 16.5 9.48732 16.5 8.81646C16.5 8.1456 17.0527 7.59082 17.748 7.59082C18.4433 7.59082 18.9959 8.1456 18.9959 8.81646Z"
      }),
      jsx("path", {
        fill: "#404040",
        d: "M8.86577 27V21.9091H10.9688C11.3499 21.9091 11.6789 21.9837 11.9556 22.1328C12.234 22.2803 12.4486 22.4866 12.5994 22.7518C12.7502 23.0153 12.8256 23.3219 12.8256 23.6715C12.8256 24.0228 12.7486 24.3303 12.5945 24.5938C12.442 24.8556 12.2241 25.0586 11.9407 25.2028C11.6573 25.3469 11.3209 25.419 10.9315 25.419H9.63388V24.4496H10.7028C10.8884 24.4496 11.0433 24.4173 11.1676 24.3526C11.2936 24.288 11.3888 24.1977 11.4535 24.0817C11.5181 23.964 11.5504 23.8273 11.5504 23.6715C11.5504 23.5141 11.5181 23.3782 11.4535 23.2638C11.3888 23.1478 11.2936 23.0584 11.1676 22.9954C11.0417 22.9324 10.8867 22.9009 10.7028 22.9009H10.0962V27H8.86577ZM17.7649 21.9091V27H16.7209L14.695 24.0618H14.6626V27H13.4322V21.9091H14.4911L16.4947 24.8423H16.5369V21.9091H17.7649ZM21.8795 23.5721C21.8514 23.4677 21.8099 23.3757 21.7552 23.2962C21.7006 23.215 21.6334 23.1462 21.5539 23.0898C21.4743 23.0335 21.3832 22.9912 21.2805 22.9631C21.1777 22.9332 21.065 22.9183 20.9424 22.9183C20.6955 22.9183 20.4817 22.978 20.301 23.0973C20.1221 23.2166 19.9837 23.3906 19.8859 23.6193C19.7881 23.8464 19.7393 24.1223 19.7393 24.4471C19.7393 24.7736 19.7865 25.052 19.8809 25.2823C19.9754 25.5127 20.1121 25.6883 20.2911 25.8093C20.4701 25.9303 20.6872 25.9908 20.9424 25.9908C21.1678 25.9908 21.3583 25.9543 21.5141 25.8814C21.6715 25.8068 21.7909 25.7016 21.8721 25.5657C21.9533 25.4298 21.9939 25.2699 21.9939 25.0859L22.2226 25.1133H20.9846V24.2159H23.1796V24.8896C23.1796 25.3453 23.0827 25.7356 22.8888 26.0604C22.6965 26.3852 22.4314 26.6346 22.0933 26.8086C21.7569 26.9826 21.3699 27.0696 20.9324 27.0696C20.4469 27.0696 20.0202 26.9644 19.6523 26.7539C19.2844 26.5434 18.9977 26.2435 18.7922 25.854C18.5867 25.4629 18.4839 24.9989 18.4839 24.462C18.4839 24.0444 18.5461 23.674 18.6704 23.3509C18.7947 23.026 18.9678 22.7509 19.1899 22.5256C19.4136 22.3002 19.6721 22.1295 19.9655 22.0135C20.2604 21.8975 20.5778 21.8395 20.9175 21.8395C21.2125 21.8395 21.4868 21.8817 21.7403 21.9663C21.9955 22.0508 22.2209 22.1701 22.4165 22.3242C22.6137 22.4783 22.7736 22.6615 22.8962 22.8736C23.0189 23.0857 23.0951 23.3185 23.1249 23.5721H21.8795Z"
      })
    ]
  });
}
var PngIcon = PngFormat;


var JpegFormat = function JpegFormat() {
  return jsxs("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 32 32",
    width: "32",
    height: "32",
    fill: "none",
    style: "vertical-align:middle",
    children: [
      jsx("path", {
        fill: "#E6E6E6",
        d: "M4 5C4 2.23858 6.23858 0 9 0H23C25.7614 0 28 2.23858 28 5V27C28 29.7614 25.7614 32 23 32H9C6.23858 32 4 29.7614 4 27V5Z"
      }),
      jsx("rect", {
        x: "8",
        y: "4.5",
        width: "16",
        height: "12.1364",
        rx: "1.5",
        stroke: "#404040"
      }),
      jsx("path", {
        fill: "#666666",
        d: "M8 13.4541L11.7342 11.2834C12.8517 10.6338 14.276 10.8981 15.0861 11.9053V11.9053C15.8223 12.8206 17.0785 13.1327 18.1575 12.6683L24 10.1538"
      }),
      jsx("path", {
        fill: "#666666",
        d: "M18.9959 8.81646C18.9959 9.48732 18.4433 10.0421 17.748 10.0421C17.0527 10.0421 16.5 9.48732 16.5 8.81646C16.5 8.1456 17.0527 7.59082 17.748 7.59082C18.4433 7.59082 18.9959 8.1456 18.9959 8.81646Z"
      }),
      jsx("path", {
        fill: "#404040",
        d: "M9.30016 21.9091H10.5132V25.429C10.5116 25.7588 10.4329 26.0471 10.2771 26.294C10.1213 26.5393 9.90587 26.7299 9.63077 26.8658C9.35733 27.0017 9.04081 27.0696 8.6812 27.0696C8.36301 27.0696 8.07383 27.0141 7.81365 26.9031C7.55513 26.792 7.34881 26.6197 7.19469 26.386C7.04223 26.1523 6.96683 25.8532 6.96848 25.4886H8.19398C8.19895 25.6196 8.22381 25.7314 8.26855 25.8242C8.31496 25.9154 8.37876 25.9841 8.45996 26.0305C8.54116 26.0769 8.63811 26.1001 8.7508 26.1001C8.86846 26.1001 8.96789 26.0753 9.04909 26.0256C9.1303 25.9742 9.19161 25.8988 9.23304 25.7994C9.27613 25.6999 9.2985 25.5765 9.30016 25.429V21.9091ZM11.2857 27V21.9091H13.3887C13.7698 21.9091 14.0988 21.9837 14.3755 22.1328C14.6539 22.2803 14.8685 22.4866 15.0194 22.7518C15.1702 23.0153 15.2456 23.3219 15.2456 23.6715C15.2456 24.0228 15.1685 24.3303 15.0144 24.5938C14.8619 24.8556 14.644 25.0586 14.3606 25.2028C14.0772 25.3469 13.7408 25.419 13.3514 25.419H12.0538V24.4496H13.1227C13.3083 24.4496 13.4632 24.4173 13.5875 24.3526C13.7135 24.288 13.8088 24.1977 13.8734 24.0817C13.938 23.964 13.9703 23.8273 13.9703 23.6715C13.9703 23.5141 13.938 23.3782 13.8734 23.2638C13.8088 23.1478 13.7135 23.0584 13.5875 22.9954C13.4616 22.9324 13.3066 22.9009 13.1227 22.9009H12.5162V27H11.2857ZM15.8521 27V21.9091H19.4018V22.9084H17.0826V23.9524H19.2203V24.9542H17.0826V26.0007H19.4018V27H15.8521ZM23.5133 23.5721C23.4851 23.4677 23.4437 23.3757 23.389 23.2962C23.3343 23.215 23.2672 23.1462 23.1877 23.0898C23.1081 23.0335 23.017 22.9912 22.9142 22.9631C22.8115 22.9332 22.6988 22.9183 22.5762 22.9183C22.3292 22.9183 22.1155 22.978 21.9348 23.0973C21.7559 23.2166 21.6175 23.3906 21.5197 23.6193C21.4219 23.8464 21.373 24.1223 21.373 24.4471C21.373 24.7736 21.4203 25.052 21.5147 25.2823C21.6092 25.5127 21.7459 25.6883 21.9249 25.8093C22.1039 25.9303 22.321 25.9908 22.5762 25.9908C22.8016 25.9908 22.9921 25.9543 23.1479 25.8814C23.3053 25.8068 23.4247 25.7016 23.5059 25.5657C23.5871 25.4298 23.6277 25.2699 23.6277 25.0859L23.8564 25.1133H22.6184V24.2159H24.8134V24.8896C24.8134 25.3453 24.7164 25.7356 24.5225 26.0604C24.3303 26.3852 24.0652 26.6346 23.7271 26.8086C23.3907 26.9826 23.0037 27.0696 22.5662 27.0696C22.0807 27.0696 21.6539 26.9644 21.286 26.7539C20.9181 26.5434 20.6315 26.2435 20.426 25.854C20.2205 25.4629 20.1177 24.9989 20.1177 24.462C20.1177 24.0444 20.1799 23.674 20.3042 23.3509C20.4284 23.026 20.6016 22.7509 20.8237 22.5256C21.0474 22.3002 21.3059 22.1295 21.5993 22.0135C21.8942 21.8975 22.2116 21.8395 22.5513 21.8395C22.8463 21.8395 23.1206 21.8817 23.3741 21.9663C23.6293 22.0508 23.8547 22.1701 24.0502 22.3242C24.2475 22.4783 24.4074 22.6615 24.53 22.8736C24.6526 23.0857 24.7289 23.3185 24.7587 23.5721H23.5133Z"
      })
    ]
  });
}
var JpegIcon = JpegFormat;


var CsvFormat = function CsvFormat() {
  return jsxs("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 32 32",
    width: "32",
    height: "32",
    fill: "none",
    style: "vertical-align:middle",
    children: [
      jsx("path", {
        fill: "#0C8045",
        d: "M4 5.33333C4 2.38782 6.38781 0 9.33333 0H18.6667L28 9.33333V26.6667C28 29.6122 25.6122 32 22.6667 32H9.33333C6.38781 32 4 29.6122 4 26.6667V5.33333Z"
      }),
      jsx("path", {
        fill: "#19AC65",
        d: "M18.6667 0L28 9.33333H20.6667C19.5621 9.33333 18.6667 8.4379 18.6667 7.33333V0Z"
      }),
      jsx("path", {
        fill: "white",
        d: "M13.3337 20.7536H12.0908C12.0742 20.6259 12.0403 20.5108 11.9889 20.408C11.9375 20.3053 11.8696 20.2174 11.7851 20.1445C11.7005 20.0716 11.6003 20.0161 11.4843 19.978C11.3699 19.9382 11.2431 19.9183 11.1039 19.9183C10.857 19.9183 10.6441 19.9788 10.4651 20.0998C10.2878 20.2208 10.1511 20.3956 10.0549 20.6243C9.96048 20.853 9.91325 21.1297 9.91325 21.4545C9.91325 21.7926 9.96131 22.076 10.0574 22.3047C10.1552 22.5317 10.2919 22.7032 10.4676 22.8192C10.6449 22.9336 10.8545 22.9908 11.0965 22.9908C11.2324 22.9908 11.3558 22.9734 11.4669 22.9386C11.5796 22.9038 11.6782 22.8532 11.7627 22.7869C11.8489 22.719 11.9193 22.637 11.974 22.5408C12.0303 22.4431 12.0693 22.3329 12.0908 22.2102L13.3337 22.2177C13.3122 22.4431 13.2467 22.6651 13.1373 22.8839C13.0296 23.1026 12.8813 23.3023 12.6924 23.483C12.5034 23.6619 12.2731 23.8045 12.0013 23.9105C11.7312 24.0166 11.4213 24.0696 11.0716 24.0696C10.6109 24.0696 10.1983 23.9685 9.8337 23.7663C9.47078 23.5625 9.18408 23.2659 8.97362 22.8764C8.76315 22.487 8.65792 22.013 8.65792 21.4545C8.65792 20.8944 8.76481 20.4196 8.97859 20.0302C9.19237 19.6407 9.48155 19.3449 9.84613 19.1428C10.2107 18.9406 10.6192 18.8395 11.0716 18.8395C11.3799 18.8395 11.6649 18.8826 11.9267 18.9688C12.1886 19.0533 12.4189 19.1776 12.6178 19.3416C12.8167 19.504 12.9782 19.7037 13.1025 19.9407C13.2268 20.1777 13.3039 20.4486 13.3337 20.7536ZM16.7896 20.4354C16.773 20.2531 16.6993 20.1114 16.5683 20.0103C16.4391 19.9076 16.2543 19.8562 16.014 19.8562C15.8549 19.8562 15.7223 19.8769 15.6163 19.9183C15.5102 19.9598 15.4307 20.0169 15.3776 20.0898C15.3246 20.1611 15.2973 20.2431 15.2956 20.3359C15.2923 20.4122 15.3072 20.4793 15.3404 20.5373C15.3752 20.5953 15.4249 20.6467 15.4895 20.6914C15.5558 20.7345 15.6353 20.7726 15.7281 20.8058C15.8209 20.8389 15.9254 20.8679 16.0414 20.8928L16.4789 20.9922C16.7308 21.0469 16.9528 21.1198 17.145 21.2109C17.3389 21.3021 17.5013 21.4106 17.6323 21.5366C17.7648 21.6625 17.8651 21.8075 17.933 21.9716C18.001 22.1357 18.0358 22.3196 18.0375 22.5234C18.0358 22.8449 17.9546 23.1209 17.7938 23.3512C17.6331 23.5816 17.4019 23.758 17.1003 23.8807C16.8004 24.0033 16.4383 24.0646 16.014 24.0646C15.5881 24.0646 15.2169 24.0008 14.9004 23.8732C14.5839 23.7456 14.3378 23.5517 14.1621 23.2915C13.9864 23.0314 13.8961 22.7024 13.8911 22.3047H15.0694C15.0794 22.4688 15.1233 22.6055 15.2012 22.7148C15.279 22.8242 15.3859 22.9071 15.5218 22.9634C15.6594 23.0198 15.8185 23.0479 15.9991 23.0479C16.1648 23.0479 16.3057 23.0256 16.4217 22.9808C16.5393 22.9361 16.6297 22.8739 16.6926 22.7944C16.7556 22.7148 16.7879 22.6237 16.7896 22.521C16.7879 22.4248 16.7581 22.3428 16.7001 22.2749C16.6421 22.2053 16.5526 22.1456 16.4316 22.0959C16.3123 22.0445 16.1598 21.9973 15.9742 21.9542L15.4423 21.8299C15.0015 21.7288 14.6543 21.5656 14.4007 21.3402C14.1472 21.1132 14.0212 20.8066 14.0229 20.4205C14.0212 20.1056 14.1058 19.8297 14.2764 19.5927C14.4471 19.3557 14.6833 19.1709 14.9849 19.0384C15.2865 18.9058 15.6304 18.8395 16.0165 18.8395C16.4109 18.8395 16.7531 18.9066 17.0431 19.0408C17.3348 19.1734 17.561 19.3598 17.7218 19.6001C17.8825 19.8404 17.9645 20.1188 17.9678 20.4354H16.7896ZM19.8148 18.9091L20.9533 22.6378H20.9955L22.134 18.9091H23.5112L21.7935 24H20.1553L18.4377 18.9091H19.8148Z"
      })
    ]
  });
}
var CsvIcon = CsvFormat;


var renderIconBasedOnFileType = (type) => {
  if (type?.includes('pdf')) {
    return PdfIcon();
  }
  else if (type?.includes('word')) {
    return WordIcon();
  }
  else if (type?.includes('sheet')) {
    return ExcelIcon();
  }
  else if (type?.includes('presentation')) {
    return PresentationIcon();
  }
  else if (type?.includes('json')) {
    return JsonIcon();
  }
  else if (type?.includes('text/csv')) {
    return CsvIcon();
  }
  else if (type?.includes('text')) {
    return TxtIcon();
  }
  else if (type?.includes('png')) {
    return PngIcon();
  }
  else if (type?.includes('jpg')) {
    return JpegIcon();
  }
  else if (type?.includes('jpeg')) {
    return JpegIcon();
  }
  return TxtIcon();
}

var SvgChecked = function SvgChecked() {
  return jsxs("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 20 20",
    width: "20",
    height: "20",
    fill: "none",
    style: "vertical-align:middle",
    children: [
      jsx("path", {
        stroke: "#0077B6",
        strokeWidth: "1.5",
        strokeLinecap: "round",
        strokeLinejoin: "round",
        d: "M3.33301 10.1715L7.77745 14.6159L16.6663 5.72705"
      })
    ]
  });
}
var CheckedIcon = SvgChecked;

var SvgError = function SvgError() {
  return jsxs("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    width: "24",
    height: "24",
    fill: "none",
    style: "vertical-align:middle",
    children: [
      jsxs("g",
        {
          id: "error",
          children:
            [
              jsx("rect",
                {
                  id: "Rectangle 141208",
                  x: "2",
                  y: "2",
                  width: "20",
                  height: "20",
                  rx: "6",
                  fill: "#DA1E28"
                }),
              jsx("g",
                {
                  id: "Group 2608567",
                  children: [
                    jsx("path",
                      {
                        id: "Line 4 (Stroke)",
                        fillRule: "evenodd",
                        clipRule: "evenodd",
                        d: "M12.0018 6C12.5529 6 12.9996 6.44675 12.9996 6.99785V13.6645C12.9996 14.2156 12.5529 14.6624 12.0018 14.6624C11.4507 14.6624 11.0039 14.2156 11.0039 13.6645V6.99785C11.0039 6.44675 11.4507 6 12.0018 6Z",
                        fill: "#FBE5E6"
                      }),
                    jsx("circle",
                      {
                        id: "Ellipse 182",
                        cx: "12",
                        cy: "17.3311",
                        r: "0.5",
                        fill: "#FBE5E6",
                        stroke: "#FBE5E6"
                      }),
                  ]
                }),
            ]
        })
    ]
  });
}
var ErrorIcon = SvgError;


const Toast = (props) => {
  const toastIcon = ErrorIcon;
  return jsxs("div", {
    class: 'c-toast',
    children: [
      // jsx("div", {
      //   class: "icon icon-Error path1 c-pe2"
      // }),

      jsxs("div", {
        class: "c-ms-2 d-flex align-items-center",
        children: [
          toastIcon(),
          jsx("div", {
            class: "toast-message",
            children: props.message
          })
        ]
      }),

      jsx("div", {
        class: "c-me-2 cursor-pointer",
        children:
          jsx("div", {
            class: "icon icon-close close",
            onClick: () => props.closeToast(props.toast)
          })
        // jsx(XMarkIcon, {
        //   onClick: () => props.closeToast(props.toast)
        // })      
      })

    ]
  })
};


const ToastList = ({ data, position, removeToast }) => {
  position = 'top-left';
  const listRef = useRef(null);
  const handleScrolling = (el) => {
    const isTopPosition = ["top-left", "top-right"].includes(position);
    if (isTopPosition) {
      el?.scrollTo(0, el.scrollHeight);
    } else {
      el?.scrollTo(0, 0);
    }
  };

  useEffect(() => {
    handleScrolling(listRef.current);
  }, [position, data]);

  const sortedData = position.includes("bottom")
    ? [...data].reverse()
    : [...data];

  const closeToast = (tt) => {
    removeToast(tt);
  }

  return (
    sortedData.length > 0 && (
      jsx("div", {
        //  className={`toast-list toast-list--${position}`}
        class: 'toast-list',
        'aria-live': "assertive",
        ref: { listRef },
        children: [
          // {
          //   sortedData.map((toast) => (
          //     Toast({ message: "ssss" })
          //   ))
          // },

          sortedData.length > 0 && sortedData.map((item, i) => {
            // return jsxs("div", {})
            //return Toast({ message: item.message, type: item.type, onClose: {closeToast} })
            return Toast({ toast: item, message: item.message, type: item.type, closeToast })
          })

        ]
      })
    )
  );
};

export {
  Button, Checkbox, Checklist, ConditionChecker, DATETIME_SUBTYPES, DATETIME_SUBTYPES_LABELS, DATETIME_SUBTYPE_PATH, DATE_DISALLOW_PAST_PATH, DATE_LABEL_PATH, Datetime, FormComponent$1 as Default, ExpressionLanguageModule, FeelExpressionLanguage, FeelersTemplating, FieldFactory, Form, FormComponent, FormContext$1 as FormContext, FormField, FormFieldRegistry, FormFields, FormLayouter, FormRenderContext$1 as FormRenderContext, Group, Image, Obstacle, Map, Importer, MINUTES_IN_DAY, MarkdownModule, MarkdownRenderer, Numberfield, PathRegistry, Radio, Select, Spacer, Seperator, Fileupload, Gridfield, Latlong, Email, Phone, TIME_INTERVAL_PATH, TIME_LABEL_PATH, TIME_SERIALISINGFORMAT_LABELS, TIME_SERIALISING_FORMATS, TIME_SERIALISING_FORMAT_PATH, TIME_USE24H_PATH, Taglist, Text, Textarea, Textfield, VALUES_SOURCES, VALUES_SOURCES_DEFAULTS, VALUES_SOURCES_LABELS, VALUES_SOURCES_PATHS, VALUES_SOURCE_DEFAULT, ViewerCommands, ViewerCommandsModule, clone, createForm, createFormContainer, createInjector, formFields, generateIdForType, generateIndexForType, getSchemaVariables, getValuesSource, iconsByType, isRequired, pathParse, pathsEqual, runRecursively, schemaVersion,
  LATLONG_SUBTYPES, LATLONG_SUBTYPES_LABELS, LAT_LABEL_PATH, LONG_LABEL_PATH, MEGA_DROPDOWN_VIEW_PATH
};

//# sourceMappingURL=index.es.js.map
