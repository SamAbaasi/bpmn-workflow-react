import Ids from 'ids';

import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';

export function getParametersExtension(element: any, tagName: string) {
  const businessObject = getBusinessObject(element);
  return getExtension(businessObject, tagName);
}

export function getParameters(element: any, tagName: string) {
  const parameters = getParametersExtension(element, tagName);
  return parameters && parameters.get('values');
}

export function getExtension(element: any, type: string) {
  if (!element.extensionElements) {
    return null;
  }
  return element.extensionElements.values.filter(function (e: any) {
    return e.$instanceOf(type);
  })[0];
}

export function createElement(
  elementType: string,
  properties: any,
  parent: any,
  factory: any
) {
  const element = factory.create(elementType, properties);

  if (parent) {
    element.$parent = parent;
  }

  return element;
}

export function createParameters(
  properties: any,
  parent: any,
  bpmnFactory: any,
  tagName: string
) {
  return createElement(tagName, properties, parent, bpmnFactory);
}

export function nextId(prefix: string) {
  const ids = new Ids([32, 32, 1]);

  return ids.nextPrefixed(prefix);
}
