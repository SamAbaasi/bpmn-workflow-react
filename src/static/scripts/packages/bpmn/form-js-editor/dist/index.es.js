import {
  FormFieldRegistry as FormFieldRegistry$1, iconsByType, Text as Text$1, FormFields, formFields, FormContext, FormRenderContext, FormComponent, Importer, PathRegistry, FormLayouter, FieldFactory, runRecursively, clone, getSchemaVariables, DATETIME_SUBTYPES, DATE_LABEL_PATH, TIME_LABEL_PATH, DATETIME_SUBTYPE_PATH, DATETIME_SUBTYPES_LABELS, TIME_SERIALISING_FORMAT_PATH, TIME_SERIALISING_FORMATS, TIME_INTERVAL_PATH, TIME_USE24H_PATH, DATE_DISALLOW_PAST_PATH, TIME_SERIALISINGFORMAT_LABELS, getValuesSource, VALUES_SOURCES, VALUES_SOURCES_DEFAULTS, VALUES_SOURCES_PATHS, VALUES_SOURCES_LABELS, FeelExpressionLanguage, createFormContainer, createInjector, MarkdownModule, schemaVersion, MEGA_DROPDOWN_VIEW_PATH
} from 'src/static/scripts/packages/bpmn/form-js-viewer';
export { schemaVersion } from 'src/static/scripts/packages/bpmn/form-js-viewer';
import Ids from 'ids';
import { isArray, isFunction, isNumber, bind, assign, debounce, forEach, get, isObject, uniqueBy, sortBy, find, set as set$1, isString, isUndefined, without, has } from 'min-dash';
import classnames from 'classnames';
import { jsx, jsxs, Fragment as Fragment$1 } from 'preact/jsx-runtime';
import { useContext, useState, useMemo, useEffect, useCallback, useRef as useRef$1, useLayoutEffect } from 'preact/hooks';
import { createContext, Fragment, render, createElement } from 'preact';
import * as React from 'preact/compat';
import { createPortal, useRef, useContext as useContext$1, useEffect as useEffect$1, forwardRef } from 'preact/compat';
import dragula from 'src/static/scripts/packages/bpmn/draggle';
import { classes, query, closest, event, matches, domify } from 'min-dom';
import { mutate } from 'array-move';
import { FeelersEditor } from 'feelers';
import FeelEditor from 'src/static/scripts/packages/bpmn/feel-editor';
import { lineNumbers } from '@codemirror/view';
import * as focusTrap from 'focus-trap';
import Big from 'big.js';
import { read, utils, writeFile, } from 'xlsx';

var FN_REF = '__fn';
var DEFAULT_PRIORITY$2 = 1000;
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
    priority = DEFAULT_PRIORITY$2;
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
    priority = DEFAULT_PRIORITY$2;
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

/**
 * A factory to create a configurable debouncer.
 *
 * @param {number|boolean} [config=true]
 */
function DebounceFactory(config = true) {
  const timeout = typeof config === 'number' ? config : config ? 300 : 0;
  if (timeout) {
    return fn => debounce(fn, timeout);
  } else {
    return fn => fn;
  }
}
DebounceFactory.$inject = ['config.debounce'];

class FormFieldRegistry extends FormFieldRegistry$1 {
  /**
   * Updates a form fields id.
   *
   * @param {Object} formField
   * @param {string} newId
   */
  updateId(formField, newId) {
    this._validateId(newId);
    this._eventBus.fire('formField.updateId', {
      formField,
      newId: newId
    });
    this.remove(formField);
    formField.id = newId;
    this.add(formField);

    // TODO(nikku): make this a proper object graph so we
    // do not have to deal with IDs this way...
    if ('components' in formField) {
      for (const component of formField.components) {
        component._parent = newId;
      }
    }
  }

  /**
   * Validate the suitability of the given id and signals a problem
   * with an exception.
   *
   * @param {string} id
   *
   * @throws {Error} if id is empty or already assigned
   */
  _validateId(id) {
    if (!id) {
      throw new Error('formField must have an id');
    }
    if (this.get(id)) {
      throw new Error('formField with id ' + id + ' already added');
    }
  }
}

const MAX_COLUMNS_PER_ROW = 16;
const MAX_COLUMNS = 16;
const MIN_COLUMNS = 2;
const MAX_FIELDS_PER_ROW = 4;
class FormLayoutValidator {
  /**
   * @constructor
   *
   * @param { import('./FormLayouter').default } formLayouter
   * @param { import('./FormFieldRegistry').default } formFieldRegistry
   */
  constructor(formLayouter, formFieldRegistry) {
    this._formLayouter = formLayouter;
    this._formFieldRegistry = formFieldRegistry;
  }
  validateField(field = {}, columns, row) {
    // allow empty (auto columns)
    if (Number.isInteger(columns)) {
      // allow minimum cols
      if (columns < MIN_COLUMNS) {
        return `Minimum ${MIN_COLUMNS} columns are allowed`;
      }

      // allow maximum cols
      if (columns > MAX_COLUMNS) {
        return `Maximum ${MAX_COLUMNS} columns are allowed`;
      }
    }
    if (!row) {
      row = this._formLayouter.getRowForField(field);
    }

    // calculate columns with and without updated field
    let sumColumns = parseInt(columns) || 0;
    let sumFields = 1;
    let sumAutoCols = columns ? 0 : 1;
    row.components.forEach(id => {
      if (field.id === id) {
        return;
      }
      const component = this._formFieldRegistry.get(id);
      const cols = (component.layout || {}).columns;
      if (!cols) {
        sumAutoCols++;
      }
      sumColumns += parseInt(cols) || 0;
      sumFields++;
    });

    // do not allow overflows
    if (sumColumns > MAX_COLUMNS_PER_ROW || sumAutoCols > 0 && sumColumns > calculateMaxColumnsWithAuto(sumAutoCols) || columns === MAX_COLUMNS_PER_ROW && sumFields > 1) {
      return `New value exceeds the maximum of ${MAX_COLUMNS_PER_ROW} columns per row`;
    }
    if (sumFields > MAX_FIELDS_PER_ROW) {
      return `Maximum ${MAX_FIELDS_PER_ROW} fields per row are allowed`;
    }
    return null;
  }
}
FormLayoutValidator.$inject = ['formLayouter', 'formFieldRegistry'];

// helper //////////////////////

// on normal screen sizes, auto columns take minimum 2 columns
function calculateMaxColumnsWithAuto(autoCols) {
  return MAX_COLUMNS_PER_ROW - autoCols * 2;
}

const emptyImage = createEmptyImage();
function editorFormFieldClasses(type, {
  disabled = false
} = {}) {
  if (!type) {
    throw new Error('type required');
  }
  return classnames('fjs-form-field', `fjs-form-field-${type}`, {
    'fjs-disabled': disabled
  });
}

/**
 * Add a dragger that calls back the passed function with
 * { event, delta } on drag.
 *
 * @example
 *
 * function dragMove(event, delta) {
 *   // we are dragging (!!)
 * }
 *
 * domElement.addEventListener('dragstart', dragger(dragMove));
 *
 * @param {Function} fn
 *
 * @return {Function} drag start callback function
 */
function createDragger$1(fn) {
  let self;
  let startX, startY;

  /** drag start */
  function onDragStart(event) {
    self = this;
    startX = event.clientX;
    startY = event.clientY;

    // (1) hide drag preview image
    if (event.dataTransfer) {
      event.dataTransfer.setDragImage(emptyImage, 0, 0);
    }

    // (2) setup drag listeners

    // attach drag + cleanup event
    document.addEventListener('dragover', onDrag);
    document.addEventListener('dragend', onEnd);
    document.addEventListener('drop', preventDefault$1);
  }
  function onDrag(event) {
    const delta = {
      x: event.clientX - startX,
      y: event.clientY - startY
    };

    // call provided fn with event, delta
    return fn.call(self, event, delta);
  }
  function onEnd() {
    document.removeEventListener('dragover', onDrag);
    document.removeEventListener('dragend', onEnd);
    document.removeEventListener('drop', preventDefault$1);
  }
  return onDragStart;
}

/**
 * Throttle function call according UI update cycle.
 *
 * @param  {Function} fn
 *
 * @return {Function} throttled fn
 */
function throttle(fn) {
  let active = false;
  let lastArgs = [];
  let lastThis = undefined;
  return function (...args) {
    lastArgs = args;
    lastThis = this;
    if (active) {
      return;
    }
    active = true;
    fn.apply(lastThis, lastArgs);
    window.requestAnimationFrame(function () {
      lastArgs = lastThis = active = undefined;
    });
  };
}
function preventDefault$1(event) {
  event.preventDefault();
  event.stopPropagation();
}
function createEmptyImage() {
  const img = new Image();
  img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  return img;
}

const DragAndDropContext = createContext({
  drake: null
});
var DragAndDropContext$1 = DragAndDropContext;

/**
 * @param {string} type
 * @param {boolean} [strict]
 *
 * @returns {any}
 */
function getService$1(type, strict) { }
const FormEditorContext = createContext({
  getService: getService$1
});
var FormEditorContext$1 = FormEditorContext;

function useService$1(type, strict) {
  const {
    getService
  } = useContext(FormEditorContext$1);
  return getService(type, strict);
}

var _path$4;
function _extends$4() { _extends$4 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$4.apply(this, arguments); }
var SvgClose = function SvgClose(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$4({
    xmlns: "http://www.w3.org/2000/svg",
    width: 16,
    height: 16,
    fill: "currentColor"
  }, props), _path$4 || (_path$4 = /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "m12 4.7-.7-.7L8 7.3 4.7 4l-.7.7L7.3 8 4 11.3l.7.7L8 8.7l3.3 3.3.7-.7L8.7 8 12 4.7Z",
    clipRule: "evenodd"
  })));
};
var CloseIcon = SvgClose;

var _path$3, _path2$1;
function _extends$3() { _extends$3 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$3.apply(this, arguments); }
var SvgDelete = function SvgDelete(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$3({
    xmlns: "http://www.w3.org/2000/svg",
    width: 16,
    height: 16,
    fill: "none"
  }, props), /*#__PURE__*/React.createElement("rect", {
    width: 16,
    height: 16,
    x: 0.536,
    fill: "#fff",
    rx: 3,
    style: {
      mixBlendMode: "multiply"
    }
  }), /*#__PURE__*/React.createElement("path", {
    fill: "#fff",
    d: "M0 0h16v16H0z",
    style: {
      mixBlendMode: "multiply"
    },
    transform: "translate(.536)"
  }), _path$3 || (_path$3 = /*#__PURE__*/React.createElement("path", {
    fill: "currentcolor",
    d: "M7.536 6h-1v6h1V6Zm3 0h-1v6h1V6Z"
  })), _path2$1 || (_path2$1 = /*#__PURE__*/React.createElement("path", {
    fill: "currentcolor",
    d: "M2.536 3v1h1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4h1V3h-12Zm2 11V4h8v10h-8Zm6-13h-4v1h4V1Z"
  })));
};
var DeleteIcon$1 = SvgDelete;

var _path$2;
function _extends$2() { _extends$2 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$2.apply(this, arguments); }
var SvgDraggable = function SvgDraggable(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$2({
    xmlns: "http://www.w3.org/2000/svg",
    xmlSpace: "preserve",
    width: 16,
    height: 16,
    fill: "currentcolor",
    viewBox: "0 0 32 32"
  }, props), _path$2 || (_path$2 = /*#__PURE__*/React.createElement("path", {
    d: "M10 6h4v4h-4zm8 0h4v4h-4zm-8 8h4v4h-4zm8 0h4v4h-4zm-8 8h4v4h-4zm8 0h4v4h-4z"
  })), /*#__PURE__*/React.createElement("path", {
    d: "M0 0h32v32H0z",
    style: {
      fill: "none"
    }
  }));
};
var DraggableIcon = SvgDraggable;

var _path$1;
function _extends$1() { _extends$1 = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends$1.apply(this, arguments); }
var SvgSearch = function SvgSearch(props) {
  return /*#__PURE__*/React.createElement("svg", _extends$1({
    xmlns: "http://www.w3.org/2000/svg",
    width: 15,
    height: 15,
    fill: "none"
  }, props), _path$1 || (_path$1 = /*#__PURE__*/React.createElement("path", {
    fill: "currentColor",
    d: "m14.5 13.793-3.776-3.776a5.508 5.508 0 1 0-.707.707l3.776 3.776.707-.707ZM2 6.5a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0Z"
  })));
};
var SearchIcon = SvgSearch;

var _path, _rect, _mask, _path2, _path3, _path4, _path5, _path6;
function _extends() { _extends = Object.assign ? Object.assign.bind() : function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }
var SvgEmptyForm = function SvgEmptyForm(props) {
  return /*#__PURE__*/React.createElement("svg", _extends({
    xmlns: "http://www.w3.org/2000/svg",
    width: 126,
    height: 96,
    fill: "none"
  }, props), _path || (_path = /*#__PURE__*/React.createElement("path", {
    fill: "#FF832B",
    fillRule: "evenodd",
    d: "M70 78v8a3 3 0 0 1-3 3h-8v-5h6v-6h5Zm0-16h-5V46h5v16Zm0-32h-5v-6h-6v-5h8a3 3 0 0 1 3 3v8ZM43 19v5H27v-5h16Zm-32 0v5H5v6H0v-8a3 3 0 0 1 3-3h8ZM0 46h5v16H0V46Zm0 32h5v6h6v5H3a3 3 0 0 1-3-3v-8Zm27 11v-5h16v5H27Z",
    clipRule: "evenodd"
  })), _rect || (_rect = /*#__PURE__*/React.createElement("rect", {
    width: 70,
    height: 70,
    fill: "#E5E5E5",
    rx: 3,
    transform: "matrix(-1 0 0 1 94 0)"
  })), _mask || (_mask = /*#__PURE__*/React.createElement("mask", {
    id: "EmptyForm_svg__a",
    fill: "#fff"
  }, /*#__PURE__*/React.createElement("path", {
    fillRule: "evenodd",
    d: "M87.085 88.684 75.43 45.185l43.499 11.656-11.044 8.072 8.557 8.556-12.728 12.728-8.557-8.556-8.072 11.043Z",
    clipRule: "evenodd"
  }))), _path2 || (_path2 = /*#__PURE__*/React.createElement("path", {
    fill: "#393939",
    fillRule: "evenodd",
    d: "M87.085 88.684 75.43 45.185l43.499 11.656-11.044 8.072 8.557 8.556-12.728 12.728-8.557-8.556-8.072 11.043Z",
    clipRule: "evenodd"
  })), _path3 || (_path3 = /*#__PURE__*/React.createElement("path", {
    fill: "#393939",
    d: "M75.43 45.185 70.6 46.48l-2.241-8.365 8.365 2.242-1.294 4.83Zm11.655 43.499 4.037 2.95-6.163 8.432-2.704-10.088 4.83-1.294Zm31.844-31.843 1.294-4.83 10.088 2.703-8.432 6.163-2.95-4.036Zm-11.044 8.072-3.535 3.535-4.128-4.127 4.713-3.445 2.95 4.037Zm8.557 8.556 3.535-3.535 3.536 3.535-3.536 3.536-3.535-3.536Zm-12.728 12.728 3.536 3.536-3.536 3.535-3.536-3.535 3.536-3.536Zm-8.557-8.556-4.036-2.951 3.444-4.713 4.128 4.128-3.536 3.535ZM80.26 43.89 91.915 87.39l-9.66 2.588L70.6 46.48l9.66-2.588Zm37.375 17.78L74.136 50.014l2.588-9.66 43.499 11.656-2.589 9.66Zm-12.699-.795 11.043-8.072 5.901 8.073-11.043 8.072-5.901-8.073Zm7.971 16.129-8.556-8.557 7.071-7.07 8.556 8.556-7.071 7.07Zm-12.728 5.657 12.728-12.728 7.071 7.07-12.727 12.729-7.072-7.071Zm-1.485-8.557 8.557 8.557-7.072 7.07-8.556-8.556 7.07-7.071ZM83.049 85.733 91.12 74.69l8.073 5.901-8.072 11.044-8.073-5.902Z",
    mask: "url(#EmptyForm_svg__a)"
  })), _path4 || (_path4 = /*#__PURE__*/React.createElement("path", {
    stroke: "#000",
    strokeLinecap: "round",
    strokeWidth: 3,
    d: "m69.431 39.163-9.192-9.192"
  })), _path5 || (_path5 = /*#__PURE__*/React.createElement("path", {
    stroke: "#000",
    strokeLinecap: "round",
    strokeWidth: 3,
    d: "M1.5-1.5h8",
    transform: "matrix(-1 0 0 1 68.213 50.123)"
  })), _path6 || (_path6 = /*#__PURE__*/React.createElement("path", {
    stroke: "#000",
    strokeLinecap: "round",
    strokeWidth: 3,
    d: "M78.969 36.367v-8"
  })));
};
var EmptyFormIcon = SvgEmptyForm;

function EditorText(props) {
  const {
    type,
    text = ''
  } = props.field;
  const Icon = iconsByType('text');
  const templating = useService$1('templating');
  const expressionLanguage = useService$1('expressionLanguage');
  if (!text || !text.trim()) {
    return jsx("div", {
      class: editorFormFieldClasses(type),
      children: jsxs("div", {
        class: "fjs-form-field-placeholder",
        children: [jsx(Icon, {
          viewBox: "0 0 54 54"
        }), "Text view is empty"]
      })
    });
  }
  if (expressionLanguage.isExpression(text)) {
    return jsx("div", {
      class: editorFormFieldClasses(type),
      children: jsxs("div", {
        class: "fjs-form-field-placeholder",
        children: [jsx(Icon, {
          viewBox: "0 0 54 54"
        }), "Text view is populated by an expression"]
      })
    });
  }
  if (templating.isTemplate(text)) {
    return jsx("div", {
      class: editorFormFieldClasses(type),
      children: jsxs("div", {
        class: "fjs-form-field-placeholder",
        children: [jsx(Icon, {
          viewBox: "0 0 54 54"
        }), "Text view is templated"]
      })
    });
  }
  return jsx(Text$1, {
    ...props,
    disableLinks: true
  });
}
EditorText.config = Text$1.config;

const editorFormFields = [EditorText];

class EditorFormFields extends FormFields {
  constructor() {
    super();
    editorFormFields.forEach(formField => {
      this.register(formField.config.type, formField);
    });
  }
}

var ModularSection = (props => {
  const {
    rootClass,
    RootElement,
    section,
    children
  } = props;
  const eventBus = useService$1('eventBus');
  const sectionConfig = useService$1(`config.${section}`);
  const [parent, setParent] = useState(sectionConfig && sectionConfig.parent || null);
  const [shouldRender, setShouldRender] = useState(true);
  const ParentElement = useMemo(() => {
    if (parent === null) {
      return null;
    }
    if (typeof parent === 'string') {
      const element = document.querySelector(parent);
      if (!element) {
        throw new Error(`Target root element with selector '${parent}' not found for section '${section}'`);
      }
      return document.querySelector(parent);
    }

    // @ts-ignore
    if (!(parent instanceof Element)) {
      throw new Error(`Target root element for section '${section}' must be a valid selector or DOM element`);
    }
    return parent;
  }, [section, parent]);
  useEffect(() => {
    const onAttach = ({
      container
    }) => {
      setParent(container);
      setShouldRender(true);
    };
    const onDetach = () => {
      setParent(null);
      setShouldRender(false);
    };
    const onReset = () => {
      setParent(null);
      setShouldRender(true);
    };
    eventBus.on(`${section}.attach`, onAttach);
    eventBus.on(`${section}.detach`, onDetach);
    eventBus.on(`${section}.reset`, onReset);
    eventBus.fire(`${section}.section.rendered`);
    return () => {
      eventBus.off(`${section}.attach`, onAttach);
      eventBus.off(`${section}.detach`, onDetach);
      eventBus.off(`${section}.reset`, onReset);
      eventBus.fire(`${section}.section.destroyed`);
    };
  }, [eventBus, section]);
  useEffect(() => {
    if (shouldRender) {
      eventBus.fire(`${section}.rendered`, {
        element: ParentElement
      });
      return () => {
        eventBus.fire(`${section}.destroyed`, {
          element: ParentElement
        });
      };
    }
  }, [eventBus, section, shouldRender, ParentElement]);
  const Root = useCallback(({
    children
  }) => RootElement ? jsx(RootElement, {
    children: children
  }) : jsx("div", {
    className: rootClass,
    children: children
  }), [rootClass, RootElement]);
  return shouldRender ? parent ? createPortal(jsx(Root, {
    children: children
  }), ParentElement) : jsx(Root, {
    children: children
  }) : null;
});

const FillContext = createContext({
  addFill(uid, props) {
    throw new Error('FillContext.addFill() uninitialized');
  },
  removeFill(uid) {
    throw new Error('FillContext.addFill() uninitialized');
  }
});
var FillContext$1 = FillContext;

var Fill = (props => {
  const uid = useRef(Symbol('fill_uid'));
  const fillContext = useContext$1(FillContext$1);
  useEffect$1(() => {
    if (!fillContext) {
      return;
    }
    fillContext.addFill({
      id: uid,
      ...props
    });
    return () => {
      fillContext.removeFill(uid);
    };
  }, [fillContext, props]);
  return null;
});

const SlotContext = createContext({
  fills: []
});
var SlotContext$1 = SlotContext;

var Slot = (props => {
  const {
    name,
    fillRoot = FillFragment,
    groupFn = _groupByGroupName,
    separatorFn = key => null,
    limit
  } = props;
  const {
    fills
  } = useContext(SlotContext$1);
  const filtered = useMemo(() => fills.filter(fill => fill.slot === name), [fills, name]);
  const cropped = useMemo(() => limit ? filtered.slice(0, limit) : filtered, [filtered, limit]);
  const groups = useMemo(() => groupFn(cropped), [cropped, groupFn]);
  const fillsAndSeparators = useMemo(() => {
    return buildFills(groups, fillRoot, separatorFn);
  }, [groups, fillRoot, separatorFn]);
  return fillsAndSeparators;
});

/**
 * Creates a Fragment for a fill.
 *
 * @param {Object} fill Fill to be rendered
 * @returns {Object} Preact Fragment containing fill's children
 */
const FillFragment = fill => jsx(Fragment, {
  children: fill.children
}, fill.id);

/**
 * Creates an array of fills, with separators inserted between groups.
 *
 * @param {Array} groups Groups of fills
 * @param {Function} fillRenderer Function to create a fill
 * @param {Function} separatorRenderer Function to create a separator
 * @returns {Array} Array of fills and separators
 */
const buildFills = (groups, fillRenderer, separatorRenderer) => {
  const result = [];
  groups.forEach((array, idx) => {
    if (idx !== 0) {
      const separator = separatorRenderer(`__separator_${idx}`);
      if (separator) {
        result.push(separator);
      }
    }
    array.forEach(fill => {
      result.push(fillRenderer(fill));
    });
  });
  return result;
};

/**
 * Groups fills by group name property.
 */
const _groupByGroupName = fills => {
  const groups = [];
  const groupsById = {};
  fills.forEach(function (fill) {
    const {
      group: groupName = 'z_default'
    } = fill;
    let group = groupsById[groupName];
    if (!group) {
      groupsById[groupName] = group = [];
      groups.push(group);
    }
    group.push(fill);
  });
  groups.forEach(group => group.sort(_comparePriority));
  return Object.keys(groupsById).sort().map(id => groupsById[id]);
};

/**
 * Compares fills by priority.
 */
const _comparePriority = (a, b) => {
  return (b.priority || 0) - (a.priority || 0);
};

var SlotFillRoot = (props => {
  const [fills, setFills] = useState([]);
  const fillContext = useMemo(() => ({
    addFill: fill => {
      setFills(fills => [...fills.filter(f => f.id !== fill.id), fill]);
      props.onSetFill && props.onSetFill(fill);
    },
    removeFill: id => {
      setFills(fills => fills.filter(f => f.id !== id));
      props.onRemoveFill && props.onRemoveFill(id);
    }
  }), []);
  const slotContext = useMemo(() => ({
    fills
  }), [fills]);
  return jsx(SlotContext$1.Provider, {
    value: slotContext,
    children: jsx(FillContext$1.Provider, {
      /* @ts-expect-error */
      value: fillContext,
      children: props.children
    })
  });
});

const PALETTE_ENTRIES = formFields.filter(({
  config: fieldConfig
}) => fieldConfig.type !== 'default').map(({
  config: fieldConfig
}) => {
  return {
    label: fieldConfig.label,
    type: fieldConfig.type,
    group: fieldConfig.group
  };
});
const PALETTE_GROUPS = [{
  label: 'Basic input',
  id: 'basic-input'
}, {
  label: 'Selection',
  id: 'selection'
}, {
  label: 'Presentation',
  id: 'presentation'
}, {
  label: 'Action',
  id: 'action'
}];
function Palette(props) {
  const [entries, setEntries] = useState(PALETTE_ENTRIES);
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef$1();
  const groups = groupEntries(entries);
  const simplifyString = useCallback(str => {
    return str.toLowerCase().replace(/\s+/g, '');
  }, []);
  const filter = useCallback(entry => {
    const simplifiedSearchTerm = simplifyString(searchTerm);
    if (!simplifiedSearchTerm) {
      return true;
    }
    const simplifiedEntryLabel = simplifyString(entry.label);
    const simplifiedEntryType = simplifyString(entry.type);
    return simplifiedEntryLabel.includes(simplifiedSearchTerm) || simplifiedEntryType.includes(simplifiedSearchTerm);
  }, [searchTerm, simplifyString]);

  // filter entries on search change
  useEffect(() => {
    const entries = PALETTE_ENTRIES.filter(filter).sort();
    setEntries(entries);
  }, [filter, searchTerm]);
  const handleInput = useCallback(event => {
    setSearchTerm(() => event.target.value);
  }, [setSearchTerm]);
  const handleClear = useCallback(event => {
    setSearchTerm('');
    inputRef.current.focus();
  }, [inputRef, setSearchTerm]);
  return jsxs("div", {
    class: "fjs-palette",
    children: [jsx("div", {
      //class: "fjs-palette-header fs-6",
      class: "fjs-palette-title fs-6 c-text-dark fw-bold c-mt-2 c-mx-2",
      title: "Field Types",
      children: "Field Types"
    }),
    // jsxs("div", {
    //   class: "fjs-palette-search-container",
    //   children: [jsx("span", {
    //     class: "fjs-palette-search-icon",
    //     children: jsx(SearchIcon, {})
    //   }), jsx("input", {
    //     class: "fjs-palette-search",
    //     ref: inputRef,
    //     type: "text",
    //     placeholder: "Search components2",
    //     value: searchTerm,
    //     onInput: handleInput
    //   }), searchTerm && jsx("button", {
    //     title: "Clear content",
    //     class: "fjs-palette-search-clear",
    //     onClick: handleClear,
    //     children: jsx(CloseIcon, {})
    //   })]
    // }),
    jsxs("div", {
      class: "fjs-palette-entries",
      children: [groups.map(({
        label,
        entries,
        id
      }) => jsxs("div", {
        class: "fjs-palette-group",
        "data-group-id": id,
        children: [jsx("span", {
          class: "fjs-palette-group-title",
          children: label
        }), jsx("div", {
          class: "fjs-palette-fields fjs-drag-container fjs-no-drop",
          children: entries.map(({
            label,
            type
          }) => {
            const Icon = iconsByType(type);
            return jsxs("div", {
              class: "fjs-palette-field fjs-drag-copy fjs-no-drop",
              "data-field-type": type,
              title: `Create ${getIndefiniteArticle(type)} ${label} element`,
              children: [Icon ? jsx(Icon, {
                class: "fjs-palette-field-icon",
                width: "36",
                height: "36",
                viewBox: "0 0 54 54"
              }) : null, jsx("span", {
                class: "fjs-palette-field-text",
                children: label
              })]
            });
          })
        })]
      })), groups.length == 0 && jsx("div", {
        class: "fjs-palette-no-entries",
        children: "No components found."
      })]
    }), jsx("div", {
      class: "fjs-palette-footer",
      children: jsx(Slot, {
        name: "editor-palette__footer",
        fillRoot: FillRoot
      })
    })]
  });
}
const FillRoot = fill => jsx("div", {
  className: "fjs-palette-footer-fill",
  children: fill.children
});

// helpers ///////

function groupEntries(entries) {
  const groups = PALETTE_GROUPS.map(group => {
    return {
      ...group,
      entries: []
    };
  });
  const getGroup = id => groups.find(group => id === group.id);
  entries.forEach(entry => {
    const {
      group
    } = entry;
    getGroup(group).entries.push(entry);
  });
  return groups.filter(g => g.entries.length);
}
function getIndefiniteArticle(type) {
  if (['image', 'obstacle'].includes(type)) {
    return 'an';
  }
  return 'a';
}

var InjectedRendersRoot = (() => {
  const renderInjector = useService$1('renderInjector');
  const injectedRenderers = renderInjector.fetchRenderers();
  const injectedProps = useMemo(() => ({
    useService: useService$1,
    components: {
      Fill,
      Slot
    }
  }), []);
  return jsx(Fragment, {
    children: injectedRenderers.map(({
      Renderer
    }) => jsx(Renderer, {
      ...injectedProps
    }))
  });
});

const CURSOR_CLS_PATTERN = /^fjs-cursor-.*$/;
function set(mode) {
  const classes$1 = classes(document.body);
  classes$1.removeMatching(CURSOR_CLS_PATTERN);
  if (mode) {
    classes$1.add('fjs-cursor-' + mode);
  }
}
function unset() {
  set(null);
}

const DRAG_CONTAINER_CLS = 'fjs-drag-container';
const DROP_CONTAINER_VERTICAL_CLS = 'fjs-drop-container-vertical';
const DROP_CONTAINER_HORIZONTAL_CLS = 'fjs-drop-container-horizontal';
const DRAG_MOVE_CLS = 'fjs-drag-move';
const DRAG_ROW_MOVE_CLS = 'fjs-drag-row-move';
const DRAG_COPY_CLS = 'fjs-drag-copy';
const DRAG_NO_DROP_CLS = 'fjs-no-drop';
const DRAG_NO_MOVE_CLS = 'fjs-no-move';
const ERROR_DROP_CLS = 'fjs-error-drop';

/**
 * @typedef { { id: String, components: Array<any> } } FormRow
 */

class Dragging {
  /**
   * @constructor
   *
   * @param { import('../../core/FormFieldRegistry').default } formFieldRegistry
   * @param { import('../../core/FormLayouter').default } formLayouter
   * @param { import('../../core/FormLayoutValidator').default } formLayoutValidator
   * @param { import('../../core/EventBus').default } eventBus
   * @param { import('../modeling/Modeling').default } modeling
   * @param { import('@bpmn-io/form-js-viewer').PathRegistry } pathRegistry
   */
  constructor(formFieldRegistry, formLayouter, formLayoutValidator, eventBus, modeling, pathRegistry) {
    this._formFieldRegistry = formFieldRegistry;
    this._formLayouter = formLayouter;
    this._formLayoutValidator = formLayoutValidator;
    this._eventBus = eventBus;
    this._modeling = modeling;
    this._pathRegistry = pathRegistry;
  }

  /**
   * Calculcates position in form schema given the dropped place.
   *
   * @param { FormRow } targetRow
   * @param { any } targetFormField
   * @param { HTMLElement } sibling
   * @returns { number }
   */
  getTargetIndex(targetRow, targetFormField, sibling) {
    /** @type HTMLElement */
    const siblingFormFieldNode = sibling && sibling.querySelector('.fjs-element');
    const siblingFormField = siblingFormFieldNode && this._formFieldRegistry.get(siblingFormFieldNode.dataset.id);

    // (1) dropped before existing field => place before
    if (siblingFormField) {
      return getFormFieldIndex$1(targetFormField, siblingFormField);
    }

    // (2) dropped in row => place at the end of row (after last field in row)
    if (targetRow) {
      return getFormFieldIndex$1(targetFormField, this._formFieldRegistry.get(targetRow?.components[targetRow?.components.length - 1])) + 1;
    }

    // (3) dropped as last item
    return targetFormField?.components.length;
  }
  validateDrop(element, target) {
    const formFieldNode = element.querySelector('.fjs-element');
    const targetRow = this._formLayouter.getRow(target.dataset.rowId);
    let columns;
    let formField;
    let targetParentId;
    if (formFieldNode) {
      formField = this._formFieldRegistry.get(formFieldNode.dataset.id);
      columns = (formField.layout || {}).columns;

      // (1) check for row constraints
      if (isRow(target)) {
        targetParentId = getFormParent(target).dataset.id;
        const rowError = this._formLayoutValidator.validateField(formField, columns, targetRow);
        if (rowError) {
          return rowError;
        }
      } else {
        targetParentId = target.dataset.id;
      }

      // (2) check target is a valid parent
      if (!targetParentId) {
        return 'Drop is not a valid target';
      }

      // (3) check  for path collisions
      const targetParentFormField = this._formFieldRegistry.get(targetParentId);
      const currentParentFormField = this._formFieldRegistry.get(formField._parent);
      if (targetParentFormField !== currentParentFormField) {
        const targetParentPath = this._pathRegistry.getValuePath(targetParentFormField);
        const currentParentPath = this._pathRegistry.getValuePath(currentParentFormField);
        if (targetParentPath.join('.') !== currentParentPath.join('.')) {
          const isDropAllowedByPathRegistry = this._pathRegistry.executeRecursivelyOnFields(formField, ({
            field,
            isClosed
          }) => {
            const options = {
              cutoffNode: currentParentFormField.id
            };
            const fieldPath = this._pathRegistry.getValuePath(field, options);
            return this._pathRegistry.canClaimPath([...targetParentPath, ...fieldPath], isClosed);
          });
          if (!isDropAllowedByPathRegistry) {
            return 'Drop not allowed by path registry';
          }
        }
      }
    }
  }
  moveField(element, source, targetRow, targetFormField, targetIndex) {
    const formFieldNode = element.querySelector('.fjs-element');
    const formField = this._formFieldRegistry.get(formFieldNode.dataset.id);
    const sourceParent = getFormParent(source);
    const sourceFormField = this._formFieldRegistry.get(sourceParent.dataset.id);
    const sourceIndex = getFormFieldIndex$1(sourceFormField, formField);
    const sourceRow = this._formLayouter.getRowForField(formField);
    this._modeling.moveFormField(formField, sourceFormField, targetFormField, sourceIndex, targetIndex, sourceRow, targetRow);
  }
  createNewField(element, targetRow, targetFormField, targetIndex) {
    const type = element.dataset.fieldType;
    let attrs = {
      type
    };
    attrs = {
      ...attrs,
      _parent: targetFormField.id,
      layout: {
        row: targetRow ? targetRow.id : this._formLayouter.nextRowId(),
        // enable auto columns
        columns: null
      }
    };
    this._modeling.addFormField(attrs, targetFormField, targetIndex);
  }
  handleRowDrop(el, target, source, sibling) {
    const targetFormField = this._formFieldRegistry.get(target.dataset.id);
    const rowNode = el.querySelector('.fjs-layout-row');
    const row = this._formLayouter.getRow(rowNode.dataset.rowId);

    // move each field in the row before first field of sibling row
    row.components.forEach((id, index) => {
      const formField = this._formFieldRegistry.get(id);
      const sourceParent = getFormParent(source);
      const sourceFormField = this._formFieldRegistry.get(sourceParent.dataset.id);
      const siblingRowNode = sibling && sibling.querySelector('.fjs-layout-row');
      const siblingRow = siblingRowNode && this._formLayouter.getRow(siblingRowNode.dataset.rowId);
      const siblingFormField = sibling && this._formFieldRegistry.get(siblingRow.components[0]);
      const sourceIndex = getFormFieldIndex$1(sourceFormField, formField);
      const targetIndex = (siblingRowNode ? getFormFieldIndex$1(targetFormField, siblingFormField) : targetFormField.components.length) + index;
      this._modeling.moveFormField(formField, sourceFormField, targetFormField, sourceIndex, targetIndex, row, row);
    });
  }
  handleElementDrop(el, target, source, sibling, drake) {
    // (1) detect drop target
    const targetFormField = this._formFieldRegistry.get(getFormParent(target).dataset.id);
    let targetRow;

    // (2.1) dropped in existing row
    if (isRow(target)) {
      targetRow = this._formLayouter.getRow(target.dataset.rowId);
    }

    // (2.2) validate whether drop is allowed
    const validationError = this.validateDrop(el, target);
    if (validationError) {
      return drake.cancel(true);
    }
    drake.remove();

    // (3) detect position to drop field in schema order
    const targetIndex = this.getTargetIndex(targetRow, targetFormField, sibling);

    // (4) create new field or move existing
    if (isPalette(source)) {
      this.createNewField(el, targetRow, targetFormField, targetIndex);
    } else {
      this.moveField(el, source, targetRow, targetFormField, targetIndex);
    }
  }

  /**
   * @param { { container: Array<string>, direction: string, mirrorContainer: string } } options
   */
  createDragulaInstance(options) {
    const {
      container,
      mirrorContainer
    } = options || {};
    let dragulaOptions = {
      direction: function (el, target) {
        if (isRow(target)) {
          return 'horizontal';
        }
        return 'vertical';
      },
      mirrorContainer,
      isContainer(el) {
        return container.some(cls => el.classList.contains(cls));
      },
      moves(el, source, handle) {
        return !handle.classList.contains(DRAG_NO_MOVE_CLS) && (el.classList.contains(DRAG_MOVE_CLS) || el.classList.contains(DRAG_COPY_CLS) || el.classList.contains(DRAG_ROW_MOVE_CLS));
      },
      copy(el) {
        return el.classList.contains(DRAG_COPY_CLS);
      },
      accepts: (el, target) => {
        unsetDropNotAllowed(target);

        // allow dropping rows only between rows
        if (el.classList.contains(DRAG_ROW_MOVE_CLS)) {
          return !target.classList.contains(DROP_CONTAINER_HORIZONTAL_CLS);
        }

        // validate field drop
        const validationError = this.validateDrop(el, target);
        if (validationError) {
          // set error feedback to row
          setDropNotAllowed(target);
        }
        return !target.classList.contains(DRAG_NO_DROP_CLS);
      },
      slideFactorX: 10,
      slideFactorY: 5
    };
    const dragulaInstance = dragula(dragulaOptions);

    // bind life cycle events
    dragulaInstance.on('drag', (element, source) => {
      this.emit('drag.start', {
        element,
        source
      });
    });
    dragulaInstance.on('dragend', element => {
      this.emit('drag.end', {
        element
      });
    });
    dragulaInstance.on('drop', (element, target, source, sibling) => {
      this.emit('drag.drop', {
        element,
        target,
        source,
        sibling
      });
    });
    dragulaInstance.on('over', (element, container, source) => {
      this.emit('drag.hover', {
        element,
        container,
        source
      });
    });
    dragulaInstance.on('out', (element, container, source) => {
      this.emit('drag.out', {
        element,
        container,
        source
      });
    });
    dragulaInstance.on('cancel', (element, container, source) => {
      this.emit('drag.cancel', {
        element,
        container,
        source
      });
    });
    dragulaInstance.on('drop', (el, target, source, sibling) => {
      if (!target) {
        dragulaInstance.remove();
        return;
      }

      // (1) handle row drop
      if (isDragRow(el)) {
        this.handleRowDrop(el, target, source, sibling);
      } else {
        // (2) handle form field drop
        this.handleElementDrop(el, target, source, sibling, dragulaInstance);
      }
    });
    this.emit('dragula.created', dragulaInstance);
    return dragulaInstance;
  }
  emit(event, context) {
    this._eventBus.fire(event, context);
  }
}
Dragging.$inject = ['formFieldRegistry', 'formLayouter', 'formLayoutValidator', 'eventBus', 'modeling', 'pathRegistry'];

// helper //////////

function getFormFieldIndex$1(parent, formField) {
  let fieldFormIndex = parent.components.length;
  parent.components.forEach(({
    id
  }, index) => {
    if (id === formField.id) {
      fieldFormIndex = index;
    }
  });
  return fieldFormIndex;
}
function isRow(node) {
  return node.classList.contains('fjs-layout-row');
}
function isDragRow(node) {
  return node.classList.contains(DRAG_ROW_MOVE_CLS);
}
function isPalette(node) {
  return node.classList.contains('fjs-palette-fields');
}
function getFormParent(node) {
  return node.closest('.fjs-element');
}
function setDropNotAllowed(node) {
  node.classList.add(ERROR_DROP_CLS);
  set('not-allowed');
}
function unsetDropNotAllowed(node) {
  node.classList.remove(ERROR_DROP_CLS);
  set('grabbing');
}

function FieldDragPreview(props) {
  const {
    class: className,
    Icon,
    label
  } = props;
  return jsxs("div", {
    class: classnames('fjs-field-preview', className),
    children: [jsx(Icon, {
      class: "fjs-field-preview-icon",
      width: "36",
      height: "36",
      viewBox: "0 0 54 54"
    }), jsx("span", {
      class: "fjs-field-preview-text",
      children: label
    })]
  });
}

const COLUMNS_REGEX = /^cds--col(-lg)?/;
const ELEMENT_RESIZING_CLS = 'fjs-element-resizing';
const GRID_OFFSET_PX = 16;
function FieldResizer(props) {
  const {
    field,
    position
  } = props;
  const ref = useRef$1(null);
  const formLayoutValidator = useService$1('formLayoutValidator');
  const modeling = useService$1('modeling');

  // we can't use state as we need to
  // manipulate this inside dragging events
  const context = useRef$1({
    startColumns: 0,
    newColumns: 0
  });
  const onResize = throttle((_, delta) => {
    const {
      x: dx
    } = delta;
    const {
      layout = {}
    } = field;
    const newColumns = calculateNewColumns(ref.current, layout.columns || context.current.startColumns, dx, position);
    const errorMessage = formLayoutValidator.validateField(field, newColumns);
    if (!errorMessage) {
      context.current.newColumns = newColumns;

      // make visual updates to preview change
      const columnNode = ref.current.closest('.fjs-layout-column');
      removeMatching(columnNode, COLUMNS_REGEX);
      columnNode.classList.add(`cds--col-lg-${newColumns}`);
    }
  });
  const onResizeStart = event => {
    const target = getElementNode(field);
    const parent = getParent(target);

    // initialize drag handler
    const onDragStart = createDragger$1(onResize);
    onDragStart(event);

    // mitigate auto columns on the grid that
    // has a offset of 16px (1rem) to both side
    const columnNode = getColumnNode(target);
    const startWidth = columnNode.getBoundingClientRect().width + GRID_OFFSET_PX;
    context.current.startColumns = asColumns(startWidth, parent);
    setResizing(target, position);
  };
  const onResizeEnd = () => {
    const {
      layout = {}
    } = field;
    if (context.current.newColumns) {
      modeling.editFormField(field, 'layout', {
        ...layout,
        columns: context.current.newColumns
      });
    }
    const target = getElementNode(field);
    unsetResizing(target, position);
    context.current.newColumns = null;
  };
  if (field.type === 'default') {
    return null;
  }
  return jsx("div", {
    ref: ref,
    class: classnames('fjs-field-resize-handle', 'fjs-field-resize-handle-' + position, DRAG_NO_MOVE_CLS),
    draggable: true,
    onDragStart: onResizeStart,
    onDragEnd: onResizeEnd
  });
}

// helper //////

function asColumns(width, parent) {
  const totalWidth = parent.getBoundingClientRect().width;
  const oneColumn = 1 / 16 * totalWidth;
  return Math.round(width / oneColumn);
}
function calculateNewColumns(node, currentColumns, deltaX, position) {
  const parent = getParent(node);

  // invert delta if we are resizing from the left
  if (position === 'left') {
    deltaX = deltaX * -1;
  }
  const deltaColumns = asColumns(deltaX, parent);
  return currentColumns + deltaColumns;
}
function getParent(node) {
  return node.closest('.fjs-layout-row');
}
function removeMatching(node, regex) {
  return classes(node).removeMatching(regex);
}
function getColumnNode(node) {
  return node.closest('.fjs-layout-column');
}
function getElementNode(field) {
  return query('.fjs-element[data-id="' + field.id + '"]');
}
function setResizing(node, position) {
  classes(node).add(ELEMENT_RESIZING_CLS + '-' + position);
}
function unsetResizing(node, position) {
  classes(node).remove(ELEMENT_RESIZING_CLS + '-' + position);
}

function ContextPad(props) {
  if (!props.children) {
    return null;
  }
  return jsx("div", {
    class: "fjs-context-pad",
    children: props.children
  });
}
function Empty() {
  return null;
}
function EmptyRoot(props) {
  return jsx("div", {
    class: "fjs-empty-editor",
    children: jsxs("div", {
      class: "fjs-empty-editor-card",
      children: [jsx(EmptyFormIcon, {}), jsx("h2", {
        children: "Build your form"
      }), jsx("span", {
        children: "Drag and drop components here to start designing."
      }), jsx("span", {
        children: "Use the preview window to test your form."
      })]
    })
  });
}
function Element$1(props) {
  const eventBus = useService$1('eventBus'),
    formEditor = useService$1('formEditor'),
    formFieldRegistry = useService$1('formFieldRegistry'),
    modeling = useService$1('modeling'),
    selection = useService$1('selection');
  const {
    hoveredId,
    setHoveredId
  } = useContext(FormRenderContext);
  const {
    field
  } = props;
  const {
    id,
    type,
    showOutline,
    repeatable,
    gird_view
  } = field;
  const ref = useRef$1();
  function scrollIntoView({
    selection
  }) {
    if (!selection || selection.id !== id || !ref.current) {
      return;
    }
    const elementBounds = ref.current.getBoundingClientRect(),
      containerBounds = formEditor._container.getBoundingClientRect();
    if (elementBounds.top < 0 || elementBounds.top > containerBounds.bottom) {
      ref.current.scrollIntoView();
    }
  }
  useEffect(() => {
    eventBus.on('selection.changed', scrollIntoView);
    return () => eventBus.off('selection.changed', scrollIntoView);
  }, [id]);
  useLayoutEffect(() => {
    if (selection.isSelected(field)) {
      ref.current.focus();
    }
  }, [selection, field]);
  function onClick(event) {
    event.stopPropagation();
    selection.toggle(field);

    // properly focus on field
    ref.current.focus();
  }
  const classes = [];
  if (props.class) {
    classes.push(...props.class.split(' '));
  }
  if (selection.isSelected(field)) {
    classes.push('fjs-editor-selected');
  }
  if (showOutline) {
    classes.push('fjs-outlined');
  }
  if (hoveredId === field.id) {
    classes.push('fjs-editor-hovered');
  }
  const onRemove = event => {
    event.stopPropagation();
    const parentField = formFieldRegistry.get(field._parent);
    const index = getFormFieldIndex(parentField, field);
    modeling.removeFormField(field, parentField, index);
  };
  const onKeyPress = event => {
    if (event.key === 'Enter') {
      event.stopPropagation();
      selection.toggle(field);
    }
  };
  return jsxs("div", {
    class: classes.join(' '),
    "data-id": id,
    "data-field-type": type,
    tabIndex: type === 'default' ? -1 : 0,
    onClick: onClick,
    onKeyPress: onKeyPress,
    onMouseOver: e => {
      // @ts-ignore
      setHoveredId(field.id);
      e.stopPropagation();
    },
    ref: ref,
    children: [jsx(DebugColumns, {
      field: field
    }), jsx(ContextPad, {
      children: selection.isSelected(field) && field.type !== 'default' ? jsx("button", {
        class: "fjs-context-pad-item",
        onClick: onRemove,
        children: jsx(DeleteIcon$1, {})
      }) : null
    }), props.children, jsx(FieldResizer, {
      position: "left",
      field: field
    }), jsx(FieldResizer, {
      position: "right",
      field: field
    })]
  });
}
function DebugColumns(props) {
  const {
    field
  } = props;
  const debugColumnsConfig = useService$1('config.debugColumns');
  if (!debugColumnsConfig || field.type == 'default') {
    return null;
  }
  return jsx("div", {
    style: "width: fit-content; padding: 2px 6px; height: 16px; background: var(--color-blue-205-100-95); display: flex; justify-content: center; align-items: center; position: absolute; bottom: -2px; z-index: 2; font-size: 10px; right: 3px;",
    class: "fjs-debug-columns",
    children: (field.layout || {}).columns || 'auto'
  });
}
function Children(props) {
  const {
    field
  } = props;
  const {
    id
  } = field;
  const classes = ['fjs-children', DROP_CONTAINER_VERTICAL_CLS];
  if (props.class) {
    classes.push(...props.class.split(' '));
  }
  return jsx("div", {
    class: classes.join(' '),
    "data-id": id,
    children: props.children
  });
}
function Row(props) {
  const {
    row
  } = props;
  const {
    id
  } = row;
  const classes = [DROP_CONTAINER_HORIZONTAL_CLS];
  if (props.class) {
    classes.push(...props.class.split(' '));
  }
  return jsxs("div", {
    class: classnames(DRAG_ROW_MOVE_CLS),
    children: [jsx("span", {
      class: "fjs-row-dragger",
      children: jsx(DraggableIcon, {})
    }), jsx("div", {
      class: classes.join(' '),
      "data-row-id": id,
      children: props.children
    })]
  });
}
function Column(props) {
  const {
    field
  } = props;
  const classes = [DRAG_MOVE_CLS];
  if (field.type === 'default') {
    return props.children;
  }
  if (props.class) {
    classes.push(...props.class.split(' '));
  }
  return jsx("div", {
    "data-field-type": field.type,
    class: classes.join(' '),
    children: props.children
  });
}
function FormEditor$1(props) {
  const dragging = useService$1('dragging'),
    eventBus = useService$1('eventBus'),
    formEditor = useService$1('formEditor'),
    injector = useService$1('injector'),
    selection = useService$1('selection'),
    propertiesPanel = useService$1('propertiesPanel'),
    propertiesPanelConfig = useService$1('config.propertiesPanel');
  const {
    schema,
    properties
  } = formEditor._getState();
  const {
    ariaLabel
  } = properties;
  const formContainerRef = useRef$1(null);
  const propertiesPanelRef = useRef$1(null);
  const [, setSelection] = useState(schema);
  useEffect(() => {
    function handleSelectionChanged(event) {
      setSelection(event.selection || schema);
    }
    eventBus.on('selection.changed', handleSelectionChanged);
    setSelection(selection.get() || schema);
    return () => {
      eventBus.off('selection.changed', handleSelectionChanged);
    };
  }, [schema, selection]);
  const [drake, setDrake] = useState(null);
  const dragAndDropContext = {
    drake
  };
  useEffect(() => {
    let dragulaInstance = dragging.createDragulaInstance({
      container: [DRAG_CONTAINER_CLS, DROP_CONTAINER_VERTICAL_CLS, DROP_CONTAINER_HORIZONTAL_CLS],
      mirrorContainer: formContainerRef.current
    });
    setDrake(dragulaInstance);
    const onDetach = () => {
      if (dragulaInstance) {
        dragulaInstance.destroy();
        eventBus.fire('dragula.destroyed');
      }
    };
    const onAttach = () => {
      onDetach();
      dragulaInstance = dragging.createDragulaInstance({
        container: [DRAG_CONTAINER_CLS, DROP_CONTAINER_VERTICAL_CLS, DROP_CONTAINER_HORIZONTAL_CLS],
        mirrorContainer: formContainerRef.current
      });
      setDrake(dragulaInstance);
    };
    const onCreate = drake => {
      setDrake(drake);
    };
    const onDragStart = () => {
      set('grabbing');
    };
    const onDragEnd = () => {
      unset();
    };
    eventBus.on('attach', onAttach);
    eventBus.on('detach', onDetach);
    eventBus.on('dragula.created', onCreate);
    eventBus.on('drag.start', onDragStart);
    eventBus.on('drag.end', onDragEnd);
    return () => {
      onDetach();
      eventBus.off('attach', onAttach);
      eventBus.off('detach', onDetach);
      eventBus.off('dragula.created', onCreate);
      eventBus.off('drag.start', onDragStart);
      eventBus.off('drag.end', onDragEnd);
    };
  }, [dragging, eventBus]);

  // fire event after render to notify interested parties
  useEffect(() => {
    eventBus.fire('formEditor.rendered');
  }, []);
  const [hoveredId, setHoveredId] = useState(null);
  const formRenderContext = useMemo(() => ({
    Children,
    Column,
    Element: Element$1,
    Empty,
    EmptyRoot,
    Row,
    hoveredId,
    setHoveredId
  }), [hoveredId]);
  const formContext = useMemo(() => ({
    getService(type, strict = true) {
      // TODO(philippfromme): clean up
      if (type === 'form') {
        return {
          _getState() {
            return {
              data: {},
              errors: {},
              properties: {
                ariaLabel,
                disabled: true
              },
              schema
            };
          }
        };
      }
      return injector.get(type, strict);
    },
    formId: formEditor._id
  }), [ariaLabel, formEditor, injector, schema]);
  const onSubmit = useCallback(() => { }, []);
  const onReset = useCallback(() => { }, []);

  // attach default properties panel
  const hasDefaultPropertiesPanel = defaultPropertiesPanel(propertiesPanelConfig);
  useEffect(() => {
    if (hasDefaultPropertiesPanel) {
      propertiesPanel.attachTo(propertiesPanelRef.current);
    }
  }, [propertiesPanelRef, propertiesPanel, hasDefaultPropertiesPanel]);
  return jsx("div", {
    class: "fjs-form-editor",
    children: jsxs(SlotFillRoot, {
      children: [jsxs(DragAndDropContext$1.Provider, {
        value: dragAndDropContext,
        children: [jsx(ModularSection, {
          rootClass: "fjs-palette-container",
          section: "palette",
          children: jsx(Palette, {})
        }), jsx("div", {
          ref: formContainerRef,
          class: "fjs-form-container",
          children: jsx(FormContext.Provider, {
            value: formContext,
            children: jsx(FormRenderContext.Provider, {
              // @ts-ignore
              value: formRenderContext,
              children: jsx(FormComponent, {
                onSubmit: onSubmit,
                onReset: onReset
              })
            })
          })
        }), jsx(CreatePreview, {})]
      }), hasDefaultPropertiesPanel && jsx("div", {
        class: "fjs-editor-properties-container",
        ref: propertiesPanelRef
      }), jsx(ModularSection, {
        rootClass: "fjs-render-injector-container",
        section: "renderInjector",
        children: jsx(InjectedRendersRoot, {})
      })]
    })
  });
}
function getFormFieldIndex(parent, formField) {
  let fieldFormIndex = parent.components.length;
  parent.components.forEach(({
    id
  }, index) => {
    if (id === formField.id) {
      fieldFormIndex = index;
    }
  });
  return fieldFormIndex;
}
function CreatePreview(props) {
  const {
    drake
  } = useContext(DragAndDropContext$1);
  function handleCloned(clone, original, type) {
    const fieldType = clone.dataset.fieldType;

    // (1) field preview
    if (fieldType) {
      const {
        label
      } = findPaletteEntry(fieldType);
      const Icon = iconsByType(fieldType);
      clone.innerHTML = '';
      clone.class = 'gu-mirror';
      clone.classList.add('fjs-field-preview-container');
      if (original.classList.contains('fjs-palette-field')) {
        // default to auto columns when creating from palette
        clone.classList.add('cds--col');
      }

      // todo(pinussilvestrus): dragula, how to mitigate cursor position
      // https://github.com/bevacqua/dragula/issues/285
      render(jsx(FieldDragPreview, {
        label: label,
        Icon: Icon
      }), clone);
    } else {
      // (2) row preview

      // remove elements from copy (context pad, row dragger, ...)
      ['fjs-context-pad', 'fjs-row-dragger', 'fjs-debug-columns'].forEach(cls => {
        const cloneNode = clone.querySelectorAll('.' + cls);
        cloneNode.length && cloneNode.forEach(e => e.remove());
      });

      // mirror grid
      clone.classList.add('cds--grid');
      clone.classList.add('cds--grid--condensed');
    }
  }
  useEffect(() => {
    if (!drake) {
      return;
    }
    drake.on('cloned', handleCloned);
    return () => drake.off('cloned', handleCloned);
  }, [drake]);
  return null;
}

// helper //////

function findPaletteEntry(type) {
  return PALETTE_ENTRIES.find(entry => entry.type === type);
}
function defaultPropertiesPanel(propertiesPanelConfig) {
  return !(propertiesPanelConfig && propertiesPanelConfig.parent);
}

class Renderer {
  constructor(renderConfig, eventBus, formEditor, injector) {
    const {
      container,
      compact = false
    } = renderConfig;
    const App = () => {
      const [state, setState] = useState(formEditor._getState());
      const formEditorContext = {
        getService(type, strict = true) {
          return injector.get(type, strict);
        }
      };
      formEditor.on('changed', newState => {
        setState(newState);
      });
      const {
        schema
      } = state;
      if (!schema) {
        return null;
      }
      return jsx("div", {
        class: `fjs-container fjs-editor-container ${compact ? 'fjs-editor-compact' : ''}`,
        children: jsx(FormEditorContext$1.Provider, {
          value: formEditorContext,
          children: jsx(FormEditor$1, {})
        })
      });
    };
    eventBus.on('form.init', () => {
      render(jsx(App, {}), container);
    });
    eventBus.on('form.destroy', () => {
      render(null, container);
    });
  }
}
Renderer.$inject = ['config.renderer', 'eventBus', 'formEditor', 'injector'];

var renderModule = {
  __init__: ['formFields', 'renderer'],
  formFields: ['type', EditorFormFields],
  renderer: ['type', Renderer]
};

var core = {
  __depends__: [renderModule],
  debounce: ['factory', DebounceFactory],
  eventBus: ['type', EventBus],
  importer: ['type', Importer],
  formFieldRegistry: ['type', FormFieldRegistry],
  pathRegistry: ['type', PathRegistry],
  formLayouter: ['type', FormLayouter],
  formLayoutValidator: ['type', FormLayoutValidator],
  fieldFactory: ['type', FieldFactory]
};

/**
 * @typedef {import('didi').Injector} Injector
 *
 * @typedef {import('../../core/EventBus').default} EventBus
 */

var NOT_REGISTERED_ERROR = 'is not a registered action',
  IS_REGISTERED_ERROR = 'is already registered';

/**
 * An interface that provides access to modeling actions by decoupling
 * the one who requests the action to be triggered and the trigger itself.
 *
 * It's possible to add new actions by registering them with ´registerAction´
 * and likewise unregister existing ones with ´unregisterAction´.
 *
 *
 * ## Life-Cycle and configuration
 *
 * The editor actions will wait for diagram initialization before
 * registering default actions _and_ firing an `editorActions.init` event.
 *
 * Interested parties may listen to the `editorActions.init` event with
 * low priority to check, which actions got registered. Other components
 * may use the event to register their own actions via `registerAction`.
 *
 * @param {EventBus} eventBus
 * @param {Injector} injector
 */
function EditorActions(eventBus, injector) {
  // initialize actions
  this._actions = {};
  var self = this;
  eventBus.on('diagram.init', function () {
    // all diagram modules got loaded; check which ones
    // are available and register the respective default actions
    self._registerDefaultActions(injector);

    // ask interested parties to register available editor
    // actions on diagram initialization
    eventBus.fire('editorActions.init', {
      editorActions: self
    });
  });
}
EditorActions.$inject = ['eventBus', 'injector'];

/**
 * Register default actions.
 *
 * @param {Injector} injector
 */
EditorActions.prototype._registerDefaultActions = function (injector) {
  // (1) retrieve optional components to integrate with

  var commandStack = injector.get('commandStack', false);
  var modeling = injector.get('modeling', false);
  var selection = injector.get('selection', false);
  var zoomScroll = injector.get('zoomScroll', false);
  var copyPaste = injector.get('copyPaste', false);
  var canvas = injector.get('canvas', false);
  var rules = injector.get('rules', false);
  var keyboardMove = injector.get('keyboardMove', false);
  var keyboardMoveSelection = injector.get('keyboardMoveSelection', false);

  // (2) check components and register actions

  if (commandStack) {
    this.register('undo', function () {
      commandStack.undo();
    });
    this.register('redo', function () {
      commandStack.redo();
    });
  }
  if (copyPaste && selection) {
    this.register('copy', function () {
      var selectedElements = selection.get();
      if (selectedElements.length) {
        return copyPaste.copy(selectedElements);
      }
    });
  }
  if (copyPaste) {
    this.register('paste', function () {
      copyPaste.paste();
    });
  }
  if (zoomScroll) {
    this.register('stepZoom', function (opts) {
      zoomScroll.stepZoom(opts.value);
    });
  }
  if (canvas) {
    this.register('zoom', function (opts) {
      canvas.zoom(opts.value);
    });
  }
  if (modeling && selection && rules) {
    this.register('removeSelection', function () {
      var selectedElements = selection.get();
      if (!selectedElements.length) {
        return;
      }
      var allowed = rules.allowed('elements.delete', {
        elements: selectedElements
      }),
        removableElements;
      if (allowed === false) {
        return;
      } else if (isArray(allowed)) {
        removableElements = allowed;
      } else {
        removableElements = selectedElements;
      }
      if (removableElements.length) {
        modeling.removeElements(removableElements.slice());
      }
    });
  }
  if (keyboardMove) {
    this.register('moveCanvas', function (opts) {
      keyboardMove.moveCanvas(opts);
    });
  }
  if (keyboardMoveSelection) {
    this.register('moveSelection', function (opts) {
      keyboardMoveSelection.moveSelection(opts.direction, opts.accelerated);
    });
  }
};

/**
 * Triggers a registered action
 *
 * @param {string} action
 * @param {Object} opts
 *
 * @return {unknown} Returns what the registered listener returns
 */
EditorActions.prototype.trigger = function (action, opts) {
  if (!this._actions[action]) {
    throw error(action, NOT_REGISTERED_ERROR);
  }
  return this._actions[action](opts);
};

/**
 * Registers a collections of actions.
 * The key of the object will be the name of the action.
 *
 * @example
 * ´´´
 * var actions = {
 *   spaceTool: function() {
 *     spaceTool.activateSelection();
 *   },
 *   lassoTool: function() {
 *     lassoTool.activateSelection();
 *   }
 * ];
 *
 * editorActions.register(actions);
 *
 * editorActions.isRegistered('spaceTool'); // true
 * ´´´
 *
 * @param {Object} actions
 */
EditorActions.prototype.register = function (actions, listener) {
  var self = this;
  if (typeof actions === 'string') {
    return this._registerAction(actions, listener);
  }
  forEach(actions, function (listener, action) {
    self._registerAction(action, listener);
  });
};

/**
 * Registers a listener to an action key
 *
 * @param {string} action
 * @param {Function} listener
 */
EditorActions.prototype._registerAction = function (action, listener) {
  if (this.isRegistered(action)) {
    throw error(action, IS_REGISTERED_ERROR);
  }
  this._actions[action] = listener;
};

/**
 * Unregister an existing action
 *
 * @param {string} action
 */
EditorActions.prototype.unregister = function (action) {
  if (!this.isRegistered(action)) {
    throw error(action, NOT_REGISTERED_ERROR);
  }
  this._actions[action] = undefined;
};

/**
 * Returns the number of actions that are currently registered
 *
 * @return {number}
 */
EditorActions.prototype.getActions = function () {
  return Object.keys(this._actions);
};

/**
 * Checks wether the given action is registered
 *
 * @param {string} action
 *
 * @return {boolean}
 */
EditorActions.prototype.isRegistered = function (action) {
  return !!this._actions[action];
};
function error(action, message) {
  return new Error(action + ' ' + message);
}

/**
 * @type { import('didi').ModuleDeclaration }
 */
var EditorActionsModule$1 = {
  __init__: ['editorActions'],
  editorActions: ['type', EditorActions]
};

class FormEditorActions extends EditorActions {
  constructor(eventBus, injector) {
    super(eventBus, injector);
    eventBus.on('form.init', () => {
      this._registerDefaultActions(injector);
      eventBus.fire('editorActions.init', {
        editorActions: this
      });
    });
  }
  _registerDefaultActions(injector) {
    const commandStack = injector.get('commandStack', false),
      formFieldRegistry = injector.get('formFieldRegistry', false),
      selection = injector.get('selection', false);
    if (commandStack) {
      // @ts-ignore
      this.register('undo', () => {
        commandStack.undo();
      });

      // @ts-ignore
      this.register('redo', () => {
        commandStack.redo();
      });
    }
    if (formFieldRegistry && selection) {
      // @ts-ignore
      this.register('selectFormField', (options = {}) => {
        const {
          id
        } = options;
        if (!id) {
          return;
        }
        const formField = formFieldRegistry.get(id);
        if (formField) {
          selection.set(formField);
        }
      });
    }
  }
}
FormEditorActions.$inject = ['eventBus', 'injector'];

var EditorActionsModule = {
  __depends__: [EditorActionsModule$1],
  editorActions: ['type', FormEditorActions]
};

var DraggingModule = {
  __init__: ['dragging'],
  dragging: ['type', Dragging]
};

var KEYS_COPY = ['c', 'C'];
var KEYS_PASTE = ['v', 'V'];
var KEYS_REDO = ['y', 'Y'];
var KEYS_UNDO = ['z', 'Z'];

/**
 * Returns true if event was triggered with any modifier
 * @param {KeyboardEvent} event
 */
function hasModifier(event) {
  return event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
}

/**
 * @param {KeyboardEvent} event
 */
function isCmd(event) {
  // ensure we don't react to AltGr
  // (mapped to CTRL + ALT)
  if (event.altKey) {
    return false;
  }
  return event.ctrlKey || event.metaKey;
}

/**
 * Checks if key pressed is one of provided keys.
 *
 * @param {string|string[]} keys
 * @param {KeyboardEvent} event
 */
function isKey(keys, event) {
  keys = isArray(keys) ? keys : [keys];
  return keys.indexOf(event.key) !== -1 || keys.indexOf(event.code) !== -1;
}

/**
 * @param {KeyboardEvent} event
 */
function isShift(event) {
  return event.shiftKey;
}
function isCopy(event) {
  return isCmd(event) && isKey(KEYS_COPY, event);
}
function isPaste(event) {
  return isCmd(event) && isKey(KEYS_PASTE, event);
}
function isUndo(event) {
  return isCmd(event) && !isShift(event) && isKey(KEYS_UNDO, event);
}
function isRedo(event) {
  return isCmd(event) && (isKey(KEYS_REDO, event) || isKey(KEYS_UNDO, event) && isShift(event));
}

/**
 * @typedef {import('../../core/EventBus').default} EventBus
 */

var KEYDOWN_EVENT = 'keyboard.keydown',
  KEYUP_EVENT = 'keyboard.keyup';
var HANDLE_MODIFIER_ATTRIBUTE = 'input-handle-modified-keys';
var DEFAULT_PRIORITY$1 = 1000;

/**
 * A keyboard abstraction that may be activated and
 * deactivated by users at will, consuming global key events
 * and triggering diagram actions.
 *
 * For keys pressed down, keyboard fires `keyboard.keydown` event.
 * The event context contains one field which is `KeyboardEvent` event.
 *
 * The implementation fires the following key events that allow
 * other components to hook into key handling:
 *
 *  - keyboard.bind
 *  - keyboard.unbind
 *  - keyboard.init
 *  - keyboard.destroy
 *
 * All events contain one field which is node.
 *
 * A default binding for the keyboard may be specified via the
 * `keyboard.bindTo` configuration option.
 *
 * @param {Object} config
 * @param {EventBus} eventBus
 */
function Keyboard(config, eventBus) {
  var self = this;
  this._config = config || {};
  this._eventBus = eventBus;
  this._keydownHandler = this._keydownHandler.bind(this);
  this._keyupHandler = this._keyupHandler.bind(this);

  // properly clean dom registrations
  eventBus.on('diagram.destroy', function () {
    self._fire('destroy');
    self.unbind();
  });
  eventBus.on('diagram.init', function () {
    self._fire('init');
  });
  eventBus.on('attach', function () {
    if (config && config.bindTo) {
      self.bind(config.bindTo);
    }
  });
  eventBus.on('detach', function () {
    self.unbind();
  });
}
Keyboard.$inject = ['config.keyboard', 'eventBus'];
Keyboard.prototype._keydownHandler = function (event) {
  this._keyHandler(event, KEYDOWN_EVENT);
};
Keyboard.prototype._keyupHandler = function (event) {
  this._keyHandler(event, KEYUP_EVENT);
};
Keyboard.prototype._keyHandler = function (event, type) {
  var eventBusResult;
  if (this._isEventIgnored(event)) {
    return;
  }
  var context = {
    keyEvent: event
  };
  eventBusResult = this._eventBus.fire(type || KEYDOWN_EVENT, context);
  if (eventBusResult) {
    event.preventDefault();
  }
};
Keyboard.prototype._isEventIgnored = function (event) {
  if (event.defaultPrevented) {
    return true;
  }
  return isInput(event.target) && this._isModifiedKeyIgnored(event);
};
Keyboard.prototype._isModifiedKeyIgnored = function (event) {
  if (!isCmd(event)) {
    return true;
  }
  var allowedModifiers = this._getAllowedModifiers(event.target);
  return allowedModifiers.indexOf(event.key) === -1;
};
Keyboard.prototype._getAllowedModifiers = function (element) {
  var modifierContainer = closest(element, '[' + HANDLE_MODIFIER_ATTRIBUTE + ']', true);
  if (!modifierContainer || this._node && !this._node.contains(modifierContainer)) {
    return [];
  }
  return modifierContainer.getAttribute(HANDLE_MODIFIER_ATTRIBUTE).split(',');
};
Keyboard.prototype.bind = function (node) {
  // make sure that the keyboard is only bound once to the DOM
  this.unbind();
  this._node = node;

  // bind key events
  event.bind(node, 'keydown', this._keydownHandler);
  event.bind(node, 'keyup', this._keyupHandler);
  this._fire('bind');
};
Keyboard.prototype.getBinding = function () {
  return this._node;
};
Keyboard.prototype.unbind = function () {
  var node = this._node;
  if (node) {
    this._fire('unbind');

    // unbind key events
    event.unbind(node, 'keydown', this._keydownHandler);
    event.unbind(node, 'keyup', this._keyupHandler);
  }
  this._node = null;
};
Keyboard.prototype._fire = function (event) {
  this._eventBus.fire('keyboard.' + event, {
    node: this._node
  });
};

/**
 * Add a listener function that is notified with `KeyboardEvent` whenever
 * the keyboard is bound and the user presses a key. If no priority is
 * provided, the default value of 1000 is used.
 *
 * @param {number} [priority]
 * @param {Function} listener
 * @param {string} type
 */
Keyboard.prototype.addListener = function (priority, listener, type) {
  if (isFunction(priority)) {
    type = listener;
    listener = priority;
    priority = DEFAULT_PRIORITY$1;
  }
  this._eventBus.on(type || KEYDOWN_EVENT, priority, listener);
};
Keyboard.prototype.removeListener = function (listener, type) {
  this._eventBus.off(type || KEYDOWN_EVENT, listener);
};
Keyboard.prototype.hasModifier = hasModifier;
Keyboard.prototype.isCmd = isCmd;
Keyboard.prototype.isShift = isShift;
Keyboard.prototype.isKey = isKey;

// helpers ///////

function isInput(target) {
  return target && (matches(target, 'input, textarea') || target.contentEditable === 'true');
}

var LOW_PRIORITY$1 = 500;

/**
 * Adds default keyboard bindings.
 *
 * This does not pull in any features will bind only actions that
 * have previously been registered against the editorActions component.
 *
 * @param {EventBus} eventBus
 * @param {Keyboard} keyboard
 */
function KeyboardBindings(eventBus, keyboard) {
  var self = this;
  eventBus.on('editorActions.init', LOW_PRIORITY$1, function (event) {
    var editorActions = event.editorActions;
    self.registerBindings(keyboard, editorActions);
  });
}
KeyboardBindings.$inject = ['eventBus', 'keyboard'];

/**
 * Register available keyboard bindings.
 *
 * @param {Keyboard} keyboard
 * @param {EditorActions} editorActions
 */
KeyboardBindings.prototype.registerBindings = function (keyboard, editorActions) {
  /**
   * Add keyboard binding if respective editor action
   * is registered.
   *
   * @param {string} action name
   * @param {Function} fn that implements the key binding
   */
  function addListener(action, fn) {
    if (editorActions.isRegistered(action)) {
      keyboard.addListener(fn);
    }
  }

  // undo
  // (CTRL|CMD) + Z
  addListener('undo', function (context) {
    var event = context.keyEvent;
    if (isUndo(event)) {
      editorActions.trigger('undo');
      return true;
    }
  });

  // redo
  // CTRL + Y
  // CMD + SHIFT + Z
  addListener('redo', function (context) {
    var event = context.keyEvent;
    if (isRedo(event)) {
      editorActions.trigger('redo');
      return true;
    }
  });

  // copy
  // CTRL/CMD + C
  addListener('copy', function (context) {
    var event = context.keyEvent;
    if (isCopy(event)) {
      editorActions.trigger('copy');
      return true;
    }
  });

  // paste
  // CTRL/CMD + V
  addListener('paste', function (context) {
    var event = context.keyEvent;
    if (isPaste(event)) {
      editorActions.trigger('paste');
      return true;
    }
  });

  // zoom in one step
  // CTRL/CMD + +
  addListener('stepZoom', function (context) {
    var event = context.keyEvent;

    // quirk: it has to be triggered by `=` as well to work on international keyboard layout
    // cf: https://github.com/bpmn-io/bpmn-js/issues/1362#issuecomment-722989754
    if (isKey(['+', 'Add', '='], event) && isCmd(event)) {
      editorActions.trigger('stepZoom', {
        value: 1
      });
      return true;
    }
  });

  // zoom out one step
  // CTRL + -
  addListener('stepZoom', function (context) {
    var event = context.keyEvent;
    if (isKey(['-', 'Subtract'], event) && isCmd(event)) {
      editorActions.trigger('stepZoom', {
        value: -1
      });
      return true;
    }
  });

  // zoom to the default level
  // CTRL + 0
  addListener('zoom', function (context) {
    var event = context.keyEvent;
    if (isKey('0', event) && isCmd(event)) {
      editorActions.trigger('zoom', {
        value: 1
      });
      return true;
    }
  });

  // delete selected element
  // DEL
  addListener('removeSelection', function (context) {
    var event = context.keyEvent;
    if (isKey(['Backspace', 'Delete', 'Del'], event)) {
      editorActions.trigger('removeSelection');
      return true;
    }
  });
};

/**
 * @type { import('didi').ModuleDeclaration }
 */
var KeyboardModule$1 = {
  __init__: ['keyboard', 'keyboardBindings'],
  keyboard: ['type', Keyboard],
  keyboardBindings: ['type', KeyboardBindings]
};

const LOW_PRIORITY = 500;
class FormEditorKeyboardBindings {
  constructor(eventBus, keyboard) {
    eventBus.on('editorActions.init', LOW_PRIORITY, event => {
      const {
        editorActions
      } = event;
      this.registerBindings(keyboard, editorActions);
    });
  }
  registerBindings(keyboard, editorActions) {
    function addListener(action, fn) {
      if (editorActions.isRegistered(action)) {
        keyboard.addListener(fn);
      }
    }

    // undo
    // (CTRL|CMD) + Z
    addListener('undo', context => {
      const {
        keyEvent
      } = context;
      if (isCmd(keyEvent) && !isShift(keyEvent) && isKey(KEYS_UNDO, keyEvent)) {
        editorActions.trigger('undo');
        return true;
      }
    });

    // redo
    // CTRL + Y
    // CMD + SHIFT + Z
    addListener('redo', context => {
      const {
        keyEvent
      } = context;
      if (isCmd(keyEvent) && (isKey(KEYS_REDO, keyEvent) || isKey(KEYS_UNDO, keyEvent) && isShift(keyEvent))) {
        editorActions.trigger('redo');
        return true;
      }
    });
  }
}
FormEditorKeyboardBindings.$inject = ['eventBus', 'keyboard'];

var KeyboardModule = {
  __depends__: [KeyboardModule$1],
  __init__: ['keyboardBindings'],
  keyboardBindings: ['type', FormEditorKeyboardBindings]
};

function arrayAdd$1(array, index, item) {
  array.splice(index, 0, item);
  return array;
}
function arrayRemove(array, index) {
  array.splice(index, 1);
  return array;
}
function updatePath(formFieldRegistry, formField, index) {
  const parent = formFieldRegistry.get(formField._parent);
  refreshPathsRecursively(formField, [...parent._path, 'components', index]);
  return formField;
}
function refreshPathsRecursively(formField, path) {
  formField._path = path;
  const components = formField.components || [];
  components.forEach((component, index) => {
    refreshPathsRecursively(component, [...path, 'components', index]);
  });
}
function updateRow(formField, rowId) {
  formField.layout = {
    ...(formField.layout || {}),
    row: rowId
  };
  return formField;
}

class AddFormFieldHandler {
  /**
   * @constructor
   * @param { import('../../../FormEditor').default } formEditor
   * @param { import('../../../core/FormFieldRegistry').default } formFieldRegistry
   */
  constructor(formEditor, formFieldRegistry) {
    this._formEditor = formEditor;
    this._formFieldRegistry = formFieldRegistry;
  }
  execute(context) {
    const {
      formField,
      targetFormField,
      targetIndex
    } = context;
    const {
      schema
    } = this._formEditor._getState();
    const targetPath = [...targetFormField._path, 'components'];
    formField._parent = targetFormField.id;

    // (1) Add new form field
    arrayAdd$1(get(schema, targetPath), targetIndex, formField);

    // (2) Update internal paths of new form field and its siblings (and their children)
    get(schema, targetPath).forEach((formField, index) => updatePath(this._formFieldRegistry, formField, index));

    // (3) Add new form field to form field registry
    this._formFieldRegistry.add(formField);

    // TODO: Create updater/change support that automatically updates paths and schema on command execution
    this._formEditor._setState({
      schema
    });
  }
  revert(context) {
    const {
      formField,
      targetFormField,
      targetIndex
    } = context;
    const {
      schema
    } = this._formEditor._getState();
    const targetPath = [...targetFormField._path, 'components'];

    // (1) Remove new form field
    arrayRemove(get(schema, targetPath), targetIndex);

    // (2) Update internal paths of new form field and its siblings (and their children)
    get(schema, targetPath).forEach((formField, index) => updatePath(this._formFieldRegistry, formField, index));

    // (3) Remove new form field from form field registry
    this._formFieldRegistry.remove(formField);

    // TODO: Create updater/change support that automatically updates paths and schema on command execution
    this._formEditor._setState({
      schema
    });
  }
}
AddFormFieldHandler.$inject = ['formEditor', 'formFieldRegistry'];

class EditFormFieldHandler {
  /**
   * @constructor
   * @param { import('../../../FormEditor').default } formEditor
   * @param { import('../../../core/FormFieldRegistry').default } formFieldRegistry
   */
  constructor(formEditor, formFieldRegistry) {
    this._formEditor = formEditor;
    this._formFieldRegistry = formFieldRegistry;
  }
  execute(context) {
    const {
      formField,
      properties
    } = context;
    let {
      schema
    } = this._formEditor._getState();
    const oldProperties = {};
    for (let key in properties) {
      oldProperties[key] = formField[key];
      const property = properties[key];
      if (key === 'id') {
        if (property !== formField.id) {
          this._formFieldRegistry.updateId(formField, property);
        }
      } else {
        formField[key] = property;
      }
    }
    context.oldProperties = oldProperties;

    // TODO: Create updater/change support that automatically updates paths and schema on command execution
    this._formEditor._setState({
      schema
    });
    return formField;
  }
  revert(context) {
    const {
      formField,
      oldProperties
    } = context;
    let {
      schema
    } = this._formEditor._getState();
    for (let key in oldProperties) {
      const property = oldProperties[key];
      if (key === 'id') {
        if (property !== formField.id) {
          this._formFieldRegistry.updateId(formField, property);
        }
      } else {
        formField[key] = property;
      }
    }

    // TODO: Create updater/change support that automatically updates paths and schema on command execution
    this._formEditor._setState({
      schema
    });
    return formField;
  }
}
EditFormFieldHandler.$inject = ['formEditor', 'formFieldRegistry'];

class MoveFormFieldHandler {
  /**
   * @constructor
   * @param { import('../../../FormEditor').default } formEditor
   * @param { import('../../../core/FormFieldRegistry').default } formFieldRegistry
   * @param { import('@bpmn-io/form-js-viewer').PathRegistry } pathRegistry
   */
  constructor(formEditor, formFieldRegistry, pathRegistry) {
    this._formEditor = formEditor;
    this._formFieldRegistry = formFieldRegistry;
    this._pathRegistry = pathRegistry;
  }
  execute(context) {
    this.moveFormField(context);
  }
  revert(context) {
    let {
      sourceFormField,
      targetFormField,
      sourceIndex,
      targetIndex,
      sourceRow,
      targetRow
    } = context;
    this.moveFormField({
      sourceFormField: targetFormField,
      targetFormField: sourceFormField,
      sourceIndex: targetIndex,
      targetIndex: sourceIndex,
      sourceRow: targetRow,
      targetRow: sourceRow
    }, true);
  }
  moveFormField(context, revert) {
    let {
      sourceFormField,
      targetFormField,
      sourceIndex,
      targetIndex,
      targetRow
    } = context;
    let {
      schema
    } = this._formEditor._getState();
    const sourcePath = [...sourceFormField._path, 'components'];
    if (sourceFormField.id === targetFormField.id) {
      if (revert) {
        if (sourceIndex > targetIndex) {
          sourceIndex--;
        }
      } else {
        if (sourceIndex < targetIndex) {
          targetIndex--;
        }
      }
      const formField = get(schema, [...sourcePath, sourceIndex]);

      // (1) Add to row
      updateRow(formField, targetRow ? targetRow.id : null);

      // (2) Move form field
      mutate(get(schema, sourcePath), sourceIndex, targetIndex);

      // (3) Update internal paths of new form field and its siblings (and their children)
      get(schema, sourcePath).forEach((formField, index) => updatePath(this._formFieldRegistry, formField, index));
    } else {
      const formField = get(schema, [...sourcePath, sourceIndex]);

      // (1) Deregister form field (and children) from path registry
      this._pathRegistry.executeRecursivelyOnFields(formField, ({
        field
      }) => {
        this._pathRegistry.unclaimPath(this._pathRegistry.getValuePath(field));
      });
      formField._parent = targetFormField.id;

      // (2) Remove form field
      arrayRemove(get(schema, sourcePath), sourceIndex);

      // (3) Update internal paths of siblings (and their children)
      get(schema, sourcePath).forEach((formField, index) => updatePath(this._formFieldRegistry, formField, index));
      const targetPath = [...targetFormField._path, 'components'];

      // (4) Add to row
      updateRow(formField, targetRow ? targetRow.id : null);

      // (5) Add form field
      arrayAdd$1(get(schema, targetPath), targetIndex, formField);

      // (6) Update internal paths of siblings (and their children)
      get(schema, targetPath).forEach((formField, index) => updatePath(this._formFieldRegistry, formField, index));

      // (7) Reregister form field (and children) from path registry
      this._pathRegistry.executeRecursivelyOnFields(formField, ({
        field,
        isClosed
      }) => {
        this._pathRegistry.claimPath(this._pathRegistry.getValuePath(field), isClosed);
      });
    }

    // TODO: Create updater/change support that automatically updates paths and schema on command execution
    this._formEditor._setState({
      schema
    });
  }
}
MoveFormFieldHandler.$inject = ['formEditor', 'formFieldRegistry', 'pathRegistry'];

class RemoveFormFieldHandler {
  /**
   * @constructor
   * @param { import('../../../FormEditor').default } formEditor
   * @param { import('../../../core/FormFieldRegistry').default } formFieldRegistry
   */
  constructor(formEditor, formFieldRegistry) {
    this._formEditor = formEditor;
    this._formFieldRegistry = formFieldRegistry;
  }
  execute(context) {
    const {
      sourceFormField,
      sourceIndex
    } = context;
    let {
      schema
    } = this._formEditor._getState();
    const sourcePath = [...sourceFormField._path, 'components'];
    const formField = context.formField = get(schema, [...sourcePath, sourceIndex]);

    // (1) Remove form field
    arrayRemove(get(schema, sourcePath), sourceIndex);

    // (2) Update internal paths of its siblings (and their children)
    get(schema, sourcePath).forEach((formField, index) => updatePath(this._formFieldRegistry, formField, index));

    // (3) Remove form field and children from form field registry
    runRecursively(formField, formField => this._formFieldRegistry.remove(formField));

    // TODO: Create updater/change support that automatically updates paths and schema on command execution
    this._formEditor._setState({
      schema
    });
  }
  revert(context) {
    const {
      formField,
      sourceFormField,
      sourceIndex
    } = context;
    let {
      schema
    } = this._formEditor._getState();
    const sourcePath = [...sourceFormField._path, 'components'];

    // (1) Add form field
    arrayAdd$1(get(schema, sourcePath), sourceIndex, formField);

    // (2) Update internal paths of its siblings (and their children)
    get(schema, sourcePath).forEach((formField, index) => updatePath(this._formFieldRegistry, formField, index));

    // (3) Add form field and children to form field registry
    runRecursively(formField, formField => this._formFieldRegistry.add(formField));

    // TODO: Create updater/change support that automatically updates paths and schema on command execution
    this._formEditor._setState({
      schema
    });
  }
}
RemoveFormFieldHandler.$inject = ['formEditor', 'formFieldRegistry'];

class UpdateIdClaimHandler {
  /**
   * @constructor
   * @param { import('../../../core/FormFieldRegistry').default } formFieldRegistry
   */
  constructor(formFieldRegistry) {
    this._formFieldRegistry = formFieldRegistry;
  }
  execute(context) {
    const {
      claiming,
      formField,
      id
    } = context;
    if (claiming) {
      this._formFieldRegistry._ids.claim(id, formField);
    } else {
      this._formFieldRegistry._ids.unclaim(id);
    }
  }
  revert(context) {
    const {
      claiming,
      formField,
      id
    } = context;
    if (claiming) {
      this._formFieldRegistry._ids.unclaim(id);
    } else {
      this._formFieldRegistry._ids.claim(id, formField);
    }
  }
}
UpdateIdClaimHandler.$inject = ['formFieldRegistry'];

class UpdateKeyClaimHandler {
  /**
   * @constructor
   * @param { import('@bpmn-io/form-js-viewer').PathRegistry } pathRegistry
   */
  constructor(pathRegistry) {
    this._pathRegistry = pathRegistry;
  }
  execute(context) {
    const {
      claiming,
      formField,
      key
    } = context;
    const options = {
      replacements: {
        [formField.id]: key
      }
    };
    const valuePath = this._pathRegistry.getValuePath(formField, options);
    if (claiming) {
      this._pathRegistry.claimPath(valuePath, true);
    } else {
      this._pathRegistry.unclaimPath(valuePath);
    }

    // cache path for revert
    context.valuePath = valuePath;
  }
  revert(context) {
    const {
      claiming,
      valuePath
    } = context;
    if (claiming) {
      this._pathRegistry.unclaimPath(valuePath);
    } else {
      this._pathRegistry.claimPath(valuePath, true);
    }
  }
}
UpdateKeyClaimHandler.$inject = ['pathRegistry'];

class UpdatePathClaimHandler {
  /**
   * @constructor
   * @param { import('@bpmn-io/form-js-viewer').PathRegistry } pathRegistry
   */
  constructor(pathRegistry) {
    this._pathRegistry = pathRegistry;
  }
  execute(context) {
    const {
      claiming,
      formField,
      path
    } = context;
    const options = {
      replacements: {
        [formField.id]: path
      }
    };
    const valuePaths = [];
    if (claiming) {
      this._pathRegistry.executeRecursivelyOnFields(formField, ({
        field,
        isClosed
      }) => {
        const valuePath = this._pathRegistry.getValuePath(field, options);
        valuePaths.push({
          valuePath,
          isClosed
        });
        this._pathRegistry.claimPath(valuePath, isClosed);
      });
    } else {
      this._pathRegistry.executeRecursivelyOnFields(formField, ({
        field,
        isClosed
      }) => {
        const valuePath = this._pathRegistry.getValuePath(field, options);
        valuePaths.push({
          valuePath,
          isClosed
        });
        this._pathRegistry.unclaimPath(valuePath);
      });
    }

    // cache path info for revert
    context.valuePaths = valuePaths;
  }
  revert(context) {
    const {
      claiming,
      valuePaths
    } = context;
    if (claiming) {
      valuePaths.forEach(({
        valuePath
      }) => {
        this._pathRegistry.unclaimPath(valuePath);
      });
    } else {
      valuePaths.forEach(({
        valuePath,
        isClosed
      }) => {
        this._pathRegistry.claimPath(valuePath, isClosed);
      });
    }
  }
}
UpdatePathClaimHandler.$inject = ['pathRegistry'];

class Modeling {
  constructor(commandStack, eventBus, formEditor, formFieldRegistry, fieldFactory) {
    this._commandStack = commandStack;
    this._formEditor = formEditor;
    this._formFieldRegistry = formFieldRegistry;
    this._fieldFactory = fieldFactory;
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
      'formField.add': AddFormFieldHandler,
      'formField.edit': EditFormFieldHandler,
      'formField.move': MoveFormFieldHandler,
      'formField.remove': RemoveFormFieldHandler,
      'id.updateClaim': UpdateIdClaimHandler,
      'key.updateClaim': UpdateKeyClaimHandler,
      'path.updateClaim': UpdatePathClaimHandler
    };
  }
  addFormField(attrs, targetFormField, targetIndex) {
    const formField = this._fieldFactory.create(attrs);
    const context = {
      formField,
      targetFormField,
      targetIndex
    };
    this._commandStack.execute('formField.add', context);
    return formField;
  }
  editFormField(formField, properties, value) {
    if (!isObject(properties)) {
      properties = {
        [properties]: value
      };
    }
    const context = {
      formField,
      properties
    };
    this._commandStack.execute('formField.edit', context);
  }
  moveFormField(formField, sourceFormField, targetFormField, sourceIndex, targetIndex, sourceRow, targetRow) {
    const context = {
      formField,
      sourceFormField,
      targetFormField,
      sourceIndex,
      targetIndex,
      sourceRow,
      targetRow
    };
    this._commandStack.execute('formField.move', context);
  }
  removeFormField(formField, sourceFormField, sourceIndex) {
    const context = {
      formField,
      sourceFormField,
      sourceIndex
    };
    this._commandStack.execute('formField.remove', context);
  }
  claimId(formField, id) {
    const context = {
      formField,
      id,
      claiming: true
    };
    this._commandStack.execute('id.updateClaim', context);
  }
  unclaimId(formField, id) {
    const context = {
      formField,
      id,
      claiming: false
    };
    this._commandStack.execute('id.updateClaim', context);
  }
  claimKey(formField, key) {
    const context = {
      formField,
      key,
      claiming: true
    };
    this._commandStack.execute('key.updateClaim', context);
  }
  unclaimKey(formField, key) {
    const context = {
      formField,
      key,
      claiming: false
    };
    this._commandStack.execute('key.updateClaim', context);
  }
  claimPath(formField, path) {
    const context = {
      formField,
      path,
      claiming: true
    };
    this._commandStack.execute('path.updateClaim', context);
  }
  unclaimPath(formField, path) {
    const context = {
      formField,
      path,
      claiming: false
    };
    this._commandStack.execute('path.updateClaim', context);
  }
}
Modeling.$inject = ['commandStack', 'eventBus', 'formEditor', 'formFieldRegistry', 'fieldFactory'];

/**
 * @typedef {import('../core/Types').ElementLike} ElementLike
 * @typedef {import('../core/EventBus').default} EventBus
 * @typedef {import('./CommandStack').CommandContext} CommandContext
 *
 * @typedef {string|string[]} Events
 * @typedef { (context: CommandContext) => ElementLike[] | void } HandlerFunction
 * @typedef { (context: CommandContext) => void } ComposeHandlerFunction
 */

var DEFAULT_PRIORITY = 1000;

/**
 * A utility that can be used to plug into the command execution for
 * extension and/or validation.
 *
 * @class
 * @constructor
 *
 * @example
 *
 * ```javascript
 * import CommandInterceptor from 'diagram-js/lib/command/CommandInterceptor';
 *
 * class CommandLogger extends CommandInterceptor {
 *   constructor(eventBus) {
 *     super(eventBus);
 *
 *   this.preExecute('shape.create', (event) => {
 *     console.log('commandStack.shape-create.preExecute', event);
 *   });
 * }
 * ```
 *
 * @param {EventBus} eventBus
 */
function CommandInterceptor(eventBus) {
  /**
   * @type {EventBus}
   */
  this._eventBus = eventBus;
}
CommandInterceptor.$inject = ['eventBus'];
function unwrapEvent(fn, that) {
  return function (event) {
    return fn.call(that || null, event.context, event.command, event);
  };
}

/**
 * Intercept a command during one of the phases.
 *
 * @param {Events} [events] command(s) to intercept
 * @param {string} [hook] phase to intercept
 * @param {number} [priority]
 * @param {ComposeHandlerFunction|HandlerFunction} handlerFn
 * @param {boolean} [unwrap] whether the event should be unwrapped
 * @param {any} [that]
 */
CommandInterceptor.prototype.on = function (events, hook, priority, handlerFn, unwrap, that) {
  if (isFunction(hook) || isNumber(hook)) {
    that = unwrap;
    unwrap = handlerFn;
    handlerFn = priority;
    priority = hook;
    hook = null;
  }
  if (isFunction(priority)) {
    that = unwrap;
    unwrap = handlerFn;
    handlerFn = priority;
    priority = DEFAULT_PRIORITY;
  }
  if (isObject(unwrap)) {
    that = unwrap;
    unwrap = false;
  }
  if (!isFunction(handlerFn)) {
    throw new Error('handlerFn must be a function');
  }
  if (!isArray(events)) {
    events = [events];
  }
  var eventBus = this._eventBus;
  forEach(events, function (event) {
    // concat commandStack(.event)?(.hook)?
    var fullEvent = ['commandStack', event, hook].filter(function (e) {
      return e;
    }).join('.');
    eventBus.on(fullEvent, priority, unwrap ? unwrapEvent(handlerFn, that) : handlerFn, that);
  });
};

/**
 * Add a <canExecute> phase of command interceptor.
 *
 * @param {Events} [events] command(s) to intercept
 * @param {number} [priority]
 * @param {ComposeHandlerFunction|HandlerFunction} handlerFn
 * @param {boolean} [unwrap] whether the event should be unwrapped
 * @param {any} [that]
 */
CommandInterceptor.prototype.canExecute = createHook('canExecute');

/**
 * Add a <preExecute> phase of command interceptor.
 *
 * @param {Events} [events] command(s) to intercept
 * @param {number} [priority]
 * @param {ComposeHandlerFunction|HandlerFunction} handlerFn
 * @param {boolean} [unwrap] whether the event should be unwrapped
 * @param {any} [that]
 */
CommandInterceptor.prototype.preExecute = createHook('preExecute');

/**
 * Add a <preExecuted> phase of command interceptor.
 *
 * @param {Events} [events] command(s) to intercept
 * @param {number} [priority]
 * @param {ComposeHandlerFunction|HandlerFunction} handlerFn
 * @param {boolean} [unwrap] whether the event should be unwrapped
 * @param {any} [that]
 */
CommandInterceptor.prototype.preExecuted = createHook('preExecuted');

/**
 * Add a <execute> phase of command interceptor.
 *
 * @param {Events} [events] command(s) to intercept
 * @param {number} [priority]
 * @param {ComposeHandlerFunction|HandlerFunction} handlerFn
 * @param {boolean} [unwrap] whether the event should be unwrapped
 * @param {any} [that]
 */
CommandInterceptor.prototype.execute = createHook('execute');

/**
 * Add a <executed> phase of command interceptor.
 *
 * @param {Events} [events] command(s) to intercept
 * @param {number} [priority]
 * @param {ComposeHandlerFunction|HandlerFunction} handlerFn
 * @param {boolean} [unwrap] whether the event should be unwrapped
 * @param {any} [that]
 */
CommandInterceptor.prototype.executed = createHook('executed');

/**
 * Add a <postExecute> phase of command interceptor.
 *
 * @param {Events} [events] command(s) to intercept
 * @param {number} [priority]
 * @param {ComposeHandlerFunction|HandlerFunction} handlerFn
 * @param {boolean} [unwrap] whether the event should be unwrapped
 * @param {any} [that]
 */
CommandInterceptor.prototype.postExecute = createHook('postExecute');

/**
 * Add a <postExecuted> phase of command interceptor.
 *
 * @param {Events} [events] command(s) to intercept
 * @param {number} [priority]
 * @param {ComposeHandlerFunction|HandlerFunction} handlerFn
 * @param {boolean} [unwrap] whether the event should be unwrapped
 * @param {any} [that]
 */
CommandInterceptor.prototype.postExecuted = createHook('postExecuted');

/**
 * Add a <revert> phase of command interceptor.
 *
 * @param {Events} [events] command(s) to intercept
 * @param {number} [priority]
 * @param {ComposeHandlerFunction|HandlerFunction} handlerFn
 * @param {boolean} [unwrap] whether the event should be unwrapped
 * @param {any} [that]
 */
CommandInterceptor.prototype.revert = createHook('revert');

/**
 * Add a <reverted> phase of command interceptor.
 *
 * @param {Events} [events] command(s) to intercept
 * @param {number} [priority]
 * @param {ComposeHandlerFunction|HandlerFunction} handlerFn
 * @param {boolean} [unwrap] whether the event should be unwrapped
 * @param {any} [that]
 */
CommandInterceptor.prototype.reverted = createHook('reverted');

/*
 * Add prototype methods for each phase of command execution (e.g. execute,
 * revert).
 *
 * @param {string} hook
 *
 * @return { (
 *   events?: Events,
 *   priority?: number,
 *   handlerFn: ComposeHandlerFunction|HandlerFunction,
 *   unwrap?: boolean
 * ) => any }
 */
function createHook(hook) {
  /**
   * @this {CommandInterceptor}
   *
   * @param {Events} [events]
   * @param {number} [priority]
   * @param {ComposeHandlerFunction|HandlerFunction} handlerFn
   * @param {boolean} [unwrap]
   * @param {any} [that]
   */
  const hookFn = function (events, priority, handlerFn, unwrap, that) {
    if (isFunction(events) || isNumber(events)) {
      that = unwrap;
      unwrap = handlerFn;
      handlerFn = priority;
      priority = events;
      events = null;
    }
    this.on(events, hook, priority, handlerFn, unwrap, that);
  };
  return hookFn;
}

class FormLayoutUpdater extends CommandInterceptor {
  constructor(eventBus, formLayouter, modeling, formEditor) {
    super(eventBus);
    this._eventBus = eventBus;
    this._formLayouter = formLayouter;
    this._modeling = modeling;
    this._formEditor = formEditor;

    // @ts-ignore
    this.preExecute(['formField.add', 'formField.remove', 'formField.move', 'id.updateClaim'], event => this.updateRowIds(event));

    // we need that as the state got updates
    // on the next tick (not in post execute)
    eventBus.on('changed', context => {
      const {
        schema
      } = context;
      this.updateLayout(schema);
    });
  }
  updateLayout(schema) {
    this._formLayouter.clear();
    this._formLayouter.calculateLayout(clone(schema));
  }
  updateRowIds(event) {
    const {
      schema
    } = this._formEditor._getState();

    // make sure rows are persisted in schema (e.g. for migration case)
    schema.components.forEach(formField => {
      const row = this._formLayouter.getRowForField(formField);
      updateRow(formField, row.id);
    });
  }
}
FormLayoutUpdater.$inject = ['eventBus', 'formLayouter', 'modeling', 'formEditor'];

class IdBehavior extends CommandInterceptor {
  constructor(eventBus, modeling) {
    super(eventBus);
    this.preExecute('formField.remove', function (context) {
      const {
        formField
      } = context;
      const {
        id
      } = formField;
      modeling.unclaimId(formField, id);
    }, true);
    this.preExecute('formField.edit', function (context) {
      const {
        formField,
        properties
      } = context;
      if ('id' in properties) {
        modeling.unclaimId(formField, formField.id);
        modeling.claimId(formField, properties.id);
      }
    }, true);
  }
}
IdBehavior.$inject = ['eventBus', 'modeling'];

class KeyBehavior extends CommandInterceptor {
  constructor(eventBus, modeling, formFields) {
    super(eventBus);
    this.preExecute('formField.remove', function (context) {
      const {
        formField
      } = context;
      const {
        key,
        type
      } = formField;
      const {
        config
      } = formFields.get(type);
      if (config.keyed) {
        modeling.unclaimKey(formField, key);
      }
    }, true);
    this.preExecute('formField.edit', function (context) {
      const {
        formField,
        properties
      } = context;
      const {
        key,
        type
      } = formField;
      const {
        config
      } = formFields.get(type);
      if (config.keyed && 'key' in properties) {
        modeling.unclaimKey(formField, key);
        modeling.claimKey(formField, properties.key);
      }
    }, true);
  }
}
KeyBehavior.$inject = ['eventBus', 'modeling', 'formFields'];

class PathBehavior extends CommandInterceptor {
  constructor(eventBus, modeling, formFields) {
    super(eventBus);
    this.preExecute('formField.remove', function (context) {
      const {
        formField
      } = context;
      const {
        path,
        type
      } = formField;
      const {
        config
      } = formFields.get(type);
      if (config.pathed) {
        modeling.unclaimPath(formField, path);
      }
    }, true);
    this.preExecute('formField.edit', function (context) {
      const {
        formField,
        properties
      } = context;
      const {
        path,
        type
      } = formField;
      const {
        config
      } = formFields.get(type);
      if (config.pathed && 'path' in properties) {
        modeling.unclaimPath(formField, path);
        modeling.claimPath(formField, properties.path);
      }
    }, true);
  }
}
PathBehavior.$inject = ['eventBus', 'modeling', 'formFields'];

class ValidateBehavior extends CommandInterceptor {
  constructor(eventBus) {
    super(eventBus);

    /**
     * Remove custom validation if <validationType> is about to be added.
     */
    this.preExecute('formField.edit', function (context) {
      const {
        properties
      } = context;
      const {
        validate = {}
      } = properties;
      if (validate.validationType) {
        const newValidate = {
          ...validate
        };
        //todo: check important
        // delete newValidate.minLength;
        // delete newValidate.maxLength;
        //delete newValidate.pattern;
        properties['validate'] = newValidate;
      }
    }, true);
  }
}
ValidateBehavior.$inject = ['eventBus'];

var behaviorModule = {
  __init__: ['idBehavior', 'keyBehavior', 'pathBehavior', 'validateBehavior'],
  idBehavior: ['type', IdBehavior],
  keyBehavior: ['type', KeyBehavior],
  pathBehavior: ['type', PathBehavior],
  validateBehavior: ['type', ValidateBehavior]
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

var ModelingModule = {
  __depends__: [behaviorModule, commandModule],
  __init__: ['formLayoutUpdater', 'modeling'],
  formLayoutUpdater: ['type', FormLayoutUpdater],
  modeling: ['type', Modeling]
};

class Selection {
  constructor(eventBus) {
    this._eventBus = eventBus;
    this._selection = null;
  }
  get() {
    return this._selection;
  }
  set(selection) {
    if (this._selection === selection) {
      return;
    }
    this._selection = selection;
    this._eventBus.fire('selection.changed', {
      selection: this._selection
    });
  }
  toggle(selection) {
    const newSelection = this._selection === selection ? null : selection;
    this.set(newSelection);
  }
  clear() {
    this.set(null);
  }
  isSelected(formField) {
    return this._selection === formField;
  }
}
Selection.$inject = ['eventBus'];

class SelectionBehavior {
  constructor(eventBus, selection) {
    eventBus.on(['commandStack.formField.add.postExecuted', 'commandStack.formField.move.postExecuted'], ({
      context
    }) => {
      const {
        formField
      } = context;
      selection.set(formField);
    });
    eventBus.on('commandStack.formField.remove.postExecuted', ({
      context
    }) => {
      const {
        sourceFormField,
        sourceIndex
      } = context;
      const formField = sourceFormField.components[sourceIndex] || sourceFormField.components[sourceIndex - 1];
      if (formField) {
        selection.set(formField);
      } else {
        selection.clear();
      }
    });
    eventBus.on('formField.remove', ({
      formField
    }) => {
      if (selection.isSelected(formField)) {
        selection.clear();
      }
    });
  }
}
SelectionBehavior.$inject = ['eventBus', 'selection'];

var SelectionModule = {
  __init__: ['selection', 'selectionBehavior'],
  selection: ['type', Selection],
  selectionBehavior: ['type', SelectionBehavior]
};

/**
 * Base class for sectionable UI modules.
 *
 * @property {EventBus} _eventBus - EventBus instance used for event handling.
 * @property {string} managerType - Type of the render manager. Used to form event names.
 *
 * @class SectionModuleBase
 */
class SectionModuleBase {
  /**
   * Create a SectionModuleBase instance.
   *
   * @param {any} eventBus - The EventBus instance used for event handling.
   * @param {string} sectionKey - The type of render manager. Used to form event names.
   *
   * @constructor
   */
  constructor(eventBus, sectionKey) {
    this._eventBus = eventBus;
    this._sectionKey = sectionKey;
    this._eventBus.on(`${this._sectionKey}.section.rendered`, () => {
      this.isSectionRendered = true;
    });
    this._eventBus.on(`${this._sectionKey}.section.destroyed`, () => {
      this.isSectionRendered = false;
    });
  }

  /**
   * Attach the managed section to a parent node.
   *
   * @param {HTMLElement} container - The parent node to attach to.
   */
  attachTo(container) {
    this._onceSectionRendered(() => this._eventBus.fire(`${this._sectionKey}.attach`, {
      container
    }));
  }

  /**
   * Detach the managed section from its parent node.
   */
  detach() {
    this._onceSectionRendered(() => this._eventBus.fire(`${this._sectionKey}.detach`));
  }

  /**
   * Reset the managed section to its initial state.
   */
  reset() {
    this._onceSectionRendered(() => this._eventBus.fire(`${this._sectionKey}.reset`));
  }

  /**
   * Circumvents timing issues.
   */
  _onceSectionRendered(callback) {
    if (this.isSectionRendered) {
      callback();
    } else {
      this._eventBus.once(`${this._sectionKey}.section.rendered`, callback);
    }
  }
}

let PaletteModule$1 = class PaletteModule extends SectionModuleBase {
  constructor(eventBus) {
    super(eventBus, 'palette');
  }
};
PaletteModule$1.$inject = ['eventBus'];

var PaletteModule = {
  palette: ['type', PaletteModule$1]
};

var ArrowIcon = function ArrowIcon(props) {
  return jsx("svg", {
    ...props,
    children: jsx("path", {
      fillRule: "evenodd",
      d: "m11.657 8-4.95 4.95a1 1 0 0 1-1.414-1.414L8.828 8 5.293 4.464A1 1 0 1 1 6.707 3.05L11.657 8Z"
    })
  });
};
ArrowIcon.defaultProps = {
  xmlns: "http://www.w3.org/2000/svg",
  width: "16",
  height: "16"
};
var CreateIcon = function CreateIcon(props) {
  return jsx("svg", {
    ...props,
    children: jsx("path", {
      fillRule: "evenodd",
      d: "M9 13V9h4a1 1 0 0 0 0-2H9V3a1 1 0 1 0-2 0v4H3a1 1 0 1 0 0 2h4v4a1 1 0 0 0 2 0Z"
    })
  });
};
CreateIcon.defaultProps = {
  xmlns: "http://www.w3.org/2000/svg",
  width: "16",
  height: "16"
};
var DeleteIcon = function DeleteIcon(props) {
  return jsx("svg", {
    ...props,
    children: jsx("path", {
      fillRule: "evenodd",
      d: "M12 6v7c0 1.1-.4 1.55-1.5 1.55h-5C4.4 14.55 4 14.1 4 13V6h8Zm-1.5 1.5h-5v4.3c0 .66.5 1.2 1.111 1.2H9.39c.611 0 1.111-.54 1.111-1.2V7.5ZM13 3h-2l-1-1H6L5 3H3v1.5h10V3Z"
    })
  });
};
DeleteIcon.defaultProps = {
  xmlns: "http://www.w3.org/2000/svg",
  width: "16",
  height: "16"
};
var DragIcon = function DragIcon(props) {
  return jsxs("svg", {
    ...props,
    children: [jsx("path", {
      fill: "#fff",
      style: {
        mixBlendMode: "multiply"
      },
      d: "M0 0h16v16H0z"
    }), jsx("path", {
      fill: "#fff",
      style: {
        mixBlendMode: "multiply"
      },
      d: "M0 0h16v16H0z"
    }), jsx("path", {
      d: "M7 3H5v2h2V3zm4 0H9v2h2V3zM7 7H5v2h2V7zm4 0H9v2h2V7zm-4 4H5v2h2v-2zm4 0H9v2h2v-2z",
      fill: "#161616"
    })]
  });
};
DragIcon.defaultProps = {
  width: "16",
  height: "16",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg"
};
var ExternalLinkIcon = function ExternalLinkIcon(props) {
  return jsx("svg", {
    ...props,
    children: jsx("path", {
      fillRule: "evenodd",
      clipRule: "evenodd",
      d: "M12.637 12.637v-4.72h1.362v4.721c0 .36-.137.676-.411.95-.275.275-.591.412-.95.412H3.362c-.38 0-.703-.132-.967-.396A1.315 1.315 0 0 1 2 12.638V3.362c0-.38.132-.703.396-.967S2.982 2 3.363 2h4.553v1.363H3.363v9.274h9.274ZM14 2H9.28l-.001 1.362h2.408L5.065 9.984l.95.95 6.622-6.622v2.409H14V2Z",
      fill: "currentcolor"
    })
  });
};
ExternalLinkIcon.defaultProps = {
  width: "16",
  height: "16",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg"
};
var FeelIcon$1 = function FeelIcon(props) {
  return jsx("svg", {
    ...props,
    children: jsx("path", {
      d: "M3.617 11.99c-.137.684-.392 1.19-.765 1.518-.362.328-.882.492-1.558.492H0l.309-1.579h1.264l1.515-7.64h-.912l.309-1.579h.911l.236-1.191c.137-.685.387-1.192.75-1.52C4.753.164 5.277 0 5.953 0h1.294L6.94 1.579H5.675l-.323 1.623h1.264l-.309 1.579H5.043l-1.426 7.208ZM5.605 11.021l3.029-4.155L7.28 3.202h2.073l.706 2.547h.176l1.691-2.547H14l-3.014 4.051 1.338 3.768H10.25l-.706-2.606H9.37L7.678 11.02H5.605Z",
      fill: "currentcolor"
    })
  });
};
FeelIcon$1.defaultProps = {
  width: "14",
  height: "14",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg"
};
function Header(props) {
  const {
    element,
    headerProvider
  } = props;
  const {
    getElementIcon,
    getDocumentationRef,
    getElementLabel,
    getTypeLabel
  } = headerProvider;
  const label = getElementLabel(element);
  const type = getTypeLabel(element);
  const documentationRef = getDocumentationRef && getDocumentationRef(element);
  const ElementIcon = getElementIcon(element);
  return jsxs("div", {
    class: "bio-properties-panel-header",
    children: [jsx("div", {
      class: "bio-properties-panel-header-icon",
      children: ElementIcon && jsx(ElementIcon, {
        width: "32",
        height: "32",
        viewBox: "0 0 32 32"
      })
    }), jsxs("div", {
      class: "bio-properties-panel-header-labels",
      children: [jsx("div", {
        title: type,
        class: "bio-properties-panel-header-type",
        children: type
      }), label ? jsx("div", {
        title: label,
        class: "bio-properties-panel-header-label",
        children: label
      }) : null]
    }), jsx("div", {
      class: "bio-properties-panel-header-actions",
      children: documentationRef ? jsx("a", {
        rel: "noopener",
        class: "bio-properties-panel-header-link",
        href: documentationRef,
        title: "Open documentation",
        target: "_blank",
        children: jsx(ExternalLinkIcon, {})
      }) : null
    })]
  });
}
const DescriptionContext = createContext({
  description: {},
  getDescriptionForId: () => { }
});
const ErrorsContext = createContext({
  errors: {}
});

/**
 * @typedef {Function} <propertiesPanel.showEntry> callback
 *
 * @example
 *
 * useEvent('propertiesPanel.showEntry', ({ focus = false, ...rest }) => {
 *   // ...
 * });
 *
 * @param {Object} context
 * @param {boolean} [context.focus]
 *
 * @returns void
 */
const EventContext = createContext({
  eventBus: null
});
const LayoutContext = createContext({
  layout: {},
  setLayout: () => { },
  getLayoutForKey: () => { },
  setLayoutForKey: () => { }
});
const TooltipContext = createContext({
  tooltip: {},
  getTooltipForId: () => { }
});

/**
 * Accesses the global TooltipContext and returns a tooltip for a given id and element.
 *
 * @example
 * ```jsx
 * function TextField(props) {
 *   const tooltip = useTooltipContext('input1', element);
 * }
 * ```
 *
 * @param {string} id
 * @param {object} element
 *
 * @returns {string}
 */
function useTooltipContext(id, element) {
  const {
    getTooltipForId
  } = useContext(TooltipContext);
  return getTooltipForId(id, element);
}
function TooltipWrapper(props) {
  const {
    forId,
    element
  } = props;
  const contextDescription = useTooltipContext(forId, element);
  const value = props.value || contextDescription;
  if (!value) {
    return props.children;
  }
  return jsx(Tooltip, {
    ...props,
    value: value,
    forId: prefixId$9(forId)
  });
}
function Tooltip(props) {
  const {
    forId,
    value,
    parent
  } = props;
  const [visible, setShow] = useState(false);
  const [focusedViaKeyboard, setFocusedViaKeyboard] = useState(false);
  let timeout = null;
  const wrapperRef = useRef$1(null);
  const tooltipRef = useRef$1(null);
  const showTooltip = async event => {
    const show = () => setShow(true);
    if (!visible && !timeout) {
      if (event instanceof MouseEvent) {
        timeout = setTimeout(show, 200);
      } else {
        show();
        setFocusedViaKeyboard(true);
      }
    }
  };
  const hideTooltip = () => {
    setShow(false);
    setFocusedViaKeyboard(false);
  };
  const hideTooltipViaEscape = e => {
    e.code === 'Escape' && hideTooltip();
  };
  const isTooltipHovered = ({
    x,
    y
  }) => {
    const tooltip = tooltipRef.current;
    const wrapper = wrapperRef.current;
    return tooltip && (inBounds(x, y, wrapper.getBoundingClientRect()) || inBounds(x, y, tooltip.getBoundingClientRect()));
  };
  useEffect(() => {
    const {
      current
    } = wrapperRef;
    if (!current) {
      return;
    }
    const hideHoveredTooltip = e => {
      const isFocused = document.activeElement === wrapperRef.current || document.activeElement.closest('.bio-properties-panel-tooltip');
      if (visible && !isTooltipHovered({
        x: e.x,
        y: e.y
      }) && !(isFocused && focusedViaKeyboard)) {
        hideTooltip();
      }
    };
    const hideFocusedTooltip = e => {
      const {
        relatedTarget
      } = e;
      const isTooltipChild = el => !!el.closest('.bio-properties-panel-tooltip');
      if (visible && !isHovered(wrapperRef.current) && relatedTarget && !isTooltipChild(relatedTarget)) {
        hideTooltip();
      }
    };
    document.addEventListener('wheel', hideHoveredTooltip);
    document.addEventListener('focusout', hideFocusedTooltip);
    document.addEventListener('mousemove', hideHoveredTooltip);
    return () => {
      document.removeEventListener('wheel', hideHoveredTooltip);
      document.removeEventListener('mousemove', hideHoveredTooltip);
      document.removeEventListener('focusout', hideFocusedTooltip);
    };
  }, [wrapperRef.current, visible, focusedViaKeyboard]);
  const renderTooltip = () => {
    return jsxs("div", {
      class: "bio-properties-panel-tooltip",
      role: "tooltip",
      id: "bio-properties-panel-tooltip",
      "aria-labelledby": forId,
      style: getTooltipPosition(wrapperRef.current),
      ref: tooltipRef,
      onClick: e => e.stopPropagation(),
      children: [jsx("div", {
        class: "bio-properties-panel-tooltip-content",
        children: value
      }), jsx("div", {
        class: "bio-properties-panel-tooltip-arrow"
      })]
    });
  };
  return jsxs("div", {
    class: "bio-properties-panel-tooltip-wrapper",
    tabIndex: "0",
    ref: wrapperRef,
    onMouseEnter: showTooltip,
    onMouseLeave: () => {
      clearTimeout(timeout);
      timeout = null;
    },
    onFocus: showTooltip,
    onKeyDown: hideTooltipViaEscape,
    children: [props.children, visible ? parent ? createPortal(renderTooltip(), parent.current) : renderTooltip() : null]
  });
}

// helper
function inBounds(x, y, bounds) {
  const {
    top,
    right,
    bottom,
    left
  } = bounds;
  return x >= left && x <= right && y >= top && y <= bottom;
}
function getTooltipPosition(refElement) {
  const refPosition = refElement.getBoundingClientRect();
  const right = `calc(100% - ${refPosition.x}px)`;
  const top = `${refPosition.top - 10}px`;
  return `right: ${right}; top: ${top};`;
}
function isHovered(element) {
  return element.matches(':hover');
}
function prefixId$9(id) {
  return `bio-properties-panel-${id}`;
}

/**
 * Accesses the global DescriptionContext and returns a description for a given id and element.
 *
 * @example
 * ```jsx
 * function TextField(props) {
 *   const description = useDescriptionContext('input1', element);
 * }
 * ```
 *
 * @param {string} id
 * @param {object} element
 *
 * @returns {string}
 */
function useDescriptionContext(id, element) {
  const {
    getDescriptionForId
  } = useContext(DescriptionContext);
  return getDescriptionForId(id, element);
}
function useError(id) {
  const {
    errors
  } = useContext(ErrorsContext);
  return errors[id];
}
function useErrors() {
  const {
    errors
  } = useContext(ErrorsContext);
  return errors;
}

/**
 * Subscribe to an event immediately. Update subscription after inputs changed.
 *
 * @param {string} event
 * @param {Function} callback
 */
function useEvent(event, callback, eventBus) {
  const eventContext = useContext(EventContext);
  if (!eventBus) {
    ({
      eventBus
    } = eventContext);
  }
  const didMount = useRef$1(false);

  // (1) subscribe immediately
  if (eventBus && !didMount.current) {
    eventBus.on(event, callback);
  }

  // (2) update subscription after inputs changed
  useEffect(() => {
    if (eventBus && didMount.current) {
      eventBus.on(event, callback);
    }
    didMount.current = true;
    return () => {
      if (eventBus) {
        eventBus.off(event, callback);
      }
    };
  }, [callback, event, eventBus]);
}

/**
 * Creates a state that persists in the global LayoutContext.
 *
 * @example
 * ```jsx
 * function Group(props) {
 *   const [ open, setOpen ] = useLayoutState([ 'groups', 'foo', 'open' ], false);
 * }
 * ```
 *
 * @param {(string|number)[]} path
 * @param {any} [defaultValue]
 *
 * @returns {[ any, Function ]}
 */
function useLayoutState(path, defaultValue) {
  const {
    getLayoutForKey,
    setLayoutForKey
  } = useContext(LayoutContext);
  const layoutForKey = getLayoutForKey(path, defaultValue);
  const setState = useCallback(newValue => {
    setLayoutForKey(path, newValue);
  }, [setLayoutForKey]);
  return [layoutForKey, setState];
}

/**
 * @pinussilvestrus: we need to introduce our own hook to persist the previous
 * state on updates.
 *
 * cf. https://reactjs.org/docs/hooks-faq.html#how-to-get-the-previous-props-or-state
 */

function usePrevious(value) {
  const ref = useRef$1();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

/**
 * Subscribe to `propertiesPanel.showEntry`.
 *
 * @param {string} id
 *
 * @returns {import('preact').Ref}
 */
function useShowEntryEvent(id) {
  const {
    onShow
  } = useContext(LayoutContext);
  const ref = useRef$1();
  const focus = useRef$1(false);
  const onShowEntry = useCallback(event => {
    if (event.id === id) {
      onShow();
      if (!focus.current) {
        focus.current = true;
      }
    }
  }, [id]);
  useEffect(() => {
    if (focus.current && ref.current) {
      if (isFunction(ref.current.focus)) {
        ref.current.focus();
      }
      if (isFunction(ref.current.select)) {
        ref.current.select();
      }
      focus.current = false;
    }
  });
  useEvent('propertiesPanel.showEntry', onShowEntry);
  return ref;
}

/**
 * @callback setSticky
 * @param {boolean} value
 */

/**
 * Use IntersectionObserver to identify when DOM element is in sticky mode.
 * If sticky is observered setSticky(true) will be called.
 * If sticky mode is left, setSticky(false) will be called.
 *
 *
 * @param {Object} ref
 * @param {string} scrollContainerSelector
 * @param {setSticky} setSticky
 */
function useStickyIntersectionObserver(ref, scrollContainerSelector, setSticky) {
  const [scrollContainer, setScrollContainer] = useState(query(scrollContainerSelector));
  const updateScrollContainer = useCallback(() => {
    const newScrollContainer = query(scrollContainerSelector);
    if (newScrollContainer !== scrollContainer) {
      setScrollContainer(newScrollContainer);
    }
  }, [scrollContainerSelector, scrollContainer]);
  useEffect(() => {
    updateScrollContainer();
  }, [updateScrollContainer]);
  useEvent('propertiesPanel.attach', updateScrollContainer);
  useEvent('propertiesPanel.detach', updateScrollContainer);
  useEffect(() => {
    const Observer = IntersectionObserver;

    // return early if IntersectionObserver is not available
    if (!Observer) {
      return;
    }

    // TODO(@barmac): test this
    if (!ref.current || !scrollContainer) {
      return;
    }
    const observer = new Observer(entries => {
      // scroll container is unmounted, do not update sticky state
      if (scrollContainer.scrollHeight === 0) {
        return;
      }
      entries.forEach(entry => {
        if (entry.intersectionRatio < 1) {
          setSticky(true);
        } else if (entry.intersectionRatio === 1) {
          setSticky(false);
        }
      });
    }, {
      root: scrollContainer,
      rootMargin: '0px 0px 999999% 0px',
      // Use bottom margin to avoid stickyness when scrolling out to bottom
      threshold: [1]
    });
    observer.observe(ref.current);

    // Unobserve if unmounted
    return () => {
      observer.unobserve(ref.current);
    };
  }, [ref.current, scrollContainer, setSticky]);
}

/**
 * Creates a static function reference with changing body.
 * This is necessary when external libraries require a callback function
 * that has references to state variables.
 *
 * Usage:
 * const callback = useStaticCallback((val) => {val === currentState});
 *
 * The `callback` reference is static and can be safely used in external
 * libraries or as a prop that does not cause rerendering of children.
 *
 * @param {Function} callback function with changing reference
 * @returns {Function} static function reference
 */
function useStaticCallback(callback) {
  const callbackRef = useRef$1(callback);
  callbackRef.current = callback;
  return useCallback((...args) => callbackRef.current(...args), []);
}
function Group(props) {
  const {
    element,
    entries = [],
    id,
    label,
    shouldOpen = false
  } = props;
  const groupRef = useRef$1(null);
  const [open, setOpen] = useLayoutState(['groups', id, 'open'], shouldOpen);
  const onShow = useCallback(() => setOpen(true), [setOpen]);
  const toggleOpen = () => setOpen(!open);
  const [edited, setEdited] = useState(false);
  const [sticky, setSticky] = useState(false);

  // set edited state depending on all entries
  useEffect(() => {
    // TODO(@barmac): replace with CSS when `:has()` is supported in all major browsers, or rewrite as in https://github.com/camunda/camunda-modeler/issues/3815#issuecomment-1733038161
    const scheduled = requestAnimationFrame(() => {
      const hasOneEditedEntry = entries.find(entry => {
        const {
          id,
          isEdited
        } = entry;
        const entryNode = query(`[data-entry-id="${id}"]`);
        if (!isFunction(isEdited) || !entryNode) {
          return false;
        }
        const inputNode = query('.bio-properties-panel-input', entryNode);
        return isEdited(inputNode);
      });
      setEdited(hasOneEditedEntry);
    });
    return () => cancelAnimationFrame(scheduled);
  }, [entries, setEdited]);

  // set error state depending on all entries
  const allErrors = useErrors();
  const hasErrors = entries.some(entry => allErrors[entry.id]);

  // set css class when group is sticky to top
  useStickyIntersectionObserver(groupRef, 'div.bio-properties-panel-scroll-container', setSticky);
  const propertiesPanelContext = {
    ...useContext(LayoutContext),
    onShow
  };
  return jsxs("div", {
    class: "bio-properties-panel-group",
    "data-group-id": 'group-' + id,
    ref: groupRef,
    children: [jsxs("div", {
      class: classnames('bio-properties-panel-group-header', edited ? '' : 'empty', open ? 'open' : '', sticky && open ? 'sticky' : ''),
      onClick: toggleOpen,
      children: [jsx("div", {
        title: props.tooltip ? null : label,
        "data-title": label,
        class: "bio-properties-panel-group-header-title",
        children: jsx(TooltipWrapper, {
          value: props.tooltip,
          forId: 'group-' + id,
          element: element,
          parent: groupRef,
          children: label
        })
      }), jsxs("div", {
        class: "bio-properties-panel-group-header-buttons",
        children: [jsx(DataMarker, {
          edited: edited,
          hasErrors: hasErrors
        }), jsx("button", {
          title: "Toggle section",
          class: "bio-properties-panel-group-header-button bio-properties-panel-arrow",
          children: jsx(ArrowIcon, {
            class: open ? 'bio-properties-panel-arrow-down' : 'bio-properties-panel-arrow-right'
          })
        })]
      })]
    }), jsx("div", {
      class: classnames('bio-properties-panel-group-entries', open ? 'open' : ''),
      children: jsx(LayoutContext.Provider, {
        value: propertiesPanelContext,
        children: entries.map(entry => {
          const {
            component: Component,
            id
          } = entry;
          return createElement(Component, {
            ...entry,
            element: element,
            key: id
          });
        })
      })
    })]
  });
}
function DataMarker(props) {
  const {
    edited,
    hasErrors
  } = props;
  if (hasErrors) {
    return jsx("div", {
      title: "Section contains an error",
      class: "bio-properties-panel-dot bio-properties-panel-dot--error"
    });
  }
  if (edited) {
    return jsx("div", {
      title: "Section contains data",
      class: "bio-properties-panel-dot"
    });
  }
  return null;
}

/**
 * @typedef { {
 *  text: (element: object) => string,
 *  icon?: (element: Object) => import('preact').Component
 * } } PlaceholderDefinition
 *
 * @param { PlaceholderDefinition } props
 */
function Placeholder(props) {
  const {
    text,
    icon: Icon
  } = props;
  return jsx("div", {
    class: "bio-properties-panel open",
    children: jsxs("section", {
      class: "bio-properties-panel-placeholder",
      children: [Icon && jsx(Icon, {
        class: "bio-properties-panel-placeholder-icon"
      }), jsx("p", {
        class: "bio-properties-panel-placeholder-text",
        children: text
      })]
    })
  });
}
function Description$1(props) {
  const {
    element,
    forId,
    value
  } = props;
  const contextDescription = useDescriptionContext(forId, element);
  const description = value || contextDescription;
  if (description) {
    return jsx("div", {
      class: "bio-properties-panel-description",
      children: description
    });
  }
}
const noop$6 = () => { };

/**
 * Buffer `.focus()` calls while the editor is not initialized.
 * Set Focus inside when the editor is ready.
 */
const useBufferedFocus$1 = function (editor, ref) {
  const [buffer, setBuffer] = useState(undefined);
  ref.current = useMemo(() => ({
    focus: offset => {
      if (editor) {
        editor.focus(offset);
      } else {
        if (typeof offset === 'undefined') {
          offset = Infinity;
        }
        setBuffer(offset);
      }
    }
  }), [editor]);
  useEffect(() => {
    if (typeof buffer !== 'undefined' && editor) {
      editor.focus(buffer);
      setBuffer(false);
    }
  }, [editor, buffer]);
};
const CodeEditor$1 = forwardRef((props, ref) => {
  const {
    onInput,
    disabled,
    tooltipContainer,
    enableGutters,
    value,
    onLint = noop$6,
    onPopupOpen = noop$6,
    popupOpen,
    contentAttributes = {},
    hostLanguage = null,
    singleLine = false
  } = props;
  const inputRef = useRef$1();
  const [editor, setEditor] = useState();
  const [localValue, setLocalValue] = useState(value || '');
  useBufferedFocus$1(editor, ref);
  const handleInput = useStaticCallback(newValue => {
    onInput(newValue);
    setLocalValue(newValue);
  });
  useEffect(() => {
    let editor;
    editor = new FeelersEditor({
      container: inputRef.current,
      onChange: handleInput,
      value: localValue,
      onLint,
      contentAttributes,
      tooltipContainer,
      enableGutters,
      hostLanguage,
      singleLine
    });
    setEditor(editor);
    return () => {
      onLint([]);
      inputRef.current.innerHTML = '';
      setEditor(null);
    };
  }, []);
  useEffect(() => {
    if (!editor) {
      return;
    }
    if (value === localValue) {
      return;
    }
    editor.setValue(value);
    setLocalValue(value);
  }, [value]);
  const handleClick = () => {
    ref.current.focus();
  };
  return jsxs("div", {
    class: classnames('bio-properties-panel-feelers-editor-container', popupOpen ? 'popupOpen' : null),
    children: [jsx("div", {
      class: "bio-properties-panel-feelers-editor__open-popup-placeholder",
      children: "Opened in editor"
    }), jsx("div", {
      name: props.name,
      class: classnames('bio-properties-panel-feelers-editor bio-properties-panel-input', localValue ? 'edited' : null, disabled ? 'disabled' : null),
      ref: inputRef,
      onClick: handleClick
    }), jsx("button", {
      title: "Open pop-up editor",
      class: "bio-properties-panel-open-feel-popup",
      onClick: () => onPopupOpen('feelers'),
      children: jsx(ExternalLinkIcon, {})
    })]
  });
});
const noop$5 = () => { };

/**
 * Buffer `.focus()` calls while the editor is not initialized.
 * Set Focus inside when the editor is ready.
 */
const useBufferedFocus = function (editor, ref) {
  const [buffer, setBuffer] = useState(undefined);
  ref.current = useMemo(() => ({
    focus: offset => {
      if (editor) {
        editor.focus(offset);
      } else {
        if (typeof offset === 'undefined') {
          offset = Infinity;
        }
        setBuffer(offset);
      }
    }
  }), [editor]);
  useEffect(() => {
    if (typeof buffer !== 'undefined' && editor) {
      editor.focus(buffer);
      setBuffer(false);
    }
  }, [editor, buffer]);
};
const CodeEditor = forwardRef((props, ref) => {
  const {
    enableGutters,
    value,
    onInput,
    onFeelToggle = noop$5,
    onLint = noop$5,
    onPopupOpen = noop$5,
    popupOpen,
    disabled,
    tooltipContainer,
    variables
  } = props;
  const inputRef = useRef$1();
  const [editor, setEditor] = useState();
  const [localValue, setLocalValue] = useState(value || '');
  useBufferedFocus(editor, ref);
  const handleInput = useStaticCallback(newValue => {
    onInput(newValue);
    setLocalValue(newValue);
  });
  useEffect(() => {
    let editor;

    /* Trigger FEEL toggle when
     *
     * - `backspace` is pressed
     * - AND the cursor is at the beginning of the input
     */
    const onKeyDown = e => {
      if (e.key !== 'Backspace' || !editor) {
        return;
      }
      const selection = editor.getSelection();
      const range = selection.ranges[selection.mainIndex];
      if (range.from === 0 && range.to === 0) {
        onFeelToggle();
      }
    };
    editor = new FeelEditor({
      container: inputRef.current,
      onChange: handleInput,
      onKeyDown: onKeyDown,
      onLint: onLint,
      tooltipContainer: tooltipContainer,
      value: localValue,
      variables: variables,
      extensions: [...(enableGutters ? [lineNumbers()] : [])]
    });
    setEditor(editor);
    return () => {
      onLint([]);
      inputRef.current.innerHTML = '';
      setEditor(null);
    };
  }, []);
  useEffect(() => {
    if (!editor) {
      return;
    }
    if (value === localValue) {
      return;
    }
    editor.setValue(value);
    setLocalValue(value);
  }, [value]);
  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.setVariables(variables);
  }, [variables]);
  const handleClick = () => {
    ref.current.focus();
  };
  return jsxs("div", {
    class: classnames('bio-properties-panel-feel-editor-container', disabled ? 'disabled' : null, popupOpen ? 'popupOpen' : null),
    children: [jsx("div", {
      class: "bio-properties-panel-feel-editor__open-popup-placeholder",
      children: "Opened in editor"
    }), jsx("div", {
      name: props.name,
      class: classnames('bio-properties-panel-input', localValue ? 'edited' : null),
      ref: inputRef,
      onClick: handleClick
    }), jsx("button", {
      title: "Open pop-up editor",
      class: "bio-properties-panel-open-feel-popup",
      onClick: () => onPopupOpen(),
      children: jsx(ExternalLinkIcon, {})
    })]
  });
});
function FeelIndicator(props) {
  const {
    active
  } = props;
  if (!active) {
    return null;
  }
  return jsx("span", {
    class: "bio-properties-panel-feel-indicator",
    children: "="
  });
}
const noop$4 = () => { };

/**
 * @param {Object} props
 * @param {Object} props.label
 * @param {String} props.feel
 */
function FeelIcon(props) {
  const {
    feel = false,
    active,
    disabled = false,
    onClick = noop$4
  } = props;
  const feelRequiredLabel = 'FEEL expression is mandatory';
  const feelOptionalLabel = `Click to ${active ? 'remove' : 'set a'} dynamic value with FEEL expression`;
  const handleClick = e => {
    onClick(e);

    // when pointer event was created from keyboard, keep focus on button
    if (!e.pointerType) {
      e.stopPropagation();
    }
  };
  return jsx("button", {
    class: classnames('bio-properties-panel-feel-icon', active ? 'active' : null, feel === 'required' ? 'required' : 'optional'),
    onClick: handleClick,
    disabled: feel === 'required' || disabled,
    title: feel === 'required' ? feelRequiredLabel : feelOptionalLabel,
    children: jsx(FeelIcon$1, {})
  });
}
const FeelPopupContext = createContext({
  open: () => { },
  close: () => { },
  source: null
});

/**
 * Add a dragger that calls back the passed function with
 * { event, delta } on drag.
 *
 * @example
 *
 * function dragMove(event, delta) {
 *   // we are dragging (!!)
 * }
 *
 * domElement.addEventListener('dragstart', dragger(dragMove));
 *
 * @param {Function} fn
 * @param {Element} [dragPreview]
 *
 * @return {Function} drag start callback function
 */
function createDragger(fn, dragPreview) {
  let self;
  let startX, startY;

  /** drag start */
  function onDragStart(event) {
    self = this;
    startX = event.clientX;
    startY = event.clientY;

    // (1) prevent preview image
    if (event.dataTransfer) {
      event.dataTransfer.setDragImage(dragPreview || emptyCanvas(), 0, 0);
    }

    // (2) setup drag listeners

    // attach drag + cleanup event
    // we need to do this to make sure we track cursor
    // movements before we reach other drag event handlers,
    // e.g. in child containers.
    document.addEventListener('dragover', onDrag, true);
    document.addEventListener('dragenter', preventDefault, true);
    document.addEventListener('dragend', onEnd);
    document.addEventListener('drop', preventDefault);
  }
  function onDrag(event) {
    const delta = {
      x: event.clientX - startX,
      y: event.clientY - startY
    };

    // call provided fn with event, delta
    return fn.call(self, event, delta);
  }
  function onEnd() {
    document.removeEventListener('dragover', onDrag, true);
    document.removeEventListener('dragenter', preventDefault, true);
    document.removeEventListener('dragend', onEnd);
    document.removeEventListener('drop', preventDefault);
  }
  return onDragStart;
}
function preventDefault(event) {
  event.preventDefault();
  event.stopPropagation();
}
function emptyCanvas() {
  return domify('<canvas width="0" height="0" />');
}
const noop$3 = () => { };

/**
 * A generic popup component.
 *
 * @param {Object} props
 * @param {HTMLElement} [props.container]
 * @param {string} [props.className]
 * @param {boolean} [props.delayInitialFocus]
 * @param {{x: number, y: number}} [props.position]
 * @param {number} [props.width]
 * @param {number} [props.height]
 * @param {Function} props.onClose
 * @param {Function} [props.onPostActivate]
 * @param {Function} [props.onPostDeactivate]
 * @param {boolean} [props.returnFocus]
 * @param {boolean} [props.closeOnEscape]
 * @param {string} props.title
 * @param {Ref} [ref]
 */
function PopupComponent(props, globalRef) {
  const {
    container,
    className,
    delayInitialFocus,
    position,
    width,
    height,
    onClose,
    onPostActivate = noop$3,
    onPostDeactivate = noop$3,
    returnFocus = true,
    closeOnEscape = true,
    title
  } = props;
  const focusTrapRef = useRef$1(null);
  const localRef = useRef$1(null);
  const popupRef = globalRef || localRef;
  const handleKeydown = event => {
    // do not allow keyboard events to bubble
    event.stopPropagation();
    if (closeOnEscape && event.key === 'Escape') {
      onClose();
    }
  };

  // re-activate focus trap on focus
  const handleFocus = () => {
    if (focusTrapRef.current) {
      focusTrapRef.current.activate();
    }
  };
  let style = {};
  if (position) {
    style = {
      ...style,
      top: position.top + 'px',
      left: position.left + 'px'
    };
  }
  if (width) {
    style.width = width + 'px';
  }
  if (height) {
    style.height = height + 'px';
  }
  useEffect(() => {
    if (popupRef.current) {
      popupRef.current.addEventListener('focusin', handleFocus);
    }
    return () => {
      popupRef.current.removeEventListener('focusin', handleFocus);
    };
  }, [popupRef]);
  useEffect(() => {
    if (popupRef.current) {
      focusTrapRef.current = focusTrap.createFocusTrap(popupRef.current, {
        clickOutsideDeactivates: true,
        delayInitialFocus,
        fallbackFocus: popupRef.current,
        onPostActivate,
        onPostDeactivate,
        returnFocusOnDeactivate: returnFocus
      });
      focusTrapRef.current.activate();
    }
    return () => focusTrapRef.current && focusTrapRef.current.deactivate();
  }, [popupRef]);
  return createPortal(jsx("div", {
    "aria-label": title,
    tabIndex: -1,
    ref: popupRef,
    onKeyDown: handleKeydown,
    role: "dialog",
    class: classnames('bio-properties-panel-popup', className),
    style: style,
    children: props.children
  }), container || document.body);
}
const Popup = forwardRef(PopupComponent);
Popup.Title = Title;
Popup.Body = Body;
Popup.Footer = Footer;
function Title(props) {
  const {
    children,
    className,
    draggable,
    emit = () => { },
    title,
    ...rest
  } = props;

  // we can't use state as we need to
  // manipulate this inside dragging events
  const context = useRef$1({
    startPosition: null,
    newPosition: null
  });
  const dragPreviewRef = useRef$1();
  const titleRef = useRef$1();
  const onMove = (event, delta) => {
    cancel(event);
    const {
      x: dx,
      y: dy
    } = delta;
    const newPosition = {
      x: context.current.startPosition.x + dx,
      y: context.current.startPosition.y + dy
    };
    const popupParent = getPopupParent(titleRef.current);
    popupParent.style.top = newPosition.y + 'px';
    popupParent.style.left = newPosition.x + 'px';

    // notify interested parties
    emit('dragover', {
      newPosition,
      delta
    });
  };
  const onMoveStart = event => {
    // initialize drag handler
    const onDragStart = createDragger(onMove, dragPreviewRef.current);
    onDragStart(event);
    event.stopPropagation();
    const popupParent = getPopupParent(titleRef.current);
    const bounds = popupParent.getBoundingClientRect();
    context.current.startPosition = {
      x: bounds.left,
      y: bounds.top
    };

    // notify interested parties
    emit('dragstart');
  };
  const onMoveEnd = () => {
    context.current.newPosition = null;

    // notify interested parties
    emit('dragend');
  };
  return jsxs("div", {
    class: classnames('bio-properties-panel-popup__header', draggable && 'draggable', className),
    ref: titleRef,
    draggable: draggable,
    onDragStart: onMoveStart,
    onDragEnd: onMoveEnd,
    ...rest,
    children: [draggable && jsxs(Fragment$1, {
      children: [jsx("div", {
        ref: dragPreviewRef,
        class: "bio-properties-panel-popup__drag-preview"
      }), jsx("div", {
        class: "bio-properties-panel-popup__drag-handle",
        children: jsx(DragIcon, {})
      })]
    }), jsx("div", {
      class: "bio-properties-panel-popup__title",
      children: title
    }), children]
  });
}
function Body(props) {
  const {
    children,
    className,
    ...rest
  } = props;
  return jsx("div", {
    class: classnames('bio-properties-panel-popup__body', className),
    ...rest,
    children: children
  });
}
function Footer(props) {
  const {
    children,
    className,
    ...rest
  } = props;
  return jsx("div", {
    class: classnames('bio-properties-panel-popup__footer', className),
    ...rest,
    children: props.children
  });
}

// helpers //////////////////////

function getPopupParent(node) {
  return node.closest('.bio-properties-panel-popup');
}
function cancel(event) {
  event.preventDefault();
  event.stopPropagation();
}
const FEEL_POPUP_WIDTH = 700;
const FEEL_POPUP_HEIGHT = 250;

/**
 * FEEL popup component, built as a singleton. Emits lifecycle events as follows:
 *  - `feelPopup.open` - fired before the popup is mounted
 *  - `feelPopup.opened` - fired after the popup is mounted. Event context contains the DOM node of the popup
 *  - `feelPopup.close` - fired before the popup is unmounted. Event context contains the DOM node of the popup
 *  - `feelPopup.closed` - fired after the popup is unmounted
 */
function FEELPopupRoot(props) {
  const {
    element,
    eventBus = {
      fire() { },
      on() { },
      off() { }
    },
    popupContainer
  } = props;
  const prevElement = usePrevious(element);
  const [popupConfig, setPopupConfig] = useState({});
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState(null);
  const [sourceElement, setSourceElement] = useState(null);
  const emit = (type, context) => {
    eventBus.fire('feelPopup.' + type, context);
  };
  const isOpen = useCallback(() => {
    return !!open;
  }, [open]);
  useUpdateEffect(() => {
    if (!open) {
      emit('closed');
    }
  }, [open]);
  const handleOpen = (entryId, config, _sourceElement) => {
    setSource(entryId);
    setPopupConfig(config);
    setOpen(true);
    setSourceElement(_sourceElement);
    emit('open');
  };
  const handleClose = () => {
    setOpen(false);
    setSource(null);
  };
  const feelPopupContext = {
    open: handleOpen,
    close: handleClose,
    source
  };

  // close popup on element change, cf. https://github.com/bpmn-io/properties-panel/issues/270
  useEffect(() => {
    if (element && prevElement && element !== prevElement) {
      handleClose();
    }
  }, [element]);

  // allow close and open via events
  useEffect(() => {
    const handlePopupOpen = context => {
      const {
        entryId,
        popupConfig,
        sourceElement
      } = context;
      handleOpen(entryId, popupConfig, sourceElement);
    };
    const handleIsOpen = () => {
      return isOpen();
    };
    eventBus.on('feelPopup._close', handleClose);
    eventBus.on('feelPopup._open', handlePopupOpen);
    eventBus.on('feelPopup._isOpen', handleIsOpen);
    return () => {
      eventBus.off('feelPopup._close', handleClose);
      eventBus.off('feelPopup._open', handleOpen);
      eventBus.off('feelPopup._isOpen', handleIsOpen);
    };
  }, [eventBus, isOpen]);
  return jsxs(FeelPopupContext.Provider, {
    value: feelPopupContext,
    children: [open && jsx(FeelPopupComponent, {
      onClose: handleClose,
      container: popupContainer,
      sourceElement: sourceElement,
      emit: emit,
      ...popupConfig
    }), props.children]
  });
}
function FeelPopupComponent(props) {
  const {
    container,
    id,
    hostLanguage,
    onInput,
    onClose,
    position,
    singleLine,
    sourceElement,
    title,
    tooltipContainer,
    type,
    value,
    variables,
    emit
  } = props;
  const editorRef = useRef$1();
  const popupRef = useRef$1();
  const isAutoCompletionOpen = useRef$1(false);
  const handleSetReturnFocus = () => {
    sourceElement && sourceElement.focus();
  };
  const onKeyDownCapture = event => {
    // we use capture here to make sure we handle the event before the editor does
    if (event.key === 'Escape') {
      isAutoCompletionOpen.current = autoCompletionOpen(event.target);
    }
  };
  const onKeyDown = event => {
    if (event.key === 'Escape') {
      // close popup only if auto completion is not open
      // we need to do check this because the editor is not
      // stop propagating the keydown event
      // cf. https://discuss.codemirror.net/t/how-can-i-replace-the-default-autocompletion-keymap-v6/3322/5
      if (!isAutoCompletionOpen.current) {
        onClose();
        isAutoCompletionOpen.current = false;
      }
    }
  };
  useEffect(() => {
    emit('opened', {
      domNode: popupRef.current
    });
    return () => emit('close', {
      domNode: popupRef.current
    });
  }, []);
  return jsxs(Popup, {
    container: container,
    className: "bio-properties-panel-feel-popup",
    emit: emit,
    position: position,
    title: title,
    onClose: onClose

    // handle focus manually on deactivate
    ,

    returnFocus: false,
    closeOnEscape: false,
    delayInitialFocus: false,
    onPostDeactivate: handleSetReturnFocus,
    height: FEEL_POPUP_HEIGHT,
    width: FEEL_POPUP_WIDTH,
    ref: popupRef,
    children: [jsx(Popup.Title, {
      title: title,
      emit: emit,
      draggable: true
    }), jsx(Popup.Body, {
      children: jsxs("div", {
        onKeyDownCapture: onKeyDownCapture,
        onKeyDown: onKeyDown,
        class: "bio-properties-panel-feel-popup__body",
        children: [type === 'feel' && jsx(CodeEditor, {
          enableGutters: true,
          id: prefixId$8(id),
          name: id,
          onInput: onInput,
          value: value,
          variables: variables,
          ref: editorRef,
          tooltipContainer: tooltipContainer
        }), type === 'feelers' && jsx(CodeEditor$1, {
          id: prefixId$8(id),
          contentAttributes: {
            'aria-label': title
          },
          enableGutters: true,
          hostLanguage: hostLanguage,
          name: id,
          onInput: onInput,
          value: value,
          ref: editorRef,
          singleLine: singleLine,
          tooltipContainer: tooltipContainer
        })]
      })
    }), jsx(Popup.Footer, {
      children: jsx("button", {
        onClick: onClose,
        title: "Close pop-up editor",
        class: "bio-properties-panel-feel-popup__close-btn",
        children: "Close"
      })
    })]
  });
}

// helpers /////////////////

function prefixId$8(id) {
  return `bio-properties-panel-${id}`;
}
function autoCompletionOpen(element) {
  return element.closest('.cm-editor').querySelector('.cm-tooltip-autocomplete');
}

/**
 * This hook behaves like useEffect, but does not trigger on the first render.
 *
 * @param {Function} effect
 * @param {Array} deps
 */
function useUpdateEffect(effect, deps) {
  const isMounted = useRef$1(false);
  useEffect(() => {
    if (isMounted.current) {
      return effect();
    } else {
      isMounted.current = true;
    }
  }, deps);
}
function ToggleSwitch(props) {
  const {
    id,
    label,
    onInput,
    value,
    switcherLabel,
    inline,
    onFocus,
    onBlur,
    inputRef,
    tooltip
  } = props;
  const [localValue, setLocalValue] = useState(value);
  const handleInputCallback = async () => {
    onInput(!value);
  };
  const handleInput = e => {
    handleInputCallback();
    setLocalValue(e.target.value);
  };
  useEffect(() => {
    if (value === localValue) {
      return;
    }
    setLocalValue(value);
  }, [value]);
  return jsxs("div", {
    class: classnames('bio-properties-panel-toggle-switch d-flex', {
      inline
    }),
    children: [jsx("label", {
      class: "bio-properties-panel-label",
      for: prefixId$7(id),
      children: jsx(TooltipWrapper, {
        value: tooltip,
        forId: id,
        element: props.element,
        children: label
      })
    }), jsxs("div", {
      class: "bio-properties-panel-field-wrapper",
      children: [jsxs("label", {
        class: "bio-properties-panel-toggle-switch__switcher",
        children: [jsx("input", {
          ref: inputRef,
          id: prefixId$7(id),
          class: "bio-properties-panel-input",
          type: "checkbox",
          onFocus: onFocus,
          onBlur: onBlur,
          name: id,
          onInput: handleInput,
          checked: !!localValue
        }), jsx("span", {
          class: "bio-properties-panel-toggle-switch__slider"
        })]
      }), switcherLabel && jsx("p", {
        class: "bio-properties-panel-toggle-switch__label",
        children: switcherLabel
      })]
    })]
  });
}

/**
 * @param {Object} props
 * @param {Object} props.element
 * @param {String} props.id
 * @param {String} props.description
 * @param {String} props.label
 * @param {String} props.switcherLabel
 * @param {Boolean} props.inline
 * @param {Function} props.getValue
 * @param {Function} props.setValue
 * @param {Function} props.onFocus
 * @param {Function} props.onBlur
 * @param {string|import('preact').Component} props.tooltip
 */
function ToggleSwitchEntry(props) {
  const {
    element,
    id,
    description,
    label,
    switcherLabel,
    inline,
    getValue,
    setValue,
    onFocus,
    onBlur,
    tooltip
  } = props;
  const value = getValue(element);
  return jsxs("div", {
    class: "bio-properties-panel-entry bio-properties-panel-toggle-switch-entry",
    "data-entry-id": id,
    children: [jsx(ToggleSwitch, {
      id: id,
      label: label,
      value: value,
      onInput: setValue,
      onFocus: onFocus,
      onBlur: onBlur,
      switcherLabel: switcherLabel,
      inline: inline,
      tooltip: tooltip,
      element: element
    }), jsx(Description$1, {
      forId: id,
      element: element,
      value: description
    })]
  });
}
function isEdited$8(node) {
  return node && !!node.checked;
}

// helpers /////////////////

function prefixId$7(id) {
  return `bio-properties-panel-${id}`;
}
function NumberField(props) {
  const {
    debounce,
    disabled,
    displayLabel = true,
    id,
    inputRef,
    label,
    max,
    min,
    onInput,
    step,
    value = '',
    onFocus,
    onBlur
  } = props;
  const [localValue, setLocalValue] = useState(value);
  const handleInputCallback = useMemo(() => {
    return debounce(event => {
      const {
        validity,
        value
      } = event.target;
      if (validity.valid) {
        onInput(value ? parseFloat(value) : undefined);
      }
    });
  }, [onInput, debounce]);
  const handleInput = e => {
    handleInputCallback(e);
    setLocalValue(e.target.value);
  };
  useEffect(() => {
    if (value === localValue) {
      return;
    }
    setLocalValue(value);
  }, [value]);
  return jsxs("div", {
    class: "bio-properties-panel-numberfield",
    children: [displayLabel && jsx("label", {
      for: prefixId$6(id),
      class: "bio-properties-panel-label",
      children: label
    }), jsx("input", {
      id: prefixId$6(id),
      ref: inputRef,
      type: "number",
      name: id,
      spellCheck: "false",
      autoComplete: "off",
      disabled: disabled,
      class: "bio-properties-panel-input",
      max: max,
      min: min,
      onInput: handleInput,
      onFocus: onFocus,
      onBlur: onBlur,
      step: step,
      value: localValue
    })]
  });
}

/**
 * @param {Object} props
 * @param {Boolean} props.debounce
 * @param {String} props.description
 * @param {Boolean} props.disabled
 * @param {Object} props.element
 * @param {Function} props.getValue
 * @param {String} props.id
 * @param {String} props.label
 * @param {String} props.max
 * @param {String} props.min
 * @param {Function} props.setValue
 * @param {Function} props.onFocus
 * @param {Function} props.onBlur
 * @param {String} props.step
 * @param {Function} props.validate
 */
function NumberFieldEntry(props) {
  const {
    debounce,
    description,
    disabled,
    element,
    getValue,
    id,
    label,
    max,
    min,
    setValue,
    step,
    onFocus,
    onBlur,
    validate
  } = props;
  const globalError = useError(id);
  const [localError, setLocalError] = useState(null);
  let value = getValue(element);
  useEffect(() => {
    if (isFunction(validate)) {
      const newValidationError = validate(value) || null;
      setLocalError(newValidationError);
    }
  }, [value]);
  const onInput = newValue => {
    let newValidationError = null;
    if (isFunction(validate)) {
      newValidationError = validate(newValue) || null;
    }
    setValue(newValue, newValidationError);
    setLocalError(newValidationError);
  };
  const error = globalError || localError;
  return jsxs("div", {
    class: classnames('bio-properties-panel-entry', error ? 'has-error' : ''),
    "data-entry-id": id,
    children: [jsx(NumberField, {
      debounce: debounce,
      disabled: disabled,
      id: id,
      label: label,
      onFocus: onFocus,
      onBlur: onBlur,
      onInput: onInput,
      max: max,
      min: min,
      step: step,
      value: value
    }, element), error && jsx("div", {
      class: "bio-properties-panel-error",
      children: error
    }), jsx(Description$1, {
      forId: id,
      element: element,
      value: description
    })]
  });
}
function isEdited$7(node) {
  return node && !!node.value;
}

// helpers /////////////////

function prefixId$6(id) {
  return `bio-properties-panel-${id}`;
}
const noop$2 = () => { };
function FeelTextfield(props) {
  const {
    debounce,
    id,
    element,
    label,
    hostLanguage,
    onInput,
    onError,
    feel,
    value = '',
    disabled = false,
    variables,
    singleLine,
    tooltipContainer,
    OptionalComponent = OptionalFeelInput,
    tooltip
  } = props;
  const [localValue, _setLocalValue] = useState(value);
  const editorRef = useShowEntryEvent(id);
  const containerRef = useRef$1();
  const feelActive = isString(localValue) && localValue.startsWith('=') || feel === 'required';
  const feelOnlyValue = isString(localValue) && localValue.startsWith('=') ? localValue.substring(1) : localValue;
  const [focus, _setFocus] = useState(undefined);
  const {
    open: openPopup,
    source: popupSource
  } = useContext(FeelPopupContext);
  const popuOpen = popupSource === id;
  const setFocus = (offset = 0) => {
    const hasFocus = containerRef.current.contains(document.activeElement);

    // Keep caret position if it is already focused, otherwise focus at the end
    const position = hasFocus ? document.activeElement.selectionStart : Infinity;
    _setFocus(position + offset);
  };
  const handleInputCallback = useMemo(() => {
    return debounce(newValue => {
      onInput(newValue);
    });
  }, [onInput, debounce]);
  const setLocalValue = newValue => {
    _setLocalValue(newValue);
    if (!newValue || newValue === '=') {
      handleInputCallback(undefined);
    } else {
      handleInputCallback(newValue);
    }
  };
  const handleFeelToggle = useStaticCallback(() => {
    if (feel === 'required') {
      return;
    }
    if (!feelActive) {
      setLocalValue('=' + localValue);
    } else {
      setLocalValue(feelOnlyValue);
    }
  });
  const handleLocalInput = newValue => {
    if (feelActive) {
      newValue = '=' + newValue;
    }
    if (newValue === localValue) {
      return;
    }
    setLocalValue(newValue);
    if (!feelActive && isString(newValue) && newValue.startsWith('=')) {
      // focus is behind `=` sign that will be removed
      setFocus(-1);
    }
  };
  const handleLint = useStaticCallback(lint => {
    if (!(lint && lint.length)) {
      onError(undefined);
      return;
    }
    const error = lint[0];
    const message = `${error.source}: ${error.message}`;
    onError(message);
  });
  const handlePopupOpen = (type = 'feel') => {
    const popupOptions = {
      id,
      hostLanguage,
      onInput: handleLocalInput,
      position: calculatePopupPosition(containerRef.current),
      singleLine,
      title: getPopupTitle(element, label),
      tooltipContainer,
      type,
      value: feelOnlyValue,
      variables
    };
    openPopup(id, popupOptions, editorRef.current);
  };
  useEffect(() => {
    if (typeof focus !== 'undefined') {
      editorRef.current.focus(focus);
      _setFocus(undefined);
    }
  }, [focus]);
  useEffect(() => {
    if (value === localValue) {
      return;
    }

    // External value change removed content => keep FEEL configuration
    if (!value) {
      setLocalValue(feelActive ? '=' : '');
      return;
    }
    setLocalValue(value);
  }, [value]);

  // copy-paste integration
  useEffect(() => {
    const copyHandler = event => {
      if (!feelActive) {
        return;
      }
      event.clipboardData.setData('application/FEEL', event.clipboardData.getData('text'));
    };
    const pasteHandler = event => {
      if (feelActive || popuOpen) {
        return;
      }
      const data = event.clipboardData.getData('application/FEEL');
      if (data) {
        setTimeout(() => {
          handleFeelToggle();
          setFocus();
        });
      }
    };
    containerRef.current.addEventListener('copy', copyHandler);
    containerRef.current.addEventListener('cut', copyHandler);
    containerRef.current.addEventListener('paste', pasteHandler);
    return () => {
      containerRef.current.removeEventListener('copy', copyHandler);
      containerRef.current.removeEventListener('cut', copyHandler);
      containerRef.current.removeEventListener('paste', pasteHandler);
    };
  }, [containerRef, feelActive, handleFeelToggle, setFocus]);
  return jsxs("div", {
    class: classnames('bio-properties-panel-feel-entry', {
      'feel-active': feelActive
    }),
    children: [jsxs("label", {
      for: prefixId$5(id),
      class: "bio-properties-panel-label",
      onClick: () => setFocus(),
      children: [jsx(TooltipWrapper, {
        value: tooltip,
        forId: id,
        element: props.element,
        children: label
      }), jsx(FeelIcon, {
        label: label,
        feel: feel,
        onClick: handleFeelToggle,
        active: feelActive
      })]
    }), jsxs("div", {
      class: "bio-properties-panel-feel-container",
      ref: containerRef,
      children: [jsx(FeelIndicator, {
        active: feelActive,
        disabled: feel !== 'optional' || disabled,
        onClick: handleFeelToggle
      }), feelActive ? jsx(CodeEditor, {
        id: prefixId$5(id),
        name: id,
        onInput: handleLocalInput,
        disabled: disabled,
        popupOpen: popuOpen,
        onFeelToggle: () => {
          handleFeelToggle();
          setFocus(true);
        },
        onLint: handleLint,
        onPopupOpen: handlePopupOpen,
        value: feelOnlyValue,
        variables: variables,
        ref: editorRef,
        tooltipContainer: tooltipContainer
      }) : jsx(OptionalComponent, {
        ...props,
        popupOpen: popuOpen,
        onInput: handleLocalInput,
        contentAttributes: {
          'id': prefixId$5(id),
          'aria-label': label
        },
        value: localValue,
        ref: editorRef,
        onPopupOpen: handlePopupOpen,
        containerRef: containerRef
      })]
    })]
  });
}
const OptionalFeelInput = forwardRef((props, ref) => {
  const {
    id,
    disabled,
    onInput,
    value,
    onFocus,
    onBlur
  } = props;
  const inputRef = useRef$1();

  // To be consistent with the FEEL editor, set focus at start of input
  // this ensures clean editing experience when switching with the keyboard
  ref.current = {
    focus: position => {
      const input = inputRef.current;
      if (!input) {
        return;
      }
      input.focus();
      if (typeof position === 'number') {
        if (position > value.length) {
          position = value.length;
        }
        input.setSelectionRange(position, position);
      }
    }
  };
  return jsx("input", {
    id: prefixId$5(id),
    type: "text",
    ref: inputRef,
    name: id,
    spellCheck: "false",
    autoComplete: "off",
    disabled: disabled,
    class: "bio-properties-panel-input",
    onInput: e => onInput(e.target.value),
    onFocus: onFocus,
    onBlur: onBlur,
    value: value || ''
  });
});
const OptionalFeelNumberField = forwardRef((props, ref) => {
  const {
    id,
    debounce,
    disabled,
    onInput,
    value,
    min,
    max,
    step,
    onFocus,
    onBlur
  } = props;
  const inputRef = useRef$1();

  // To be consistent with the FEEL editor, set focus at start of input
  // this ensures clean editing experience when switching with the keyboard
  ref.current = {
    focus: position => {
      const input = inputRef.current;
      if (!input) {
        return;
      }
      input.focus();
      if (typeof position === 'number' && position !== Infinity) {
        if (position > value.length) {
          position = value.length;
        }
        input.setSelectionRange(position, position);
      }
    }
  };
  return jsx(NumberField, {
    id: id,
    debounce: debounce,
    disabled: disabled,
    displayLabel: false,
    inputRef: inputRef,
    max: max,
    min: min,
    onInput: onInput,
    step: step,
    value: value,
    onFocus: onFocus,
    onBlur: onBlur
  });
});
forwardRef((props, ref) => {
  const {
    id,
    disabled,
    onInput,
    value,
    onFocus,
    onBlur
  } = props;
  const inputRef = useRef$1();

  // To be consistent with the FEEL editor, set focus at start of input
  // this ensures clean editing experience when switching with the keyboard
  ref.current = {
    focus: () => {
      const input = inputRef.current;
      if (!input) {
        return;
      }
      input.focus();
      input.setSelectionRange(0, 0);
    }
  };
  return jsx("textarea", {
    id: prefixId$5(id),
    type: "text",
    ref: inputRef,
    name: id,
    spellCheck: "false",
    autoComplete: "off",
    disabled: disabled,
    class: "bio-properties-panel-input",
    onInput: e => onInput(e.target.value),
    onFocus: onFocus,
    onBlur: onBlur,
    value: value || '',
    "data-gramm": "false"
  });
});
const OptionalFeelToggleSwitch = forwardRef((props, ref) => {
  const {
    id,
    onInput,
    value,
    onFocus,
    onBlur,
    switcherLabel
  } = props;
  const inputRef = useRef$1();

  // To be consistent with the FEEL editor, set focus at start of input
  // this ensures clean editing experience when switching with the keyboard
  ref.current = {
    focus: () => {
      const input = inputRef.current;
      if (!input) {
        return;
      }
      input.focus();
    }
  };
  return jsx(ToggleSwitch, {
    id: id,
    value: value,
    inputRef: inputRef,
    onInput: onInput,
    onFocus: onFocus,
    onBlur: onBlur,
    switcherLabel: switcherLabel
  });
});
forwardRef((props, ref) => {
  const {
    id,
    disabled,
    onInput,
    value,
    onFocus,
    onBlur
  } = props;
  const inputRef = useRef$1();
  const handleChange = ({
    target
  }) => {
    onInput(target.checked);
  };

  // To be consistent with the FEEL editor, set focus at start of input
  // this ensures clean editing experience when switching with the keyboard
  ref.current = {
    focus: () => {
      const input = inputRef.current;
      if (!input) {
        return;
      }
      input.focus();
    }
  };
  return jsx("input", {
    ref: inputRef,
    id: prefixId$5(id),
    name: id,
    onFocus: onFocus,
    onBlur: onBlur,
    type: "checkbox",
    class: "bio-properties-panel-input",
    onChange: handleChange,
    checked: value,
    disabled: disabled
  });
});

/**
 * @param {Object} props
 * @param {Object} props.element
 * @param {String} props.id
 * @param {String} props.description
 * @param {Boolean} props.debounce
 * @param {Boolean} props.disabled
 * @param {Boolean} props.feel
 * @param {String} props.label
 * @param {Function} props.getValue
 * @param {Function} props.setValue
 * @param {Function} props.tooltipContainer
 * @param {Function} props.validate
 * @param {Function} props.show
 * @param {Function} props.example
 * @param {Function} props.variables
 * @param {Function} props.onFocus
 * @param {Function} props.onBlur
 * @param {string|import('preact').Component} props.tooltip
 */
function FeelEntry(props) {
  const {
    element,
    id,
    description,
    debounce,
    disabled,
    feel,
    label,
    getValue,
    setValue,
    tooltipContainer,
    hostLanguage,
    singleLine,
    validate,
    show = noop$2,
    example,
    variables,
    onFocus,
    onBlur,
    tooltip
  } = props;
  const [validationError, setValidationError] = useState(null);
  const [localError, setLocalError] = useState(null);
  let value = getValue(element);
  useEffect(() => {
    if (isFunction(validate)) {
      const newValidationError = validate(value) || null;
      setValidationError(newValidationError);
    }
  }, [value]);
  const onInput = useStaticCallback(newValue => {
    let newValidationError = null;
    if (isFunction(validate)) {
      newValidationError = validate(newValue) || null;
    }

    // don't create multiple commandStack entries for the same value
    if (newValue !== value) {
      setValue(newValue, newValidationError);
    }
    setValidationError(newValidationError);
  });
  const onError = useCallback(err => {
    setLocalError(err);
  }, []);
  const temporaryError = useError(id);
  const error = temporaryError || localError || validationError;
  return jsxs("div", {
    class: classnames(props.class, 'bio-properties-panel-entry', error ? 'has-error' : ''),
    "data-entry-id": id,
    children: [createElement(FeelTextfield, {
      ...props,
      debounce: debounce,
      disabled: disabled,
      feel: feel,
      id: id,
      key: element,
      label: label,
      onInput: onInput,
      onError: onError,
      onFocus: onFocus,
      onBlur: onBlur,
      example: example,
      hostLanguage: hostLanguage,
      singleLine: singleLine,
      show: show,
      value: value,
      variables: variables,
      tooltipContainer: tooltipContainer,
      OptionalComponent: props.OptionalComponent,
      tooltip: tooltip
    }), error && jsx("div", {
      class: "bio-properties-panel-error",
      children: error
    }), jsx(Description$1, {
      forId: id,
      element: element,
      value: description
    })]
  });
}

/**
 * @param {Object} props
 * @param {Object} props.element
 * @param {String} props.id
 * @param {String} props.description
 * @param {Boolean} props.debounce
 * @param {Boolean} props.disabled
 * @param {String} props.max
 * @param {String} props.min
 * @param {String} props.step
 * @param {Boolean} props.feel
 * @param {String} props.label
 * @param {Function} props.getValue
 * @param {Function} props.setValue
 * @param {Function} props.tooltipContainer
 * @param {Function} props.validate
 * @param {Function} props.show
 * @param {Function} props.example
 * @param {Function} props.variables
 * @param {Function} props.onFocus
 * @param {Function} props.onBlur
 */
function FeelNumberEntry(props) {
  return jsx(FeelEntry, {
    class: "bio-properties-panel-feel-number",
    OptionalComponent: OptionalFeelNumberField,
    ...props
  });
}

/**
 * @param {Object} props
 * @param {Object} props.element
 * @param {String} props.id
 * @param {String} props.description
 * @param {Boolean} props.debounce
 * @param {Boolean} props.disabled
 * @param {Boolean} props.feel
 * @param {String} props.label
 * @param {Function} props.getValue
 * @param {Function} props.setValue
 * @param {Function} props.tooltipContainer
 * @param {Function} props.validate
 * @param {Function} props.show
 * @param {Function} props.example
 * @param {Function} props.variables
 * @param {Function} props.onFocus
 * @param {Function} props.onBlur
 */
function FeelToggleSwitchEntry(props) {
  return jsx(FeelEntry, {
    class: "bio-properties-panel-feel-toggle-switch",
    OptionalComponent: OptionalFeelToggleSwitch,
    ...props
  });
}

/**
 * @param {Object} props
 * @param {Object} props.element
 * @param {String} props.id
 * @param {String} props.description
 * @param {String} props.hostLanguage
 * @param {Boolean} props.singleLine
 * @param {Boolean} props.debounce
 * @param {Boolean} props.disabled
 * @param {Boolean} props.feel
 * @param {String} props.label
 * @param {Function} props.getValue
 * @param {Function} props.setValue
 * @param {Function} props.tooltipContainer
 * @param {Function} props.validate
 * @param {Function} props.show
 * @param {Function} props.example
 * @param {Function} props.variables
 * @param {Function} props.onFocus
 * @param {Function} props.onBlur
 */
function FeelTemplatingEntry(props) {
  return jsx(FeelEntry, {
    class: "bio-properties-panel-feel-templating",
    OptionalComponent: CodeEditor$1,
    ...props
  });
}
function isEdited$6(node) {
  if (!node) {
    return false;
  }
  if (node.type === 'checkbox') {
    return !!node.checked || node.classList.contains('edited');
  }
  return !!node.value || node.classList.contains('edited');
}

// helpers /////////////////

function prefixId$5(id) {
  return `bio-properties-panel-${id}`;
}
function calculatePopupPosition(element) {
  const {
    top,
    left
  } = element.getBoundingClientRect();
  return {
    left: left - FEEL_POPUP_WIDTH - 20,
    top: top
  };
}

// todo(pinussilvestrus): make this configurable in the future
function getPopupTitle(element, label) {
  let popupTitle = '';
  if (element && element.type) {
    popupTitle = `${element.type} / `;
  }
  return `${popupTitle}${label}`;
}
const DEFAULT_LAYOUT = {};
const DEFAULT_DESCRIPTION = {};
const DEFAULT_TOOLTIP = {};

/**
 * @typedef { {
 *    component: import('preact').Component,
 *    id: String,
 *    isEdited?: Function
 * } } EntryDefinition
 *
 * @typedef { {
 *    autoFocusEntry: String,
 *    autoOpen?: Boolean,
 *    entries: Array<EntryDefinition>,
 *    id: String,
 *    label: String,
 *    remove: (event: MouseEvent) => void
 * } } ListItemDefinition
 *
 * @typedef { {
 *    add: (event: MouseEvent) => void,
 *    component: import('preact').Component,
 *    element: Object,
 *    id: String,
 *    items: Array<ListItemDefinition>,
 *    label: String,
 *    shouldSort?: Boolean,
 *    shouldOpen?: Boolean
 * } } ListGroupDefinition
 *
 * @typedef { {
 *    component?: import('preact').Component,
 *    entries: Array<EntryDefinition>,
 *    id: String,
 *    label: String,
 *    shouldOpen?: Boolean
 * } } GroupDefinition
 *
 *  @typedef { {
 *    [id: String]: GetDescriptionFunction
 * } } DescriptionConfig
 *
 *  @typedef { {
 *    [id: String]: GetTooltipFunction
 * } } TooltipConfig
 *
 * @callback { {
 * @param {string} id
 * @param {Object} element
 * @returns {string}
 * } } GetDescriptionFunction
 *
 * @callback { {
 * @param {string} id
 * @param {Object} element
 * @returns {string}
 * } } GetTooltipFunction
 *
 * @typedef { {
 *  getEmpty: (element: object) => import('./components/Placeholder').PlaceholderDefinition,
 *  getMultiple: (element: Object) => import('./components/Placeholder').PlaceholderDefinition
 * } } PlaceholderProvider
 *
 */

/**
 * A basic properties panel component. Describes *how* content will be rendered, accepts
 * data from implementor to describe *what* will be rendered.
 *
 * @param {Object} props
 * @param {Object|Array} props.element
 * @param {import('./components/Header').HeaderProvider} props.headerProvider
 * @param {PlaceholderProvider} [props.placeholderProvider]
 * @param {Array<GroupDefinition|ListGroupDefinition>} props.groups
 * @param {Object} [props.layoutConfig]
 * @param {Function} [props.layoutChanged]
 * @param {DescriptionConfig} [props.descriptionConfig]
 * @param {Function} [props.descriptionLoaded]
 * @param {TooltipConfig} [props.tooltipConfig]
 * @param {Function} [props.tooltipLoaded]
 * @param {HTMLElement} [props.feelPopupContainer]
 * @param {Object} [props.eventBus]
 */
function PropertiesPanel(props) {
  const {
    element,
    headerProvider,
    placeholderProvider,
    groups,
    layoutConfig,
    layoutChanged,
    descriptionConfig,
    descriptionLoaded,
    tooltipConfig,
    tooltipLoaded,
    feelPopupContainer,
    eventBus
  } = props;

  // set-up layout context
  const [layout, setLayout] = useState(createLayout(layoutConfig));

  // react to external changes in the layout config
  useUpdateLayoutEffect(() => {
    const newLayout = createLayout(layoutConfig);
    setLayout(newLayout);
  }, [layoutConfig]);
  useEffect(() => {
    if (typeof layoutChanged === 'function') {
      layoutChanged(layout);
    }
  }, [layout, layoutChanged]);
  const getLayoutForKey = (key, defaultValue) => {
    return get(layout, key, defaultValue);
  };
  const setLayoutForKey = (key, config) => {
    const newLayout = assign({}, layout);
    set$1(newLayout, key, config);
    setLayout(newLayout);
  };
  const layoutContext = {
    layout,
    setLayout,
    getLayoutForKey,
    setLayoutForKey
  };

  // set-up description context
  const description = useMemo(() => createDescriptionContext(descriptionConfig), [descriptionConfig]);
  useEffect(() => {
    if (typeof descriptionLoaded === 'function') {
      descriptionLoaded(description);
    }
  }, [description, descriptionLoaded]);
  const getDescriptionForId = (id, element) => {
    return description[id] && description[id](element);
  };
  const descriptionContext = {
    description,
    getDescriptionForId
  };

  // set-up tooltip context
  const tooltip = useMemo(() => createTooltipContext(tooltipConfig), [tooltipConfig]);
  useEffect(() => {
    if (typeof tooltipLoaded === 'function') {
      tooltipLoaded(tooltip);
    }
  }, [tooltip, tooltipLoaded]);
  const getTooltipForId = (id, element) => {
    return tooltip[id] && tooltip[id](element);
  };
  const tooltipContext = {
    tooltip,
    getTooltipForId
  };
  const [errors, setErrors] = useState({});
  const onSetErrors = ({
    errors
  }) => setErrors(errors);
  useEvent('propertiesPanel.setErrors', onSetErrors, eventBus);
  const errorsContext = {
    errors
  };
  const eventContext = {
    eventBus
  };
  const propertiesPanelContext = {
    element
  };

  // empty state
  if (placeholderProvider && !element) {
    return jsx(Placeholder, {
      ...placeholderProvider.getEmpty()
    });
  }

  // multiple state
  if (placeholderProvider && isArray(element)) {
    return jsx(Placeholder, {
      ...placeholderProvider.getMultiple()
    });
  }
  return jsx(LayoutContext.Provider, {
    value: propertiesPanelContext,
    children: jsx(ErrorsContext.Provider, {
      value: errorsContext,
      children: jsx(DescriptionContext.Provider, {
        value: descriptionContext,
        children: jsx(TooltipContext.Provider, {
          value: tooltipContext,
          children: jsx(LayoutContext.Provider, {
            value: layoutContext,
            children: jsx(EventContext.Provider, {
              value: eventContext,
              children: jsx(FEELPopupRoot, {
                element: element,
                eventBus: eventBus,
                popupContainer: feelPopupContainer,
                children: jsxs("div", {
                  class: "bio-properties-panel",
                  children: [jsx(Header, {
                    element: element,
                    headerProvider: headerProvider
                  }), jsx("div", {
                    class: "bio-properties-panel-scroll-container",
                    children: groups.map(group => {
                      const {
                        component: Component = Group,
                        id
                      } = group;
                      return createElement(Component, {
                        ...group,
                        key: id,
                        element: element
                      });
                    })
                  })]
                })
              })
            })
          })
        })
      })
    })
  });
}

// helpers //////////////////

function createLayout(overrides = {}, defaults = DEFAULT_LAYOUT) {
  return {
    ...defaults,
    ...overrides
  };
}
function createDescriptionContext(overrides = {}) {
  return {
    ...DEFAULT_DESCRIPTION,
    ...overrides
  };
}
function createTooltipContext(overrides = {}) {
  return {
    ...DEFAULT_TOOLTIP,
    ...overrides
  };
}

// hooks //////////////////

/**
 * This hook behaves like useLayoutEffect, but does not trigger on the first render.
 *
 * @param {Function} effect
 * @param {Array} deps
 */
function useUpdateLayoutEffect(effect, deps) {
  const isMounted = useRef$1(false);
  useLayoutEffect(() => {
    if (isMounted.current) {
      return effect();
    } else {
      isMounted.current = true;
    }
  }, deps);
}
function CollapsibleEntry(props) {
  const {
    element,
    entries = [],
    id,
    label,
    open: shouldOpen,
    remove
  } = props;
  const [open, setOpen] = useState(shouldOpen);
  const toggleOpen = () => setOpen(!open);
  const {
    onShow
  } = useContext(LayoutContext);
  const propertiesPanelContext = {
    ...useContext(LayoutContext),
    onShow: useCallback(() => {
      setOpen(true);
      if (isFunction(onShow)) {
        onShow();
      }
    }, [onShow, setOpen])
  };

  // todo(pinussilvestrus): translate once we have a translate mechanism for the core
  const placeholderLabel = '<empty>';
  return jsxs("div", {
    "data-entry-id": id,
    class: classnames('bio-properties-panel-collapsible-entry', open ? 'open' : ''),
    children: [jsxs("div", {
      class: "bio-properties-panel-collapsible-entry-header",
      onClick: toggleOpen,
      children: [jsx("div", {
        title: label || placeholderLabel,
        class: classnames('bio-properties-panel-collapsible-entry-header-title', !label && 'empty'),
        children: label || placeholderLabel
      }), jsx("button", {
        title: "Toggle list item",
        class: "bio-properties-panel-arrow  bio-properties-panel-collapsible-entry-arrow",
        children: jsx(ArrowIcon, {
          class: open ? 'bio-properties-panel-arrow-down' : 'bio-properties-panel-arrow-right'
        })
      }), remove ? jsx("button", {
        title: "Delete item",
        class: "bio-properties-panel-remove-entry",
        onClick: remove,
        children: jsx(DeleteIcon, {})
      }) : null]
    }), jsx("div", {
      class: classnames('bio-properties-panel-collapsible-entry-entries', open ? 'open' : ''),
      children: jsx(LayoutContext.Provider, {
        value: propertiesPanelContext,
        children: entries.map(entry => {
          const {
            component: Component,
            id
          } = entry;
          return createElement(Component, {
            ...entry,
            element: element,
            key: id
          });
        })
      })
    })]
  });
}
function ListItem(props) {
  const {
    autoFocusEntry,
    autoOpen
  } = props;

  // focus specified entry on auto open
  useEffect(() => {
    if (autoOpen && autoFocusEntry) {
      const entry = query(`[data-entry-id="${autoFocusEntry}"]`);
      const focusableInput = query('.bio-properties-panel-input', entry);
      if (focusableInput) {
        if (isFunction(focusableInput.select)) {
          focusableInput.select();
        } else if (isFunction(focusableInput.focus)) {
          focusableInput.focus();
        }
      }
    }
  }, [autoOpen, autoFocusEntry]);
  return jsx("div", {
    class: "bio-properties-panel-list-item",
    children: jsx(CollapsibleEntry, {
      ...props,
      open: autoOpen
    })
  });
}
const noop$1 = () => { };

/**
 * @param {import('../PropertiesPanel').ListGroupDefinition} props
 */
function ListGroup(props) {
  const {
    add,
    importExcel,
    exportExcel,
    element,
    id,
    items,
    label,
    shouldOpen = true,
    shouldSort = true
  } = props;
  const groupRef = useRef$1(null);
  const [open, setOpen] = useLayoutState(['groups', id, 'open'], false);
  const [sticky, setSticky] = useState(false);
  const onShow = useCallback(() => setOpen(true), [setOpen]);
  const [ordering, setOrdering] = useState([]);
  const [newItemAdded, setNewItemAdded] = useState(false);
  const [importError, setImportError] = useState(false);

  // Flag to mark that add button was clicked in the last render cycle
  const [addTriggered, setAddTriggered] = useState(false);
  const prevItems = usePrevious(items);
  const prevElement = usePrevious(element);
  const elementChanged = element !== prevElement;
  const shouldHandleEffects = !elementChanged && (shouldSort || shouldOpen);

  // reset initial ordering when element changes (before first render)
  if (elementChanged) {
    setOrdering(createOrdering(shouldSort ? sortItems(items) : items));
  }

  // keep ordering in sync to items - and open changes

  // (0) set initial ordering from given items
  useEffect(() => {
    if (!prevItems || !shouldSort) {
      setOrdering(createOrdering(items));
    }
  }, [items, element]);

  // (1) items were added
  useEffect(() => {
    // reset addTriggered flag
    setAddTriggered(false);
    if (shouldHandleEffects && prevItems && items.length > prevItems.length) {
      let add = [];
      items.forEach(item => {
        if (!ordering.includes(item.id)) {
          add.push(item.id);
        }
      });
      let newOrdering = ordering;

      // open if not open, configured and triggered by add button
      //
      // TODO(marstamm): remove once we refactor layout handling for listGroups.
      // Ideally, opening should be handled as part of the `add` callback and
      // not be a concern for the ListGroup component.
      if (addTriggered && !open && shouldOpen) {
        toggleOpen();
      }

      // filter when not open and configured
      if (!open && shouldSort) {
        newOrdering = createOrdering(sortItems(items));
      }

      // add new items on top or bottom depending on sorting behavior
      newOrdering = newOrdering.filter(item => !add.includes(item));
      if (shouldSort) {
        newOrdering.unshift(...add);
      } else {
        newOrdering.push(...add);
      }
      setOrdering(newOrdering);
      setNewItemAdded(addTriggered);
    } else {
      setNewItemAdded(false);
    }
  }, [items, open, shouldHandleEffects, addTriggered]);

  // (2) sort items on open if shouldSort is set
  useEffect(() => {
    if (shouldSort && open && !newItemAdded) {
      setOrdering(createOrdering(sortItems(items)));
    }
  }, [open, shouldSort]);

  // (3) items were deleted
  useEffect(() => {
    if (shouldHandleEffects && prevItems && items.length < prevItems.length) {
      let keep = [];
      ordering.forEach(o => {
        if (getItem(items, o)) {
          keep.push(o);
        }
      });
      setOrdering(keep);
    }
  }, [items, shouldHandleEffects]);

  // set css class when group is sticky to top
  useStickyIntersectionObserver(groupRef, 'div.bio-properties-panel-scroll-container', setSticky);
  const toggleOpen = () => setOpen(!open);
  const hasItems = !!items.length;
  const propertiesPanelContext = {
    ...useContext(LayoutContext),
    onShow
  };
  const handleAddClick = e => {
    debugger;
    setAddTriggered(true);
    add(e);
  };

  const handleExport = () => {
    exportExcel()
  };

  const handleImport = e => {
    setImportError(false);
    var elem = document.getElementById('importinput');
    if (elem && document.createEvent) {
      var evt = document.createEvent("MouseEvents");
      evt.initEvent("click", true, false);
      elem.dispatchEvent(evt);
    }
  };

  const fileChange = (e) => {
    const fileDom = e.target || e.srcElement;
    var reader = new FileReader();
    if (!fileDom.files[0]?.type.includes('sheet')) {
      setImportError(true);
      return;
    }
    reader.readAsArrayBuffer(fileDom.files[0]);
    reader.onload = function (event) {
      var data = new Uint8Array(reader.result);
      var workBook = read(data, { type: 'array' });
      var sheetName = workBook.SheetNames;
      var sheetData = utils.sheet_to_json(workBook.Sheets[sheetName[0]], { header: 1 });
      importExcel(sheetData);
    }
  }

  const allErrors = useErrors();
  const hasError = items.some(item => {
    if (allErrors[item.id]) {
      return true;
    }
    if (!item.entries) {
      return;
    }

    // also check if the error is nested, e.g. for name-value entries
    return item.entries.some(entry => allErrors[entry.id]);
  });
  return jsxs("div", {
    class: "bio-properties-panel-group",
    "data-group-id": 'group-' + id,
    ref: groupRef,
    children: [jsxs("div", {
      class: classnames('bio-properties-panel-group-header', hasItems ? '' : 'empty', hasItems && open ? 'open' : '', sticky && open ? 'sticky' : ''),
      onClick: hasItems ? toggleOpen : noop$1,
      children: [jsx("div", {
        title: props.tooltip ? null : label,
        "data-title": label,
        class: "bio-properties-panel-group-header-title",
        children: jsx(TooltipWrapper, {
          value: props.tooltip,
          forId: 'group-' + id,
          element: element,
          parent: groupRef,
          children: label
        })
      }), jsxs("div", {
        class: "bio-properties-panel-group-header-buttons",
        children: [add ? jsxs("button", {
          title: "Create new list item",
          class: "bio-properties-panel-group-header-button bio-properties-panel-add-entry",
          id: 'createClick',
          onClick: handleAddClick,
          children: [jsx(CreateIcon, {}), !hasItems ? jsx("span", {
            class: "bio-properties-panel-add-entry-label",
            children: "Create"
          }) : null]
        }) : null, hasItems ? jsx("div", {
          title: `List contains ${items.length} item${items.length != 1 ? 's' : ''}`,
          class: classnames('bio-properties-panel-list-badge', hasError ? 'bio-properties-panel-list-badge--error' : ''),
          children: items.length
        }) : null, hasItems ? jsx("button", {
          title: "Toggle section",
          class: "bio-properties-panel-group-header-button bio-properties-panel-arrow",
          children: jsx(ArrowIcon, {
            class: open ? 'bio-properties-panel-arrow-down' : 'bio-properties-panel-arrow-right'
          })
        }) : null]
      })]
    }),
    jsx("div", {
      class: classnames('bio-properties-panel-list', open && hasItems ? 'open' : ''),
      children: [
        jsxs("div",
          {
            class: 'd-flex justify-content-end',
            children: [
              jsx("button", {
                class: 'btn btn-sm btn-primary',
                onClick: handleImport,
                children: 'Import'
              }),
              jsx("input", {
                type: 'file',
                id: 'importinput',
                class: 'invisible',
                style: 'width:0',
                onInput: fileChange,
              }),
              jsx("button", {
                class: 'btn btn-sm btn-primary mx-1',
                onClick: handleExport,
                children: 'Export'
              })
            ]
          }),
        importError && jsx("div", {
          class: 'text-error mx-3 mt-2',
          children: 'Error: only excel file is allowed.'
        })
      ]
    }),
    jsx("div", {
      class: classnames('bio-properties-panel-list', open && hasItems ? 'open' : ''),
      children: jsx(LayoutContext.Provider, {
        value: propertiesPanelContext,
        children: ordering.map((o, index) => {
          const item = getItem(items, o);
          if (!item) {
            return;
          }
          const {
            id
          } = item;

          // if item was added, open it
          // Existing items will not be affected as autoOpen is only applied on first render
          const autoOpen = newItemAdded;
          return createElement(ListItem, {
            ...item,
            autoOpen: autoOpen,
            element: element,
            index: index,
            key: id
          });
        })
      })
    })]
  });
}

// helpers ////////////////////

/**
 * Sorts given items alphanumeric by label
 */
function sortItems(items) {
  return sortBy(items, i => i.label.toLowerCase());
}
function getItem(items, id) {
  return find(items, i => i.id === id);
}
function createOrdering(items) {
  return items.map(i => i.id);
}
function Checkbox(props) {
  const {
    id,
    label,
    onChange,
    disabled,
    value = false,
    onFocus,
    onBlur,
    tooltip
  } = props;
  const [localValue, setLocalValue] = useState(value);
  const handleChangeCallback = ({
    target
  }) => {
    onChange(target.checked);
  };
  const handleChange = e => {
    handleChangeCallback(e);
    setLocalValue(e.target.value);
  };
  useEffect(() => {
    if (value === localValue) {
      return;
    }
    setLocalValue(value);
  }, [value]);
  const ref = useShowEntryEvent(id);
  return jsxs("div", {
    class: "bio-properties-panel-checkbox",
    children: [jsx("input", {
      ref: ref,
      id: prefixId$4(id),
      name: id,
      onFocus: onFocus,
      onBlur: onBlur,
      type: "checkbox",
      class: "bio-properties-panel-input",
      onChange: handleChange,
      checked: localValue,
      disabled: disabled
    }), jsx("label", {
      for: prefixId$4(id),
      class: "bio-properties-panel-label",
      children: jsx(TooltipWrapper, {
        value: tooltip,
        forId: id,
        element: props.element,
        children: label
      })
    })]
  });
}

/**
 * @param {Object} props
 * @param {Object} props.element
 * @param {String} props.id
 * @param {String} props.description
 * @param {String} props.label
 * @param {Function} props.getValue
 * @param {Function} props.setValue
 * @param {Function} props.onFocus
 * @param {Function} props.onBlur
 * @param {string|import('preact').Component} props.tooltip
 * @param {boolean} [props.disabled]
 */
function CheckboxEntry(props) {
  const {
    element,
    id,
    description,
    label,
    getValue,
    setValue,
    disabled,
    onFocus,
    onBlur,
    tooltip
  } = props;
  const value = getValue(element);
  const error = useError(id);
  return jsxs("div", {
    class: "bio-properties-panel-entry bio-properties-panel-checkbox-entry",
    "data-entry-id": id,
    children: [jsx(Checkbox, {
      disabled: disabled,
      id: id,
      label: label,
      onChange: setValue,
      onFocus: onFocus,
      onBlur: onBlur,
      value: value,
      tooltip: tooltip,
      element: element
    }, element), error && jsx("div", {
      class: "bio-properties-panel-error",
      children: error
    }), jsx(Description$1, {
      forId: id,
      element: element,
      value: description
    })]
  });
}
function isEdited$5(node) {
  return node && !!node.checked;
}

// helpers /////////////////

function prefixId$4(id) {
  return `bio-properties-panel-${id}`;
}
function Select(props) {
  const {
    id,
    label,
    onChange,
    options = [],
    value = '',
    disabled,
    onFocus,
    onBlur,
    tooltip
  } = props;
  const ref = useShowEntryEvent(id);
  const [localValue, setLocalValue] = useState(value);
  const handleChangeCallback = ({
    target
  }) => {
    onChange(target.value);
  };
  const handleChange = e => {
    handleChangeCallback(e);
    setLocalValue(e.target.value);
  };
  useEffect(() => {
    if (value === localValue) {
      return;
    }
    setLocalValue(value);
  }, [value]);
  return jsxs("div", {
    class: "bio-properties-panel-select",
    children: [jsx("label", {
      for: prefixId$3(id),
      class: "bio-properties-panel-label",
      children: jsx(TooltipWrapper, {
        value: tooltip,
        forId: id,
        element: props.element,
        children: label
      })
    }), jsx("select", {
      ref: ref,
      id: prefixId$3(id),
      name: id,
      class: "bio-properties-panel-input",
      onInput: handleChange,
      onFocus: onFocus,
      onBlur: onBlur,
      value: localValue,
      disabled: disabled,
      children: options.map((option, idx) => {
        if (option.children) {
          return jsx("optgroup", {
            label: option.label,
            children: option.children.map((child, idx) => jsx("option", {
              value: child.value,
              disabled: child.disabled,
              children: child.label
            }, idx))
          }, idx);
        }
        return jsx("option", {
          value: option.value,
          disabled: option.disabled,
          children: option.label
        }, idx);
      })
    })]
  });
}

/**
 * @param {object} props
 * @param {object} props.element
 * @param {string} props.id
 * @param {string} [props.description]
 * @param {string} props.label
 * @param {Function} props.getValue
 * @param {Function} props.setValue
 * @param {Function} props.onFocus
 * @param {Function} props.onBlur
 * @param {Function} props.getOptions
 * @param {boolean} [props.disabled]
 * @param {Function} [props.validate]
 * @param {string|import('preact').Component} props.tooltip
 */
function SelectEntry(props) {
  const {
    element,
    id,
    description,
    warnings,
    label,
    getValue,
    setValue,
    getOptions,
    disabled,
    onFocus,
    onBlur,
    validate,
    tooltip
  } = props;
  const options = getOptions(element);
  const globalError = useError(id);
  const [localError, setLocalError] = useState(null);
  let value = getValue(element);
  useEffect(() => {
    if (isFunction(validate)) {
      const newValidationError = validate(value) || null;
      setLocalError(newValidationError);
    }
  }, [value]);
  const onChange = newValue => {
    let newValidationError = null;
    if (isFunction(validate)) {
      newValidationError = validate(newValue) || null;
    }
    setValue(newValue, newValidationError);
    setLocalError(newValidationError);
  };
  const error = globalError || localError;
  return jsxs("div", {
    class: classnames('bio-properties-panel-entry', error ? 'has-error' : ''),
    "data-entry-id": id,
    children: [jsx(Select, {
      id: id,
      label: label,
      value: value,
      onChange: onChange,
      onFocus: onFocus,
      onBlur: onBlur,
      options: options,
      disabled: disabled,
      tooltip: tooltip,
      element: element
    }, element), error && jsx("div", {
      class: "bio-properties-panel-error",
      children: error
    }), jsx(Description$1, {
      forId: id,
      element: element,
      value: description
    }),
    jsx("div", {
      class: "bio-properties-panel-description badge bg-warning text-wrap mt-1 text-start",
      style: "font-size:0.9rem",
      children: warnings
    })
    ]
  });
}

//todo
function MultiSelect(props) {
  const {
    element,
    id,
    description,
    label,
    getValue,
    setValue,
    getOptions,
    disabled,
    onFocus,
    onBlur,
    validate,
    tooltip
  } = props;
  const options = getOptions(element);
  let selectedValue = [];
  let showedValueInInput = '';
  const [localValue, setLocalValue] = useState();
  const [showOp, setShowOp] = useState(false);
  const inputRef = useRef(null);
  let value = getValue(element);
  setLocalValue(value)

  // const globalError = useError(id);
  // const [localError, setLocalError] = useState(null);
  // let value = getValue(element);
  // useEffect(() => {
  //   if (isFunction(validate)) {
  //     const newValidationError = validate(value) || null;
  //     setLocalError(newValidationError);
  //   }
  // }, [value]);
  // const onChange = newValue => {
  //   let newValidationError = null;
  //   if (isFunction(validate)) {
  //     newValidationError = validate(newValue) || null;
  //   }
  //   setValue(newValue, newValidationError);
  //   setLocalError(newValidationError);
  // };
  // const error = globalError || localError;
  const handleChange = (e) => {
    setValue(e);
  };
  return jsxs("div", {
    "data-entry-id": id,
    className: classnames('position-relative'),
    children: [jsx("input", {
      type: "text",
      ref: inputRef,
      value: localValue,
      readOnly: true,
      class: classnames('bio-properties-panel-multiselect'),
      onClick: () => {
        if (showOp) {
          setShowOp(false)
        } else {
          setShowOp(true)
        }
      }
    }, element),
    showOp && jsx("ul", {
      class: classnames('bio-properties-panel-multiselect-options-container'),
      children: [showOp && options.map(op => {
        return (
          jsx("li", {
            children: op.value,
            class: classnames('bio-properties-panel-multiselect-option', localValue?.split(',').includes(op.value) ? 'bio-properties-panel-multiselect-option-selected' : ''),
            onClick: () => {
              if (localValue) {
                const prevValue = localValue.split(',')
                selectedValue = [...prevValue]
              }
              const searchElIndex = selectedValue.findIndex(val => val == op.value);
              if (searchElIndex > -1 && selectedValue.length !== 0) {
                selectedValue.splice(searchElIndex, 1)
              } else {
                selectedValue.push(op.value);
              }
              showedValueInInput = selectedValue.join(',')
              setLocalValue(showedValueInInput)
              handleChange(showedValueInInput)
            }
          })
        )
      })],
    })
      , error && jsx("div", {
        class: "bio-properties-panel-error",
        children: error
      }), jsx(Description$1, {
        forId: id,
        element: element,
        value: description
      })]
  });
}


function isEdited$3(node) {
  return node && !!node.value;
}

// helpers /////////////////

function prefixId$3(id) {
  return `bio-properties-panel-${id}`;
}
function resizeToContents(element) {
  element.style.height = 'auto';

  // a 2px pixel offset is required to prevent scrollbar from
  // appearing on OS with a full length scroll bar (Windows/Linux)
  element.style.height = `${element.scrollHeight + 2}px`;
}
function TextArea(props) {
  const {
    id,
    label,
    debounce,
    onInput,
    value = '',
    disabled,
    monospace,
    onFocus,
    onBlur,
    autoResize,
    rows = autoResize ? 1 : 2,
    tooltip
  } = props;
  const [localValue, setLocalValue] = useState(value);
  const ref = useShowEntryEvent(id);
  const handleInputCallback = useMemo(() => {
    return debounce(({
      target
    }) => onInput(target.value.length ? target.value : undefined));
  }, [onInput, debounce]);
  const handleInput = e => {
    handleInputCallback(e);
    autoResize && resizeToContents(e.target);
    setLocalValue(e.target.value);
  };
  useLayoutEffect(() => {
    autoResize && resizeToContents(ref.current);
  }, []);
  useEffect(() => {
    if (value === localValue) {
      return;
    }
    setLocalValue(value);
  }, [value]);
  return jsxs("div", {
    class: "bio-properties-panel-textarea",
    children: [jsx("label", {
      for: prefixId$1(id),
      class: "bio-properties-panel-label",
      children: jsx(TooltipWrapper, {
        value: tooltip,
        forId: id,
        element: props.element,
        children: label
      })
    }), jsx("textarea", {
      ref: ref,
      id: prefixId$1(id),
      name: id,
      spellCheck: "false",
      class: classnames('bio-properties-panel-input', monospace ? 'bio-properties-panel-input-monospace' : '', autoResize ? 'auto-resize' : ''),
      onInput: handleInput,
      onFocus: onFocus,
      onBlur: onBlur,
      rows: rows,
      value: localValue,
      disabled: disabled,
      "data-gramm": "false"
    })]
  });
}

/**
 * @param {object} props
 * @param {object} props.element
 * @param {string} props.id
 * @param {string} props.description
 * @param {boolean} props.debounce
 * @param {string} props.label
 * @param {Function} props.getValue
 * @param {Function} props.setValue
 * @param {Function} props.onFocus
 * @param {Function} props.onBlur
 * @param {number} props.rows
 * @param {boolean} props.monospace
 * @param {Function} [props.validate]
 * @param {boolean} [props.disabled]
 */
function TextAreaEntry(props) {
  const {
    element,
    id,
    description,
    debounce,
    label,
    getValue,
    setValue,
    rows,
    monospace,
    disabled,
    validate,
    onFocus,
    onBlur,
    autoResize,
    tooltip
  } = props;
  const globalError = useError(id);
  const [localError, setLocalError] = useState(null);
  let value = getValue(element);
  useEffect(() => {
    if (isFunction(validate)) {
      const newValidationError = validate(value) || null;
      setLocalError(newValidationError);
    }
  }, [value]);
  const onInput = newValue => {
    let newValidationError = null;
    if (isFunction(validate)) {
      newValidationError = validate(newValue) || null;
    }
    setValue(newValue, newValidationError);
    setLocalError(newValidationError);
  };
  const error = globalError || localError;
  return jsxs("div", {
    class: classnames('bio-properties-panel-entry', error ? 'has-error' : ''),
    "data-entry-id": id,
    children: [jsx(TextArea, {
      id: id,
      label: label,
      value: value,
      onInput: onInput,
      onFocus: onFocus,
      onBlur: onBlur,
      rows: rows,
      debounce: debounce,
      monospace: monospace,
      disabled: disabled,
      autoResize: autoResize,
      tooltip: tooltip,
      element: element
    }, element), error && jsx("div", {
      class: "bio-properties-panel-error",
      children: error
    }), jsx(Description$1, {
      forId: id,
      element: element,
      value: description
    })]
  });
}
function isEdited$1(node) {
  return node && !!node.value;
}

// helpers /////////////////

function prefixId$1(id) {
  return `bio-properties-panel-${id}`;
}
function Textfield(props) {
  const {
    debounce,
    disabled = false,
    id,
    label,
    onInput,
    onFocus,
    onBlur,
    value = '',
    tooltip
  } = props;
  const [localValue, setLocalValue] = useState(value || '');
  const ref = useShowEntryEvent(id);
  const handleInputCallback = useMemo(() => {
    return debounce(({
      target
    }) => onInput(target.value.length ? target.value : undefined));
  }, [onInput, debounce]);
  const handleInput = e => {
    handleInputCallback(e);
    setLocalValue(e.target.value);
  };
  useEffect(() => {
    if (value === localValue) {
      return;
    }
    setLocalValue(value);
  }, [value]);
  return jsxs("div", {
    class: "bio-properties-panel-textfield",
    children: [jsx("label", {
      for: prefixId(id),
      class: "bio-properties-panel-label",
      children: jsx(TooltipWrapper, {
        value: tooltip,
        forId: id,
        element: props.element,
        children: label
      })
    }), jsx("input", {
      ref: ref,
      id: prefixId(id),
      type: "text",
      name: id,
      spellCheck: "false",
      autoComplete: "off",
      disabled: disabled,
      class: "bio-properties-panel-input",
      onInput: handleInput,
      onFocus: onFocus,
      onBlur: onBlur,
      value: localValue
    })]
  });
}

/**
 * @param {Object} props
 * @param {Object} props.element
 * @param {String} props.id
 * @param {String} props.description
 * @param {Boolean} props.debounce
 * @param {Boolean} props.disabled
 * @param {String} props.label
 * @param {Function} props.getValue
 * @param {Function} props.setValue
 * @param {Function} props.onFocus
 * @param {Function} props.onBlur
 * @param {string|import('preact').Component} props.tooltip
 * @param {Function} props.validate
 */
function TextfieldEntry(props) {
  const {
    element,
    id,
    description,
    debounce,
    disabled,
    label,
    getValue,
    setValue,
    validate,
    onFocus,
    onBlur,
    tooltip
  } = props;
  const globalError = useError(id);
  const [localError, setLocalError] = useState(null);
  let value = getValue(element);
  useEffect(() => {
    if (isFunction(validate)) {
      const newValidationError = validate(value) || null;
      setLocalError(newValidationError);
    }
  }, [value]);
  const onInput = newValue => {
    let newValidationError = null;
    if (isFunction(validate)) {
      newValidationError = validate(newValue) || null;
    }
    setValue(newValue, newValidationError);
    setLocalError(newValidationError);
  };
  const error = globalError || localError;
  return jsxs("div", {
    class: classnames('bio-properties-panel-entry', error ? 'has-error' : ''),
    "data-entry-id": id,
    children: [jsx(Textfield, {
      debounce: debounce,
      disabled: disabled,
      id: id,
      label: label,
      onInput: onInput,
      onFocus: onFocus,
      onBlur: onBlur,
      value: value,
      tooltip: tooltip,
      element: element
    }, element), error && jsx("div", {
      class: "bio-properties-panel-error",
      children: error
    }), jsx(Description$1, {
      forId: id,
      element: element,
      value: description
    })]
  });
}
function isEdited(node) {
  return node && !!node.value;
}

// helpers /////////////////

function prefixId(id) {
  return `bio-properties-panel-${id}`;
}
class FeelPopupModule {
  constructor(eventBus) {
    this._eventBus = eventBus;
  }

  /**
   * Check if the FEEL popup is open.
   * @return {Boolean}
   */
  isOpen() {
    return this._eventBus.fire('feelPopup._isOpen');
  }

  /**
   * Open the FEEL popup.
   *
   * @param {String} entryId
   * @param {Object} popupConfig
   * @param {HTMLElement} sourceElement
   */
  open(entryId, popupConfig, sourceElement) {
    return this._eventBus.fire('feelPopup._open', {
      entryId,
      popupConfig,
      sourceElement
    });
  }

  /**
   * Close the FEEL popup.
   */
  close() {
    return this._eventBus.fire('feelPopup._close');
  }
}
FeelPopupModule.$inject = ['eventBus'];
var index = {
  feelPopup: ['type', FeelPopupModule]
};

/**
 * @param {string} type
 * @param {boolean} [strict]
 *
 * @returns {any}
 */
function getService(type, strict) { }
const PropertiesPanelContext = createContext({
  getService
});
var FormPropertiesPanelContext = PropertiesPanelContext;

function arrayAdd(array, index, item) {
  const copy = [...array];
  copy.splice(index, 0, item);
  return copy;
}
function countDecimals(number) {
  const num = Big(number);
  if (num.toString() === num.toFixed(0)) return 0;
  return num.toFixed().split('.')[1].length || 0;
}
function isValidNumber(value) {
  return (typeof value === 'number' || typeof value === 'string') && value !== '' && !isNaN(Number(value));
}
function textToLabel(text) {
  if (typeof text != 'string') return null;
  for (const line of text.split('\n')) {
    const displayLine = line.trim();

    // we use the first non-whitespace line in the text as label
    if (displayLine !== '') {
      return displayLine;
    }
  }
  return null;
}
function isValidDotPath(path) {
  return /^\w+(\.\w+)*$/.test(path);
}
const INPUTS = ['checkbox', 'checklist', 'datetime', 'number', 'radio', 'select', 'taglist', 'textfield', 'textarea', 'latlong', 'email', 'phone', 'fileupload', 'gridfield', 'image', 'obstacle', 'map'];
const VALUES_INPUTS = ['checklist', 'radio', 'select', 'taglist'];

const labelsByType = {
  button: 'BUTTON',
  checkbox: 'CHECKBOX',
  checklist: 'MULTI CHOICE',
  columns: 'COLUMNS',
  default: 'FORM',
  datetime: 'DATETIME',
  group: 'SECTION',
  image: 'IMAGE VIEW',
  obstacle: 'OBSTACLE',
  map: 'MAP',
  number: 'NUMBER',
  radio: 'SINGLE CHOICE',
  select: 'DROPDOWN',
  spacer: 'SPACER',
  seperator: 'SEPERATOR',
  taglist: 'TAGLIST',
  text: 'TEXT VIEW',
  textfield: 'SHORT TEXT',
  textarea: 'LONG TEXT',
  fileupload: 'ATACHMENT',
  gridfield: 'GRID',
  phone: 'PHONE',
  email: 'EMAIL',
  latlong: 'LAT&LONG'
};
const PropertiesPanelHeaderProvider = {
  getElementLabel: field => {
    const {
      type
    } = field;
    if (type === 'spacer') {
      return '';
    }
    if (type === 'seperator') {
      return '';
    }
    if (type === 'text') {
      return textToLabel(field.text);
    }
    if (type === 'default') {
      return field.id;
    }
    return field.label;
  },
  getElementIcon: field => {
    const {
      type
    } = field;
    const Icon = iconsByType(type);
    if (Icon) {
      return () => jsx(Icon, {
        width: "36",
        height: "36",
        viewBox: "0 0 54 54"
      });
    }
  },
  getTypeLabel: field => {
    const {
      type
    } = field;
    return labelsByType[type];
  }
};

/**
 * Provide placeholders for empty and multiple state.
 */
const PropertiesPanelPlaceholderProvider = {
  getEmpty: () => {
    return {
      text: 'Select a form field to edit its properties.'
    };
  },
  getMultiple: () => {
    return {
      text: 'Multiple form fields are selected. Select a single form field to edit its properties.'
    };
  }
};

function ActionEntry(props) {
  const {
    editField,
    field
  } = props;
  const {
    type
  } = field;
  const entries = [];
  if (type === 'button') {
    entries.push({
      id: 'action',
      component: Action,
      editField: editField,
      field: field,
      isEdited: isEdited$3
    });
  }
  return entries;
}
function Action(props) {
  const {
    editField,
    field,
    id
  } = props;
  const path = ['action'];
  const getValue = () => {
    return get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value);
  };
  const getOptions = () => [{
    label: 'Submit',
    value: 'submit'
  }, {
    label: 'Reset',
    value: 'reset'
  }];
  return SelectEntry({
    element: field,
    getOptions,
    getValue,
    id,
    label: 'Action',
    setValue
  });
}

function useService(type, strict) {
  const {
    getService
  } = useContext(FormPropertiesPanelContext);
  return getService(type, strict);
}

/**
 * Retrieve list of variables from the form schema.
 *
 * @returns { string[] } list of variables used in form schema
 */
function useVariables() {
  const form = useService('formEditor');
  const schema = form.getSchema();
  return getSchemaVariables(schema);
}

function AltTextEntry(props) {
  const {
    editField,
    field
  } = props;
  const {
    type
  } = field;
  const entries = [];
  // if (type === 'image') {
  //   entries.push({
  //     id: 'alt',
  //     component: AltText,
  //     editField: editField,
  //     field: field,
  //     isEdited: isEdited$6
  //   });
  // }
  return entries;
}
function AltText(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const path = ['alt'];
  const getValue = () => {
    return get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value);
  };
  return FeelTemplatingEntry({
    debounce,
    element: field,
    feel: 'optional',
    getValue,
    id,
    label: 'Alternative text',
    tooltip: 'Descriptive text for screen reader accessibility.',
    setValue,
    singleLine: true,
    variables
  });
}

const AUTO_OPTION_VALUE = '';
function ColumnsEntry(props) {
  const {
    editField,
    field
  } = props;
  const entries = [{
    id: 'columns',
    component: Columns,
    field,
    editField,
    isEdited: isEdited$3
  }];
  return entries;
}
function Columns(props) {
  const {
    field,
    editField,
    id
  } = props;
  const debounce = useService('debounce');
  const formLayoutValidator = useService('formLayoutValidator');
  const validate = value => {
    return formLayoutValidator.validateField(field, value ? parseInt(value) : null);
  };
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    const layout = get(field, ['layout'], {});
    const newValue = value ? parseInt(value) : null;
    editField(field, ['layout'], set$1(layout, ['columns'], newValue));
  };
  const getValue = () => {
    return get(field, ['layout', 'columns']);
  };
  const getOptions = () => {
    return [{
      label: 'Auto',
      value: AUTO_OPTION_VALUE
    },
    // todo(pinussilvestrus): make options dependant on field type
    // cf. https://github.com/bpmn-io/form-js/issues/575
    ...asArray(16).filter(i => i >= MIN_COLUMNS).map(asOption)];
  };
  return SelectEntry({
    debounce,
    element: field,
    id,
    label: 'Columns',
    getOptions,
    getValue,
    setValue,
    validate
  });
}

function ColumnsNumberEntry(props) {
  const {
    editField,
    field
  } = props;
  const entries = [{
    id: 'columnsNumber',
    component: ColumnsNumber,
    field,
    editField,
    isEdited: isEdited$3
  }];
  return entries;
}
function ColumnsNumber(props) {
  const {
    field,
    editField,
    id
  } = props;
  const debounce = useService('debounce');
  const formLayoutValidator = useService('formLayoutValidator');
  const validate = value => {
    return formLayoutValidator.validateField(field, value ? parseInt(value) : null);
  };
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    const layout = get(field, ['layout'], {});
    const newValue = value ? parseInt(value) : null;
    editField(field, ['layout'], set$1(layout, ['columnsNumber'], newValue));
  };
  const getValue = () => {
    return get(field, ['layout', 'columnsNumber']);
  };
  const getOptions = () => {
    return [{
      label: 'Auto',
      value: AUTO_OPTION_VALUE
    },
    // todo(pinussilvestrus): make options dependant on field type
    // cf. https://github.com/bpmn-io/form-js/issues/575
    ...asArray(4).filter(i => i >= MIN_COLUMNS).map(asOption)];
  };
  return SelectEntry({
    debounce,
    element: field,
    id,
    label: 'Columns Number',
    getOptions,
    getValue,
    setValue,
    validate
  });
}

function ImageSizeEntry(props) {
  const {
    editField,
    field
  } = props;
  const entries = [{
    id: 'image_size',
    component: ImageSize,
    field,
    editField,
    isEdited: isEdited$3
  }];
  return entries;
}
function ImageSize(props) {
  const {
    field,
    editField,
    id
  } = props;
  const debounce = useService('debounce');
  const formLayoutValidator = useService('formLayoutValidator');
  const validate = value => {
    return formLayoutValidator.validateField(field, value ? value : null);
  };
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    const layout = get(field, ['layout'], {});
    const newValue = value ? value : null;
    editField(field, ['layout'], set$1(layout, ['image_size'], newValue));
  };
  const getValue = () => {
    return get(field, ['layout', 'image_size']);
  };
  const getOptions = () => {
    return [{
      label: 'lg',
      value: 'lg'
    },
    {
      label: 'md',
      value: 'md'
    },
    {
      label: 'sm',
      value: 'sm'
    }];
  };
  return SelectEntry({
    debounce,
    element: field,
    id,
    label: 'Image Size',
    getOptions,
    getValue,
    setValue,
    validate
  });
}

// helper /////////

function asOption(number) {
  return {
    value: number,
    label: number.toString()
  };
}
function asArray(length) {
  return Array.from({
    length
  }).map((_, i) => i + 1);
}

function DescriptionEntry(props) {
  const {
    editField,
    field
  } = props;
  const {
    type
  } = field;
  const entries = [];
  if (INPUTS.includes(type) || type === 'fileupload' || type === 'gridfield' || type === 'latlong' || type === 'phone' || type === 'email') {
    entries.push({
      id: 'description',
      component: Description,
      editField: editField,
      field: field,
      isEdited: isEdited$6
    });
  }
  return entries;
}
function Description(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const path = ['description'];
  const getValue = () => {
    return get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value);
  };
  return FeelTemplatingEntry({
    debounce,
    element: field,
    getValue,
    id,
    label: 'Field description',
    singleLine: true,
    setValue,
    variables
  });
}

const EMPTY_OPTION = null;
function DefaultOptionEntry(props) {
  const {
    editField,
    field
  } = props;
  const {
    type
  } = field;
  const entries = [];

  // Only make default values available when they are statically defined
  if (!INPUTS.includes(type) || VALUES_INPUTS.includes(type) && !field.values) {
    return entries;
  }
  const defaultOptions = {
    editField,
    field,
    id: 'defaultValue',
    label: 'Default value'
  };
  if (type === 'checkbox') {
    entries.push({
      ...defaultOptions,
      component: DefaultValueCheckbox,
      isEdited: isEdited$3
    });
  }
  if (type === 'number' || type === 'latlong') {
    entries.push({
      ...defaultOptions,
      component: DefaultValueNumber,
      isEdited: isEdited
    });
  }
  if (type === 'radio' || (type === 'select' && !field.isMulti)) {
    entries.push({
      ...defaultOptions,
      component: DefaultValueSingleSelect,
      isEdited: isEdited$3
    });
  }

  // todo(Skaiir): implement a multiselect equivalent (cf. https://github.com/bpmn-io/form-js/issues/265)

  if (type === 'textfield') {
    entries.push({
      ...defaultOptions,
      component: DefaultValueTextfield,
      isEdited: isEdited
    });
  }
  if (type === 'textarea') {
    entries.push({
      ...defaultOptions,
      component: DefaultValueTextarea,
      isEdited: isEdited$1
    });
  }
  return entries;
}
function DefaultValueCheckbox(props) {
  const {
    editField,
    field,
    id,
    label
  } = props;
  const {
    defaultValue
  } = field;
  const path = ['defaultValue'];
  const getOptions = () => {
    return [{
      label: 'Checked',
      value: 'true'
    }, {
      label: 'Not checked',
      value: 'false'
    }];
  };
  const setValue = value => {
    return editField(field, path, parseStringToBoolean(value));
  };
  const getValue = () => {
    return parseBooleanToString(defaultValue);
  };
  return SelectEntry({
    element: field,
    getOptions,
    getValue,
    id,
    label,
    setValue
  });
}
function DefaultValueNumber(props) {
  const {
    editField,
    field,
    id,
    label
  } = props;
  const {
    decimalDigits,
    serializeToString = false
  } = field;
  const debounce = useService('debounce');
  const path = ['defaultValue'];
  const getValue = e => {
    let value = get(field, path);
    if (!isValidNumber(value)) return;

    // Enforces decimal notation so that we do not submit defaults in exponent form
    return serializeToString ? Big(value).toFixed() : value;
  };
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    let newValue;
    if (isValidNumber(value)) {
      newValue = serializeToString ? value : Number(value);
    }
    return editField(field, path, newValue);
  };
  const decimalDigitsSet = decimalDigits || decimalDigits === 0;
  return TextfieldEntry({
    debounce,
    label,
    element: field,
    getValue,
    id,
    setValue,
    validate: value => {
      if (value === undefined || value === null) return;
      if (!isValidNumber(value)) return 'Should be a valid number';
      if (decimalDigitsSet && countDecimals(value) > decimalDigits) return `Should not contain more than ${decimalDigits} decimal digits`;
    }
  });
}
function DefaultValueSingleSelect(props) {
  const {
    editField,
    field,
    id,
    label
  } = props;
  const {
    defaultValue = EMPTY_OPTION,
    values = []
  } = field;
  const path = ['defaultValue'];
  const getOptions = () => {
    return [{
      label: '<none>',
      value: EMPTY_OPTION
    }, ...values];
  };
  const setValue = value => {
    return editField(field, path, (value.length && value !== '<none>') ? value : undefined);
  };
  const getValue = () => {
    return defaultValue;
  };
  return SelectEntry({
    element: field,
    getOptions,
    getValue,
    id,
    label,
    setValue
  });
}
function DefaultValueTextfield(props) {
  const {
    editField,
    field,
    id,
    label
  } = props;
  const debounce = useService('debounce');
  const path = ['defaultValue'];
  const getValue = () => {
    return get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value);
  };
  return TextfieldEntry({
    debounce,
    element: field,
    getValue,
    id,
    label,
    setValue
  });
}
function DefaultValueTextarea(props) {
  const {
    editField,
    field,
    id,
    label
  } = props;
  const debounce = useService('debounce');
  const path = ['defaultValue'];
  const getValue = () => {
    return get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value);
  };
  return TextAreaEntry({
    debounce,
    element: field,
    getValue,
    id,
    label,
    setValue
  });
}

// helpers /////////////////

function parseStringToBoolean(value) {
  if (value === 'true') {
    return true;
  }
  return false;
}
function parseBooleanToString(value) {
  if (value === true) {
    return 'true';
  }
  return 'false';
}

function DisabledEntry(props) {
  const {
    editField,
    field
  } = props;
  const {
    type
  } = field;
  const entries = [];
  if (INPUTS.includes(type) || type === 'fileupload' || type === 'gridfield' || type === 'latlong' || type === 'phone' || type === 'email') {
    entries.push({
      id: 'disabled',
      component: Disabled,
      editField: editField,
      field: field,
      isEdited: isEdited$8
    });
  }
  return entries;
}
function Disabled(props) {
  const {
    editField,
    field,
    id
  } = props;
  const path = ['disabled'];
  const getValue = () => {
    return get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value);
  };
  return ToggleSwitchEntry({
    element: field,
    getValue,
    id,
    label: 'Disabled',
    tooltip: 'Field cannot be edited by the end-user, and the data is not submitted.',
    inline: true,
    setValue
  });
}

function IdEntry(props) {
  const {
    editField,
    field
  } = props;
  const entries = [];
  if (field.type === 'default') {
    entries.push({
      id: 'id',
      component: Id,
      editField: editField,
      field: field,
      isEdited: isEdited
    });
  }
  return entries;
}
function Id(props) {
  const {
    editField,
    field,
    id
  } = props;
  const formFieldRegistry = useService('formFieldRegistry');
  const debounce = useService('debounce');
  const path = ['id'];
  const getValue = () => {
    return get(field, path, '');
  };
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    return editField(field, path, value);
  };
  const validate = value => {
    if (isUndefined(value) || !value.length) {
      return 'Must not be empty.';
    }
    const assigned = formFieldRegistry._ids.assigned(value);
    if (assigned && assigned !== field) {
      return 'Must be unique.';
    }
    return validateId(value) || null;
  };
  return TextfieldEntry({
    debounce,
    element: field,
    getValue,
    id,
    label: 'ID',
    setValue,
    validate
  });
}

function ModeEntry(props) {
  const {
    editField,
    field
  } = props;
  const {
    type
  } = field;
  const entries = [];
  if (type === 'default') {
    entries.push({
      id: 'mode',
      component: Mode,
      editField: editField,
      field: field,
      isEdited: isEdited$3
    });
  }
  return entries;
}

function Mode(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const path = ['mode'];
  const getValue = () => {
    return get(field, path, 'online');
  };
  const setValue = value => {
    const newValue = value ? value : 'online';
    return editField(field, path, newValue);
  };
  const validate = value => {
    if (isUndefined(value) || !value.length) {
      value = getValue();
    }
    setValue(value)
    return null;
  };
  const getOptions = () => [
    {
      label: 'Online',
      value: 'online'
    },
    {
      label: 'Offline',
      value: 'offline'
    },
  ];
  return SelectEntry({
    debounce,
    element: field,
    getOptions,
    getValue,
    id,
    label: 'Mode',
    tooltip: 'Use offline mode to design forms for offline mobile apps, in offline mode it only shows warning if you use api based form fields.',
    setValue,
    validate
  });
}

function DuplicateLabelEntry(props) {
  const {
    editField,
    field
  } = props;
  const {
    type
  } = field;
  const entries = [];
  if (type === 'default') {
    entries.push({
      id: 'duplicate_label',
      component: DuplicateLabel,
      editField: editField,
      field: field,
      isEdited: isEdited$3
    });
  }
  return entries;
}

function DuplicateLabel(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const path = ['duplicate_label'];
  const getValue = () => {
    return get(field, path, 'allow');
  };
  const setValue = value => {
    const newValue = value ? value : 'allow';
    return editField(field, path, newValue);
  };
  const validate = value => {
    if (isUndefined(value) || !value.length) {
      value = getValue();
    }
    setValue(value)
    return null;
  };
  const getOptions = () => [
    {
      label: 'Allow',
      value: 'allow'
    },
    {
      label: 'Prevent',
      value: 'prevent'
    }
  ];
  return SelectEntry({
    debounce,
    element: field,
    getOptions,
    getValue,
    id,
    label: 'Duplicate Label',
    tooltip: 'Allow or prevent duplicate label.',
    setValue,
    validate
  });
}

// id structural validation /////////////

const SPACE_REGEX = /\s/;

// for QName validation as per http://www.w3.org/TR/REC-xml/#NT-NameChar
const QNAME_REGEX = /^([a-z][\w-.]*:)?[a-z_][\w-.]*$/i;

// for ID validation as per BPMN Schema (QName - Namespace)
const ID_REGEX = /^[a-z_][\w-.]*$/i;
function validateId(idValue) {
  if (containsSpace(idValue)) {
    return 'Must not contain spaces.';
  }
  if (!ID_REGEX.test(idValue)) {
    if (QNAME_REGEX.test(idValue)) {
      return 'Must not contain prefix.';
    }
    return 'Must be a valid QName.';
  }
}
function containsSpace(value) {
  return SPACE_REGEX.test(value);
}

function KeyEntry(props) {
  const {
    editField,
    field
  } = props;
  const {
    type
  } = field;
  const entries = [];
  if (INPUTS.includes(type) || type === 'fileupload' || type === 'gridfield' || type === 'latlong' || type === 'phone' || type === 'email') {
    entries.push({
      id: 'key',
      component: Key$1,
      editField: editField,
      field: field,
      isEdited: isEdited
    });
  }
  return entries;
}
function Key$1(props) {
  const {
    editField,
    field,
    id
  } = props;
  const pathRegistry = useService('pathRegistry');
  const debounce = useService('debounce');
  const path = ['key'];
  const getValue = () => {
    return get(field, path, '');
  };
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    return editField(field, path, value);
  };
  const validate = value => {
    if (value === field.key) {
      return null;
    }
    if (isUndefined(value) || !value.length) {
      return 'Must not be empty.';
    }

    if (value && !(/^\w+(\_\w+)*$/.test(value))) {
      return 'Must be a variable or a underline separated path.';
    }

    if (value && !(/^[A-Za-z]\w*$/.test(value))) {
      return 'Must begin with alphabetic characters.';
    }

    const hasIntegerPathSegment = value.split('.').some(segment => /^\d+$/.test(segment));
    if (hasIntegerPathSegment) {
      return 'Must not contain numerical path segments.';
    }
    const twoUnderlineCheck = value.split('__').length > 1;
    if (twoUnderlineCheck) {
      return 'Must not contain two underline ( __ ) character after each others.';
    }
    if (value[value.length - 1] == "_") {
      return 'Must not finish by underline ( _ ) character.';
    }

    const replacements = {
      [field.id]: value.split('.')
    };
    const oldPath = pathRegistry.getValuePath(field);
    const newPath = pathRegistry.getValuePath(field, {
      replacements
    });

    // unclaim temporarily to avoid self-conflicts
    pathRegistry.unclaimPath(oldPath);
    const canClaim = pathRegistry.canClaimPath(newPath, true);
    pathRegistry.claimPath(oldPath, true);
    return canClaim ? null : 'Must not conflict with other key/path assignments.';
  };
  return TextfieldEntry({
    debounce,
    description: 'Binds to a form variable',
    element: field,
    getValue,
    id,
    label: 'Key',
    tooltip: 'Use a unique "key" to link the form element and the related input/output data. When dealing with nested data, break it down in the user task\'s input mapping before using it.',
    setValue,
    validate
  });
}

function PathEntry(props) {
  const {
    editField,
    field
  } = props;
  const {
    type
  } = field;
  const entries = [];
  if (type === 'group') {
    entries.push({
      id: 'path',
      component: Path,
      editField: editField,
      field: field,
      isEdited: isEdited
    });
  }
  return entries;
}
function Path(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const pathRegistry = useService('pathRegistry');
  const path = ['path'];
  const getValue = () => {
    return get(field, path, '');
  };
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    return editField(field, path, value);
  };
  const validate = value => {
    if (!value || value === field.path) {
      return null;
    }
    if (value && !isValidDotPath(value)) {
      return 'Must be empty, a variable or a dot separated path';
    }
    const hasIntegerPathSegment = value && value.split('.').some(segment => /^\d+$/.test(segment));
    if (hasIntegerPathSegment) {
      return 'Must not contain numerical path segments.';
    }
    const options = value && {
      replacements: {
        [field.id]: [value]
      }
    } || {};
    const canClaim = pathRegistry.executeRecursivelyOnFields(field, ({
      field,
      isClosed
    }) => {
      const path = pathRegistry.getValuePath(field, options);
      return pathRegistry.canClaimPath(path, isClosed);
    });
    if (!canClaim) {
      return 'Must not cause two binding paths to colide';
    }
  };
  return TextfieldEntry({
    debounce,
    description: 'Where the child variables of this component are pathed to.',
    element: field,
    getValue,
    id,
    label: 'Path',
    tooltip: 'Routes the children of this component into a form variable, may be left empty to route at the root level.',
    setValue,
    validate
  });
}

function simpleBoolEntryFactory(options) {
  const {
    id,
    label,
    description,
    path,
    props
  } = options;
  const {
    editField,
    field
  } = props;
  return {
    id,
    label,
    path,
    field,
    editField,
    description,
    component: SimpleBoolComponent,
    isEdited: isEdited$5
  };
}
const SimpleBoolComponent = props => {
  const {
    id,
    label,
    path,
    field,
    editField,
    description
  } = props;
  const getValue = () => get(field, path, '');
  const setValue = value => editField(field, path, value || false);
  return CheckboxEntry({
    element: field,
    getValue,
    id,
    label,
    setValue,
    description
  });
};

function simpleTextEntryFactory(options) {
  const {
    id,
    label,
    description,
    path,
    props
  } = options;
  const {
    editField,
    field
  } = props;
  return {
    id,
    label,
    path,
    field,
    editField,
    description,
    component: SimpleTextComponent,
    isEdited: isEdited
  };
}

const SimpleTextComponent = props => {
  const {
    id,
    label,
    path,
    field,
    editField,
    description
  } = props;

  const getValue = () => get(field, path, '');
  const setValue = value => editField(field, path, value || '');
  const debounce = useService('debounce');

  return TextfieldEntry({
    debounce,
    element: field,
    getValue,
    id,
    label,
    setValue,
    description
  });
};

function GroupEntries(props) {
  const {
    field
  } = props;
  const {
    type
  } = field;
  if (type !== 'group') {
    return [];
  }
  const entries = [
    simpleBoolEntryFactory({
      id: 'showOutline',
      path: ['showOutline'],
      label: 'Show outline',
      props
    }),
    simpleBoolEntryFactory({
      id: 'repeatable',
      path: ['repeatable'],
      label: 'Repeatable by end-user',
      props
    }),
    simpleBoolEntryFactory({
      id: 'grid_view',
      path: ['grid_view'],
      label: 'Is grid view',
      props
    })
  ];
  return entries;
}


function LabelEntry(props) {
  const {
    field,
    editField
  } = props;
  const {
    type,
    subtype
  } = field;
  const entries = [];

  if (INPUTS.includes(type) || type === 'button' || type === 'group') {
    entries.push({
      id: 'label',
      component: Label$1,
      editField,
      field,
      isEdited: isEdited$6
    });
  }
  return entries;
}
function Label$1(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));

  const path = ['label'];
  const getValue = () => {
    return get(field, path, '');
  };
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    return editField(field, path, value || '');
  };

  const form = useService('formEditor');
  const formSchema = form.getSchema();
  const duplicateLabel = formSchema.duplicate_label;

  const validate = value => {
    if (isUndefined(value) || !value.length) {
      return null;
    }
    if (value.split('(').length > 1 || value.split(')').length > 1) {
      return 'Must not contain parentheses () characters.';
    }
    if (duplicateLabel == 'prevent') {
      const isDuplicated = checkIfDuplicateLabel(value, field, formSchema);
      if (isDuplicated) {
        return 'Label must not be duplicated.';
      }
    }
    return null;
  };
  const label = field.type === 'group' ? 'Group label' : 'Field label';
  return FeelTemplatingEntry({
    debounce,
    element: field,
    getValue,
    id,
    label,
    singleLine: true,
    setValue,
    validate,
    variables
  });
}

function checkIfDuplicateLabel(label, field, schema) {
  for (let i = 0; i < schema.components?.length; i++) {
    const component = schema.components[i];
    if (component.label == label && field.id !== component.id) {
      return true;
    }
    if (component.type == 'group') {
      for (let j = 0; j < component.components?.length; j++) {
        const component1 = component.components[j];
        if (component1.label == label && field.id !== component1.id) {
          return true;
        }
      }
    }
  }
  return false;
}

function TabTitleEntry(props) {
  const {
    field,
    editField
  } = props;
  const {
    type,
    subtype
  } = field;
  const entries = [];

  if (INPUTS.includes(type) || type === 'button' || type === 'group' || type === 'text' || type === 'seperator') {
    entries.push(simpleTextEntryFactory({
      id: 'tabTitle',
      path: ['tabTitle'],
      label: 'Tab title',
      description: 'Group into tab.',
      props
    }));
  }
  return entries;
}

function LinkTextEntry(props) {
  const {
    field,
    editField
  } = props;
  const {
    type,
    subtype
  } = field;
  const entries = [];

  if (type === 'textfield') {
    entries.push(simpleTextEntryFactory({
      id: 'link_text',
      path: ['link_text'],
      label: 'Link text',
      description: 'The text of the link.',
      props
    }));
  }
  return entries;
}

// function DateLabel(props) {
//   const {
//     editField,
//     field,
//     id
//   } = props;
//   const debounce = useService('debounce');
//   const variables = useVariables().map(name => ({
//     name
//   }));
//   const path = DATE_LABEL_PATH;
//   const getValue = () => {
//     return get(field, path, '');
//   };
//   const setValue = value => {
//     return editField(field, path, value || '');
//   };
//   return FeelTemplatingEntry({
//     debounce,
//     element: field,
//     getValue,
//     id,
//     label: 'Date label',
//     singleLine: true,
//     setValue,
//     variables
//   });
// }
// function TimeLabel(props) {
//   const {
//     editField,
//     field,
//     id
//   } = props;
//   const debounce = useService('debounce');
//   const variables = useVariables().map(name => ({
//     name
//   }));
//   const path = TIME_LABEL_PATH;
//   const getValue = () => {
//     return get(field, path, '');
//   };
//   const setValue = value => {
//     return editField(field, path, value || '');
//   };
//   return FeelTemplatingEntry({
//     debounce,
//     element: field,
//     getValue,
//     id,
//     label: 'Time label',
//     singleLine: true,
//     setValue,
//     variables
//   });
// }

function SourceEntry(props) {
  const {
    editField,
    field
  } = props;
  const {
    type
  } = field;
  const entries = [];
  // if (type === 'image') {
  //   entries.push({
  //     id: 'source',
  //     component: Source,
  //     editField: editField,
  //     field: field,
  //     isEdited: isEdited$6
  //   });
  // }
  return entries;
}
function Source(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const path = ['source'];
  const getValue = () => {
    return get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value);
  };
  return FeelTemplatingEntry({
    debounce,
    description: 'Expression or static value (link/data URI)',
    element: field,
    feel: 'optional',
    getValue,
    id,
    label: 'Image source',
    tooltip: 'Link referring to a hosted image, or use a data URI directly to embed image data into the form.',
    setValue,
    singleLine: true,
    variables
  });
}

function TextEntry(props) {
  const {
    editField,
    /* getService, */
    field
  } = props;
  const {
    type
  } = field;

  // const templating = getService('templating');

  if (type !== 'text') {
    return [];
  }
  const entries = [{
    id: 'text',
    component: Text,
    editField: editField,
    field: field,
    isEdited: isEdited$6
  }];

  // todo: skipped to make the release without too much risk
  // if (templating.isTemplate(field.text)) {
  //   entries.push(simpleBoolEntryFactory({
  //     id: 'strict',
  //     path: [ 'strict' ],
  //     label: 'Strict templating',
  //     description: 'Enforces types to be correct',
  //     props
  //   }));
  // }

  return entries;
}

function Text(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const path = ['text'];
  const getValue = () => {
    return get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value || '');
  };
  const description = useMemo(() => jsxs(Fragment$1, {
    children: ["Supports markdown and templating. ", jsx("a", {
      href: "https://docs.camunda.io/docs/components/modeler/forms/form-element-library/forms-element-library-text/",
      target: "_blank",
      children: "Learn more"
    })]
  }), []);
  return FeelTemplatingEntry({
    debounce,
    description,
    element: field,
    getValue,
    id,
    label: 'Text',
    hostLanguage: 'markdown',
    setValue,
    variables
  });
}

function SpacerEntry(props) {
  const {
    editField,
    field,
    id
  } = props;
  const {
    type
  } = field;
  if (type !== 'spacer') {
    return [];
  }
  const entries = [];
  entries.push({
    id: id + '-height',
    component: SpacerHeight,
    isEdited: isEdited$7,
    editField,
    field
  });
  return entries;
}
function SpacerHeight(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const getValue = e => get(field, ['height']);
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    editField(field, ['height'], value);
  };
  return NumberFieldEntry({
    debounce,
    label: 'Height',
    element: field,
    id,
    getValue,
    setValue,
    validate: value => {
      if (value === undefined || value === null) return;
      if (value < 1) return 'Should be greater than zero.';
      if (!Number.isInteger(value)) return 'Should be an integer.';
    }
  });
}

function NumberEntries(props) {
  const {
    editField,
    field,
    id
  } = props;
  const {
    type
  } = field;
  if (type !== 'number' && type !== 'latlong') {
    return [];
  }
  const entries = [];
  entries.push({
    id: id + '-decimalDigits',
    component: NumberDecimalDigits,
    isEdited: isEdited$7,
    editField,
    field
  });
  entries.push({
    id: id + '-step',
    component: NumberArrowStep,
    isEdited: isEdited,
    editField,
    field
  });
  return entries;
}
function NumberDecimalDigits(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const getValue = e => get(field, ['decimalDigits']);
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    editField(field, ['decimalDigits'], value);
  };
  return NumberFieldEntry({
    debounce,
    label: 'Decimal digits',
    element: field,
    step: 'any',
    getValue,
    id,
    setValue,
    validate: value => {
      if (value === undefined || value === null) return;
      if (value < 0) return 'Should be greater than or equal to zero.';
      if (!Number.isInteger(value)) return 'Should be an integer.';
    }
  });
}
function NumberArrowStep(props) {
  const {
    editField,
    field,
    id
  } = props;
  const {
    decimalDigits
  } = field;
  const debounce = useService('debounce');
  const getValue = e => {
    let value = get(field, ['increment']);
    if (!isValidNumber(value)) return null;
    return value;
  };
  const clearLeadingZeroes = value => {
    if (!value) return value;
    const trimmed = value.replace(/^0+/g, '');
    return (trimmed.startsWith('.') ? '0' : '') + trimmed;
  };
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    editField(field, ['increment'], clearLeadingZeroes(value));
  };
  const decimalDigitsSet = decimalDigits || decimalDigits === 0;
  return TextfieldEntry({
    debounce,
    label: 'Increment',
    element: field,
    getValue,
    id,
    setValue,
    validate: value => {
      if (value === undefined || value === null) return;
      if (!isValidNumber(value)) return 'Should be a valid number.';
      if (Big(value).cmp(0) <= 0) return 'Should be greater than zero.';
      if (decimalDigitsSet) {
        const minimumValue = Big(`1e-${decimalDigits}`);
        if (Big(value).cmp(minimumValue) < 0) return `Should be at least ${minimumValue.toString()}.`;
        if (countDecimals(value) > decimalDigits) return `Should not contain more than ${decimalDigits} decimal digits.`;
      }
    }
  });
}

function NumberSerializationEntry(props) {
  const {
    editField,
    field
  } = props;
  const {
    type
  } = field;
  if (type !== 'number' && type !== 'latlong') {
    return [];
  }
  const entries = [];
  entries.push({
    id: 'serialize-to-string',
    component: SerializeToString,
    isEdited: isEdited$5,
    editField,
    field
  });
  return entries;
}
function SerializeToString(props) {
  const {
    editField,
    field,
    id
  } = props;
  const {
    defaultValue
  } = field;
  const path = ['serializeToString'];
  const getValue = () => {
    return get(field, path, '');
  };
  const setValue = value => {
    // Whenever changing the formatting, make sure to change the default value type along with it
    if (defaultValue || defaultValue === 0) {
      editField(field, ['defaultValue'], value ? Big(defaultValue).toFixed() : Number(defaultValue));
    }
    return editField(field, path, value);
  };
  return CheckboxEntry({
    element: field,
    getValue,
    id,
    label: 'Output as string',
    description: 'Allows arbitrary precision values',
    setValue
  });
}

function DateTimeEntry(props) {
  const {
    editField,
    field
  } = props;
  const {
    type,
    subtype
  } = field;
  if (type !== 'datetime') {
    return [];
  }
  const entries = [{
    id: 'subtype',
    component: DateTimeSubtypeSelect,
    isEdited: isEdited$3,
    editField,
    field
  }];
  // if (subtype === DATETIME_SUBTYPES.TIME || subtype === DATETIME_SUBTYPES.DATETIME) {
  //   entries.push({
  //     id: 'use24h',
  //     component: Use24h,
  //     isEdited: isEdited$5,
  //     editField,
  //     field
  //   });
  // }
  return entries;
}
function DateTimeSubtypeSelect(props) {
  const {
    editField,
    field,
    id
  } = props;
  const getValue = e => get(field, DATETIME_SUBTYPE_PATH);
  const clearTimeConfig = () => {
    //const timeConfigPaths = [TIME_LABEL_PATH, TIME_USE24H_PATH, TIME_INTERVAL_PATH, TIME_SERIALISING_FORMAT_PATH];
    const timeConfigPaths = [TIME_USE24H_PATH, TIME_INTERVAL_PATH, TIME_SERIALISING_FORMAT_PATH];
    for (const path of timeConfigPaths) {
      editField(field, path, undefined);
    }
  };
  const initTimeConfig = () => {
    //editField(field, TIME_LABEL_PATH, 'Time');
    editField(field, TIME_SERIALISING_FORMAT_PATH, TIME_SERIALISING_FORMATS.UTC_OFFSET);
    editField(field, TIME_INTERVAL_PATH, 1);
  };
  const clearDateConfig = () => {
    //const dateConfigPaths = [DATE_LABEL_PATH, DATE_DISALLOW_PAST_PATH];
    const dateConfigPaths = [DATE_DISALLOW_PAST_PATH];
    for (const path of dateConfigPaths) {
      editField(field, path, undefined);
    }
  };
  const initDateConfig = () => {
    //editField(field, DATE_LABEL_PATH, 'Date');
  };

  let value = getValue();
  useEffect(() => {
    if (!value || (value && ![DATETIME_SUBTYPES.DATE, DATETIME_SUBTYPES.TIME, DATETIME_SUBTYPES.DATETIME].includes(value))) {
      setValue(DATETIME_SUBTYPES.DATE);
    }
  }, [value]);

  const setValue = value => {
    const oldValue = getValue();
    if (oldValue === value) return;
    if (value === DATETIME_SUBTYPES.DATE) {
      clearTimeConfig();
      oldValue === DATETIME_SUBTYPES.TIME && initDateConfig();
    } else if (value === DATETIME_SUBTYPES.TIME) {
      clearDateConfig();
      oldValue === DATETIME_SUBTYPES.DATE && initTimeConfig();
    } else if (value === DATETIME_SUBTYPES.DATETIME) {
      oldValue === DATETIME_SUBTYPES.DATE && initTimeConfig();
      oldValue === DATETIME_SUBTYPES.TIME && initDateConfig();
    }
    return editField(field, DATETIME_SUBTYPE_PATH, value);
  };
  const getDatetimeSubtypes = () => {
    return Object.values(DATETIME_SUBTYPES).map(subtype => ({
      label: DATETIME_SUBTYPES_LABELS[subtype],
      value: subtype
    }));
  };
  return SelectEntry({
    label: 'Subtype',
    element: field,
    getOptions: getDatetimeSubtypes,
    getValue,
    id,
    setValue
  });
}
function Use24h(props) {
  const {
    editField,
    field,
    id
  } = props;
  const path = TIME_USE24H_PATH;
  const getValue = () => {
    return get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value);
  };
  return CheckboxEntry({
    element: field,
    getValue,
    id,
    label: 'Use 24h',
    setValue
  });
}

function DateTimeConstraintsEntry(props) {
  const {
    editField,
    field,
    id
  } = props;
  const {
    type,
    subtype
  } = field;
  if (type !== 'datetime') {
    return [];
  }
  const entries = [];
  if (subtype === DATETIME_SUBTYPES.TIME || subtype === DATETIME_SUBTYPES.DATETIME) {
    entries.push({
      id: id + '-timeInterval',
      component: TimeIntervalSelect,
      isEdited: isEdited$3,
      editField,
      field
    });
  }
  if (subtype === DATETIME_SUBTYPES.DATE || subtype === DATETIME_SUBTYPES.DATETIME) {
    entries.push({
      id: id + '-disallowPassedDates',
      component: DisallowPassedDates,
      isEdited: isEdited$5,
      editField,
      field
    });
  }
  return entries;
}
function DisallowPassedDates(props) {
  const {
    editField,
    field,
    id
  } = props;
  const path = DATE_DISALLOW_PAST_PATH;
  const getValue = () => {
    return get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value);
  };
  return CheckboxEntry({
    element: field,
    getValue,
    id,
    label: 'Disallow past dates',
    setValue
  });
}
function TimeIntervalSelect(props) {
  const {
    editField,
    field,
    id
  } = props;
  const timeIntervals = [1, 5, 10, 15, 30, 60];
  const getValue = e => get(field, TIME_INTERVAL_PATH);
  const setValue = value => editField(field, TIME_INTERVAL_PATH, parseInt(value));
  const getTimeIntervals = () => {
    return timeIntervals.map(timeInterval => ({
      label: timeInterval === 60 ? '1h' : timeInterval + 'm',
      value: timeInterval
    }));
  };
  return SelectEntry({
    label: 'Time interval',
    element: field,
    getOptions: getTimeIntervals,
    getValue,
    id,
    setValue
  });
}

function DateTimeFormatEntry(props) {
  const {
    editField,
    field
  } = props;
  const {
    type,
    subtype
  } = field;
  if (type !== 'datetime') {
    return [];
  }
  const entries = [];
  if (subtype === DATETIME_SUBTYPES.TIME || subtype === DATETIME_SUBTYPES.DATETIME) {
    entries.push({
      id: 'time-format',
      component: TimeFormatSelect,
      isEdited: isEdited$3,
      editField,
      field
    });
  }
  return entries;
}
function TimeFormatSelect(props) {
  const {
    editField,
    field,
    id
  } = props;
  const getValue = e => get(field, TIME_SERIALISING_FORMAT_PATH);
  const setValue = value => editField(field, TIME_SERIALISING_FORMAT_PATH, value);
  const getTimeSerialisingFormats = () => {
    return Object.values(TIME_SERIALISING_FORMATS).map(format => ({
      label: TIME_SERIALISINGFORMAT_LABELS[format],
      value: format
    }));
  };
  return SelectEntry({
    label: 'Time format',
    element: field,
    getOptions: getTimeSerialisingFormats,
    getValue,
    id,
    setValue
  });
}

function SelectEntries(props) {
  const {
    field
  } = props;
  const {
    type
  } = field;
  if (type !== 'select') {
    return [];
  }

  const entries = [
    simpleBoolEntryFactory({
      id: 'isMulti',
      path: ['isMulti'],
      label: 'Is multi',
      props
    })
  ];
  return entries;
}

function ValueEntry(props) {
  const {
    editField,
    field,
    idPrefix,
    index,
    validateFactory
  } = props;
  const entries = [{
    component: Label,
    editField,
    field,
    id: idPrefix + '-label',
    idPrefix,
    index,
    validateFactory
  }, {
    component: Value$1,
    editField,
    field,
    id: idPrefix + '-value',
    idPrefix,
    index,
    validateFactory
  }];
  return entries;
}
function Label(props) {
  const {
    editField,
    field,
    id,
    index,
    validateFactory
  } = props;
  const debounce = useService('debounce');
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    const values = get(field, ['values']);
    return editField(field, 'values', set$1(values, [index, 'label'], value));
  };
  const getValue = () => {
    return get(field, ['values', index, 'label']);
  };
  return TextfieldEntry({
    debounce,
    element: field,
    getValue,
    id,
    label: 'Label',
    setValue,
    validate: validateFactory(getValue(), entry => entry.label)
  });
}
function Value$1(props) {
  const {
    editField,
    field,
    id,
    index,
    validateFactory
  } = props;
  const debounce = useService('debounce');
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    const values = get(field, ['values']);
    return editField(field, 'values', set$1(values, [index, 'value'], value));
  };
  const getValue = () => {
    return get(field, ['values', index, 'value']);
  };
  return TextfieldEntry({
    debounce,
    element: field,
    getValue,
    id,
    label: 'Value',
    setValue,
    validate: validateFactory(getValue(), entry => entry.value)
  });
}

function CustomValueEntry(props) {
  const {
    editField,
    field,
    idPrefix,
    index,
    validateFactory
  } = props;
  const entries = [{
    component: Key,
    editField,
    field,
    id: idPrefix + '-key',
    idPrefix,
    index,
    validateFactory
  }, {
    component: Value,
    editField,
    field,
    id: idPrefix + '-value',
    idPrefix,
    index,
    validateFactory
  }];
  return entries;
}
function Key(props) {
  const {
    editField,
    field,
    id,
    index,
    validateFactory
  } = props;
  const debounce = useService('debounce');
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    const properties = get(field, ['properties']);
    const key = Object.keys(properties)[index];
    return editField(field, 'properties', updateKey(properties, key, value));
  };
  const getValue = () => {
    return Object.keys(get(field, ['properties']))[index];
  };
  return TextfieldEntry({
    debounce,
    element: field,
    getValue,
    id,
    label: 'Key',
    setValue,
    validate: validateFactory(getValue())
  });
}
function Value(props) {
  const {
    editField,
    field,
    id,
    index,
    validateFactory
  } = props;
  const debounce = useService('debounce');
  const setValue = value => {
    const properties = get(field, ['properties']);
    const key = Object.keys(properties)[index];
    editField(field, 'properties', updateValue(properties, key, value));
  };
  const getValue = () => {
    const properties = get(field, ['properties']);
    const key = Object.keys(properties)[index];
    return get(field, ['properties', key]);
  };
  return TextfieldEntry({
    debounce,
    element: field,
    getValue,
    id,
    label: 'Value',
    setValue,
    validate: validateFactory(getValue())
  });
}

// helpers //////////

/**
 * Returns copy of object with updated value.
 *
 * @param {Object} properties
 * @param {string} key
 * @param {string} value
 *
 * @returns {Object}
 */
function updateValue(properties, key, value) {
  return {
    ...properties,
    [key]: value
  };
}

/**
 * Returns copy of object with updated key.
 *
 * @param {Object} properties
 * @param {string} oldKey
 * @param {string} newKey
 *
 * @returns {Object}
 */
function updateKey(properties, oldKey, newKey) {
  return Object.entries(properties).reduce((newProperties, entry) => {
    const [key, value] = entry;
    return {
      ...newProperties,
      [key === oldKey ? newKey : key]: value
    };
  }, {});
}

function AutoFocusSelectEntry(props) {
  const {
    autoFocusEntry,
    element,
    getValue
  } = props;
  const value = getValue(element);
  const prevValue = usePrevious(value);
  const eventBus = useService('eventBus');

  // auto focus specifc other entry when selected value changed
  useEffect(() => {
    if (autoFocusEntry && prevValue && value !== prevValue) {
      // @Note(pinussilvestrus): There is an issue in the properties
      // panel so we have to wait a bit before showing the entry.
      // Cf. https://github.com/camunda/linting/blob/4f5328e2722f73ae60ae584c5f576eaec3999cb2/lib/modeler/Linting.js#L37
      setTimeout(() => {
        eventBus.fire('propertiesPanel.showEntry', {
          id: autoFocusEntry
        });
      });
    }
  }, [value, autoFocusEntry, prevValue, eventBus]);
  return jsx(SelectEntry, {
    ...props
  });
}

function ValuesSourceSelectEntry(props) {
  const {
    editField,
    field,
    id
  } = props;

  return [{
    id: id + '-select',
    component: ValuesSourceSelect,
    isEdited: isEdited$3,
    editField,
    field,
  },
  field.type == 'select' && field?.valuesApi == undefined && simpleBoolEntryFactory({
    id: 'searchable',
    path: ['searchable'],
    label: 'Searchable',
    props
  })];
}
function ValuesSourceSelect(props) {
  const {
    editField,
    field,
    id
  } = props;

  const form = useService('formEditor');
  const mode = form.getSchema().mode;

  const getValue = getValuesSource;
  const setValue = value => {
    let newField = field;
    const newProperties = {};
    Object.values(VALUES_SOURCES).forEach(source => {
      // Clear all values source definitions and default the newly selected one
      const newValue = value === source ? VALUES_SOURCES_DEFAULTS[source] : undefined;
      newProperties[VALUES_SOURCES_PATHS[source]] = newValue;
    });
    if (value == 'static') {
      if (field.apiDetails) {
        field.apiDetails = undefined;
      }
    }
    newField = editField(field, newProperties);
    return newField;
  };
  const getValuesSourceOptions = () => {
    if (field.type == 'select') {
      return Object.values(VALUES_SOURCES).map(valueSource => ({
        label: VALUES_SOURCES_LABELS[valueSource],
        value: valueSource
      }));
    } else if (['radio', 'checklist'].includes(field.type)) {
      return Object.values(VALUES_SOURCES).filter(x => x == 'static').map(valueSource => ({
        label: VALUES_SOURCES_LABELS[valueSource],
        value: valueSource
      }));
    }
    return [];
  };
  return AutoFocusSelectEntry({
    autoFocusEntry: getAutoFocusEntryId(field),
    label: 'Type',
    element: field,
    getOptions: getValuesSourceOptions,
    getValue,
    id,
    warnings: (field?.valuesApi !== undefined && mode == 'offline') ? 'Warning: form is offline' : '',
    setValue
  });
}

// helpers //////////

function getAutoFocusEntryId(field) {
  const valuesSource = getValuesSource(field);
  if (valuesSource === VALUES_SOURCES.EXPRESSION) {
    return `${field.id}-valuesExpression-expression`;
  } else if (valuesSource === VALUES_SOURCES.INPUT) {
    return `${field.id}-dynamicValues-key`;
  } else if (valuesSource === VALUES_SOURCES.STATIC) {
    return `${field.id}-staticValues-0-label`;
  }
  else if (valuesSource === VALUES_SOURCES.API) {
    return `${field.id}-valuesApi-api`;
  }
  return null;
}

function InputKeyValuesSourceEntry(props) {
  const {
    editField,
    field,
    id
  } = props;
  const schema = '[\n  {\n    "label": "dollar",\n    "value": "$"\n  }\n]';
  const description = jsxs("div", {
    children: ["Define which input property to populate the values from.", jsx("br", {}), jsx("br", {}), "The input property may be an array of simple values or alternatively follow this schema:", jsx("pre", {
      children: jsx("code", {
        children: schema
      })
    })]
  });
  return [{
    id: id + '-key',
    component: InputValuesKey,
    label: 'Input values key',
    description,
    isEdited: isEdited,
    editField,
    field
  }];
}
function InputValuesKey(props) {
  const {
    editField,
    field,
    id,
    label,
    description
  } = props;
  const debounce = useService('debounce');
  const path = VALUES_SOURCES_PATHS[VALUES_SOURCES.INPUT];
  const getValue = () => get(field, path, '');
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    editField(field, path, value || '');
  };
  const validate = value => {
    if (isUndefined(value) || !value.length) {
      return 'Must not be empty.';
    }
    if (/\s/.test(value)) {
      return 'Must not contain spaces.';
    }
    return null;
  };
  return TextfieldEntry({
    debounce,
    description,
    element: field,
    getValue,
    id,
    label,
    setValue,
    validate
  });
}

function StaticValuesSourceEntry(props) {
  const {
    editField,
    field,
    id: idPrefix
  } = props;
  const {
    values
  } = field;
  const addEntry = e => {
    e.stopPropagation();
    const index = values.length + 1;
    const entry = getIndexedEntry(index, values);
    editField(field, VALUES_SOURCES_PATHS[VALUES_SOURCES.STATIC], arrayAdd(values, values.length, entry));
  };
  const removeEntry = entry => {
    editField(field, VALUES_SOURCES_PATHS[VALUES_SOURCES.STATIC], without(values, entry));
  };
  const validateFactory = (key, getValue) => {
    return value => {
      if (value === key) {
        return;
      }
      if (isUndefined(value) || !value.length) {
        return 'Must not be empty.';
      }
      const isValueAssigned = values.find(entry => getValue(entry) === value);
      if (isValueAssigned) {
        return 'Must be unique.';
      }
    };
  };
  const items = values.map((entry, index) => {
    const id = idPrefix + '-' + index;
    return {
      id,
      label: entry.label,
      entries: ValueEntry({
        editField,
        field,
        idPrefix: id,
        index,
        validateFactory
      }),
      autoFocusEntry: id + '-label',
      remove: () => removeEntry(entry)
    };
  });
  const importExcel = itemsList => {
    let importedValues = [];
    for (let i = 1; i < itemsList.length; i++) {
      const find = importedValues.findIndex(p => p.value == itemsList[i][1]);
      if (find == -1) {
        importedValues.push({
          label: itemsList[i][0],
          value: itemsList[i][1],
        });
      }
    }
    editField(field, VALUES_SOURCES_PATHS[VALUES_SOURCES.STATIC], importedValues);
  }
  const exportExcel = () => {
    const ws = utils.json_to_sheet(values);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Data");
    writeFile(wb, "Options.xlsx");
  }
  return {
    items,
    add: addEntry,
    importExcel: importExcel,
    exportExcel: exportExcel,
    shouldSort: false,
  };
}

// helper

function getIndexedEntry(index, values) {
  const entry = {
    label: 'Value',
    value: 'value'
  };
  while (labelOrValueIsAlreadyAssignedForIndex(index, values)) {
    index++;
  }
  if (index > 1) {
    entry.label += ` ${index}`;
    entry.value += `${index}`;
  }
  return entry;
}
function labelOrValueIsAlreadyAssignedForIndex(index, values) {
  return values.some(existingEntry => existingEntry.label === `Value ${index}` || existingEntry.value === `value${index}`);
}

function AdornerEntry(props) {
  const {
    editField,
    field
  } = props;
  const {
    type
  } = field;
  const entries = [];
  const onChange = key => {
    return value => {
      const appearance = get(field, ['appearance'], {});
      editField(field, ['appearance'], set$1(appearance, [key], value));
    };
  };
  const getValue = key => {
    return () => {
      return get(field, ['appearance', key]);
    };
  };
  if (['number', 'textfield'].includes(type)) {
    entries.push({
      id: 'prefix-adorner',
      component: PrefixAdorner,
      isEdited: isEdited$6,
      editField,
      field,
      onChange,
      getValue
    });
    entries.push({
      id: 'suffix-adorner',
      component: SuffixAdorner,
      isEdited: isEdited$6,
      editField,
      field,
      onChange,
      getValue
    });
  }
  return entries;
}
function PrefixAdorner(props) {
  const {
    field,
    id,
    onChange,
    getValue
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  return FeelTemplatingEntry({
    debounce,
    element: field,
    feel: 'optional',
    getValue: getValue('prefixAdorner'),
    id,
    label: 'Prefix',
    setValue: onChange('prefixAdorner'),
    singleLine: true,
    variables
  });
}
function SuffixAdorner(props) {
  const {
    field,
    id,
    onChange,
    getValue
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  return FeelTemplatingEntry({
    debounce,
    element: field,
    getValue: getValue('suffixAdorner'),
    id,
    label: 'Suffix',
    setValue: onChange('suffixAdorner'),
    singleLine: true,
    variables
  });
}

function ReadonlyEntry(props) {
  const {
    editField,
    field
  } = props;
  const {
    type
  } = field;
  const entries = [];
  if (INPUTS.includes(type) || type === 'fileupload' || type === 'gridfield' || type === 'latlong' || type === 'phone' || type === 'email') {
    entries.push({
      id: 'readonly',
      component: Readonly,
      editField: editField,
      field: field,
      isEdited: isEdited$6
    });
  }
  return entries;
}
function Readonly(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const path = ['readonly'];
  const getValue = () => {
    return get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value || false);
  };
  return FeelToggleSwitchEntry({
    debounce,
    element: field,
    feel: 'optional',
    getValue,
    id,
    label: 'Read only',
    tooltip: 'Field cannot be edited by the end-user, but the data will still be submitted.',
    setValue,
    variables
  });
}

function PersistentEntry(props) {
  const {
    editField,
    field
  } = props;
  const {
    type
  } = field;
  const entries = [];
  if (INPUTS.includes(type) || type === 'fileupload' || type === 'gridfield' || type === 'latlong' || type === 'phone' || type === 'email') {
    entries.push({
      id: 'persistent',
      component: Persistent,
      editField: editField,
      field: field,
      isEdited: isEdited$6
    });
  }
  return entries;
}
function Persistent(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const path = ['persistent'];
  const getValue = () => {
    return get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value || false);
  };
  return FeelToggleSwitchEntry({
    debounce,
    element: field,
    feel: 'optional',
    getValue,
    id,
    label: 'Persistent',
    tooltip: 'The value of field becomes persistent and the hide logic does not reset it.',
    setValue,
    variables
  });
}

function LinkViewEntry(props) {
  const {
    editField,
    field
  } = props;
  const {
    type
  } = field;
  const entries = [];
  if (type === 'textfield') {
    entries.push({
      id: 'link_view',
      component: LinkView,
      editField: editField,
      field: field,
      isEdited: isEdited$6
    });
  }
  return entries;
}
function LinkView(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const path = ['link_view'];
  const getValue = () => {
    return get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value || false);
  };
  return FeelToggleSwitchEntry({
    debounce,
    element: field,
    feel: 'optional',
    getValue,
    id,
    label: 'Link View',
    tooltip: 'The appearance and behavior of field is like a link.',
    setValue,
    variables
  });
}

function ConditionEntry(props) {
  const {
    editField,
    field
  } = props;
  return [{
    id: 'conditional-hide',
    component: Condition,
    editField: editField,
    field: field,
    isEdited: isEdited$6
  }];
}
function Condition(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const path = ['conditional', 'hide'];
  const getValue = () => {
    return get(field, path, '');
  };
  const setValue = value => {
    if (!value) {
      return editField(field, 'conditional', undefined);
    }
    return editField(field, 'conditional', {
      hide: value
    });
  };
  return FeelEntry({
    debounce,
    description: 'Condition under which the field is hidden',
    element: field,
    feel: 'required',
    getValue,
    id,
    label: 'Hide if',
    setValue,
    variables
  });
}

function ValuesExpressionEntry(props) {
  const {
    editField,
    field,
    id
  } = props;
  return [{
    id: id + '-expression',
    component: ValuesExpression,
    label: 'Values expression',
    isEdited: isEdited$6,
    editField,
    field
  }];
}
function ValuesExpression(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const path = VALUES_SOURCES_PATHS[VALUES_SOURCES.EXPRESSION];
  const schema = '[\n  {\n    "label": "dollar",\n    "value": "$"\n  }\n]';
  const description = jsxs("div", {
    children: ["Define an expression to populate the options from.", jsx("br", {}), jsx("br", {}), "The expression may result in an array of simple values or alternatively follow this schema:", jsx("pre", {
      children: jsx("code", {
        children: schema
      })
    })]
  });
  const getValue = () => get(field, path, '');
  const setValue = value => editField(field, path, value || '');
  return FeelEntry({
    debounce,
    description,
    element: field,
    feel: 'required',
    getValue,
    id,
    label: 'Options expression',
    setValue,
    variables
  });
}

function ValuesApiEntry(props) {
  const {
    editField,
    field,
    id
  } = props;
  return [{
    id: id + '-api',
    component: ValuesApi,
    label: 'Values api',
    isEdited: isEdited$3,
    editField,
    field
  },
  {
    id: id + '-megaDropdownView',
    component: MegaDropdownView,
    isEdited: isEdited$5,
    editField,
    field
  }
  ];
}
function ValuesApi(props) {
  const {
    editField,
    field,
    id
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const {
    defaultValue = EMPTY_OPTION,
    values = []
  } = field;

  apiList.forEach(element => {
    values.push(element)
  });

  const path = VALUES_SOURCES_PATHS[VALUES_SOURCES.API];

  const getOptions = () => {
    return [{
      label: '<none>',
      value: EMPTY_OPTION
    }, ...values];
  };
  const setValue = value => {
    field.apiDetails = apiListDetails.filter(x => x.endpoint == value)[0]
    return editField(field, path, value.length ? value : undefined);
  };

  const getValue = () => {
    return get(field, path, '');
  };

  return SelectEntry({
    debounce,
    element: field,
    getOptions,
    getValue,
    id,
    label: 'Api list',
    setValue,
    variables
  });
}

function MegaDropdownView(props) {
  const {
    editField,
    field,
    id
  } = props;
  const path = MEGA_DROPDOWN_VIEW_PATH;
  const getValue = () => {
    return get(field, path, '');
  };
  const setValue = value => {
    return editField(field, path, value);
  };
  return CheckboxEntry({
    element: field,
    getValue,
    id,
    label: 'Mega dropdown',
    setValue
  });
}

let apiList = [];
let apiListDetails = [];
async function getApisList() {
  const token = window.localStorage.getItem('ngx-app.current-user');
  const myHeaders = new Headers();
  let CSRFToken = '';
  let match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  if (match) {
    CSRFToken = match[2];
  }
  myHeaders.append('Authorization', 'Token ' + JSON.parse(token).auth_token);
  myHeaders.append('X-CSRFToken', CSRFToken);
  myHeaders.append('Accept', 'application/json, text/plain, */*');
  const options = {
    headers: myHeaders
  };

  const apiRequest = await new Request('/api/form-builder/v1/api-schema/?no_page', options);
  fetch(apiRequest)
    .then((response) => response.json())
    .then((res) => {
      if (res) {
        apiList = [];
        apiListDetails = [];
        if (Array.isArray(res)) {
          res?.map((item) => {
            apiList.push({
              value: item?.endpoint,
              label: `${item?.name}`,
            });

            apiListDetails.push({
              id: item?.id,
              name: item?.name,
              endpoint: item?.endpoint,
              httpType: item?.type,
              filter_fields: item?.filter_fields?.trim()?.split(','),
              model_fields: item?.model_fields?.trim()?.split(','),
              label: item?.label || '',
              value: item?.value || '',
            });
          });
        }
      }
    });
}

function GeneralGroup(field, editField, getService) {
  const entries = [...IdEntry({
    field,
    editField
  }), ...ModeEntry({
    field,
    editField
  }), ...DuplicateLabelEntry({
    field,
    editField
  }), ...LabelEntry({
    field,
    editField
  }), ...DescriptionEntry({
    field,
    editField
  }), ...KeyEntry({
    field,
    editField
  }), ...TabTitleEntry({
    field,
    editField
  }), ...PathEntry({
    field,
    editField
  }), ...GroupEntries({
    field,
    editField
  }), ...DefaultOptionEntry({
    field,
    editField
  }), ...ActionEntry({
    field,
    editField
  }), ...DateTimeEntry({
    field,
    editField
  }), ...TextEntry({
    field,
    editField,
    getService
  }), ...SpacerEntry({
    field,
    editField
  }), ...NumberEntries({
    field,
    editField
  }), ...SourceEntry({
    field,
    editField
  }), ...AltTextEntry({
    field,
    editField
  }), ...SelectEntries({
    field,
    editField
  }), ...DisabledEntry({
    field,
    editField
  }), ...ReadonlyEntry({
    field,
    editField
  }), ...PersistentEntry({
    field,
    editField
  }), ...LinkViewEntry({
    field,
    editField
  }), ...LinkTextEntry({
    field,
    editField
  })
  ];

  return {
    id: 'general',
    label: 'General',
    entries
  };
}

function SerializationGroup(field, editField) {
  const entries = [...NumberSerializationEntry({
    field,
    editField
  }), ...DateTimeFormatEntry({
    field,
    editField
  })];
  if (!entries.length) {
    return null;
  }
  return {
    id: 'serialization',
    label: 'Serialization',
    entries
  };
}

function ConstraintsGroup(field, editField) {
  const entries = [...DateTimeConstraintsEntry({
    field,
    editField
  })];
  if (!entries.length) {
    return null;
  }
  return {
    id: 'constraints',
    label: 'Constraints',
    entries
  };
}

const VALIDATION_TYPE_OPTIONS = {
  custom: {
    value: '',
    label: 'Custom'
  },
  email: {
    value: 'email',
    label: 'Email'
  },
  phone: {
    value: 'phone',
    label: 'Phone'
  }
};

const DOMAIN_TYPE_OPTIONS = {
  none: {
    value: '',
    label: 'none'
  },
  blacklist: {
    value: 'Blacklist',
    label: 'Blacklist'
  },
  whitelist: {
    value: 'Whitelist',
    label: 'Whitelist'
  },
};
function ValidationGroup(field, editField) {
  const {
    type
  } = field;
  const validate = get(field, ['validate'], {});
  //validate.domainType
  const isCustomValidation = [undefined, VALIDATION_TYPE_OPTIONS.custom.value].includes(validate.validationType);
  const isChooseDomainType = validate?.domainType ? true : false;
  const isChooseAttachedValidationType = validate?.attachedValidationType ? true : false;
  if (!INPUTS.includes(type)) {
    return null;
  }
  const onChange = key => {
    return value => {
      const validate = get(field, ['validate'], {});
      editField(field, ['validate'], set$1(validate, [key], value));
    };
  };
  const getValue = key => {
    return () => {
      return get(field, ['validate', key])
    };
  };
  let entries = [{
    id: 'required',
    component: Required,
    getValue,
    field,
    isEdited: isEdited$5,
    onChange
  }];
  if (type === 'textfield') {
    entries.push({
      id: 'validationType',
      component: ValidationType,
      getValue,
      field,
      editField,
      isEdited: isEdited,
      onChange
    });
  }
  if (type === 'textarea' || type === 'textfield' && isCustomValidation) {
    entries.push({
      id: 'minLength',
      component: MinLength,
      getValue,
      field,
      isEdited: isEdited$6,
      onChange
    }, {
      id: 'maxLength',
      component: MaxLength,
      getValue,
      field,
      isEdited: isEdited$6,
      onChange
    });
  }
  if (type === 'textarea' || type === 'textfield' && isCustomValidation) {
    entries.push({
      id: 'pattern',
      component: Pattern,
      getValue,
      field,
      isEdited: isEdited,
      onChange
    });
  }
  if (type === 'number' || type === 'latlong') {
    entries.push({
      id: 'min',
      component: Min,
      getValue,
      field,
      isEdited: isEdited$6,
      onChange
    }, {
      id: 'max',
      component: Max,
      getValue,
      field,
      isEdited: isEdited$6,
      onChange
    });
  }
  if (type === 'email') {
    entries.push({
      id: 'domainType',
      component: DomainType,
      getValue,
      field,
      editField,
      isEdited: isEdited,
      onChange
    });
  }
  if (type === 'email' && isChooseDomainType) {
    entries.push({
      id: 'DomainListEmail',
      component: DomainList,
      getValue,
      field,
      isEdited: isEdited$6,
      onChange
    });
  }

  if (type === 'fileupload') {
    entries.push(
      {
        id: 'maxFileNumber',
        component: MaxFileNumber,
        getValue,
        field,
        isEdited: isEdited$6,
        onChange
      },
      {
        id: 'maxTotalSize',
        component: MaxTotalSize,
        getValue,
        field,
        isEdited: isEdited$6,
        onChange
      },
      {
        id: 'attachedType',
        component: AttachedValidationType,
        getValue,
        field,
        editField,
        isEdited: isEdited,
        onChange
      });
  }

  if (type === 'fileupload' && validate?.attachedValidationType == 'Blacklist') {
    entries.push({
      id: 'blacklistAttachedText',
      component: AttachmentBlacklistText,
      getValue,
      field,
      isEdited: isEdited$6,
      onChange
    });
  }

  if (type === 'fileupload' && validate?.attachedValidationType == 'Whitelist') {
    entries.push({
      id: 'whitelistAttachedList',
      component: AttachmentWhitelist,
      getValue,
      field,
      isEdited: isEdited$6,
      onChange
    });
  }
  if (type === 'image') {
    entries.push(
      {
        id: 'maxFileNumber',
        component: MaxFileNumber,
        getValue,
        field,
        isEdited: isEdited$6,
        onChange
      },
      {
        id: 'maxTotalSize',
        component: MaxTotalSize,
        getValue,
        field,
        isEdited: isEdited$6,
        onChange
      });
  }

  return {
    id: 'validation',
    label: 'Validation',
    entries
  };
}


function DomainList(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  const debounce = useService('debounce');
  return FeelTemplatingEntry({
    debounce,
    description: 'Separate the list of desired domains with commas',
    element: field,
    feel: 'optional',
    getValue: getValue('domainList'),
    id,
    label: 'Domain list',
    setValue: onChange('domainList'),
  });
}

function DomainType(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  const debounce = useService('debounce');
  const setValue = domainType => {
    onChange('domainType')(domainType || undefined);
  };
  return SelectEntry({
    debounce,
    element: field,
    getValue: getValue('domainType'),
    id,
    label: 'Domain Validation',
    setValue,
    getOptions: () => Object.values(DOMAIN_TYPE_OPTIONS),
  });
}

function AttachmentBlacklistText(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  const debounce = useService('debounce');
  return FeelTemplatingEntry({
    debounce,
    description: 'the list Separate file extensions with commas',
    element: field,
    feel: 'optional',
    getValue: getValue('blacklistAttachment'),
    id,
    label: 'Blacklist Attached',
    setValue: onChange('blacklistAttachment'),
  });
}

let optionsWhitelistAttachment = []
function AttachmentWhitelist(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  const debounce = useService('debounce');
  getWhitelistAttachment()
  return MultiSelect({
    debounce,
    element: field,
    getValue: getValue('whitelistAttachment'),
    id,
    label: 'Whitelist Attached',
    setValue: onChange("whitelistAttachment"),
    getOptions: () => optionsWhitelistAttachment,
  });
}

async function getWhitelistAttachment() {
  const apiRequest = await new Request('/api/attachments/whitelist-type/');

  fetch(apiRequest)
    .then((response) => response.json())
    .then((res) => {
      if (res) {
        res.results.map(op => {
          op.allowed_extension.split(',').map(val => {
            if (!optionsWhitelistAttachment.map(opt => opt.value).includes(val)) {
              optionsWhitelistAttachment.push({
                value: val,
                label: val
              })
            }
          })
        })
      }
    });
  // return [
  //   {
  //     value: 'xlsx',
  //     label: 'xlsx'
  //   },
  //   {
  //     value: 'png',
  //     label: 'png'
  //   },
  // ]
}

function AttachedValidationType(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  const debounce = useService('debounce');
  const setValue = attachedValidationType => {
    onChange('attachedValidationType')(attachedValidationType || undefined);
  };
  return SelectEntry({
    debounce,
    element: field,
    getValue: getValue('attachedValidationType'),
    id,
    label: 'Attached Validation',
    setValue,
    getOptions: () => Object.values(DOMAIN_TYPE_OPTIONS),
  });
}
function Required(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  return CheckboxEntry({
    element: field,
    getValue: getValue('required'),
    id,
    label: 'Required',
    setValue: onChange('required')
  });
}
function MinLength(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  return FeelNumberEntry({
    debounce,
    element: field,
    feel: 'optional',
    getValue: getValue('minLength'),
    id,
    label: 'Minimum length',
    min: 0,
    setValue: onChange('minLength'),
    variables
  });
}
function MaxLength(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  return FeelNumberEntry({
    debounce,
    element: field,
    feel: 'optional',
    getValue: getValue('maxLength'),
    id,
    label: 'Maximum length',
    min: 0,
    setValue: onChange('maxLength'),
    variables
  });
}
function Pattern(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  const debounce = useService('debounce');
  return TextfieldEntry({
    debounce,
    element: field,
    getValue: getValue('pattern'),
    id,
    label: 'Custom regular expression',
    setValue: onChange('pattern')
  });
}
function Min(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    onChange('min')(value);
  };

  return NumberFieldEntry({
    debounce,
    label: 'Minimum',
    element: field,
    id,
    getValue: getValue('min'),
    setValue,
    validate: value => {
      if (value === undefined || value === null) return;
      // if (value < 1) return 'Should be greater than zero.';
      if (!Number.isInteger(value)) return 'Should be an integer.';
    },
    variables
  });
}

function Max(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  const setValue = (value, error) => {
    if (error) {
      return;
    }
    onChange('max')(value);
  };

  return NumberFieldEntry({
    debounce,
    label: 'Maximum',
    element: field,
    id,
    getValue: getValue('max'),
    setValue,
    validate: value => {
      if (value === undefined || value === null) return;
      if (!Number.isInteger(value)) return 'Should be an integer.';
    },
    variables
  });
}

function MaxFileNumber(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  return FeelNumberEntry({
    debounce,
    element: field,
    feel: 'optional',
    id,
    label: 'Maximum File Number',
    step: 'any',
    getValue: getValue('maxFileNumber'),
    setValue: onChange('maxFileNumber'),
    placeholder: 'Ex: 5',
    variables
  });
}
function MaxTotalSize(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  const debounce = useService('debounce');
  const variables = useVariables().map(name => ({
    name
  }));
  return FeelNumberEntry({
    debounce,
    element: field,
    feel: 'optional',
    id,
    label: 'Maximum Total Size (MB)',
    step: 'any',
    getValue: getValue('maxTotalSize'),
    setValue: onChange('maxTotalSize'),
    placeholder: 'Ex: 15',
    variables
  });
}
function ValidationType(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  const debounce = useService('debounce');
  const setValue = validationType => {
    onChange('validationType')(validationType || undefined);
  };
  return SelectEntry({
    debounce,
    element: field,
    getValue: getValue('validationType'),
    id,
    label: 'Validation pattern',
    setValue,
    getOptions: () => Object.values(VALIDATION_TYPE_OPTIONS),
    tooltip: getValue('validationType')() === VALIDATION_TYPE_OPTIONS.phone.value ? 'The built-in phone validation pattern is based on the E.164 standard with no spaces. Ex: +491234567890' : undefined
  });
}

function ValuesGroups(field, editField) {
  const {
    type,
    id: fieldId
  } = field;
  if (!VALUES_INPUTS.includes(type)) {
    return [];
  }
  const context = {
    editField,
    field
  };
  const valuesSourceId = `${fieldId}-valuesSource`;

  /**
   * @type {Array<Group|ListGroup>}
   */
  const groups = [{
    id: valuesSourceId,
    label: 'Options source',
    tooltip: getValuesTooltip(),
    component: Group,
    entries: ValuesSourceSelectEntry({
      ...context,
      id: valuesSourceId
    })
  }];
  const valuesSource = getValuesSource(field);
  if (valuesSource === VALUES_SOURCES.INPUT) {
    const dynamicValuesId = `${fieldId}-dynamicValues`;
    groups.push({
      id: dynamicValuesId,
      label: 'Dynamic options',
      component: Group,
      entries: InputKeyValuesSourceEntry({
        ...context,
        id: dynamicValuesId
      })
    });
  } else if (valuesSource === VALUES_SOURCES.STATIC) {
    const staticValuesId = `${fieldId}-staticValues`;
    groups.push({
      id: staticValuesId,
      label: 'Manual options',
      component: ListGroup,
      ...StaticValuesSourceEntry({
        ...context,
        id: staticValuesId
      })
    });
  } else if (valuesSource === VALUES_SOURCES.EXPRESSION) {
    const valuesExpressionId = `${fieldId}-valuesExpression`;
    groups.push({
      id: valuesExpressionId,
      label: 'Options expression',
      component: Group,
      entries: ValuesExpressionEntry({
        ...context,
        id: valuesExpressionId
      })
    });
  }
  else if (valuesSource === VALUES_SOURCES.API) {
    const valuesApiId = `${fieldId}-valuesApi`;
    groups.push({
      id: valuesApiId,
      label: 'Options Api',
      component: Group,
      entries: ValuesApiEntry({
        ...context,
        id: valuesApiId
      })
    });
  }
  return groups;
}

// helpers //////////

function getValuesTooltip() {
  return '"Static" defines a constant, predefined set of form options.\n\n' + '"Input data" defines options that are populated dynamically, adjusting based on variable data for flexible responses to different conditions or inputs.\n\n' + '"Expression" defines options that are populated from a FEEL expression.';
}

function CustomPropertiesGroup(field, editField) {
  const {
    properties = {},
    type
  } = field;
  if (type === 'default') {
    return null;
  }
  const addEntry = event => {
    event.stopPropagation();
    let index = Object.keys(properties).length + 1;
    while (`key${index}` in properties) {
      index++;
    }
    editField(field, ['properties'], {
      ...properties,
      [`key${index}`]: 'value'
    });
  };
  const validateFactory = key => {
    return value => {
      if (value === key) {
        return;
      }
      if (isUndefined(value) || !value.length) {
        return 'Must not be empty.';
      }
      if (has(properties, value)) {
        return 'Must be unique.';
      }
    };
  };
  const items = Object.keys(properties).map((key, index) => {
    const removeEntry = event => {
      event.stopPropagation();
      return editField(field, ['properties'], removeKey(properties, key));
    };
    const id = `${field.id}-property-${index}`;
    return {
      autoFocusEntry: id + '-key',
      entries: CustomValueEntry({
        editField,
        field,
        idPrefix: id,
        index,
        validateFactory
      }),
      id,
      label: key || '',
      remove: removeEntry
    };
  });
  return {
    add: addEntry,
    component: ListGroup,
    id: 'custom-values',
    items,
    label: 'Custom properties',
    tooltip: 'Add properties directly to the form schema, useful to configure functionality in custom-built task applications and form renderers.',
    shouldSort: false
  };
}

// helpers //////////

/**
 * Returns copy of object without key.
 *
 * @param {Object} properties
 * @param {string} oldKey
 *
 * @returns {Object}
 */
function removeKey(properties, oldKey) {
  return Object.entries(properties).reduce((newProperties, entry) => {
    const [key, value] = entry;
    if (key === oldKey) {
      return newProperties;
    }
    return {
      ...newProperties,
      [key]: value
    };
  }, {});
}

function AppearanceGroup(field, editField) {
  const entries = [...AdornerEntry({
    field,
    editField
  })];
  if (!entries.length) {
    return null;
  }
  return {
    id: 'appearance',
    label: 'Appearance',
    entries
  };
}

function LayoutGroup(field, editField) {
  const {
    type
  } = field;
  if (type === 'default') {
    return null;
  }
  const entries = [...ColumnsEntry({
    field,
    editField
  })];
  if (['radio', 'checklist'].includes(field.type)) {
    entries.push(...ColumnsNumberEntry({
      field,
      editField
    }))
  }
  if (['image'].includes(field.type)) {
    entries.push(...ImageSizeEntry({
      field,
      editField
    }))
  }
  if (entries.length === 0) {
    return null;
  }
  return {
    id: 'layout',
    label: 'Layout',
    entries
  };
}

function GridConfigGroup(field, editField) {
  const {
    type
  } = field;
  if (type !== 'gridfield') {
    return null;
  }

  const onChange = key => {
    return value => {
      const grid_config = get(field, ['grid_config'], {});
      editField(field, ['grid_config'], set$1(grid_config, [key], value));
    };
  };
  const getValue = key => {
    return () => {
      return get(field, ['grid_config', key])
    };
  };

  const entries = [
    {
      id: 'dynamic_grid',
      component: DynamicGrid,
      getValue,
      field,
      isEdited: isEdited$5,
      onChange
    },
    // simpleBoolEntryFactory({
    //   id: 'dynamic_grid',
    //   path: ['dynamic_grid'],
    //   label: 'Dynamic (import excel)',
    //   props: {
    //     field,
    //     editField
    //   }
    // }),
    //(field['gird_config'] && !field['gird_config']['dynamic_grid']) && 
    (!field['grid_config'] || (field['grid_config'] && !field['grid_config']['dynamic_grid'])) &&
    ({
      component: GridColumns,
      field,
      editField,
      onChange,
      getValue
    }),
    {
      id: 'add_row_disabled',
      component: GridDisableAddRow,
      getValue,
      field,
      isEdited: isEdited$5,
      onChange
    },
    {
      id: 'remove_row_disabled',
      component: GridDisableRemoveRow,
      getValue,
      field,
      isEdited: isEdited$5,
      onChange
    },
    {
      component: GridDisabledColumns,
      field,
      editField,
      onChange,
      getValue
    },
    {
      component: GridRequiredExpectedColumns,
      field,
      editField,
      onChange,
      getValue
    },
    {
      component: GridOptionalExpectedColumns,
      field,
      editField,
      onChange,
      getValue
    }
  ];

  if (entries.length === 0) {
    return null;
  }
  return {
    id: 'grid_config',
    label: 'Grid config',
    entries
  };

}

function GridColumns(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  const debounce = useService('debounce');

  return FeelTemplatingEntry({
    debounce,
    description: 'the list separate columns with commas',
    element: field,
    feel: 'optional',
    getValue: getValue('grid_columns'),
    id,
    label: 'Columns list',
    setValue: onChange('grid_columns'),
  })
}

function GridDisabledColumns(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  const debounce = useService('debounce');

  return FeelTemplatingEntry({
    debounce,
    description: 'Separate disabled columns index with commas',
    element: field,
    feel: 'optional',
    getValue: getValue('disabled_columns'),
    id,
    label: 'Disabled columns index list',
    setValue: onChange('disabled_columns'),
  })
}

function GridRequiredExpectedColumns(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  const debounce = useService('debounce');

  return FeelTemplatingEntry({
    debounce,
    description: 'Separate required expected columns title with commas',
    element: field,
    feel: 'optional',
    getValue: getValue('required_expected_columns'),
    id,
    label: 'Required expected columns list',
    setValue: onChange('required_expected_columns'),
  })
}

function GridOptionalExpectedColumns(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  const debounce = useService('debounce');

  return FeelTemplatingEntry({
    debounce,
    description: 'Separate optional expected columns title with commas',
    element: field,
    feel: 'optional',
    getValue: getValue('optional_expected_columns'),
    id,
    label: 'Optional expected columns list',
    setValue: onChange('optional_expected_columns'),
  })
}

function GridDisableAddRow(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  return CheckboxEntry({
    element: field,
    getValue: getValue('add_row_disabled'),
    id,
    label: 'Disable add row',
    setValue: onChange('add_row_disabled')
  });
}

function GridDisableRemoveRow(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  return CheckboxEntry({
    element: field,
    getValue: getValue('remove_row_disabled'),
    id,
    label: 'Disable remove row (clear)',
    setValue: onChange('remove_row_disabled')
  });
}

function DynamicGrid(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  return CheckboxEntry({
    element: field,
    getValue: getValue('dynamic_grid'),
    id,
    label: 'Dynamic grid (import excel)',
    setValue: onChange('dynamic_grid')
  });
}


function MapSettingGroup(field, editField) {
  const {
    type
  } = field;
  if (type !== 'map') {
    return null;
  }
  if (!INPUTS.includes(type)) {
    return null;
  }
  const onChange = key => {
    return value => {
      const mapSetting = get(field, ['map_setting'], {});
      editField(field, ['map_setting'], set$1(mapSetting, [key], value));
    };
  };
  const getValue = key => {
    return () => {
      return get(field, ['map_setting', key])
    };
  };
  let entries = [{
    id: 'routing',
    component: MapRouting,
    getValue,
    field,
    isEdited: isEdited$5,
    onChange
  },
  {
    id: 'distance',
    component: MapDistance,
    getValue,
    field,
    isEdited: isEdited$5,
    onChange
  }];

  return {
    id: 'map_setting',
    label: 'Map setting',
    entries
  };
}

function MapRouting(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  return CheckboxEntry({
    element: field,
    getValue: getValue('routing'),
    id,
    label: 'Routing',
    setValue: onChange('routing')
  });
}

function MapDistance(props) {
  const {
    field,
    getValue,
    id,
    onChange
  } = props;
  return CheckboxEntry({
    element: field,
    getValue: getValue('distance'),
    id,
    label: 'Distance',
    setValue: onChange('distance')
  });
}

function ConditionGroup(field, editField) {
  const {
    type
  } = field;
  if (type === 'default') {
    return null;
  }
  const entries = [...ConditionEntry({
    field,
    editField
  })];
  return {
    id: 'condition',
    label: 'Condition',
    entries
  };
}

function getGroups(field, editField, getService) {
  if (!field) {
    return [];
  }
  const groups = [GeneralGroup(field, editField, getService), ConditionGroup(field, editField), LayoutGroup(field, editField), GridConfigGroup(field, editField), MapSettingGroup(field, editField), AppearanceGroup(field, editField), SerializationGroup(field, editField), ...ValuesGroups(field, editField), ConstraintsGroup(field, editField), ValidationGroup(field, editField), CustomPropertiesGroup(field, editField)];

  // contract: if a group returns null, it should not be displayed at all
  return groups.filter(group => group !== null);
}
function FormPropertiesPanel(props) {
  const {
    eventBus,
    injector
  } = props;
  const formEditor = injector.get('formEditor');
  const modeling = injector.get('modeling');
  const selectionModule = injector.get('selection');
  const propertiesPanelConfig = injector.get('config.propertiesPanel') || {};
  const {
    feelPopupContainer
  } = propertiesPanelConfig;
  const [state, setState] = useState({
    selectedFormField: selectionModule.get() || formEditor._getState().schema
  });
  const selectedFormField = state.selectedFormField;
  const refresh = useCallback(field => {
    // TODO(skaiir): rework state management, re-rendering the whole properties panel is not the way to go
    // https://github.com/bpmn-io/form-js/issues/686
    setState({
      selectedFormField: selectionModule.get() || formEditor._getState().schema
    });

    // notify interested parties on property panel updates
    eventBus.fire('propertiesPanel.updated', {
      formField: field
    });
  }, [eventBus, formEditor, selectionModule]);
  useLayoutEffect(() => {
    /**
     * TODO(pinussilvestrus): update with actual updated element,
     * once we have a proper updater/change support
     */
    eventBus.on('changed', refresh);
    eventBus.on('import.done', refresh);
    eventBus.on('selection.changed', refresh);
    return () => {
      eventBus.off('changed', refresh);
      eventBus.off('import.done', refresh);
      eventBus.off('selection.changed', refresh);
    };
  }, [eventBus, refresh]);
  const getService = (type, strict = true) => injector.get(type, strict);
  const propertiesPanelContext = {
    getService
  };
  const onFocus = () => eventBus.fire('propertiesPanel.focusin');
  const onBlur = () => eventBus.fire('propertiesPanel.focusout');
  const editField = useCallback((formField, key, value) => modeling.editFormField(formField, key, value), [modeling]);
  return jsx("div", {
    class: "fjs-properties-panel",
    "data-field": selectedFormField && selectedFormField.id,
    onFocusCapture: onFocus,
    onBlurCapture: onBlur,
    children: jsx(FormPropertiesPanelContext.Provider, {
      value: propertiesPanelContext,
      children: jsx(PropertiesPanel, {
        element: selectedFormField,
        eventBus: eventBus,
        groups: getGroups(selectedFormField, editField, getService),
        headerProvider: PropertiesPanelHeaderProvider,
        placeholderProvider: PropertiesPanelPlaceholderProvider,
        feelPopupContainer: feelPopupContainer
      })
    })
  });
}

class PropertiesPanelRenderer {
  constructor(propertiesPanelConfig, injector, eventBus) {
    const {
      parent
    } = propertiesPanelConfig || {};
    this._eventBus = eventBus;
    this._injector = injector;
    this._container = domify('<div class="fjs-properties-container" input-handle-modified-keys="y,z"></div>');
    if (parent) {
      this.attachTo(parent);
    }
    this._eventBus.once('formEditor.rendered', 500, () => {
      this._render();
    });
    getApisList()
  }

  /**
   * Attach the properties panel to a parent node.
   *
   * @param {HTMLElement} container
   */
  attachTo(container) {
    if (!container) {
      throw new Error('container required');
    }
    if (typeof container === 'string') {
      container = query(container);
    }

    // (1) detach from old parent
    this.detach();

    // (2) append to parent container
    container.appendChild(this._container);

    // (3) notify interested parties
    this._eventBus.fire('propertiesPanel.attach');
  }

  /**
   * Detach the properties panel from its parent node.
   */
  detach() {
    const parentNode = this._container.parentNode;
    if (parentNode) {
      parentNode.removeChild(this._container);
      this._eventBus.fire('propertiesPanel.detach');
    }
  }
  _render() {
    render(jsx(FormPropertiesPanel, {
      eventBus: this._eventBus,
      injector: this._injector
    }), this._container);
    this._eventBus.fire('propertiesPanel.rendered');
  }
  _destroy() {
    if (this._container) {
      render(null, this._container);
      this._eventBus.fire('propertiesPanel.destroyed');
    }
  }
}
PropertiesPanelRenderer.$inject = ['config.propertiesPanel', 'injector', 'eventBus'];

var PropertiesPanelModule = {
  __depends__: [index],
  __init__: ['propertiesPanel'],
  propertiesPanel: ['type', PropertiesPanelRenderer]
};

/**
 * Manages the rendering of visual plugins.
 * @constructor
 * @param {Object} eventBus - Event bus for the application.
 */
class RenderInjector extends SectionModuleBase {
  constructor(eventBus) {
    super(eventBus, 'renderInjector');
    this._eventBus = eventBus;
    this.registeredRenderers = [];
  }

  /**
   * Inject a new renderer into the injector.
   * @param {string} identifier - Identifier for the renderer.
   * @param {Function} Renderer - The renderer function.
   */
  attachRenderer(identifier, Renderer) {
    this.registeredRenderers = [...this.registeredRenderers, {
      identifier,
      Renderer
    }];
  }

  /**
   * Detach a renderer from the by key injector.
   * @param {string} identifier - Identifier for the renderer.
   */
  detachRenderer(identifier) {
    this.registeredRenderers = this.registeredRenderers.filter(r => r.identifier !== identifier);
  }

  /**
   * Returns the registered renderers.
   * @returns {Array} Array of registered renderers.
   */
  fetchRenderers() {
    return this.registeredRenderers;
  }
}
RenderInjector.$inject = ['eventBus'];

var RenderInjectionModule = {
  __init__: ['renderInjector'],
  renderInjector: ['type', RenderInjector]
};

class EditorTemplating {
  // same rules as viewer templating
  isTemplate(value) {
    return isString(value) && (value.startsWith('=') || /{{/.test(value));
  }

  // return the template raw, as we usually just want to display that
  evaluate(template) {
    return template;
  }
}
EditorTemplating.$inject = [];

var ExpressionLanguageModule = {
  __init__: ['expressionLanguage', 'templating'],
  expressionLanguage: ['type', FeelExpressionLanguage],
  templating: ['type', EditorTemplating]
};

const ids = new Ids([32, 36, 1]);

/**
 * @typedef { import('./types').Injector } Injector
 * @typedef { import('./types').Module } Module
 * @typedef { import('./types').Schema } Schema
 *
 * @typedef { import('./types').FormEditorOptions } FormEditorOptions
 * @typedef { import('./types').FormEditorProperties } FormEditorProperties
 *
 * @typedef { {
 *   properties: FormEditorProperties,
 *   schema: Schema
 * } } State
 *
 * @typedef { (type:string, priority:number, handler:Function) => void } OnEventWithPriority
 * @typedef { (type:string, handler:Function) => void } OnEventWithOutPriority
 * @typedef { OnEventWithPriority & OnEventWithOutPriority } OnEventType
 */

/**
 * The form editor.
 */
class FormEditor {
  /**
   * @constructor
   * @param {FormEditorOptions} options
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
    this._container.setAttribute('input-handle-modified-keys', 'z,y');
    const {
      container,
      exporter,
      injector = this._createInjector(options, this._container),
      properties = {}
    } = options;

    /**
     * @private
     * @type {any}
     */
    this.exporter = exporter;

    /**
     * @private
     * @type {State}
     */
    this._state = {
      properties,
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
  destroy() {
    // destroy form services
    this.get('eventBus').fire('form.destroy');

    // destroy diagram services (e.g. EventBus)
    this.get('eventBus').fire('diagram.destroy');
    this._detach(false);
  }

  /**
   * @param {Schema} schema
   *
   * @return {Promise<{ warnings: Array<any> }>}
   */
  importSchema(schema) {
    return new Promise((resolve, reject) => {
      try {
        this.clear();
        const {
          schema: importedSchema,
          warnings
        } = this.get('importer').importSchema(schema);
        this._setState({
          schema: importedSchema
        });
        this._emit('import.done', {
          warnings
        });
        return resolve({
          warnings
        });
      } catch (error) {
        this._emit('import.done', {
          error: error,
          warnings: error.warnings || []
        });
        return reject(error);
      }
    });
  }

  /**
   * @returns {Schema}
   */
  saveSchema() {
    return this.getSchema();
  }

  /**
   * @returns {Schema}
   */
  getSchema() {
    const {
      schema
    } = this._getState();
    return exportSchema(schema, this.exporter, schemaVersion);
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
   * @internal
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
   * @param {any} property
   * @param {any} value
   */
  setProperty(property, value) {
    const properties = set$1(this._getState().properties, [property], value);
    this._setState({
      properties
    });
  }

  /**
   * @param {string} type
   * @param {Function} handler
   */
  off(type, handler) {
    this.get('eventBus').off(type, handler);
  }

  /**
   * @internal
   *
   * @param {FormEditorOptions} options
   * @param {Element} container
   *
   * @returns {Injector}
   */
  _createInjector(options, container) {
    const {
      additionalModules = [],
      modules = this._getModules(),
      renderer = {}
    } = options;
    const config = {
      ...options,
      renderer: {
        ...renderer,
        container
      }
    };
    return createInjector([{
      config: ['value', config]
    }, {
      formEditor: ['value', this]
    }, core, ...modules, ...additionalModules]);
  }

  /**
   * @internal
   */
  _emit(type, data) {
    this.get('eventBus').fire(type, data);
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
    return [ModelingModule, EditorActionsModule, DraggingModule, KeyboardModule, SelectionModule, PaletteModule, ExpressionLanguageModule, MarkdownModule, PropertiesPanelModule, RenderInjectionModule];
  }

  /**
   * @internal
   */
  _onEvent(type, priority, handler) {
    this.get('eventBus').on(type, priority, handler);
  }
}

// helpers //////////

function exportSchema(schema, exporter, schemaVersion) {
  const exportDetails = exporter ? {
    exporter
  } : {};
  const cleanedSchema = clone(schema, (name, value) => {
    if (['_parent', '_path'].includes(name)) {
      return undefined;
    }
    return value;
  });
  return {
    ...cleanedSchema,
    ...exportDetails,
    schemaVersion
  };
}

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
function createFormEditor(options) {
  const {
    schema,
    ...rest
  } = options;
  const formEditor = new FormEditor(rest);
  return formEditor.importSchema(schema).then(() => {
    return formEditor;
  });
}

export { FormEditor, createFormEditor };
//# sourceMappingURL=index.es.js.map
