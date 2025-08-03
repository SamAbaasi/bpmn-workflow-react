import { options } from '../../../../static/scripts/packages/bpmn/properties-panel/preact/src/index.d';
import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';

import {
  createElement,
  createParameters,
  getParameters,
  getParametersExtension,
  nextId,
} from './util';

import ParameterProps from './groupsOutputProps';

import { without } from 'min-dash';

export default function GroupProps({
  element,
  injector,
  mainTagName,
  parameterTagName,
  activitiesList
}: any) {
  const parameters = getParameters(element, mainTagName) || [];
  const bpmnFactory = injector.get('bpmnFactory'),
    commandStack = injector.get('commandStack');

  const items = parameters.map((parameter: any, index: any) => {
    const id = element.id + '-' + parameterTagName + '-' + index;
    let options = [];
    let valuesSelectedAllParameters: any[] = []
    for (let i = 0; i < activitiesList.length ; i++) {
      const anotherParameters:any[] = parameters.filter((p:any) => p.name != parameter.name)
      anotherParameters.map(param => valuesSelectedAllParameters = [...param.value.split(','),...valuesSelectedAllParameters])
      const findSelectedOption = valuesSelectedAllParameters.findIndex(
        (el: any) => el.trim() == activitiesList[i].value.trim() && el.trim() != ''
      );
      if (findSelectedOption == -1) {
        options.push(activitiesList[i]);
      }
    }
    parameter.options = options;

    return {
      id,
      label: parameter.get('name') || '',
      entries: ParameterProps({
        idPrefix: id,
        element,
        parameter,
      }),
      autoFocusEntry: id + '-name',
      remove: removeFactory({ commandStack, element, parameter, mainTagName }),
    };
  });

  return {
    items,
    add: addFactory({
      element,
      bpmnFactory,
      commandStack,
      mainTagName,
      parameterTagName,
    }),
  };
}

function removeFactory({ commandStack, element, parameter, mainTagName }: any) {
  return function (event: any) {
    event.stopPropagation();

    const extension = getParametersExtension(element, mainTagName);

    if (!extension) {
      return;
    }

    const parameters = without(extension.get('values'), parameter);

    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: extension,
      properties: {
        values: parameters,
      },
    });
  };
}

function addFactory({
  element,
  bpmnFactory,
  commandStack,
  mainTagName,
  parameterTagName,
}: any) {
  return function (event: any) {
    event.stopPropagation();

    const commands = [];

    const businessObject = getBusinessObject(element);

    let extensionElements = businessObject.get('extensionElements');

    // (1) ensure extension elements
    if (!extensionElements) {
      extensionElements = createElement(
        'bpmn:ExtensionElements',
        { values: [] },
        businessObject,
        bpmnFactory
      );

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          element,
          moddleElement: businessObject,
          properties: { extensionElements },
        },
      });
    }

    // (2) ensure parameters extension
    let extension = getParametersExtension(element, mainTagName);

    if (!extension) {
      extension = createParameters(
        {
          values: [],
        },
        extensionElements,
        bpmnFactory,
        mainTagName
      );

      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          element,
          moddleElement: extensionElements,
          properties: {
            values: [...extensionElements.get('values'), extension],
          },
        },
      });
    }

    // (3) create parameter
    const newParameter = createElement(
      parameterTagName,
      {
        name: mainTagName == 'irancell:Groups' ? nextId(`Group`) : '',
        value: '',
      },
      extension,
      bpmnFactory
    );

    // (4) add parameter to list
    commands.push({
      cmd: 'element.updateModdleProperties',
      context: {
        element,
        moddleElement: extension,
        properties: {
          values: [...extension.get('values'), newParameter],
        },
      },
    });

    commandStack.execute('properties-panel.multi-command-executor', commands);
  };
}
