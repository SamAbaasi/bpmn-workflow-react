'use strict';

var Ids = require('ids');
var minDash = require('min-dash');
var Big = require('big.js');
var feelin = require('feelin');
var feelers = require('feelers');
var classNames = require('classnames');
var jsxRuntime = require('preact/jsx-runtime');
var hooks = require('preact/hooks');
var preact = require('preact');
var React = require('preact/compat');
var flatpickr = require('flatpickr');
var Markup = require('preact-markup');
var didi = require('didi');
var showdown = require('showdown');

function _interopNamespaceDefault(e) {
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var React__namespace = /*#__PURE__*/_interopNamespaceDefault(React);

const getFlavouredFeelVariableNames = (feelString, feelFlavour = 'expression', options = {}) => {
  const {
    depth = 0,
    specialDepthAccessors = {}
  } = options;
  if (!['expression', 'unaryTest'].includes(feelFlavour)) return [];
  const tree = feelFlavour === 'expression' ? feelin.parseExpression(feelString) : feelin.parseUnaryTests(feelString);
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
    return minDash.isString(value) && value.startsWith('=');
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
    if (!minDash.isString(expression) || !expression.startsWith('=')) {
      return null;
    }
    try {
      const result = feelin.evaluate(expression.slice(1), data);
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
  constructor() {}

  /**
   * Determines if the given value is a feelers template.
   *
   * @param {any} value
   * @returns {boolean}
   *
   */
  isTemplate(value) {
    return minDash.isString(value) && (value.startsWith('=') || /{{.*?}}/.test(value));
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
    return feelers.evaluate(template, context, {
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
    const parseTree = feelers.parser.parse(template);
    const tree = feelers.buildSimpleTree(parseTree, template);
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
const DATE_LABEL_PATH = ['dateLabel'];
const DATE_DISALLOW_PAST_PATH = ['disallowPassedDates'];
const TIME_LABEL_PATH = ['timeLabel'];
const TIME_USE24H_PATH = ['use24h'];
const TIME_INTERVAL_PATH = ['timeInterval'];
const TIME_SERIALISING_FORMAT_PATH = ['timeSerializingFormat'];

// config  ///////////////////

const VALUES_SOURCES = {
  STATIC: 'static',
  INPUT: 'input',
  EXPRESSION: 'expression'
};
const VALUES_SOURCE_DEFAULT = VALUES_SOURCES.STATIC;
const VALUES_SOURCES_LABELS = {
  [VALUES_SOURCES.STATIC]: 'Static',
  [VALUES_SOURCES.INPUT]: 'Input data',
  [VALUES_SOURCES.EXPRESSION]: 'Expression'
};
const VALUES_SOURCES_PATHS = {
  [VALUES_SOURCES.STATIC]: ['values'],
  [VALUES_SOURCES.INPUT]: ['valuesKey'],
  [VALUES_SOURCES.EXPRESSION]: ['valuesExpression']
};
const VALUES_SOURCES_DEFAULTS = {
  [VALUES_SOURCES.STATIC]: [{
    label: 'Value',
    value: 'value'
  }],
  [VALUES_SOURCES.INPUT]: '',
  [VALUES_SOURCES.EXPRESSION]: '='
};

// helpers ///////////////////

function getValuesSource(field) {
  for (const source of Object.values(VALUES_SOURCES)) {
    if (minDash.get(field, VALUES_SOURCES_PATHS[source]) !== undefined) {
      return source;
    }
  }
  return VALUES_SOURCE_DEFAULT;
}

function createInjector(bootstrapModules) {
  const injector = new didi.Injector(bootstrapModules);
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

const EXPRESSION_PROPERTIES = ['alt', 'appearance.prefixAdorner', 'appearance.suffixAdorner', 'conditional.hide', 'description', 'label', 'source', 'readonly', 'text', 'validate.min', 'validate.max', 'validate.minLength', 'validate.maxLength', 'valuesExpression'];
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
        const property = minDash.get(component, prop.split('.'));
        if (property && expressionLanguage.isExpression(property)) {
          const expressionVariables = expressionLanguage.getVariableNames(property, {
            type: 'expression'
          });
          variables = [...variables, ...expressionVariables];
        }
      });
      TEMPLATE_PROPERTIES.forEach(prop => {
        const property = minDash.get(component, prop.split('.'));
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
    if (!minDash.isString(condition) || !condition.startsWith('=')) {
      return null;
    }
    try {
      // cut off initial '='
      const result = feelin.unaryTest(condition.slice(1), data);
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
      minDash.set(obj, workingValuePath, undefined);
      workingValuePath.pop();
      const parentObject = minDash.get(obj, workingValuePath);
      recurse = minDash.isObject(parentObject) && !minDash.values(parentObject).length && !!workingValuePath.length;
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
      elements: minDash.uniqueBy('id', dirty.reverse())
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
  elements = minDash.isArray(elements) ? elements : [elements];
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
    const updatedErrors = minDash.set(errors, [field.id], fieldErrors.length ? fieldErrors : undefined);
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
  events = minDash.isArray(events) ? events : [events];
  if (minDash.isFunction(priority)) {
    that = callback;
    callback = priority;
    priority = DEFAULT_PRIORITY;
  }
  if (!minDash.isNumber(priority)) {
    throw new Error('priority must be a number');
  }
  var actualCallback = callback;
  if (that) {
    actualCallback = minDash.bind(callback, that);

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
  if (minDash.isFunction(priority)) {
    that = callback;
    callback = priority;
    priority = DEFAULT_PRIORITY;
  }
  if (!minDash.isNumber(priority)) {
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
  events = minDash.isArray(events) ? events : [events];
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
function InternalEvent() {}
InternalEvent.prototype.stopPropagation = function () {
  this.cancelBubble = true;
};
InternalEvent.prototype.preventDefault = function () {
  this.defaultPrevented = true;
};
InternalEvent.prototype.init = function (data) {
  minDash.assign(this, data || {});
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

const EMAIL_PATTERN = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const PHONE_PATTERN = /(\+|00)(297|93|244|1264|358|355|376|971|54|374|1684|1268|61|43|994|257|32|229|226|880|359|973|1242|387|590|375|501|1441|591|55|1246|673|975|267|236|1|61|41|56|86|225|237|243|242|682|57|269|238|506|53|5999|61|1345|357|420|49|253|1767|45|1809|1829|1849|213|593|20|291|212|34|372|251|358|679|500|33|298|691|241|44|995|44|233|350|224|590|220|245|240|30|1473|299|502|594|1671|592|852|504|385|509|36|62|44|91|246|353|98|964|354|972|39|1876|44|962|81|76|77|254|996|855|686|1869|82|383|965|856|961|231|218|1758|423|94|266|370|352|371|853|590|212|377|373|261|960|52|692|389|223|356|95|382|976|1670|258|222|1664|596|230|265|60|262|264|687|227|672|234|505|683|31|47|977|674|64|968|92|507|64|51|63|680|675|48|1787|1939|850|351|595|970|689|974|262|40|7|250|966|249|221|65|500|4779|677|232|503|378|252|508|381|211|239|597|421|386|46|268|1721|248|963|1649|235|228|66|992|690|993|670|676|1868|216|90|688|886|255|256|380|598|1|998|3906698|379|1784|58|1284|1340|84|678|681|685|967|27|260|263)(9[976]\d|8[987530]\d|6[987]\d|5[90]\d|42\d|3[875]\d|2[98654321]\d|9[8543210]|8[6421]|6[6543210]|5[87654321]|4[987654310]|3[9643210]|2[70]|7|1)\d{4,20}$/;
const VALIDATE_FEEL_PROPERTIES = ['min', 'max', 'minLength', 'maxLength'];
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
      errors = [...errors, `Field must match pattern ${evaluatedValidation.pattern}.`];
    }
    if (evaluatedValidation.required) {
      const isUncheckedCheckbox = type === 'checkbox' && value === false;
      const isUnsetValue = minDash.isNil(value) || value === '';
      const isEmptyMultiselect = Array.isArray(value) && value.length === 0;
      if (isUncheckedCheckbox || isUnsetValue || isEmptyMultiselect) {
        errors = [...errors, 'Field is required.'];
      }
    }
    if ('min' in evaluatedValidation && (value || value === 0) && value < evaluatedValidation.min) {
      errors = [...errors, `Field must have minimum value of ${evaluatedValidation.min}.`];
    }
    if ('max' in evaluatedValidation && (value || value === 0) && value > evaluatedValidation.max) {
      errors = [...errors, `Field must have maximum value of ${evaluatedValidation.max}.`];
    }
    if ('minLength' in evaluatedValidation && value && value.trim().length < evaluatedValidation.minLength) {
      errors = [...errors, `Field must have minimum length of ${evaluatedValidation.minLength}.`];
    }
    if ('maxLength' in evaluatedValidation && value && value.trim().length > evaluatedValidation.maxLength) {
      errors = [...errors, `Field must have maximum length of ${evaluatedValidation.maxLength}.`];
    }
    if ('validationType' in evaluatedValidation && value && evaluatedValidation.validationType === 'phone' && !PHONE_PATTERN.test(value)) {
      errors = [...errors, 'Field must be a valid  international phone number. (e.g. +4930664040900)'];
    }
    if ('validationType' in evaluatedValidation && value && evaluatedValidation.validationType === 'email' && !EMAIL_PATTERN.test(value)) {
      errors = [...errors, 'Field must be a valid email.'];
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
    const value = minDash.get(evaluatedValidate, path);

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
      minDash.set(evaluatedValidate, path, evaluatedValue);
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
  if (minDash.isArray(node.children)) {
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
  return minDash.groupBy(components, c => {
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
  return minDash.flatten(formRows.map(c => c.rows));
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
  return jsxRuntime.jsx("div", {
    class: formFieldClasses(type$c),
    children: jsxRuntime.jsx("button", {
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

const FormRenderContext = preact.createContext({
  EmptyRoot: props => {
    return null;
  },
  Empty: props => {
    return null;
  },
  Children: props => {
    return jsxRuntime.jsx("div", {
      class: props.class,
      children: props.children
    });
  },
  Element: props => {
    return jsxRuntime.jsx("div", {
      class: props.class,
      children: props.children
    });
  },
  Row: props => {
    return jsxRuntime.jsx("div", {
      class: props.class,
      children: props.children
    });
  },
  Column: props => {
    if (props.field.type === 'default') {
      return props.children;
    }
    return jsxRuntime.jsx("div", {
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
function getService(type, strict) {}
const FormContext = preact.createContext({
  getService,
  formId: null
});
var FormContext$1 = FormContext;

function useService(type, strict) {
  const {
    getService
  } = hooks.useContext(FormContext$1);
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
  return hooks.useMemo(() => {
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
  return hooks.useMemo(() => {
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
  return hooks.useMemo(() => {
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
  hooks.useEffect(() => {
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
  const ref = hooks.useRef(defaultValue);
  hooks.useEffect(() => ref.current = value, dependencies);
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
  const [state, setState] = hooks.useState(defaultValue);
  const previous = usePrevious(value, defaultValue, [value]);
  const changed = !compare(previous, value);
  hooks.useEffect(() => {
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
  return hooks.useMemo(() => {
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
  return hooks.useMemo(() => evaluatedTemplate && evaluatedTemplate.split('\n')[0], [evaluatedTemplate]);
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
  return jsxRuntime.jsx("div", {
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
  return jsxRuntime.jsx("div", {
    class: "fjs-form-field-error",
    "aria-live": "polite",
    id: id,
    children: jsxRuntime.jsx("ul", {
      children: errors.map(error => {
        return jsxRuntime.jsx("li", {
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
  return jsxRuntime.jsxs("label", {
    for: id,
    class: classNames('fjs-form-field-label', {
      'fjs-incollapsible-label': !collapseOnEmpty
    }, props['class']),
    children: [props.children, evaluatedLabel, required && jsxRuntime.jsx("span", {
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
  } = hooks.useContext(FormContext$1);
  const errorMessageId = errors.length === 0 ? undefined : `${prefixId(id, formId)}-error-message`;
  return jsxRuntime.jsxs("div", {
    class: classNames(formFieldClasses(type$b, {
      errors,
      disabled,
      readonly
    }), {
      'fjs-checked': value
    }),
    children: [jsxRuntime.jsx(Label, {
      id: prefixId(id, formId),
      label: label,
      required: required,
      children: jsxRuntime.jsx("input", {
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
    }), jsxRuntime.jsx(Description, {
      description: description
    }), jsxRuntime.jsx(Errors, {
      errors: errors,
      id: errorMessageId
    })]
  });
}
Checkbox.config = {
  type: type$b,
  keyed: true,
  label: 'Checkbox',
  group: 'selection',
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
  return valuesKey ? minDash.get(formData, [valuesKey]) : values;
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
  if (!options.valuesKey && !options.valuesExpression) {
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
function useValuesAsync (field) {
  const {
    valuesExpression,
    valuesKey,
    values: staticValues
  } = field;
  const [valuesGetter, setValuesGetter] = hooks.useState({
    values: [],
    error: undefined,
    state: LOAD_STATES.LOADING
  });
  const initialData = useService('form')._getState().initialData;
  const expressionEvaluation = useExpressionEvaluation(valuesExpression);
  const evaluatedValues = useDeepCompareState(expressionEvaluation || [], []);
  hooks.useEffect(() => {
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
    } else {
      setValuesGetter(buildErrorState('No values source defined in the form definition'));
      return;
    }

    // normalize data to support primitives and partially defined objects
    values = normalizeValuesData(values);
    setValuesGetter(buildLoadedState(values));
  }, [valuesKey, staticValues, initialData, valuesExpression, evaluatedValues]);
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
    const isValidDisplayHour = minDash.isNumber(displayHour) && displayHour >= 1 && displayHour <= 12;
    const isValidMinute = minute >= 0 && minute <= 59;
    if (!isValidDisplayHour || !isValidMinute) return null;
    const hour = displayHour % 12 + (isPM ? 12 : 0);
    return hour * 60 + minute;
  } else {
    const digits = workingString.match(/\d+/g);
    const hour = parseInt(digits && digits[0]);
    const minute = parseInt(digits && digits[1]);
    const isValidHour = minDash.isNumber(hour) && hour >= 0 && hour <= 23;
    const isValidMinute = minDash.isNumber(minute) && minute >= 0 && minute <= 59;
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
function serializeDateTime(date, time, timeSerializingFormat) {
  const workingDate = new Date();
  workingDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
  workingDate.setHours(Math.floor(time / 60), time % 60, 0, 0);
  if (timeSerializingFormat === TIME_SERIALISING_FORMATS.UTC_NORMALIZED) {
    const timezoneOffsetMinutes = workingDate.getTimezoneOffset();
    const dayOffset = time + timezoneOffsetMinutes < 0 ? -1 : time + timezoneOffsetMinutes > MINUTES_IN_DAY ? 1 : 0;

    // Apply the date rollover pre-emptively
    workingDate.setHours(workingDate.getHours() + dayOffset * 24);
  }
  return serializeDate(workingDate) + 'T' + serializeTime(time, workingDate.getTimezoneOffset(), timeSerializingFormat);
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
    const validValues = normalizeValuesData(getValuesData(formField, data)).map(v => v.value);
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
    const validValues = normalizeValuesData(getValuesData(formField, data)).map(v => v.value);
    return value.filter(v => validValues.includes(v));
  } catch (error) {
    // use default value in case of formatting error
    // TODO(@Skaiir): log a warning when this happens - https://github.com/bpmn-io/form-js/issues/289
    return [];
  }
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
  const outerDivRef = hooks.useRef();
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
  } = hooks.useContext(FormContext$1);
  const errorMessageId = errors.length === 0 ? undefined : `${prefixId(id, formId)}-error-message`;
  return jsxRuntime.jsxs("div", {
    class: classNames(formFieldClasses(type$a, {
      errors,
      disabled,
      readonly
    })),
    ref: outerDivRef,
    children: [jsxRuntime.jsx(Label, {
      label: label,
      required: required
    }), loadState == LOAD_STATES.LOADED && options.map((v, index) => {
      return jsxRuntime.jsx(Label, {
        id: prefixId(`${id}-${index}`, formId),
        label: v.label,
        class: classNames({
          'fjs-checked': value.includes(v.value)
        }),
        required: false,
        children: jsxRuntime.jsx("input", {
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
    }), jsxRuntime.jsx(Description, {
      description: description
    }), jsxRuntime.jsx(Errors, {
      errors: errors,
      id: errorMessageId
    })]
  });
}
Checklist.config = {
  type: type$a,
  keyed: true,
  label: 'Checklist',
  group: 'selection',
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
  } = hooks.useContext(FormRenderContext$1);
  const FormFieldComponent = formFields.get(field.type);
  if (!FormFieldComponent) {
    throw new Error(`cannot render field <${field.type}>`);
  }
  const valuePath = hooks.useMemo(() => pathRegistry.getValuePath(field), [field, pathRegistry]);
  const initialValue = hooks.useMemo(() => minDash.get(initialData, valuePath), [initialData, valuePath]);
  const readonly = useReadonly(field, properties);
  const value = minDash.get(data, valuePath);

  // add precedence: global readonly > form field disabled
  const disabled = !properties.readOnly && (properties.disabled || field.disabled || false);
  const onBlur = hooks.useCallback(() => {
    if (viewerCommands) {
      viewerCommands.updateFieldValidation(field, value);
    }
  }, [viewerCommands, field, value]);
  hooks.useEffect(() => {
    if (viewerCommands && initialValue) {
      viewerCommands.updateFieldValidation(field, initialValue);
    }
  }, [viewerCommands, field, initialValue]);
  const hidden = useCondition(field.conditional && field.conditional.hide || null);
  if (hidden) {
    return jsxRuntime.jsx(Empty, {});
  }
  return jsxRuntime.jsx(Column, {
    field: field,
    class: gridColumnClasses(field),
    children: jsxRuntime.jsx(Element, {
      class: "fjs-element",
      field: field,
      children: jsxRuntime.jsx(FormFieldComponent, {
        ...props,
        disabled: disabled,
        errors: errors[field.id],
        onChange: disabled || readonly ? noop$1 : onChange,
        onBlur: disabled || readonly ? noop$1 : onBlur,
        readonly: readonly,
        value: value
      })
    })
  });
}

function Grid(props) {
  const {
    Children,
    Row
  } = hooks.useContext(FormRenderContext$1);
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
  return jsxRuntime.jsxs(Children, {
    class: "fjs-vertical-layout fjs-children cds--grid cds--grid--condensed",
    field: field,
    children: [rows.map(row => {
      const {
        components = []
      } = row;
      if (!components.length) {
        return null;
      }
      return jsxRuntime.jsx(Row, {
        row: row,
        class: "fjs-layout-row cds--row",
        children: components.map(id => {
          const childField = formFieldRegistry.get(id);
          if (!childField) {
            return null;
          }
          return preact.createElement(FormField, {
            ...props,
            key: childField.id,
            field: childField
          });
        })
      });
    }), components.length ? null : jsxRuntime.jsx(Empty, {})]
  });
}

function FormComponent$1(props) {
  const {
    EmptyRoot
  } = hooks.useContext(FormRenderContext$1);
  const fullProps = {
    ...props,
    Empty: EmptyRoot
  };
  return jsxRuntime.jsx(Grid, {
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
  return /*#__PURE__*/React__namespace.createElement("svg", _extends$k({
    xmlns: "http://www.w3.org/2000/svg",
    width: 14,
    height: 15,
    fill: "none",
    viewBox: "0 0 28 30"
  }, props), _path$h || (_path$h = /*#__PURE__*/React__namespace.createElement("path", {
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
  return jsxRuntime.jsxs("div", {
    class: classNames('fjs-input-group', {
      'fjs-disabled': disabled,
      'fjs-readonly': readonly
    }, {
      'hasErrors': hasErrors
    }),
    ref: rootRef,
    children: [pre && jsxRuntime.jsxs("span", {
      class: "fjs-input-adornment border-right border-radius-left",
      onClick: onAdornmentClick,
      children: [" ", minDash.isString(pre) ? jsxRuntime.jsx("span", {
        class: "fjs-input-adornment-text",
        children: pre
      }) : pre, " "]
    }), children, post && jsxRuntime.jsxs("span", {
      class: "fjs-input-adornment border-left border-radius-right",
      onClick: onAdornmentClick,
      children: [" ", minDash.isString(post) ? jsxRuntime.jsx("span", {
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
    setDate
  } = props;
  const dateInputRef = hooks.useRef();
  const focusScopeRef = hooks.useRef();
  const [flatpickrInstance, setFlatpickrInstance] = hooks.useState(null);
  const [isInputDirty, setIsInputDirty] = hooks.useState(false);
  const [forceFocusCalendar, setForceFocusCalendar] = hooks.useState(false);

  // shorts the date value back to the source
  hooks.useEffect(() => {
    if (!flatpickrInstance || !flatpickrInstance.config) return;
    flatpickrInstance.setDate(date, true);
    setIsInputDirty(false);
  }, [flatpickrInstance, date.toString()]);
  hooks.useEffect(() => {
    if (!forceFocusCalendar) return;
    focusRelevantFlatpickerDay(flatpickrInstance);
    setForceFocusCalendar(false);
  }, [flatpickrInstance, forceFocusCalendar]);

  // setup flatpickr instance
  hooks.useEffect(() => {
    let config = {
      allowInput: true,
      dateFormat: getLocaleDateFlatpickrConfig(),
      static: true,
      clickOpens: false,
      // TODO: support dates prior to 1900 (https://github.com/bpmn-io/form-js/issues/533)
      minDate: disallowPassedDates ? 'today' : '01/01/1900',
      errorHandler: () => {/* do nothing, we expect the values to sometimes be erronous and we don't want warnings polluting the console */}
    };
    const instance = flatpickr(dateInputRef.current, config);
    setFlatpickrInstance(instance);
    const onCalendarFocusOut = e => {
      if (!instance.calendarContainer.contains(e.relatedTarget) && e.relatedTarget != dateInputRef.current) {
        instance.close();
      }
    };

    // remove dirty tag to have mouse day selection prioritize input blur
    const onCalendarMouseDown = e => {
      if (e.target.classList.contains('flatpickr-day')) {
        setIsInputDirty(false);
      }
    };

    // when the dropdown of the datepickr opens, we register a few event handlers to re-implement some of the
    // flatpicker logic that was lost when setting allowInput to true
    instance.config.onOpen = [() => instance.calendarContainer.addEventListener('focusout', onCalendarFocusOut), () => instance.calendarContainer.addEventListener('mousedown', onCalendarMouseDown)];
    instance.config.onClose = [() => instance.calendarContainer.removeEventListener('focusout', onCalendarFocusOut), () => instance.calendarContainer.removeEventListener('mousedown', onCalendarMouseDown)];
  }, [disallowPassedDates]);

  // onChange is updated dynamically, so not to re-render the flatpicker every time it changes
  hooks.useEffect(() => {
    if (!flatpickrInstance || !flatpickrInstance.config) return;
    flatpickrInstance.config.onChange = [date => setDate(new Date(date)), () => setIsInputDirty(false)];
  }, [flatpickrInstance, setDate]);
  const onInputKeyDown = hooks.useCallback(e => {
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
  const onInputFocus = hooks.useCallback(e => {
    if (!flatpickrInstance || focusScopeRef.current.contains(e.relatedTarget) || readonly) return;
    flatpickrInstance.open();
  }, [flatpickrInstance, readonly]);

  // simulate an enter press on blur to make sure the date value is submitted in all scenarios
  const onInputBlur = hooks.useCallback(e => {
    if (!isInputDirty || e.relatedTarget && e.relatedTarget.classList.contains('flatpickr-day')) return;
    dateInputRef.current.dispatchEvent(ENTER_KEYDOWN_EVENT);
    setIsInputDirty(false);
    onDateTimeBlur(e);
  }, [isInputDirty, onDateTimeBlur]);
  const fullId = `${prefixId(id, formId)}--date`;
  return jsxRuntime.jsxs("div", {
    class: "fjs-datetime-subsection",
    children: [jsxRuntime.jsx(Label, {
      id: fullId,
      label: label,
      collapseOnEmpty: collapseLabelOnEmpty,
      required: required
    }), jsxRuntime.jsx(InputAdorner, {
      pre: jsxRuntime.jsx(CalendarIcon, {}),
      disabled: disabled,
      readonly: readonly,
      rootRef: focusScopeRef,
      inputRef: dateInputRef,
      children: jsxRuntime.jsx("div", {
        class: "fjs-datepicker",
        style: {
          width: '100%'
        },
        children: jsxRuntime.jsx("input", {
          ref: dateInputRef,
          type: "text",
          id: fullId,
          class: "fjs-input",
          disabled: disabled,
          readOnly: readonly,
          placeholder: getLocaleReadableDateFormat(),
          autoComplete: "off",
          onFocus: onInputFocus,
          onKeyDown: onInputKeyDown,
          onMouseDown: () => !flatpickrInstance.isOpen && !readonly && flatpickrInstance.open(),
          onBlur: onInputBlur,
          onInput: () => setIsInputDirty(true),
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
  return /*#__PURE__*/React__namespace.createElement("svg", _extends$j({
    xmlns: "http://www.w3.org/2000/svg",
    width: 16,
    height: 16,
    fill: "none",
    viewBox: "0 0 28 29"
  }, props), _path$g || (_path$g = /*#__PURE__*/React__namespace.createElement("path", {
    fill: "currentColor",
    d: "M13 14.41 18.59 20 20 18.59l-5-5.01V5h-2v9.41Z"
  })), _path2$4 || (_path2$4 = /*#__PURE__*/React__namespace.createElement("path", {
    fill: "currentColor",
    fillRule: "evenodd",
    d: "M6.222 25.64A14 14 0 1 0 21.778 2.36 14 14 0 0 0 6.222 25.64ZM7.333 4.023a12 12 0 1 1 13.334 19.955A12 12 0 0 1 7.333 4.022Z",
    clipRule: "evenodd"
  })));
};
var ClockIcon = SvgClock;

const DEFAULT_LABEL_GETTER = value => value;
const NOOP = () => {};
function DropdownList(props) {
  const {
    listenerElement = window,
    values = [],
    getLabel = DEFAULT_LABEL_GETTER,
    onValueSelected = NOOP,
    height = 235,
    emptyListMessage = 'No results',
    initialFocusIndex = 0
  } = props;
  const [mouseControl, setMouseControl] = hooks.useState(false);
  const [focusedValueIndex, setFocusedValueIndex] = hooks.useState(initialFocusIndex);
  const [smoothScrolling, setSmoothScrolling] = hooks.useState(false);
  const dropdownContainer = hooks.useRef();
  const mouseScreenPos = hooks.useRef();
  const focusedItem = hooks.useMemo(() => values.length ? values[focusedValueIndex] : null, [focusedValueIndex, values]);
  const changeFocusedValueIndex = hooks.useCallback(delta => {
    setFocusedValueIndex(x => Math.min(Math.max(0, x + delta), values.length - 1));
  }, [values.length]);
  hooks.useEffect(() => {
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
  hooks.useEffect(() => {
    const individualEntries = dropdownContainer.current.children;
    if (individualEntries.length && !mouseControl) {
      const focusedEntry = individualEntries[focusedValueIndex];
      focusedEntry && focusedEntry.scrollIntoView({
        block: 'nearest',
        inline: 'nearest'
      });
    }
  }, [focusedValueIndex, mouseControl]);
  hooks.useEffect(() => {
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
  return jsxRuntime.jsxs("div", {
    ref: dropdownContainer,
    tabIndex: -1,
    class: "fjs-dropdownlist",
    onMouseDown: e => e.preventDefault(),
    style: {
      maxHeight: height,
      scrollBehavior: smoothScrolling ? 'smooth' : 'auto'
    },
    children: [values.length > 0 && values.map((v, i) => {
      return jsxRuntime.jsx("div", {
        class: classNames('fjs-dropdownlist-item', {
          'focused': focusedValueIndex === i
        }),
        onMouseMove: mouseControl ? undefined : e => onMouseMovedInKeyboardMode(e, i),
        onMouseEnter: mouseControl ? () => setFocusedValueIndex(i) : undefined,
        onMouseDown: e => onValueSelected(v),
        children: getLabel(v)
      });
    }), !values.length && jsxRuntime.jsx("div", {
      class: "fjs-dropdownlist-empty",
      children: emptyListMessage
    })]
  });
}

function Timepicker(props) {
  const {
    id,
    label,
    collapseLabelOnEmpty,
    onDateTimeBlur,
    formId,
    required,
    disabled,
    readonly,
    use24h = false,
    timeInterval,
    time,
    setTime
  } = props;
  const safeTimeInterval = hooks.useMemo(() => {
    const allowedIntervals = [1, 5, 10, 15, 30, 60];
    if (allowedIntervals.includes(timeInterval)) {
      return timeInterval;
    }
    return 15;
  }, [timeInterval]);
  const timeInputRef = hooks.useRef();
  const [dropdownIsOpen, setDropdownIsOpen] = hooks.useState(false);
  const useDropdown = hooks.useMemo(() => safeTimeInterval !== 1, [safeTimeInterval]);
  const [rawValue, setRawValue] = hooks.useState('');

  // populates values from source
  hooks.useEffect(() => {
    if (time === null) {
      setRawValue('');
      return;
    }
    const intervalAdjustedTime = time - time % safeTimeInterval;
    setRawValue(formatTime(use24h, intervalAdjustedTime));
    if (intervalAdjustedTime != time) {
      setTime(intervalAdjustedTime);
    }
  }, [time, setTime, use24h, safeTimeInterval]);
  const propagateRawToMinute = hooks.useCallback(newRawValue => {
    const localRawValue = newRawValue || rawValue;

    // If no raw value exists, set the minute to null
    if (!localRawValue) {
      setTime(null);
      return;
    }
    const minutes = parseInputTime(localRawValue);

    // If raw string couldn't be parsed, clean everything up
    if (!minDash.isNumber(minutes)) {
      setRawValue('');
      setTime(null);
      return;
    }

    // Enforce the minutes to match the timeInterval
    const correctedMinutes = minutes - minutes % safeTimeInterval;

    // Enforce the raw text to be formatted properly
    setRawValue(formatTime(use24h, correctedMinutes));
    setTime(correctedMinutes);
  }, [rawValue, safeTimeInterval, use24h, setTime]);
  const timeOptions = hooks.useMemo(() => {
    const minutesInDay = 24 * 60;
    const intervalCount = Math.floor(minutesInDay / safeTimeInterval);
    return [...Array(intervalCount).keys()].map(intervalIndex => formatTime(use24h, intervalIndex * safeTimeInterval));
  }, [safeTimeInterval, use24h]);
  const initialFocusIndex = hooks.useMemo(() => {
    // if there are no options, there will not be any focusing
    if (!timeOptions || !safeTimeInterval) return null;

    // if there is a set minute value, we focus it in the dropdown
    if (time) return time / safeTimeInterval;
    const cacheTime = parseInputTime(rawValue);

    // if there is a valid value in the input cache, we try and focus close to it
    if (cacheTime) {
      const flooredCacheTime = cacheTime - cacheTime % safeTimeInterval;
      return flooredCacheTime / safeTimeInterval;
    }

    // If there is no set value, simply focus the middle of the dropdown (12:00)
    return Math.floor(timeOptions.length / 2);
  }, [rawValue, time, safeTimeInterval, timeOptions]);
  const onInputKeyDown = e => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        break;
      case 'ArrowDown':
        useDropdown && setDropdownIsOpen(true);
        e.preventDefault();
        break;
      case 'Escape':
        useDropdown && setDropdownIsOpen(false);
        break;
      case 'Enter':
        !dropdownIsOpen && propagateRawToMinute();
        break;
    }
  };
  const onInputBlur = e => {
    setDropdownIsOpen(false);
    propagateRawToMinute();
    onDateTimeBlur(e);
  };
  const onDropdownValueSelected = value => {
    setDropdownIsOpen(false);
    propagateRawToMinute(value);
  };
  const fullId = `${prefixId(id, formId)}--time`;
  return jsxRuntime.jsxs("div", {
    class: "fjs-datetime-subsection",
    children: [jsxRuntime.jsx(Label, {
      id: fullId,
      label: label,
      collapseOnEmpty: collapseLabelOnEmpty,
      required: required
    }), jsxRuntime.jsx(InputAdorner, {
      pre: jsxRuntime.jsx(ClockIcon, {}),
      inputRef: timeInputRef,
      disabled: disabled,
      readonly: readonly,
      children: jsxRuntime.jsxs("div", {
        class: "fjs-timepicker fjs-timepicker-anchor",
        children: [jsxRuntime.jsx("input", {
          ref: timeInputRef,
          type: "text",
          id: fullId,
          class: "fjs-input",
          value: rawValue,
          disabled: disabled,
          readOnly: readonly,
          placeholder: use24h ? 'hh:mm' : 'hh:mm ?m',
          autoComplete: "off",
          onFocus: () => !readonly && useDropdown && setDropdownIsOpen(true),
          onClick: () => !readonly && useDropdown && setDropdownIsOpen(true)

          // @ts-ignore
          ,
          onInput: e => {
            setRawValue(e.target.value);
            useDropdown && setDropdownIsOpen(false);
          },
          onBlur: onInputBlur,
          onKeyDown: onInputKeyDown,
          "data-input": true,
          "aria-describedby": props['aria-describedby']
        }), dropdownIsOpen && jsxRuntime.jsx(DropdownList, {
          values: timeOptions,
          height: 150,
          onValueSelected: onDropdownValueSelected,
          listenerElement: timeInputRef.current,
          initialFocusIndex: initialFocusIndex
        })]
      })
    })]
  });
}

const type$9 = 'datetime';
function Datetime(props) {
  const {
    disabled,
    errors = [],
    onBlur,
    field,
    onChange,
    readonly,
    value = ''
  } = props;
  const {
    description,
    id,
    dateLabel,
    timeLabel,
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
  } = hooks.useContext(FormContext$1);
  const dateTimeGroupRef = hooks.useRef();
  const getNullDateTime = () => ({
    date: new Date(Date.parse(null)),
    time: null
  });
  const [dateTime, setDateTime] = hooks.useState(getNullDateTime());
  const [dateTimeUpdateRequest, setDateTimeUpdateRequest] = hooks.useState(null);
  const isValidDate = date => date && !isNaN(date.getTime());
  const isValidTime = time => !isNaN(parseInt(time));
  const useDatePicker = hooks.useMemo(() => subtype === DATETIME_SUBTYPES.DATE || subtype === DATETIME_SUBTYPES.DATETIME, [subtype]);
  const useTimePicker = hooks.useMemo(() => subtype === DATETIME_SUBTYPES.TIME || subtype === DATETIME_SUBTYPES.DATETIME, [subtype]);
  const onDateTimeBlur = hooks.useCallback(e => {
    if (e.relatedTarget && dateTimeGroupRef.current.contains(e.relatedTarget)) {
      return;
    }
    onBlur();
  }, [onBlur]);
  hooks.useEffect(() => {
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
  const computeAndSetState = hooks.useCallback(({
    date,
    time
  }) => {
    let newDateTimeValue = null;
    if (subtype === DATETIME_SUBTYPES.DATE && isValidDate(date)) {
      newDateTimeValue = serializeDate(date);
    } else if (subtype === DATETIME_SUBTYPES.TIME && isValidTime(time)) {
      newDateTimeValue = serializeTime(time, new Date().getTimezoneOffset(), timeSerializingFormat);
    } else if (subtype === DATETIME_SUBTYPES.DATETIME && isValidDate(date) && isValidTime(time)) {
      newDateTimeValue = serializeDateTime(date, time, timeSerializingFormat);
    }
    onChange({
      value: newDateTimeValue,
      field
    });
  }, [field, onChange, subtype, timeSerializingFormat]);
  hooks.useEffect(() => {
    if (dateTimeUpdateRequest) {
      if (dateTimeUpdateRequest.refreshOnly) {
        computeAndSetState(dateTime);
      } else {
        const newDateTime = {
          ...dateTime,
          ...dateTimeUpdateRequest
        };
        setDateTime(newDateTime);
        computeAndSetState(newDateTime);
      }
      setDateTimeUpdateRequest(null);
    }
  }, [computeAndSetState, dateTime, dateTimeUpdateRequest]);
  hooks.useEffect(() => {
    setDateTimeUpdateRequest({
      refreshOnly: true
    });
  }, [timeSerializingFormat]);
  const allErrors = hooks.useMemo(() => {
    if (required || subtype !== DATETIME_SUBTYPES.DATETIME) return errors;
    const isOnlyOneFieldSet = isValidDate(dateTime.date) && !isValidTime(dateTime.time) || !isValidDate(dateTime.date) && isValidTime(dateTime.time);
    return isOnlyOneFieldSet ? ['Date and time must both be entered.', ...errors] : errors;
  }, [required, subtype, dateTime, errors]);
  const setDate = hooks.useCallback(date => {
    setDateTimeUpdateRequest(prev => prev ? {
      ...prev,
      date
    } : {
      date
    });
  }, []);
  const setTime = hooks.useCallback(time => {
    setDateTimeUpdateRequest(prev => prev ? {
      ...prev,
      time
    } : {
      time
    });
  }, []);
  const errorMessageId = allErrors.length === 0 ? undefined : `${prefixId(id, formId)}-error-message`;
  const datePickerProps = {
    id,
    label: dateLabel,
    collapseLabelOnEmpty: !timeLabel,
    onDateTimeBlur,
    formId,
    required,
    disabled,
    disallowPassedDates,
    date: dateTime.date,
    readonly,
    setDate,
    'aria-describedby': errorMessageId
  };
  const timePickerProps = {
    id,
    label: timeLabel,
    collapseLabelOnEmpty: !dateLabel,
    onDateTimeBlur,
    formId,
    required,
    disabled,
    readonly,
    use24h,
    timeInterval,
    time: dateTime.time,
    setTime,
    'aria-describedby': errorMessageId
  };
  return jsxRuntime.jsxs("div", {
    class: formFieldClasses(type$9, {
      errors: allErrors,
      disabled,
      readonly
    }),
    children: [jsxRuntime.jsxs("div", {
      class: classNames('fjs-vertical-group'),
      ref: dateTimeGroupRef,
      children: [useDatePicker && jsxRuntime.jsx(Datepicker, {
        ...datePickerProps
      }), useTimePicker && useDatePicker && jsxRuntime.jsx("div", {
        class: "fjs-datetime-separator"
      }), useTimePicker && jsxRuntime.jsx(Timepicker, {
        ...timePickerProps
      })]
    }), jsxRuntime.jsx(Description, {
      description: description
    }), jsxRuntime.jsx(Errors, {
      errors: allErrors,
      id: errorMessageId
    })]
  });
}
Datetime.config = {
  type: type$9,
  keyed: true,
  label: 'Date time',
  group: 'basic-input',
  emptyValue: null,
  sanitizeValue: sanitizeDateTimePickerValue,
  create: (options = {}) => {
    const defaults = {};
    minDash.set(defaults, DATETIME_SUBTYPE_PATH, DATETIME_SUBTYPES.DATE);
    minDash.set(defaults, DATE_LABEL_PATH, 'Date');
    return {
      ...defaults,
      ...options
    };
  }
};

/**
 * This file must not be changed or exchanged.
 *
 * @see http://bpmn.io/license for more information.
 */
function Logo() {
  return jsxRuntime.jsxs("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 14.02 5.57",
    width: "53",
    height: "21",
    style: "vertical-align:middle",
    children: [jsxRuntime.jsx("path", {
      fill: "currentColor",
      d: "M1.88.92v.14c0 .41-.13.68-.4.8.33.14.46.44.46.86v.33c0 .61-.33.95-.95.95H0V0h.95c.65 0 .93.3.93.92zM.63.57v1.06h.24c.24 0 .38-.1.38-.43V.98c0-.28-.1-.4-.32-.4zm0 1.63v1.22h.36c.2 0 .32-.1.32-.39v-.35c0-.37-.12-.48-.4-.48H.63zM4.18.99v.52c0 .64-.31.98-.94.98h-.3V4h-.62V0h.92c.63 0 .94.35.94.99zM2.94.57v1.35h.3c.2 0 .3-.09.3-.37v-.6c0-.29-.1-.38-.3-.38h-.3zm2.89 2.27L6.25 0h.88v4h-.6V1.12L6.1 3.99h-.6l-.46-2.82v2.82h-.55V0h.87zM8.14 1.1V4h-.56V0h.79L9 2.4V0h.56v4h-.64zm2.49 2.29v.6h-.6v-.6zM12.12 1c0-.63.33-1 .95-1 .61 0 .95.37.95 1v2.04c0 .64-.34 1-.95 1-.62 0-.95-.37-.95-1zm.62 2.08c0 .28.13.39.33.39s.32-.1.32-.4V.98c0-.29-.12-.4-.32-.4s-.33.11-.33.4z"
    }), jsxRuntime.jsx("path", {
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
  return jsxRuntime.jsxs("div", {
    class: "fjs-powered-by-lightbox",
    style: "z-index: 100; position: fixed; top: 0; left: 0;right: 0; bottom: 0",
    children: [jsxRuntime.jsx("div", {
      class: "backdrop",
      style: "width: 100%; height: 100%; background: rgba(40 40 40 / 20%)",
      onClick: props.onBackdropClick
    }), jsxRuntime.jsxs("div", {
      class: "notice",
      style: "position: absolute; left: 50%; top: 40%; transform: translate(-50%); width: 260px; padding: 10px; background: white; box-shadow: 0  1px 4px rgba(0 0 0 / 30%); font-family: Helvetica, Arial, sans-serif; font-size: 14px; display: flex; line-height: 1.3",
      children: [jsxRuntime.jsx("a", {
        href: "https://bpmn.io",
        target: "_blank",
        rel: "noopener",
        style: "margin: 15px 20px 15px 10px; align-self: center; color: var(--cds-icon-primary, #404040)",
        children: jsxRuntime.jsx(Logo, {})
      }), jsxRuntime.jsxs("span", {
        children: ["Web-based tooling for BPMN, DMN, and forms powered by ", jsxRuntime.jsx("a", {
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
  return jsxRuntime.jsx("div", {
    class: "fjs-powered-by fjs-form-field",
    style: "text-align: right",
    children: jsxRuntime.jsx("a", {
      href: "https://bpmn.io",
      target: "_blank",
      rel: "noopener",
      class: "fjs-powered-by-link",
      title: "Powered by bpmn.io",
      style: "color: var(--cds-text-primary, #404040)",
      onClick: props.onClick,
      children: jsxRuntime.jsx(Logo, {})
    })
  });
}
function PoweredBy(props) {
  const [open, setOpen] = hooks.useState(false);
  function toggleOpen(open) {
    return event => {
      event.preventDefault();
      setOpen(open);
    };
  }
  return jsxRuntime.jsxs(preact.Fragment, {
    children: [React.createPortal(jsxRuntime.jsx(Lightbox, {
      open: open,
      onBackdropClick: toggleOpen(false)
    }), document.body), jsxRuntime.jsx(Link, {
      onClick: toggleOpen(true)
    })]
  });
}

const noop = () => {};
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
  return jsxRuntime.jsxs("form", {
    class: "fjs-form",
    onSubmit: handleSubmit,
    onReset: handleReset,
    "aria-label": ariaLabel,
    noValidate: true,
    children: [jsxRuntime.jsx(FormField, {
      field: schema,
      onChange: onChange
    }), jsxRuntime.jsx(PoweredBy, {})]
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
    showOutline
  } = field;
  const {
    formId
  } = hooks.useContext(FormContext$1);
  const {
    Empty
  } = hooks.useContext(FormRenderContext$1);
  const fullProps = {
    ...props,
    Empty
  };
  return jsxRuntime.jsxs("div", {
    className: classNames(formFieldClasses(type), {
      'fjs-outlined': showOutline
    }),
    role: "group",
    "aria-labelledby": prefixId(id, formId),
    children: [jsxRuntime.jsx(Label, {
      id: prefixId(id, formId),
      label: label
    }), jsxRuntime.jsx(Grid, {
      ...fullProps
    })]
  });
}
Group.config = {
  type: 'group',
  pathed: true,
  label: 'Group',
  group: 'presentation',
  create: (options = {}) => ({
    components: [],
    showOutline: true,
    ...options
  })
};

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
  return /*#__PURE__*/React__namespace.createElement("svg", _extends$i({
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
  }, props), /*#__PURE__*/React__namespace.createElement("path", {
    d: "M0 0h1280v1280H0z",
    style: {
      fill: "#e5e9ed"
    }
  }), /*#__PURE__*/React__namespace.createElement("path", {
    d: "M910 410H370v470h540V410Zm-57.333 57.333v355.334H427.333V467.333h425.334Z",
    style: {
      fill: "#cad3db"
    }
  }), /*#__PURE__*/React__namespace.createElement("path", {
    d: "M810 770H480v-60l100-170 130 170 100-65v125Z",
    style: {
      fill: "#cad3db"
    }
  }), /*#__PURE__*/React__namespace.createElement("circle", {
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
    source
  } = field;
  const evaluatedImageSource = useSingleLineTemplateEvaluation(source, {
    debug: true
  });
  const safeSource = hooks.useMemo(() => sanitizeImageSource(evaluatedImageSource), [evaluatedImageSource]);
  const altText = useSingleLineTemplateEvaluation(alt, {
    debug: true
  });
  const {
    formId
  } = hooks.useContext(FormContext$1);
  return jsxRuntime.jsx("div", {
    class: formFieldClasses(type$8),
    children: jsxRuntime.jsxs("div", {
      class: "fjs-image-container",
      children: [safeSource && jsxRuntime.jsx("img", {
        alt: altText,
        src: safeSource,
        class: "fjs-image",
        id: prefixId(id, formId)
      }), !safeSource && jsxRuntime.jsx("div", {
        class: "fjs-image-placeholder",
        children: jsxRuntime.jsx(ImagePlaceholder, {
          alt: "This is an image placeholder"
        })
      })]
    })
  });
}
Image.config = {
  type: type$8,
  keyed: false,
  label: 'Image view',
  group: 'presentation',
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
  return jsxRuntime.jsx(InputAdorner, {
    ...props,
    pre: evaluatedPre,
    post: evaluatedPost
  });
}

var _path$f;
function _extends$h() { _extends$h = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$h.apply(this, arguments); }
var SvgAngelDown = function SvgAngelDown(props) {
  return /*#__PURE__*/React__namespace.createElement("svg", _extends$h({
    xmlns: "http://www.w3.org/2000/svg",
    width: 8,
    height: 8
  }, props), _path$f || (_path$f = /*#__PURE__*/React__namespace.createElement("path", {
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
  return /*#__PURE__*/React__namespace.createElement("svg", _extends$g({
    xmlns: "http://www.w3.org/2000/svg",
    width: 8,
    height: 8
  }, props), _path$e || (_path$e = /*#__PURE__*/React__namespace.createElement("path", {
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
  const inputRef = hooks.useRef();
  const [stringValueCache, setStringValueCache] = hooks.useState('');

  // checks whether the value currently in the form data is practically different from the one in the input field cache
  // this allows us to guarantee the field always displays valid form data, but without auto-simplifying values like 1.000 to 1
  const cacheValueMatchesState = hooks.useMemo(() => Numberfield.config.sanitizeValue({
    value,
    formField: field
  }) === Numberfield.config.sanitizeValue({
    value: stringValueCache,
    formField: field
  }), [stringValueCache, value, field]);
  const displayValue = hooks.useMemo(() => {
    if (value === 'NaN') return 'NaN';
    if (stringValueCache === '-') return '-';
    return cacheValueMatchesState ? stringValueCache : value || value === 0 ? Big(value).toFixed() : '';
  }, [stringValueCache, value, cacheValueMatchesState]);
  const arrowIncrementValue = hooks.useMemo(() => {
    if (incrementValue) return Big(incrementValue);
    if (decimalDigits) return Big(`1e-${decimalDigits}`);
    return Big('1');
  }, [decimalDigits, incrementValue]);
  const setValue = hooks.useCallback(stringValue => {
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
  } = hooks.useContext(FormContext$1);
  const errorMessageId = errors.length === 0 ? undefined : `${prefixId(id, formId)}-error-message`;
  return jsxRuntime.jsxs("div", {
    class: formFieldClasses(type$7, {
      errors,
      disabled,
      readonly
    }),
    children: [jsxRuntime.jsx(Label, {
      id: prefixId(id, formId),
      label: label,
      required: required
    }), jsxRuntime.jsx(TemplatedInputAdorner, {
      disabled: disabled,
      readonly: readonly,
      pre: prefixAdorner,
      post: suffixAdorner,
      children: jsxRuntime.jsxs("div", {
        class: classNames('fjs-vertical-group', {
          'fjs-disabled': disabled,
          'fjs-readonly': readonly
        }, {
          'hasErrors': errors.length
        }),
        children: [jsxRuntime.jsx("input", {
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
        }), jsxRuntime.jsxs("div", {
          class: classNames('fjs-number-arrow-container', {
            'fjs-disabled': disabled,
            'fjs-readonly': readonly
          }),
          children: [jsxRuntime.jsx("button", {
            class: "fjs-number-arrow-up",
            type: "button",
            "aria-label": "Increment",
            onClick: () => increment(),
            tabIndex: -1,
            children: jsxRuntime.jsx(AngelUpIcon, {})
          }), jsxRuntime.jsx("div", {
            class: "fjs-number-arrow-separator"
          }), jsxRuntime.jsx("button", {
            class: "fjs-number-arrow-down",
            type: "button",
            "aria-label": "Decrement",
            onClick: () => decrement(),
            tabIndex: -1,
            children: jsxRuntime.jsx(AngelDownIcon, {})
          })]
        })]
      })
    }), jsxRuntime.jsx(Description, {
      description: description
    }), jsxRuntime.jsx(Errors, {
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
  const outerDivRef = hooks.useRef();
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
  } = hooks.useContext(FormContext$1);
  const errorMessageId = errors.length === 0 ? undefined : `${prefixId(id, formId)}-error-message`;
  return jsxRuntime.jsxs("div", {
    class: formFieldClasses(type$6, {
      errors,
      disabled,
      readonly
    }),
    ref: outerDivRef,
    children: [jsxRuntime.jsx(Label, {
      label: label,
      required: required
    }), loadState == LOAD_STATES.LOADED && options.map((option, index) => {
      return jsxRuntime.jsx(Label, {
        id: prefixId(`${id}-${index}`, formId),
        label: option.label,
        class: classNames({
          'fjs-checked': option.value === value
        }),
        required: false,
        children: jsxRuntime.jsx("input", {
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
    }), jsxRuntime.jsx(Description, {
      description: description
    }), jsxRuntime.jsx(Errors, {
      errors: errors,
      id: errorMessageId
    })]
  });
}
Radio.config = {
  type: type$6,
  keyed: true,
  label: 'Radio',
  group: 'selection',
  emptyValue: null,
  sanitizeValue: sanitizeSingleSelectValue,
  create: createEmptyOptions
};

var _path$d;
function _extends$f() { _extends$f = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$f.apply(this, arguments); }
var SvgXMark = function SvgXMark(props) {
  return /*#__PURE__*/React__namespace.createElement("svg", _extends$f({
    xmlns: "http://www.w3.org/2000/svg",
    width: 8,
    height: 8
  }, props), _path$d || (_path$d = /*#__PURE__*/React__namespace.createElement("path", {
    fill: "currentColor",
    fillRule: "evenodd",
    stroke: "currentColor",
    strokeWidth: 0.5,
    d: "M4 3.766 7.43.336l.234.234L4.234 4l3.43 3.43-.234.234L4 4.234.57 7.664.336 7.43 3.766 4 .336.57.57.336Zm0 0",
    clipRule: "evenodd"
  })));
};
var XMarkIcon = SvgXMark;

function SearchableSelect(props) {
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
  } = hooks.useContext(FormContext$1);
  const [filter, setFilter] = hooks.useState('');
  const [isDropdownExpanded, setIsDropdownExpanded] = hooks.useState(false);
  const [shouldApplyFilter, setShouldApplyFilter] = hooks.useState(true);
  const [isEscapeClosed, setIsEscapeClose] = hooks.useState(false);
  const searchbarRef = hooks.useRef();
  const {
    state: loadState,
    values: options
  } = useValuesAsync(field);

  // We cache a map of option values to their index so that we don't need to search the whole options array every time to correlate the label
  const valueToOptionMap = hooks.useMemo(() => Object.assign({}, ...options.map((o, x) => ({
    [o.value]: options[x]
  }))), [options]);
  const valueLabel = hooks.useMemo(() => value && valueToOptionMap[value] && valueToOptionMap[value].label || '', [value, valueToOptionMap]);

  // whenever we change the underlying value, set the label to it
  hooks.useEffect(() => {
    setFilter(valueLabel);
  }, [valueLabel]);
  const filteredOptions = hooks.useMemo(() => {
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
  const setValue = hooks.useCallback(option => {
    setFilter(option && option.label || '');
    props.onChange({
      value: option && option.value || null,
      field
    });
  }, [field, props]);
  const onInputKeyDown = hooks.useCallback(keyDownEvent => {
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
  const displayState = hooks.useMemo(() => {
    const ds = {};
    ds.componentReady = !disabled && !readonly && loadState === LOAD_STATES.LOADED;
    ds.displayCross = ds.componentReady && value !== null && value !== undefined;
    ds.displayDropdown = !disabled && !readonly && isDropdownExpanded && !isEscapeClosed;
    return ds;
  }, [disabled, isDropdownExpanded, isEscapeClosed, loadState, readonly, value]);
  const onAngelMouseDown = hooks.useCallback(e => {
    setIsEscapeClose(false);
    setIsDropdownExpanded(!isDropdownExpanded);
    const searchbar = searchbarRef.current;
    isDropdownExpanded ? searchbar.blur() : searchbar.focus();
    e.preventDefault();
  }, [isDropdownExpanded]);
  return jsxRuntime.jsxs(jsxRuntime.Fragment, {
    children: [jsxRuntime.jsxs("div", {
      id: prefixId(`${id}`, formId),
      class: classNames('fjs-input-group', {
        'disabled': disabled,
        'readonly': readonly
      }, {
        'hasErrors': errors.length
      }),
      children: [jsxRuntime.jsx("input", {
        disabled: disabled,
        readOnly: readonly,
        class: "fjs-input",
        ref: searchbarRef,
        id: prefixId(`${id}-search`, formId),
        onChange: onChange,
        type: "text",
        value: filter,
        placeholder: 'Search',
        autoComplete: "off",
        onKeyDown: e => onInputKeyDown(e),
        onMouseDown: () => {
          setIsEscapeClose(false);
          setIsDropdownExpanded(true);
          setShouldApplyFilter(false);
        },
        onFocus: () => {
          setIsDropdownExpanded(true);
          setShouldApplyFilter(false);
        },
        onBlur: () => {
          setIsDropdownExpanded(false);
          setFilter(valueLabel);
          onBlur();
        },
        "aria-describedby": props['aria-describedby']
      }), displayState.displayCross && jsxRuntime.jsxs("span", {
        class: "fjs-select-cross",
        onMouseDown: e => {
          setValue(null);
          e.preventDefault();
        },
        children: [jsxRuntime.jsx(XMarkIcon, {}), " "]
      }), jsxRuntime.jsx("span", {
        class: "fjs-select-arrow",
        onMouseDown: e => onAngelMouseDown(e),
        children: displayState.displayDropdown ? jsxRuntime.jsx(AngelUpIcon, {}) : jsxRuntime.jsx(AngelDownIcon, {})
      })]
    }), jsxRuntime.jsx("div", {
      class: "fjs-select-anchor",
      children: displayState.displayDropdown && jsxRuntime.jsx(DropdownList, {
        values: filteredOptions,
        getLabel: o => o.label,
        onValueSelected: o => {
          setValue(o);
          setIsDropdownExpanded(false);
        },
        listenerElement: searchbarRef.current
      })
    })]
  });
}

function SimpleSelect(props) {
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
  } = hooks.useContext(FormContext$1);
  const [isDropdownExpanded, setIsDropdownExpanded] = hooks.useState(false);
  const selectRef = hooks.useRef();
  const {
    state: loadState,
    values: options
  } = useValuesAsync(field);

  // We cache a map of option values to their index so that we don't need to search the whole options array every time to correlate the label
  const valueToOptionMap = hooks.useMemo(() => Object.assign({}, ...options.map((o, x) => ({
    [o.value]: options[x]
  }))), [options]);
  const valueLabel = hooks.useMemo(() => value && valueToOptionMap[value] && valueToOptionMap[value].label || '', [value, valueToOptionMap]);
  const setValue = hooks.useCallback(option => {
    props.onChange({
      value: option && option.value || null,
      field
    });
  }, [field, props]);
  const displayState = hooks.useMemo(() => {
    const ds = {};
    ds.componentReady = !disabled && !readonly && loadState === LOAD_STATES.LOADED;
    ds.displayCross = ds.componentReady && value !== null && value !== undefined;
    ds.displayDropdown = !disabled && !readonly && isDropdownExpanded;
    return ds;
  }, [disabled, isDropdownExpanded, loadState, value]);
  const onMouseDown = hooks.useCallback(e => {
    const select = selectRef.current;
    setIsDropdownExpanded(!isDropdownExpanded);
    if (isDropdownExpanded) {
      select.blur();
    } else {
      select.focus();
    }
    e.preventDefault();
  }, [isDropdownExpanded]);
  const initialFocusIndex = hooks.useMemo(() => value && minDash.findIndex(options, o => o.value === value) || 0, [options, value]);
  return jsxRuntime.jsxs(jsxRuntime.Fragment, {
    children: [jsxRuntime.jsxs("div", {
      ref: selectRef,
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
      children: [jsxRuntime.jsx("div", {
        class: classNames('fjs-select-display', {
          'fjs-select-placeholder': !value
        }),
        id: prefixId(`${id}-display`, formId),
        children: valueLabel || 'Select'
      }), !disabled && jsxRuntime.jsx("input", {
        id: prefixId(`${id}-search`, formId),
        class: "fjs-select-hidden-input",
        value: valueLabel,
        onFocus: () => !readonly && setIsDropdownExpanded(true),
        onBlur: () => !readonly && setIsDropdownExpanded(false),
        "aria-describedby": props['aria-describedby']
      }), displayState.displayCross && jsxRuntime.jsx("span", {
        class: "fjs-select-cross",
        onMouseDown: e => {
          setValue(null);
          e.stopPropagation();
        },
        children: jsxRuntime.jsx(XMarkIcon, {})
      }), jsxRuntime.jsx("span", {
        class: "fjs-select-arrow",
        children: displayState.displayDropdown ? jsxRuntime.jsx(AngelUpIcon, {}) : jsxRuntime.jsx(AngelDownIcon, {})
      })]
    }), jsxRuntime.jsx("div", {
      class: "fjs-select-anchor",
      children: displayState.displayDropdown && jsxRuntime.jsx(DropdownList, {
        values: options,
        getLabel: o => o.label,
        initialFocusIndex: initialFocusIndex,
        onValueSelected: o => {
          setValue(o);
          setIsDropdownExpanded(false);
        },
        listenerElement: selectRef.current
      })
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
    validate = {}
  } = field;
  const {
    required
  } = validate;
  const {
    formId
  } = hooks.useContext(FormContext$1);
  const errorMessageId = errors.length === 0 ? undefined : `${prefixId(id, formId)}-error-message`;
  const selectProps = hooks.useMemo(() => ({
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
  return jsxRuntime.jsxs("div", {
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
    children: [jsxRuntime.jsx(Label, {
      id: prefixId(`${id}-search`, formId),
      label: label,
      required: required
    }), searchable ? jsxRuntime.jsx(SearchableSelect, {
      ...selectProps
    }) : jsxRuntime.jsx(SimpleSelect, {
      ...selectProps
    }), jsxRuntime.jsx(Description, {
      description: description
    }), jsxRuntime.jsx(Errors, {
      errors: errors,
      id: errorMessageId
    })]
  });
}
Select.config = {
  type: type$5,
  keyed: true,
  label: 'Select',
  group: 'selection',
  emptyValue: null,
  sanitizeValue: sanitizeSingleSelectValue,
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
  return jsxRuntime.jsx("div", {
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
  } = hooks.useContext(FormContext$1);
  const errorMessageId = errors.length === 0 ? undefined : `${prefixId(id, formId)}-error-message`;
  const [filter, setFilter] = hooks.useState('');
  const [filteredOptions, setFilteredOptions] = hooks.useState([]);
  const [isDropdownExpanded, setIsDropdownExpanded] = hooks.useState(false);
  const [hasOptionsLeft, setHasOptionsLeft] = hooks.useState(true);
  const [isEscapeClosed, setIsEscapeClose] = hooks.useState(false);
  const searchbarRef = hooks.useRef();
  const {
    state: loadState,
    values: options
  } = useValuesAsync(field);

  // We cache a map of option values to their index so that we don't need to search the whole options array every time to correlate the label
  const valueToOptionMap = hooks.useMemo(() => Object.assign({}, ...options.map((o, x) => ({
    [o.value]: options[x]
  }))), [options]);

  // Usage of stringify is necessary here because we want this effect to only trigger when there is a value change to the array
  hooks.useEffect(() => {
    if (loadState === LOAD_STATES.LOADED) {
      setFilteredOptions(options.filter(o => o.label && o.value && o.label.toLowerCase().includes(filter.toLowerCase()) && !values.includes(o.value)));
    } else {
      setFilteredOptions([]);
    }
  }, [filter, JSON.stringify(values), options, loadState]);
  hooks.useEffect(() => {
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
  const shouldDisplayDropdown = hooks.useMemo(() => !disabled && loadState === LOAD_STATES.LOADED && isDropdownExpanded && !isEscapeClosed, [disabled, isDropdownExpanded, isEscapeClosed, loadState]);
  return jsxRuntime.jsxs("div", {
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
    children: [jsxRuntime.jsx(Label, {
      label: label,
      required: required,
      id: prefixId(`${id}-search`, formId)
    }), jsxRuntime.jsxs("div", {
      class: classNames('fjs-taglist', {
        'fjs-disabled': disabled,
        'fjs-readonly': readonly
      }),
      children: [loadState === LOAD_STATES.LOADED && jsxRuntime.jsx("div", {
        class: "fjs-taglist-tags",
        children: values.map(v => {
          return jsxRuntime.jsxs("div", {
            class: classNames('fjs-taglist-tag', {
              'fjs-disabled': disabled,
              'fjs-readonly': readonly
            }),
            onMouseDown: e => e.preventDefault(),
            children: [jsxRuntime.jsx("span", {
              class: "fjs-taglist-tag-label",
              children: valueToOptionMap[v] ? valueToOptionMap[v].label : `unexpected value{${v}}`
            }), !disabled && !readonly && jsxRuntime.jsx("button", {
              type: "button",
              title: "Remove tag",
              class: "fjs-taglist-tag-remove",
              onClick: event => onTagRemoveClick(event, v),
              children: jsxRuntime.jsx(XMarkIcon, {})
            })]
          });
        })
      }), jsxRuntime.jsx("input", {
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
    }), jsxRuntime.jsx("div", {
      class: "fjs-taglist-anchor",
      children: shouldDisplayDropdown && jsxRuntime.jsx(DropdownList, {
        values: filteredOptions,
        getLabel: o => o.label,
        onValueSelected: o => selectValue(o.value),
        emptyListMessage: hasOptionsLeft ? 'No results' : 'All values selected',
        listenerElement: searchbarRef.current
      })
    }), jsxRuntime.jsx(Description, {
      description: description
    }), jsxRuntime.jsx(Errors, {
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
  const safeHtml = hooks.useMemo(() => {
    const html = markdownRenderer.render(markdown);
    return sanitizeHTML(html);
  }, [markdownRenderer, markdown]);
  const OverridenTargetLink = hooks.useMemo(() => BuildOverridenTargetLink(textLinkTarget), [textLinkTarget]);
  const componentOverrides = hooks.useMemo(() => {
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
  return jsxRuntime.jsx("div", {
    class: formFieldClasses(type$2),
    children: jsxRuntime.jsx(Markup, {
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
  group: 'presentation',
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
    return jsxRuntime.jsx("a", {
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
  return jsxRuntime.jsx("a", {
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
  } = hooks.useContext(FormContext$1);
  const errorMessageId = errors.length === 0 ? undefined : `${prefixId(id, formId)}-error-message`;
  return jsxRuntime.jsxs("div", {
    class: formFieldClasses(type$1, {
      errors,
      disabled,
      readonly
    }),
    children: [jsxRuntime.jsx(Label, {
      id: prefixId(id, formId),
      label: label,
      required: required
    }), jsxRuntime.jsx(TemplatedInputAdorner, {
      disabled: disabled,
      readonly: readonly,
      pre: prefixAdorner,
      post: suffixAdorner,
      children: jsxRuntime.jsx("input", {
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
    }), jsxRuntime.jsx(Description, {
      description: description
    }), jsxRuntime.jsx(Errors, {
      errors: errors,
      id: errorMessageId
    })]
  });
}
Textfield.config = {
  type: type$1,
  keyed: true,
  label: 'Text field',
  group: 'basic-input',
  emptyValue: '',
  sanitizeValue: ({
    value
  }) => {
    if (minDash.isArray(value) || minDash.isObject(value)) {
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
  const textareaRef = hooks.useRef();
  const onInput = ({
    target
  }) => {
    props.onChange({
      field,
      value: target.value
    });
  };
  hooks.useLayoutEffect(() => {
    autoSizeTextarea(textareaRef.current);
  }, [value]);
  hooks.useEffect(() => {
    autoSizeTextarea(textareaRef.current);
  }, []);
  const {
    formId
  } = hooks.useContext(FormContext$1);
  const errorMessageId = errors.length === 0 ? undefined : `${prefixId(id, formId)}-error-message`;
  return jsxRuntime.jsxs("div", {
    class: formFieldClasses(type, {
      errors,
      disabled,
      readonly
    }),
    children: [jsxRuntime.jsx(Label, {
      id: prefixId(id, formId),
      label: label,
      required: required
    }), jsxRuntime.jsx("textarea", {
      class: "fjs-textarea",
      disabled: disabled,
      readonly: readonly,
      id: prefixId(id, formId),
      onInput: onInput,
      onBlur: onBlur,
      value: value,
      ref: textareaRef,
      "aria-describedby": errorMessageId
    }), jsxRuntime.jsx(Description, {
      description: description
    }), jsxRuntime.jsx(Errors, {
      errors: errors,
      id: errorMessageId
    })]
  });
}
Textarea.config = {
  type,
  keyed: true,
  label: 'Text area',
  group: 'basic-input',
  emptyValue: '',
  sanitizeValue: ({
    value
  }) => minDash.isArray(value) || minDash.isObject(value) ? '' : String(value),
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
  return /*#__PURE__*/React__namespace.createElement("svg", _extends$e({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$c || (_path$c = /*#__PURE__*/React__namespace.createElement("path", {
    fillRule: "evenodd",
    d: "M45 17a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V20a3 3 0 0 1 3-3h36zm-9 8.889H18v2.222h18v-2.222z"
  })));
};
var ButtonIcon = SvgButton;

var _path$b;
function _extends$d() { _extends$d = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$d.apply(this, arguments); }
var SvgCheckbox = function SvgCheckbox(props) {
  return /*#__PURE__*/React__namespace.createElement("svg", _extends$d({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$b || (_path$b = /*#__PURE__*/React__namespace.createElement("path", {
    d: "M34 18H20a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V20a2 2 0 0 0-2-2zm-9 14-5-5 1.41-1.41L25 29.17l7.59-7.59L34 23l-9 9z"
  })));
};
var CheckboxIcon = SvgCheckbox;

var _g, _use, _use2, _use3, _defs;
function _extends$c() { _extends$c = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$c.apply(this, arguments); }
var SvgChecklist = function SvgChecklist(props) {
  return /*#__PURE__*/React__namespace.createElement("svg", _extends$c({
    xmlns: "http://www.w3.org/2000/svg",
    xmlnsXlink: "http://www.w3.org/1999/xlink",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _g || (_g = /*#__PURE__*/React__namespace.createElement("g", {
    fillRule: "evenodd"
  }, /*#__PURE__*/React__namespace.createElement("use", {
    xlinkHref: "#Checklist_svg__a"
  }), /*#__PURE__*/React__namespace.createElement("use", {
    xlinkHref: "#Checklist_svg__a",
    y: 24
  }), /*#__PURE__*/React__namespace.createElement("use", {
    xlinkHref: "#Checklist_svg__a",
    y: 12
  }))), _use || (_use = /*#__PURE__*/React__namespace.createElement("use", {
    xlinkHref: "#Checklist_svg__b"
  })), _use2 || (_use2 = /*#__PURE__*/React__namespace.createElement("use", {
    xlinkHref: "#Checklist_svg__b",
    y: 12
  })), _use3 || (_use3 = /*#__PURE__*/React__namespace.createElement("use", {
    xlinkHref: "#Checklist_svg__b",
    y: 24
  })), _defs || (_defs = /*#__PURE__*/React__namespace.createElement("defs", null, /*#__PURE__*/React__namespace.createElement("path", {
    id: "Checklist_svg__a",
    d: "M18 12h-6v6h6v-6zm-6-2a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-6z"
  }), /*#__PURE__*/React__namespace.createElement("path", {
    id: "Checklist_svg__b",
    d: "M23 14.5a1 1 0 0 1 1-1h19a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H24a1 1 0 0 1-1-1v-1z"
  }))));
};
var ChecklistIcon = SvgChecklist;

var _path$a, _path2$3, _path3;
function _extends$b() { _extends$b = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$b.apply(this, arguments); }
var SvgDatetime = function SvgDatetime(props) {
  return /*#__PURE__*/React__namespace.createElement("svg", _extends$b({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$a || (_path$a = /*#__PURE__*/React__namespace.createElement("path", {
    fillRule: "evenodd",
    d: "M37.908 13.418h-5.004v-2.354h-1.766v2.354H21.13v-2.354h-1.766v2.354H14.36a2.07 2.07 0 0 0-2.06 2.06v23.549a2.07 2.07 0 0 0 2.06 2.06h6.77v-1.766h-6.358a.707.707 0 0 1-.706-.706V15.89c0-.39.316-.707.706-.707h4.592v2.355h1.766v-2.355h10.008v2.355h1.766v-2.355h4.592a.71.71 0 0 1 .707.707v6.358h1.765v-6.77c0-1.133-.927-2.06-2.06-2.06z"
  })), _path2$3 || (_path2$3 = /*#__PURE__*/React__namespace.createElement("path", {
    d: "m35.13 37.603 1.237-1.237-3.468-3.475v-5.926h-1.754v6.654l3.984 3.984Z"
  })), _path3 || (_path3 = /*#__PURE__*/React__namespace.createElement("path", {
    fillRule: "evenodd",
    d: "M23.08 36.962a9.678 9.678 0 1 0 17.883-7.408 9.678 9.678 0 0 0-17.882 7.408Zm4.54-10.292a7.924 7.924 0 1 1 8.805 13.177A7.924 7.924 0 0 1 27.62 26.67Z"
  })));
};
var DatetimeIcon = SvgDatetime;

var _path$9, _path2$2;
function _extends$a() { _extends$a = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$a.apply(this, arguments); }
var SvgTaglist = function SvgTaglist(props) {
  return /*#__PURE__*/React__namespace.createElement("svg", _extends$a({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$9 || (_path$9 = /*#__PURE__*/React__namespace.createElement("path", {
    fillRule: "evenodd",
    d: "M45 16a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V19a3 3 0 0 1 3-3h36Zm0 2H9a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h36a1 1 0 0 0 1-1V19a1 1 0 0 0-1-1Z"
  })), _path2$2 || (_path2$2 = /*#__PURE__*/React__namespace.createElement("path", {
    d: "M11 22a1 1 0 0 1 1-1h19a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H12a1 1 0 0 1-1-1V22Z"
  })));
};
var TaglistIcon = SvgTaglist;

var _rect, _rect2, _rect3;
function _extends$9() { _extends$9 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$9.apply(this, arguments); }
var SvgForm = function SvgForm(props) {
  return /*#__PURE__*/React__namespace.createElement("svg", _extends$9({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54
  }, props), _rect || (_rect = /*#__PURE__*/React__namespace.createElement("rect", {
    width: 24,
    height: 4,
    x: 15,
    y: 17,
    rx: 1
  })), _rect2 || (_rect2 = /*#__PURE__*/React__namespace.createElement("rect", {
    width: 24,
    height: 4,
    x: 15,
    y: 25,
    rx: 1
  })), _rect3 || (_rect3 = /*#__PURE__*/React__namespace.createElement("rect", {
    width: 13,
    height: 4,
    x: 15,
    y: 33,
    rx: 1
  })));
};
var FormIcon = SvgForm;

var _path$8;
function _extends$8() { _extends$8 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$8.apply(this, arguments); }
var SvgGroup = function SvgGroup(props) {
  return /*#__PURE__*/React__namespace.createElement("svg", _extends$8({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$8 || (_path$8 = /*#__PURE__*/React__namespace.createElement("path", {
    fillRule: "evenodd",
    d: "M8 33v5a1 1 0 0 0 1 1h4v2H9a3 3 0 0 1-3-3v-5h2Zm18 6v2H15v-2h11Zm13 0v2H28v-2h11Zm9-6v5a3 3 0 0 1-3 3h-4v-2h4a1 1 0 0 0 .993-.883L46 38v-5h2ZM8 22v9H6v-9h2Zm40 0v9h-2v-9h2Zm-35-9v2H9a1 1 0 0 0-.993.883L8 16v4H6v-4a3 3 0 0 1 3-3h4Zm32 0a3 3 0 0 1 3 3v4h-2v-4a1 1 0 0 0-.883-.993L45 15h-4v-2h4Zm-6 0v2H28v-2h11Zm-13 0v2H15v-2h11Z"
  })));
};
var GroupIcon = SvgGroup;

var _path$7;
function _extends$7() { _extends$7 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$7.apply(this, arguments); }
var SvgNumber = function SvgNumber(props) {
  return /*#__PURE__*/React__namespace.createElement("svg", _extends$7({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$7 || (_path$7 = /*#__PURE__*/React__namespace.createElement("path", {
    fillRule: "evenodd",
    d: "M45 16a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V19a3 3 0 0 1 3-3h36zm0 2H9a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h36a1 1 0 0 0 1-1V19a1 1 0 0 0-1-1zM35 28.444h7l-3.5 4-3.5-4zM35 26h7l-3.5-4-3.5 4z"
  })));
};
var NumberIcon = SvgNumber;

var _path$6;
function _extends$6() { _extends$6 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$6.apply(this, arguments); }
var SvgRadio = function SvgRadio(props) {
  return /*#__PURE__*/React__namespace.createElement("svg", _extends$6({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$6 || (_path$6 = /*#__PURE__*/React__namespace.createElement("path", {
    d: "M27 22c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0-5c-5.52 0-10 4.48-10 10s4.48 10 10 10 10-4.48 10-10-4.48-10-10-10zm0 18a8 8 0 1 1 0-16 8 8 0 1 1 0 16z"
  })));
};
var RadioIcon = SvgRadio;

var _path$5;
function _extends$5() { _extends$5 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$5.apply(this, arguments); }
var SvgSelect = function SvgSelect(props) {
  return /*#__PURE__*/React__namespace.createElement("svg", _extends$5({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$5 || (_path$5 = /*#__PURE__*/React__namespace.createElement("path", {
    fillRule: "evenodd",
    d: "M45 16a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V19a3 3 0 0 1 3-3h36zm0 2H9a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h36a1 1 0 0 0 1-1V19a1 1 0 0 0-1-1zm-12 7h9l-4.5 6-4.5-6z"
  })));
};
var SelectIcon = SvgSelect;

var _path$4, _path2$1;
function _extends$4() { _extends$4 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$4.apply(this, arguments); }
var SvgSpacer = function SvgSpacer(props) {
  return /*#__PURE__*/React__namespace.createElement("svg", _extends$4({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$4 || (_path$4 = /*#__PURE__*/React__namespace.createElement("path", {
    stroke: "currentcolor",
    strokeLinecap: "square",
    strokeWidth: 2,
    d: "M9 23h36M9 31h36"
  })), _path2$1 || (_path2$1 = /*#__PURE__*/React__namespace.createElement("path", {
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
  return /*#__PURE__*/React__namespace.createElement("svg", _extends$3({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$3 || (_path$3 = /*#__PURE__*/React__namespace.createElement("path", {
    d: "M20.58 33.77h-3l-1.18-3.08H11l-1.1 3.08H7l5.27-13.54h2.89zm-5-5.36-1.86-5-1.83 5zM22 20.23h5.41a15.47 15.47 0 0 1 2.4.14 3.42 3.42 0 0 1 1.41.55 3.47 3.47 0 0 1 1 1.14 3 3 0 0 1 .42 1.58 3.26 3.26 0 0 1-1.91 2.94 3.63 3.63 0 0 1 1.91 1.22 3.28 3.28 0 0 1 .66 2 4 4 0 0 1-.43 1.8 3.63 3.63 0 0 1-1.09 1.4 3.89 3.89 0 0 1-1.83.65q-.69.07-3.3.09H22zm2.73 2.25v3.13h3.8a1.79 1.79 0 0 0 1.1-.49 1.41 1.41 0 0 0 .41-1 1.49 1.49 0 0 0-.35-1 1.54 1.54 0 0 0-1-.48c-.27 0-1.05-.05-2.34-.05zm0 5.39v3.62h2.57a11.52 11.52 0 0 0 1.88-.09 1.65 1.65 0 0 0 1-.54 1.6 1.6 0 0 0 .38-1.14 1.75 1.75 0 0 0-.29-1 1.69 1.69 0 0 0-.86-.62 9.28 9.28 0 0 0-2.41-.23zm19.62.92 2.65.84a5.94 5.94 0 0 1-2 3.29A5.74 5.74 0 0 1 41.38 34a5.87 5.87 0 0 1-4.44-1.84 7.09 7.09 0 0 1-1.73-5A7.43 7.43 0 0 1 37 21.87 6 6 0 0 1 41.54 20a5.64 5.64 0 0 1 4 1.47A5.33 5.33 0 0 1 47 24l-2.7.65a2.8 2.8 0 0 0-2.86-2.27A3.09 3.09 0 0 0 39 23.42a5.31 5.31 0 0 0-.93 3.5 5.62 5.62 0 0 0 .93 3.65 3 3 0 0 0 2.4 1.09 2.72 2.72 0 0 0 1.82-.66 4 4 0 0 0 1.13-2.21z"
  })));
};
var TextIcon = SvgText;

var _path$2;
function _extends$2() { _extends$2 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$2.apply(this, arguments); }
var SvgTextfield = function SvgTextfield(props) {
  return /*#__PURE__*/React__namespace.createElement("svg", _extends$2({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$2 || (_path$2 = /*#__PURE__*/React__namespace.createElement("path", {
    fillRule: "evenodd",
    d: "M45 16a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V19a3 3 0 0 1 3-3h36zm0 2H9a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h36a1 1 0 0 0 1-1V19a1 1 0 0 0-1-1zm-32 4v10h-2V22h2z"
  })));
};
var TextfieldIcon = SvgTextfield;

var _path$1;
function _extends$1() { _extends$1 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$1.apply(this, arguments); }
var SvgTextarea = function SvgTextarea(props) {
  return /*#__PURE__*/React__namespace.createElement("svg", _extends$1({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path$1 || (_path$1 = /*#__PURE__*/React__namespace.createElement("path", {
    fillRule: "evenodd",
    d: "M45 13a3 3 0 0 1 3 3v22a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V16a3 3 0 0 1 3-3h36zm0 2H9a1 1 0 0 0-1 1v22a1 1 0 0 0 1 1h36a1 1 0 0 0 1-1V16a1 1 0 0 0-1-1zm-1.136 15.5.849.849-6.364 6.364-.849-.849 6.364-6.364zm.264 3.5.849.849-2.828 2.828-.849-.849L44.128 34zM13 19v10h-2V19h2z"
  })));
};
var TextareaIcon = SvgTextarea;

var _path, _path2;
function _extends() { _extends = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }
var SvgImage = function SvgImage(props) {
  return /*#__PURE__*/React__namespace.createElement("svg", _extends({
    xmlns: "http://www.w3.org/2000/svg",
    width: 54,
    height: 54,
    fill: "currentcolor"
  }, props), _path || (_path = /*#__PURE__*/React__namespace.createElement("path", {
    fillRule: "evenodd",
    d: "M34.636 21.91A3.818 3.818 0 1 1 27 21.908a3.818 3.818 0 0 1 7.636 0Zm-2 0A1.818 1.818 0 1 1 29 21.908a1.818 1.818 0 0 1 3.636 0Z",
    clipRule: "evenodd"
  })), _path2 || (_path2 = /*#__PURE__*/React__namespace.createElement("path", {
    fillRule: "evenodd",
    d: "M15 13a2 2 0 0 0-2 2v24a2 2 0 0 0 2 2h24a2 2 0 0 0 2-2V15a2 2 0 0 0-2-2H15Zm24 2H15v12.45l4.71-4.709a1.91 1.91 0 0 1 2.702 0l6.695 6.695 2.656-1.77a1.91 1.91 0 0 1 2.411.239L39 32.73V15ZM15 39v-8.754a.975.975 0 0 0 .168-.135l5.893-5.893 6.684 6.685a1.911 1.911 0 0 0 2.41.238l2.657-1.77 6.02 6.02c.052.051.108.097.168.135V39H15Z",
    clipRule: "evenodd"
  })));
};
var ImageIcon = SvgImage;

const iconsByType = type => {
  return {
    button: ButtonIcon,
    checkbox: CheckboxIcon,
    checklist: ChecklistIcon,
    columns: GroupIcon,
    datetime: DatetimeIcon,
    group: GroupIcon,
    image: ImageIcon,
    number: NumberIcon,
    radio: RadioIcon,
    select: SelectIcon,
    spacer: SpacerIcon,
    taglist: TaglistIcon,
    text: TextIcon,
    textfield: TextfieldIcon,
    textarea: TextareaIcon,
    default: FormIcon
  }[type];
};

const formFields = [Button, Checkbox, Checklist, FormComponent$1, Group, Image, Numberfield, Datetime, Radio, Select, Spacer, Taglist, Text, Textfield, Textarea];

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
    const [state, setState] = hooks.useState(form._getState());
    const formContext = {
      getService(type, strict = true) {
        return injector.get(type, strict);
      },
      formId: form._id
    };
    eventBus.on('changed', newState => {
      setState(newState);
    });
    const onChange = hooks.useCallback(update => form._update(update), [form]);
    const {
      properties
    } = state;
    const {
      readOnly
    } = properties;
    const onSubmit = hooks.useCallback(() => {
      if (!readOnly) {
        form.submit();
      }
    }, [form, readOnly]);
    const onReset = hooks.useCallback(() => form.reset(), [form]);
    const {
      schema
    } = state;
    if (!schema) {
      return null;
    }
    return jsxRuntime.jsx(FormContext$1.Provider, {
      value: formContext,
      children: jsxRuntime.jsx(FormComponent, {
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
    preact.render(jsxRuntime.jsx(App, {}), container);
  });
  eventBus.on('form.destroy', () => {
    preact.render(null, container);
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
    const errors = formFieldRegistry.getAll().reduce((errors, field) => {
      const {
        disabled
      } = field;
      if (disabled) {
        return errors;
      }
      const value = minDash.get(data, pathRegistry.getValuePath(field));
      const fieldErrors = validator.validateField(field, value);
      return minDash.set(errors, [field.id], fieldErrors.length ? fieldErrors : undefined);
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
    if (minDash.isString(parentNode)) {
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
    const properties = minDash.set(this._getState().properties, [property], value);
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
    minDash.set(data, pathRegistry.getValuePath(field), value);
    minDash.set(errors, [field.id], fieldErrors.length ? fieldErrors : undefined);
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
      const value = minDash.get(formData, valuePath);
      return minDash.set(previous, valuePath, value);
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
        let valueData = minDash.get(data, valuePath);
        if (!minDash.isUndefined(valueData) && fieldConfig.sanitizeValue) {
          valueData = fieldConfig.sanitizeValue({
            formField,
            data,
            value: valueData
          });
        }
        const initializedFieldValue = !minDash.isUndefined(valueData) ? valueData : !minDash.isUndefined(defaultValue) ? defaultValue : fieldConfig.emptyValue;
        return minDash.set(initializedData, valuePath, initializedFieldValue);
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

exports.Button = Button;
exports.Checkbox = Checkbox;
exports.Checklist = Checklist;
exports.ConditionChecker = ConditionChecker;
exports.DATETIME_SUBTYPES = DATETIME_SUBTYPES;
exports.DATETIME_SUBTYPES_LABELS = DATETIME_SUBTYPES_LABELS;
exports.DATETIME_SUBTYPE_PATH = DATETIME_SUBTYPE_PATH;
exports.DATE_DISALLOW_PAST_PATH = DATE_DISALLOW_PAST_PATH;
exports.DATE_LABEL_PATH = DATE_LABEL_PATH;
exports.Datetime = Datetime;
exports.Default = FormComponent$1;
exports.ExpressionLanguageModule = ExpressionLanguageModule;
exports.FeelExpressionLanguage = FeelExpressionLanguage;
exports.FeelersTemplating = FeelersTemplating;
exports.FieldFactory = FieldFactory;
exports.Form = Form;
exports.FormComponent = FormComponent;
exports.FormContext = FormContext$1;
exports.FormField = FormField;
exports.FormFieldRegistry = FormFieldRegistry;
exports.FormFields = FormFields;
exports.FormLayouter = FormLayouter;
exports.FormRenderContext = FormRenderContext$1;
exports.Group = Group;
exports.Image = Image;
exports.Importer = Importer;
exports.MINUTES_IN_DAY = MINUTES_IN_DAY;
exports.MarkdownModule = MarkdownModule;
exports.MarkdownRenderer = MarkdownRenderer;
exports.Numberfield = Numberfield;
exports.PathRegistry = PathRegistry;
exports.Radio = Radio;
exports.Select = Select;
exports.Spacer = Spacer;
exports.TIME_INTERVAL_PATH = TIME_INTERVAL_PATH;
exports.TIME_LABEL_PATH = TIME_LABEL_PATH;
exports.TIME_SERIALISINGFORMAT_LABELS = TIME_SERIALISINGFORMAT_LABELS;
exports.TIME_SERIALISING_FORMATS = TIME_SERIALISING_FORMATS;
exports.TIME_SERIALISING_FORMAT_PATH = TIME_SERIALISING_FORMAT_PATH;
exports.TIME_USE24H_PATH = TIME_USE24H_PATH;
exports.Taglist = Taglist;
exports.Text = Text;
exports.Textarea = Textarea;
exports.Textfield = Textfield;
exports.VALUES_SOURCES = VALUES_SOURCES;
exports.VALUES_SOURCES_DEFAULTS = VALUES_SOURCES_DEFAULTS;
exports.VALUES_SOURCES_LABELS = VALUES_SOURCES_LABELS;
exports.VALUES_SOURCES_PATHS = VALUES_SOURCES_PATHS;
exports.VALUES_SOURCE_DEFAULT = VALUES_SOURCE_DEFAULT;
exports.ViewerCommands = ViewerCommands;
exports.ViewerCommandsModule = ViewerCommandsModule;
exports.clone = clone;
exports.createForm = createForm;
exports.createFormContainer = createFormContainer;
exports.createInjector = createInjector;
exports.formFields = formFields;
exports.generateIdForType = generateIdForType;
exports.generateIndexForType = generateIndexForType;
exports.getSchemaVariables = getSchemaVariables;
exports.getValuesSource = getValuesSource;
exports.iconsByType = iconsByType;
exports.isRequired = isRequired;
exports.pathParse = pathParse;
exports.pathsEqual = pathsEqual;
exports.runRecursively = runRecursively;
exports.schemaVersion = schemaVersion;
//# sourceMappingURL=index.cjs.map
