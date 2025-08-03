import { html } from 'htm/preact';
import { useService } from '../../../../static/scripts/packages/processmaker/bpmn-js-properties-panel';
import { getBusinessObject } from 'bpmn-js/lib/util/ModelUtil';
import {
  TextAreaEntry,
  TextFieldEntry,
  SelectEntry,
  MultiSelectEntry,
  ToggleSwitchEntry,
} from '../../../../static/scripts/packages/processmaker/@bpmn-io/properties-panel';

var nodesValue: any[] = [];

export function addDataSender(props: any) {
  const modeling: any = useService('modeling');
  const translate: any = useService('translate');
  const debounce: any = useService('debounceInput');
  const moddle: any = useService('moddle');
  let htmlElement: any;

  const getValue = (value: any) => {
    const extensionElements: any[] =
      value?.businessObject?.extensionElements?.values;
    let result: any;
    const senderData = extensionElements?.find(
      (t) => t?.$type == 'irancell:Sender' && t?.$attrs?.parentNode == 'email'
    );
    result = senderData?.mailSender;
    return result;
  };

  const setValue = (value: any) => {
    const senderNode = moddle.create('irancell:Sender', {
      mailSender: value,
      parentNode: 'email',
      nodeId: 'mail',
    });
    let extensionElements = getBusinessObject(props.element).extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements');
      const findIndexSenderNode = nodesValue.findIndex(
        (node) =>
          node.elId == props.element.businessObject.id &&
          node.label == 'Mail sender' &&
          node.nodeId == 'mail'
      );
      if (findIndexSenderNode > -1) {
        nodesValue[findIndexSenderNode].node = senderNode;
      } else {
        nodesValue.push({
          elId: props.element.businessObject.id,
          label: 'Mail sender',
          node: senderNode,
          nodeId: 'mail',
        });
      }
      const nodesExtensionElements = nodesValue.filter(
        (node) => node.elId == props.element.businessObject.id
      );
      nodesExtensionElements.map((node) => {
        extensionElements.get('values').push(node.node);
      });
    } else {
      const findSender = extensionElements
        .get('values')
        .findIndex(
          (node: any) =>
            node?.$type == 'irancell:Sender' &&
            node?.$attrs?.nodeId == 'mail' &&
            node?.$attrs?.parentNode == 'email'
        );
      if (findSender > -1) {
        extensionElements.values[findSender].mailSender = value;
      } else {
        extensionElements.get('values').push(senderNode);
      }
    }
    modeling.updateProperties(props.element, {
      extensionElements,
    });
  };

  const validate = (value: any) => {
    if (!value) {
      return true;
    }
    return;
  };

  htmlElement = getTextElement(
    props,
    translate,
    getValue,
    setValue,
    debounce,
    validate
  );
  return htmlElement;
}

export function addUserReciver(props: any) {
  const modeling: any = useService('modeling');
  const translate: any = useService('translate');
  const debounce: any = useService('debounceInput');
  const moddle: any = useService('moddle');
  let htmlElement: any;

  // reciverUser
  const getValue = (value: any) => {
    const extensionElements: any[] =
      value?.businessObject?.extensionElements?.values;
    let result: any;
    const reciverUserData = extensionElements?.find(
      (t) =>
        t?.$type == 'irancell:Receiver' &&
        t?.$attrs?.nodeId == 'reciverUser' &&
        t?.$attrs?.parentNode == 'email'
    );
    result = reciverUserData?.reciverUser;
    return result;
  };

  const setValue = (value: any) => {
    const reciverUserNode = moddle.create('irancell:Receiver', {
      reciverUser: value,
      parentNode: 'email',
      nodeId: 'reciverUser',
    });
    let extensionElements = getBusinessObject(props.element).extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements');
      const findIndexReciverUserNode = nodesValue.findIndex(
        (node) =>
          node.elId == props.element.businessObject.id &&
          node.label == 'reciverUser' &&
          node.nodeId == 'reciverUser'
      );
      if (findIndexReciverUserNode > -1) {
        nodesValue[findIndexReciverUserNode].node = reciverUserNode;
      } else {
        nodesValue.push({
          elId: props.element.businessObject.id,
          label: 'reciverUser',
          node: reciverUserNode,
          nodeId: 'reciverUser',
        });
      }
      const nodesExtensionElements = nodesValue.filter(
        (node) => node.elId == props.element.businessObject.id
      );
      nodesExtensionElements.map((node) => {
        extensionElements.get('values').push(node.node);
      });
    } else {
      const findReciverUser = extensionElements
        .get('values')
        .findIndex(
          (node: any) =>
            node?.$type == 'irancell:Receiver' &&
            node?.$attrs?.nodeId == 'reciverUser' &&
            node?.$attrs?.parentNode == 'email'
        );
      if (findReciverUser > -1) {
        extensionElements.values[findReciverUser].reciverUser = value;
      } else {
        extensionElements.get('values').push(reciverUserNode);
      }
    }
    modeling.updateProperties(props.element, {
      extensionElements,
    });
  };

  const validate = (value: any) => {
    if (!value) {
      return true;
    }
    return;
  };

  htmlElement = getTextElement(
    props,
    translate,
    getValue,
    setValue,
    debounce,
    validate
  );
  return htmlElement;
}

export function addGroupReciver(props: any) {
  const modeling: any = useService('modeling');
  const translate: any = useService('translate');
  const debounce: any = useService('debounceInput');
  const moddle: any = useService('moddle');
  let htmlElement: any;

  // reciverGroup
  const getValue = (value: any) => {
    const extensionElements: any[] =
      value?.businessObject?.extensionElements?.values;
    let result: any;
    const reciverGroupeData = extensionElements?.find(
      (t) =>
        t?.$type == 'irancell:Receiver' &&
        t?.$attrs?.nodeId == 'reciverGroup' &&
        t?.$attrs?.parentNode == 'email'
    );
    result = reciverGroupeData?.reciverGroup;
    return result;
  };

  const setValue = (value: any) => {
    const reciverGroupNode = moddle.create('irancell:Receiver', {
      reciverGroup: value,
      parentNode: 'email',
      nodeId: 'reciverGroup',
    });
    let extensionElements = getBusinessObject(props.element).extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements');
      const findIndexReciverGroupNodeNode = nodesValue.findIndex(
        (node) =>
          node.elId == props.element.businessObject.id &&
          node.label == 'reciverGroup' &&
          node.nodeId == 'reciverGroup'
      );
      if (findIndexReciverGroupNodeNode > -1) {
        nodesValue[findIndexReciverGroupNodeNode].node = reciverGroupNode;
      } else {
        nodesValue.push({
          elId: props.element.businessObject.id,
          label: 'reciverGroup',
          node: reciverGroupNode,
          nodeId: 'reciverGroup',
        });
      }
      const nodesExtensionElements = nodesValue.filter(
        (node) => node.elId == props.element.businessObject.id
      );
      nodesExtensionElements.map((node) => {
        extensionElements.get('values').push(node.node);
      });
    } else {
      const findReciverGroup = extensionElements
        .get('values')
        .findIndex(
          (node: any) =>
            node?.$type == 'irancell:Receiver' &&
            node?.$attrs?.nodeId == 'reciverGroup' &&
            node?.$attrs?.parentNode == 'email'
        );
      if (findReciverGroup > -1) {
        extensionElements.values[findReciverGroup].reciverGroup = value;
      } else {
        extensionElements.get('values').push(reciverGroupNode);
      }
    }
    modeling.updateProperties(props.element, {
      extensionElements,
    });
  };

  const validate = (value: any) => {
    if (!value) {
      return true;
    }
    return;
  };

  htmlElement = getTextElement(
    props,
    translate,
    getValue,
    setValue,
    debounce,
    validate
  );
  return htmlElement;
}

export function addEmailReciever(props: any) {
  const modeling: any = useService('modeling');
  const translate: any = useService('translate');
  const debounce: any = useService('debounceInput');
  const moddle: any = useService('moddle');
  let htmlElement: any;

  // reciverUser
  const getValue = (value: any) => {
    const extensionElements: any[] =
      value?.businessObject?.extensionElements?.values;
    let result: any;
    const reciverEmailData = extensionElements?.find(
      (t) =>
        t?.$type == 'irancell:Receiver' &&
        t?.$attrs?.nodeId == 'reciverEmail' &&
        t?.$attrs?.parentNode == 'email'
    );
    result = reciverEmailData?.reciverEmail;
    return result;
  };

  const setValue = (value: any) => {
    const reciverEmailNode = moddle.create('irancell:Receiver', {
      reciverEmail: value,
      parentNode: 'email',
      nodeId: 'reciverEmail',
    });
    let extensionElements = getBusinessObject(props.element).extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements');
      const findIndexReciverEmailNode = nodesValue.findIndex(
        (node) =>
          node.elId == props.element.businessObject.id &&
          node.label == 'reciverEmail' &&
          node.nodeId == 'reciverEmail'
      );
      if (findIndexReciverEmailNode > -1) {
        nodesValue[findIndexReciverEmailNode].node = reciverEmailNode;
      } else {
        nodesValue.push({
          elId: props.element.businessObject.id,
          label: 'reciverEmail',
          node: reciverEmailNode,
          nodeId: 'reciverEmail',
        });
      }
      const nodesExtensionElements = nodesValue.filter(
        (node) => node.elId == props.element.businessObject.id
      );
      nodesExtensionElements.map((node) => {
        extensionElements.get('values').push(node.node);
      });
    } else {
      const findReciverEmail = extensionElements
        .get('values')
        .findIndex(
          (node: any) =>
            node?.$type == 'irancell:Receiver' &&
            node?.$attrs?.nodeId == 'reciverEmail' &&
            node?.$attrs?.parentNode == 'email'
        );
      if (findReciverEmail > -1) {
        extensionElements.values[findReciverEmail].reciverEmail = value;
      } else {
        extensionElements.get('values').push(reciverEmailNode);
      }
    }
    modeling.updateProperties(props.element, {
      extensionElements,
    });
  };

  const validate = (value: any) => {
    if (!value) {
      return true;
    }
    return;
  };

  htmlElement = getTextElement(
    props,
    translate,
    getValue,
    setValue,
    debounce,
    validate
  );
  return htmlElement;
}

export function addSubjectCompose(props: any) {
  const modeling: any = useService('modeling');
  const translate: any = useService('translate');
  const debounce: any = useService('debounceInput');
  const moddle: any = useService('moddle');
  let htmlElement: any;

  const getValue = (value: any) => {
    const extensionElements: any[] =
      value?.businessObject?.extensionElements?.values;
    let result: any;
    const subjetcComposeData = extensionElements?.find(
      (t) =>
        t?.$type == 'irancell:Compose' &&
        t?.$attrs?.nodeId == 'composeSubject' &&
        t?.$attrs?.parentNode == 'email'
    );
    result = subjetcComposeData?.composeSubject;
    return result;
  };

  const setValue = (value: any) => {
    const composeSubjectNode = moddle.create('irancell:Compose', {
      composeSubject: value,
      parentNode: 'email',
      nodeId: 'composeSubject',
    });
    let extensionElements = getBusinessObject(props.element).extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements');
      const findIndexComposeSubjectNode = nodesValue.findIndex(
        (node) =>
          node.elId == props.element.businessObject.id &&
          node.label == 'composeSubject' &&
          node.nodeId == 'composeSubject'
      );
      if (findIndexComposeSubjectNode > -1) {
        nodesValue[findIndexComposeSubjectNode].node = composeSubjectNode;
      } else {
        nodesValue.push({
          elId: props.element.businessObject.id,
          label: 'composeSubject',
          node: composeSubjectNode,
          nodeId: 'composeSubject',
        });
      }
      const nodesExtensionElements = nodesValue.filter(
        (node) => node.elId == props.element.businessObject.id
      );
      nodesExtensionElements.map((node) => {
        extensionElements.get('values').push(node.node);
      });
    } else {
      const findComposeSubject = extensionElements
        .get('values')
        .findIndex(
          (node: any) =>
            node?.$type == 'irancell:Compose' &&
            node?.$attrs?.nodeId == 'composeSubject' &&
            node?.$attrs?.parentNode == 'email'
        );
      if (findComposeSubject > -1) {
        extensionElements.values[findComposeSubject].composeSubject = value;
      } else {
        extensionElements.get('values').push(composeSubjectNode);
      }
    }
    modeling.updateProperties(props.element, {
      extensionElements,
    });
  };

  const validate = (value: any) => {
    if (!value) {
      return true;
    }
    return;
  };

  htmlElement = getTextElement(
    props,
    translate,
    getValue,
    setValue,
    debounce,
    validate
  );
  return htmlElement;
}

export function addBodyCompose(props: any) {
  const modeling: any = useService('modeling');
  const translate: any = useService('translate');
  const debounce: any = useService('debounceInput');
  const moddle: any = useService('moddle');
  let htmlElement: any;
  // composeBody
  const getValue = (value: any) => {
    const extensionElements: any[] =
      value?.businessObject?.extensionElements?.values;
    let result: any;
    const bodyComposeData = extensionElements?.find(
      (t) =>
        t?.$type == 'irancell:Compose' &&
        t?.$attrs?.nodeId == 'composeBody' &&
        t?.$attrs?.parentNode == 'email'
    );
    result = bodyComposeData?.composeBody;
    return result;
  };

  const setValue = (value: any) => {
    const composeBodytNode = moddle.create('irancell:Compose', {
      composeBody: value,
      parentNode: 'email',
      nodeId: 'composeBody',
    });
    let extensionElements = getBusinessObject(props.element).extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements');
      const findIndexComposeBodyNode = nodesValue.findIndex(
        (node) =>
          node.elId == props.element.businessObject.id &&
          node.label == 'composeBody' &&
          node.nodeId == 'composeBody'
      );
      if (findIndexComposeBodyNode > -1) {
        nodesValue[findIndexComposeBodyNode].node = composeBodytNode;
      } else {
        nodesValue.push({
          elId: props.element.businessObject.id,
          label: 'composeBody',
          node: composeBodytNode,
          nodeId: 'composeBody',
        });
      }
      const nodesExtensionElements = nodesValue.filter(
        (node) => node.elId == props.element.businessObject.id
      );
      nodesExtensionElements.map((node) => {
        extensionElements.get('values').push(node.node);
      });
    } else {
      const findComposeBody = extensionElements
        .get('values')
        .findIndex(
          (node: any) =>
            node?.$type == 'irancell:Compose' &&
            node?.$attrs?.nodeId == 'composeBody' &&
            node?.$attrs?.parentNode == 'email'
        );
      if (findComposeBody > -1) {
        extensionElements.values[findComposeBody].composeBody = value;
      } else {
        extensionElements.get('values').push(composeBodytNode);
      }
    }
    modeling.updateProperties(props.element, {
      extensionElements,
    });
  };

  const validate = (value: any) => {
    if (!value) {
      return true;
    }
    return;
  };

  htmlElement = getTextAreaEntry(
    props,
    translate,
    getValue,
    setValue,
    debounce,
    validate
  );
  return htmlElement;
}

export function addPyClassStartExecution(props: any) {
  const modeling: any = useService('modeling');
  const translate: any = useService('translate');
  const debounce: any = useService('debounceInput');
  const moddle: any = useService('moddle');
  let htmlElement: any;

  const getValue = (value: any) => {
    const extensionElements: any[] =
      value?.businessObject?.extensionElements?.values;
    let result: any;
    const startExecutionListenerData = extensionElements?.find(
      (t) => t?.$type == 'irancell:StartExecutionListener'
    );
    result = startExecutionListenerData?.class;
    return result;
  };

  const setValue = (value: any) => {
    const startExecutionListenerNode = moddle.create(
      'irancell:StartExecutionListener',
      {
        class: value,
        nodeId: 'pythonClass',
      }
    );
    let extensionElements = getBusinessObject(props.element).extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements');
      const findIndexStartExecutionListenerNode = nodesValue.findIndex(
        (node) =>
          node.elId == props.element.businessObject.id &&
          node.label == 'pythonClassStartExecutionListener' &&
          node.nodeId == 'pythonClass'
      );
      if (findIndexStartExecutionListenerNode > -1) {
        nodesValue[findIndexStartExecutionListenerNode].node =
          startExecutionListenerNode;
      } else {
        nodesValue.push({
          elId: props.element.businessObject.id,
          label: 'pythonClassStartExecutionListener',
          node: startExecutionListenerNode,
          nodeId: 'pythonClass',
        });
      }
      const nodesExtensionElements = nodesValue.filter(
        (node) => node.elId == props.element.businessObject.id
      );
      nodesExtensionElements.map((node) => {
        extensionElements.get('values').push(node.node);
      });
    } else {
      extensionElements.get('values').push(startExecutionListenerNode);
    }
    modeling.updateProperties(props.element, {
      extensionElements,
    });
  };

  const validate = (value: any) => {
    if (!value) {
      return true;
    }
    return;
  };

  const getOptions = () => {
    return props.options;
  };

  htmlElement = getSelectbox(
    props,
    translate,
    getValue,
    setValue,
    debounce,
    validate,
    getOptions,
    false,
    'Python Class',
    ''
  );
  return htmlElement;
}

export function addPyClassEndExecution(props: any) {
  const modeling: any = useService('modeling');
  const translate: any = useService('translate');
  const debounce: any = useService('debounceInput');
  const moddle: any = useService('moddle');
  let htmlElement: any;

  const getValue = (value: any) => {
    const extensionElements: any[] =
      value?.businessObject?.extensionElements?.values;
    let result: any;
    const endExecutionListenerData = extensionElements?.find(
      (t) => t?.$type == 'irancell:EndExecutionListener'
    );
    result = endExecutionListenerData?.class;
    return result;
  };

  const setValue = (value: any) => {
    const endExecutionListenerNode = moddle.create(
      'irancell:EndExecutionListener',
      {
        class: value,
        nodeId: 'pythonClass',
      }
    );
    let extensionElements = getBusinessObject(props.element).extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements');
      const findIndexEndExecutionListenerNode = nodesValue.findIndex(
        (node) =>
          node.elId == props.element.businessObject.id &&
          node.label == 'pythonClassEndExecutionListener' &&
          node.nodeId == 'pythonClass'
      );
      if (findIndexEndExecutionListenerNode > -1) {
        nodesValue[findIndexEndExecutionListenerNode].node =
          endExecutionListenerNode;
      } else {
        nodesValue.push({
          elId: props.element.businessObject.id,
          label: 'pythonClassEndExecutionListener',
          node: endExecutionListenerNode,
          nodeId: 'pythonClass',
        });
      }
      const nodesExtensionElements = nodesValue.filter(
        (node) => node.elId == props.element.businessObject.id
      );
      nodesExtensionElements.map((node) => {
        extensionElements.get('values').push(node.node);
      });
    } else {
      extensionElements.get('values').push(endExecutionListenerNode);
    }
    modeling.updateProperties(props.element, {
      extensionElements,
    });
  };

  const validate = (value: any) => {
    if (!value) {
      return true;
    }
    return;
  };

  const getOptions = () => {
    return props.options;
  };

  htmlElement = getSelectbox(
    props,
    translate,
    getValue,
    setValue,
    debounce,
    validate,
    getOptions,
    false,
    'Python Class',
    ''
  );
  return htmlElement;
}

export function addFormName(props: any) {
  const modeling: any = useService('modeling');
  const translate: any = useService('translate');
  const debounce: any = useService('debounceInput');
  const moddle: any = useService('moddle');
  let htmlElement: any;

  // addFormName
  const getValue = (value: any) => {
    const extensionElements: any[] =
      value?.businessObject?.extensionElements?.values;
    let result: any;
    const formNameData = extensionElements?.find(
      (t) => t?.$type == 'irancell:Form' && t?.$attrs?.nodeId == 'formName'
    );
    result = formNameData?.formName;
    return result;
  };

  const setValue = (value: any) => {
    const formNameNode = moddle.create('irancell:Form', {
      formName: value,
      nodeId: 'formName',
    });
    let extensionElements = getBusinessObject(props.element).extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements');
      const findIndexFormNameNode = nodesValue.findIndex(
        (node) =>
          node.elId == props.element.businessObject.id &&
          node.label == 'formName' &&
          node.nodeId == 'formName'
      );
      if (findIndexFormNameNode > -1) {
        nodesValue[findIndexFormNameNode].node = formNameNode;
      } else {
        nodesValue.push({
          elId: props.element.businessObject.id,
          label: 'formName',
          node: formNameNode,
          nodeId: 'formName',
        });
      }
      const nodesExtensionElements = nodesValue.filter(
        (node) => node.elId == props.element.businessObject.id
      );
      nodesExtensionElements.map((node) => {
        extensionElements.get('values').push(node.node);
      });
    } else {
      const findFormName = extensionElements
        .get('values')
        .findIndex(
          (node: any) =>
            node?.$type == 'irancell:Form' && node?.$attrs?.nodeId == 'formName'
        );
      if (findFormName > -1) {
        extensionElements.values[findFormName].formName = value;
      } else {
        extensionElements.get('values').push(formNameNode);
      }
    }
    modeling.updateProperties(props.element, {
      extensionElements,
    });
  };

  const validate = (value: any) => {
    if (!value) {
      return true;
    }
    return;
  };

  const getOptions = () => {
    return props.options;
  };

  const disabled = () => {
    const findActivity =
      props.element.businessObject?.extensionElements?.values.find(
        (value: any) => value.activity
      );
    const findFormName =
      props.element.businessObject?.extensionElements?.values.find(
        (value: any) => value.formName
      );
    if (findFormName && findActivity) {
      setValue(null);
    }
    if (!findFormName) {
      nodesValue.map((nodes, index) => {
        if (nodes.node.activity == props.element.id) {
          nodes.node.activity = '';
        }
      });
    }
    return findActivity ? true : false;
  };

  htmlElement = getSelectbox(
    props,
    translate,
    getValue,
    setValue,
    debounce,
    validate,
    getOptions,
    disabled() ? true : false,
    'Form List',
    ''
  );
  return htmlElement;
}

export function addTags(props: any) {
  const modeling: any = useService('modeling');
  const translate: any = useService('translate');
  const debounce: any = useService('debounceInput');
  const moddle: any = useService('moddle');
  let htmlElement: any;

  const getValue = (value: any) => {
    const extensionElements: any[] =
      value?.businessObject?.extensionElements?.values;
    let result: any;
    const tagData = extensionElements?.find(
      (t) =>
        t?.$type == 'irancell:WFM' &&
        t?.$attrs?.nodeId == 'tag' &&
        t?.$attrs?.parentNode == 'WFM'
    );
    result = tagData?.tag;
    if(!tagData?.tag || tagData?.tag == ''){
     const findIndexOnlineOfflineNode = extensionElements?.findIndex(
        (t) =>
          t?.$type == 'irancell:WFM' &&
          t?.$attrs?.nodeId == 'offline' &&
          t?.$attrs?.parentNode == 'WFM'
      );
      if(findIndexOnlineOfflineNode>-1) extensionElements.splice(findIndexOnlineOfflineNode,1)
    }
    return result;
  };

  const setValue = (value: any) => {
    const tagNode = moddle.create('irancell:WFM', {
      tag: value,
      parentNode: 'WFM',
      nodeId: 'tag',
    });
    let extensionElements = getBusinessObject(props.element).extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements');
      const findIndexTagNode = nodesValue.findIndex(
        (node) =>
          node.elId == props.element.businessObject.id &&
          node.label == 'tag' &&
          node.nodeId == 'tag'
      );
      if (findIndexTagNode > -1) {
        nodesValue[findIndexTagNode].node = tagNode;
      } else {
        nodesValue.push({
          elId: props.element.businessObject.id,
          label: 'tag',
          node: tagNode,
          nodeId: 'tag',
        });
      }
      const nodesExtensionElements = nodesValue.filter(
        (node) => node.elId == props.element.businessObject.id
      );
      nodesExtensionElements.map((node) => {
        extensionElements.get('values').push(node.node);
      });
    } else {
      const findTag = extensionElements
        .get('values')
        .findIndex(
          (node: any) =>
            node?.$type == 'irancell:WFM' &&
            node?.$attrs?.nodeId == 'tag' &&
            node?.$attrs?.parentNode == 'WFM'
        );
      if (findTag > -1) {
        extensionElements.values[findTag].tag = value;
      } else {
        extensionElements.get('values').push(tagNode);
      }
    }
  //  console.log('tagNode',tagNode);

      //     nodesValue.map((nodes, index) => {
  //       if (nodes.node.activity == props.element.id) {
  //         nodes.node.activity = '';
  //       }
  //     });
    modeling.updateProperties(props.element, {
      extensionElements,
    });
  };

  const validate = (value: any) => {
    if (!value) {
      return true;
    }
    return;
  };

  const getOptions = () => {
    return props.options;
  };

  htmlElement = getMultiselect(
    props,
    translate,
    getValue,
    setValue,
    debounce,
    validate,
    getOptions,
    false,
    'Tags',
    '/api/tag/'
    // disabled() ? true : false
  );
  return htmlElement;
}

export function addTaskType(props: any) {
  const modeling: any = useService('modeling');
  const translate: any = useService('translate');
  const debounce: any = useService('debounceInput');
  const moddle: any = useService('moddle');
  let htmlElement: any;

  const getValue = (value: any) => {
    const extensionElements: any[] =
      value?.businessObject?.extensionElements?.values;
    let result: any;
    const taskTypeData = extensionElements?.find(
      (t) =>
        t?.$type == 'irancell:WFM' &&
        t?.$attrs?.nodeId == 'taskType' &&
        t?.$attrs?.parentNode == 'WFM'
    );
    result = taskTypeData?.taskType;
    return result;
  };

  const setValue = (value: any) => {
    const taskTypeNode = moddle.create('irancell:WFM', {
      taskType: value,
      parentNode: 'WFM',
      nodeId: 'taskType',
    });
    let extensionElements = getBusinessObject(props.element).extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements');
      const findIndexTaskTypeNode = nodesValue.findIndex(
        (node) =>
          node.elId == props.element.businessObject.id &&
          node.label == 'taskType' &&
          node.nodeId == 'taskType'
      );
      if (findIndexTaskTypeNode > -1) {
        nodesValue[findIndexTaskTypeNode].node = taskTypeNode;
      } else {
        nodesValue.push({
          elId: props.element.businessObject.id,
          label: 'taskType',
          node: taskTypeNode,
          nodeId: 'taskType',
        });
      }
      const nodesExtensionElements = nodesValue.filter(
        (node) => node.elId == props.element.businessObject.id
      );
      nodesExtensionElements.map((node) => {
        extensionElements.get('values').push(node.node);
      });
    } else {
      const findTaskType = extensionElements
        .get('values')
        .findIndex(
          (node: any) =>
            node?.$type == 'irancell:WFM' &&
            node?.$attrs?.nodeId == 'taskType' &&
            node?.$attrs?.parentNode == 'WFM'
        );
      if (findTaskType > -1) {
        extensionElements.values[findTaskType].taskType = value;
      } else {
        extensionElements.get('values').push(taskTypeNode);
      }
    }
    modeling.updateProperties(props.element, {
      extensionElements,
    });
  };

  const validate = (value: any) => {
    if (!value) {
      return true;
    }
    return;
  };

  const getOptions = () => {
    return props.options;
  };


  htmlElement = getSelectbox(
    props,
    translate,
    getValue,
    setValue,
    debounce,
    validate,
    getOptions,
    false,
    'Task Type',
    '/api/tasks/'
    // disabled() ? true : false
  );
  return htmlElement;
}


//in
export function addOnlineOffline(props: any) {
  const modeling: any = useService('modeling');
  const translate: any = useService('translate');
  const debounce: any = useService('debounceInput');
  const moddle: any = useService('moddle');
  let htmlElement: any;

  const getValue = (value: any) => {
    const extensionElements: any[] =
      value?.businessObject?.extensionElements?.values;
    let result: any;
    const onlineOfflineData = extensionElements?.find(
      (t) =>
        t?.$type == 'irancell:WFM' &&
        t?.$attrs?.nodeId == 'offline' &&
        t?.$attrs?.parentNode == 'WFM'
    );
    result = onlineOfflineData?.offline;
    return result;
  };

  const setValue = (value: any) => {
    const onlineOfflineNode = moddle.create('irancell:WFM', {
      offline: value,
      parentNode: 'WFM',
      nodeId: 'offline',
    });
    let extensionElements = getBusinessObject(props.element).extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements');
      const findIndexOnlineOfflineNode = nodesValue.findIndex(
        (node) =>
          node.elId == props.element.businessObject.id &&
          node.label == 'offline' &&
          node.nodeId == 'offline'
      );
      if (findIndexOnlineOfflineNode > -1) {
        nodesValue[findIndexOnlineOfflineNode].node = onlineOfflineNode;
      } else {
        nodesValue.push({
          elId: props.element.businessObject.id,
          label: 'offline',
          node: onlineOfflineNode,
          nodeId: 'offline',
        });
      }
      const nodesExtensionElements = nodesValue.filter(
        (node) => node.elId == props.element.businessObject.id
      );
      nodesExtensionElements.map((node) => {
        extensionElements.get('values').push(node.node);
      });
    } else {
      const findOnlineOffline = extensionElements
        .get('values')
        .findIndex(
          (node: any) =>
            node?.$type == 'irancell:WFM' &&
            node?.$attrs?.nodeId == 'offline' &&
            node?.$attrs?.parentNode == 'WFM'
        );
      if (findOnlineOffline > -1) {
        extensionElements.values[findOnlineOffline].offline = value;
      } else {
        extensionElements.get('values').push(onlineOfflineNode);
      }
    }
    modeling.updateProperties(props.element, {
      extensionElements,
    });
  };

  const showEl = () => {
    const findTags =
      props.element.businessObject?.extensionElements?.values.find(
        (value: any) => value.tag
      );
  //   const findFormName =
  //     props.element.businessObject?.extensionElements?.values.find(
  //       (value: any) => value.formName
  //     );
  //   if (findFormName && findActivity) {
  //     setValue(null);
  //   }
  //   if (!findFormName) {
  //     nodesValue.map((nodes, index) => {
  //       if (nodes.node.activity == props.element.id) {
  //         nodes.node.activity = '';
  //       }
  //     });
  //   }
    return findTags ? true : false;
  };

  if(showEl()){
    htmlElement = getRadio(
      props,
      translate,
      getValue,
      setValue,
      '',
      ['offline']
    );
  }
  return htmlElement;
}

export function addFormActivity(props: any) {
  const modeling: any = useService('modeling');
  const translate: any = useService('translate');
  const debounce: any = useService('debounceInput');
  const moddle: any = useService('moddle');
  let htmlElement: any;

  // addFormActivity
  const getValue = (value: any) => {
    const extensionElements: any[] =
      value?.businessObject?.extensionElements?.values;
    let result: any;
    const activityData = extensionElements?.find(
      (t) => t?.$type == 'irancell:Form' && t?.$attrs?.nodeId == 'activity'
    );
    result = activityData?.activity;
    return result;
  };

  const setValue = (value: any) => {
    const activityNode = moddle.create('irancell:Form', {
      activity: value,
      nodeId: 'activity',
    });
    let extensionElements = getBusinessObject(props.element).extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements');
      const findIndexactivityNode = nodesValue.findIndex(
        (node) =>
          node.elId == props.element.businessObject.id &&
          node.label == 'activity' &&
          node.nodeId == 'activity'
      );
      if (findIndexactivityNode > -1) {
        nodesValue[findIndexactivityNode].node = activityNode;
      } else {
        nodesValue.push({
          elId: props.element.businessObject.id,
          label: 'activity',
          node: activityNode,
          nodeId: 'activity',
        });
      }
      const nodesExtensionElements = nodesValue.filter(
        (node) => node.elId == props.element.businessObject.id
      );
      nodesExtensionElements.map((node) => {
        extensionElements.get('values').push(node.node);
      });
    } else {
      const findactivity = extensionElements
        .get('values')
        .findIndex(
          (node: any) =>
            node?.$type == 'irancell:Form' && node?.$attrs?.nodeId == 'activity'
        );
      if (findactivity > -1) {
        extensionElements.values[findactivity].activity = value;
      } else {
        extensionElements.get('values').push(activityNode);
      }
    }
    modeling.updateProperties(props.element, {
      extensionElements,
    });
  };

  const validate = (value: any) => {
    if (!value) {
      return true;
    }
    return;
  };

  const getOptions = () => {
    let optionsActivity = props.options.filter(
      (res: any) => res.label !== props.element.id
    );
    return optionsActivity;
  };

  const disabled = () => {
    const findFormName =
      props.element.businessObject?.extensionElements?.values.find(
        (value: any) => value.formName
      );
    const findActivity =
      props.element.businessObject?.extensionElements?.values.find(
        (value: any) => value.activity
      );
    if (findFormName && findActivity) {
      setValue(null);
    }

    return findFormName ? true : false;
  };

  htmlElement = getSelectbox(
    props,
    translate,
    getValue,
    setValue,
    debounce,
    validate,
    getOptions,
    disabled() ? true : false,
    'Activity List',
    ''
  );
  return htmlElement;
}

export function messageType(props: any) {
  const modeling: any = useService('modeling');
  const translate: any = useService('translate');
  const debounce: any = useService('debounceInput');
  const moddle: any = useService('moddle');
  let htmlElement: any;

  const getValue = (value: any) => {
    const extensionElements: any[] =
      value?.businessObject?.extensionElements?.values;
    let result: any;
    const massageTypeData = extensionElements?.find(
      (t) => t?.$type == 'irancell:MessageType'
    );
    result = massageTypeData?.$attrs?.data;
    return result;
  };

  const setValue = (value: any) => {
    const massageTypeNode = moddle.create('irancell:MessageType', {
      data: value,
      nodeId: 'messageTypeSelected',
    });
    let extensionElements = getBusinessObject(props.element).extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements');
      const findIndexMessageTypeNode = nodesValue.findIndex(
        (node) =>
          node.elId == props.element.businessObject.id &&
          node.label == 'messageType' &&
          node.nodeId == 'messageTypeSelected'
      );
      if (findIndexMessageTypeNode > -1) {
        nodesValue[findIndexMessageTypeNode].node = massageTypeNode;
      } else {
        nodesValue.push({
          elId: props.element.businessObject.id,
          label: 'messageType',
          node: massageTypeNode,
          nodeId: 'messageTypeSelected',
        });
      }
      const nodesExtensionElements = nodesValue.filter(
        (node) => node.elId == props.element.businessObject.id
      );
      nodesExtensionElements.map((node) => {
        extensionElements.get('values').push(node.node);
      });
    } else {
      const findMessageType = extensionElements
        .get('values')
        .findIndex(
          (node: any) =>
            node?.$type == 'irancell:MessageType' &&
            node?.$attrs?.nodeId == 'messageTypeSelected'
        );
      if (findMessageType > -1) {
        extensionElements.values[findMessageType].$attrs.data = value;
      } else {
        extensionElements.get('values').push(findMessageType);
      }

      // const nodesExtensionElements = nodesValue.filter(
      //   (node) => node.elId == props.element.businessObject.id
      // );
      // nodesExtensionElements.map((node) => {
      //   extensionElements.get('values').push(node.node);
      // });
    }
    modeling.updateProperties(props.element, {
      extensionElements,
    });
  };

  const validate = (value: any) => {
    if (!value) {
      return true;
    }
    return;
  };

  const getOptions = () => {
    return props.options;
  };

  htmlElement = getSelectbox(
    props,
    translate,
    getValue,
    setValue,
    debounce,
    validate,
    getOptions,
    false,
    'Type',
    ''
  );
  return htmlElement;
}

export function addGroupReciverForSMS(props: any) {
  const modeling: any = useService('modeling');
  const translate: any = useService('translate');
  const debounce: any = useService('debounceInput');
  const moddle: any = useService('moddle');
  let htmlElement: any;

  // reciverGroup
  const getValue = (value: any) => {
    const extensionElements: any[] =
      value?.businessObject?.extensionElements?.values;
    let result: any;
    const reciverGroupForSMSData = extensionElements?.find(
      (t) =>
        t?.$type == 'irancell:SMSConfiguration' &&
        t?.$attrs?.nodeId == 'reciverGroupForSMS' &&
        t?.$attrs?.parentNode == 'sms'
    );
    result = reciverGroupForSMSData?.reciverGroupForSMS;
    return result;
  };

  const setValue = (value: any) => {
    const reciverGroupForSMSNode = moddle.create('irancell:SMSConfiguration', {
      reciverGroupForSMS: value,
      parentNode: 'sms',
      nodeId: 'reciverGroupForSMS',
    });
    let extensionElements = getBusinessObject(props.element).extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements');
      const findIndexReciverGroupForSMSNode = nodesValue.findIndex(
        (node) =>
          node.elId == props.element.businessObject.id &&
          node.label == 'reciverGroupForSMS' &&
          node.nodeId == 'reciverGroupForSMS'
      );
      if (findIndexReciverGroupForSMSNode > -1) {
        nodesValue[findIndexReciverGroupForSMSNode].node =
          reciverGroupForSMSNode;
      } else {
        nodesValue.push({
          elId: props.element.businessObject.id,
          label: 'reciverGroupForSMS',
          node: reciverGroupForSMSNode,
          nodeId: 'reciverGroupForSMS',
        });
      }
      const nodesExtensionElements = nodesValue.filter(
        (node) => node.elId == props.element.businessObject.id
      );
      nodesExtensionElements.map((node) => {
        extensionElements.get('values').push(node.node);
      });
    } else {
      const findReciverGroupForSMS = extensionElements
        .get('values')
        .findIndex(
          (node: any) =>
            node?.$type == 'irancell:SMSConfiguration' &&
            node?.$attrs?.nodeId == 'reciverGroupForSMS' &&
            node?.$attrs?.parentNode == 'sms'
        );
      if (findReciverGroupForSMS > -1) {
        extensionElements.values[findReciverGroupForSMS].reciverGroupForSMS =
          value;
      } else {
        extensionElements.get('values').push(reciverGroupForSMSNode);
      }
    }
    modeling.updateProperties(props.element, {
      extensionElements,
    });
  };

  const validate = (value: any) => {
    if (!value) {
      return true;
    }
    return;
  };

  htmlElement = getTextElement(
    props,
    translate,
    getValue,
    setValue,
    debounce,
    validate
  );
  return htmlElement;
}

export function addUserReciverForSMS(props: any) {
  const modeling: any = useService('modeling');
  const translate: any = useService('translate');
  const debounce: any = useService('debounceInput');
  const moddle: any = useService('moddle');
  let htmlElement: any;

  // reciverGroup
  const getValue = (value: any) => {
    const extensionElements: any[] =
      value?.businessObject?.extensionElements?.values;
    let result: any;
    const reciverUserForSMSData = extensionElements?.find(
      (t) =>
        t?.$type == 'irancell:SMSConfiguration' &&
        t?.$attrs?.nodeId == 'reciverUserForSMS' &&
        t?.$attrs?.parentNode == 'sms'
    );
    result = reciverUserForSMSData?.reciverUserForSMS;
    return result;
  };

  const setValue = (value: any) => {
    const reciverUserForSMSNode = moddle.create('irancell:SMSConfiguration', {
      reciverUserForSMS: value,
      parentNode: 'sms',
      nodeId: 'reciverUserForSMS',
    });
    let extensionElements = getBusinessObject(props.element).extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements');
      const findIndexReciverUserForSMSNode = nodesValue.findIndex(
        (node) =>
          node.elId == props.element.businessObject.id &&
          node.label == 'reciverUserForSMS' &&
          node.nodeId == 'reciverUserForSMS'
      );
      if (findIndexReciverUserForSMSNode > -1) {
        nodesValue[findIndexReciverUserForSMSNode].node = reciverUserForSMSNode;
      } else {
        nodesValue.push({
          elId: props.element.businessObject.id,
          label: 'reciverUserForSMS',
          node: reciverUserForSMSNode,
          nodeId: 'reciverUserForSMS',
        });
      }
      const nodesExtensionElements = nodesValue.filter(
        (node) => node.elId == props.element.businessObject.id
      );
      nodesExtensionElements.map((node) => {
        extensionElements.get('values').push(node.node);
      });
    } else {
      const findReciverUserForSMS = extensionElements
        .get('values')
        .findIndex(
          (node: any) =>
            node?.$type == 'irancell:SMSConfiguration' &&
            node?.$attrs?.nodeId == 'reciverUserForSMS' &&
            node?.$attrs?.parentNode == 'sms'
        );
      if (findReciverUserForSMS > -1) {
        extensionElements.values[findReciverUserForSMS].reciverUserForSMS =
          value;
      } else {
        extensionElements.get('values').push(reciverUserForSMSNode);
      }
    }
    modeling.updateProperties(props.element, {
      extensionElements,
    });
  };

  const validate = (value: any) => {
    if (!value) {
      return true;
    }
    return;
  };

  htmlElement = getTextElement(
    props,
    translate,
    getValue,
    setValue,
    debounce,
    validate
  );
  return htmlElement;
}

export function addNumberReciverForSMS(props: any) {
  const modeling: any = useService('modeling');
  const translate: any = useService('translate');
  const debounce: any = useService('debounceInput');
  const moddle: any = useService('moddle');
  let htmlElement: any;

  // reciverGroup
  const getValue = (value: any) => {
    const extensionElements: any[] =
      value?.businessObject?.extensionElements?.values;
    let result: any;
    const reciverNumberForSMSData = extensionElements?.find(
      (t) =>
        t?.$type == 'irancell:SMSConfiguration' &&
        t?.$attrs?.nodeId == 'reciverNumberForSMS' &&
        t?.$attrs?.parentNode == 'sms'
    );
    result = reciverNumberForSMSData?.reciverNumberForSMS;
    return result;
  };

  const setValue = (value: any) => {
    const reciverNumberForSMSNode = moddle.create('irancell:SMSConfiguration', {
      reciverNumberForSMS: value,
      parentNode: 'sms',
      nodeId: 'reciverNumberForSMS',
      label: 'reciverNumberForSMS',
    });
    let extensionElements = getBusinessObject(props.element).extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements');
      const findIndexreciverNumberForSMSNode = nodesValue.findIndex(
        (node) =>
          node.elId == props.element.businessObject.id &&
          node.label == 'reciverNumberForSMS' &&
          node.nodeId == 'reciverNumberForSMS' &&
          node.parentNode == 'sms'
      );
      if (findIndexreciverNumberForSMSNode > -1) {
        nodesValue[findIndexreciverNumberForSMSNode].node =
          reciverNumberForSMSNode;
      } else {
        nodesValue.push({
          elId: props.element.businessObject.id,
          label: 'reciverNumberForSMS',
          node: reciverNumberForSMSNode,
          nodeId: 'reciverNumberForSMS',
          parentNode: 'sms',
        });
      }
      const nodesExtensionElements = nodesValue.filter(
        (node) => node.elId == props.element.businessObject.id
      );
      nodesExtensionElements.map((node) => {
        extensionElements.get('values').push(node.node);
      });
    } else {
      const findReciverNumberForSMS = extensionElements
        .get('values')
        .findIndex(
          (node: any) =>
            node?.$type == 'irancell:SMSConfiguration' &&
            node?.$attrs?.nodeId == 'reciverNumberForSMS' &&
            node?.$attrs?.parentNode == 'sms'
        );
      if (findReciverNumberForSMS > -1) {
        extensionElements.values[findReciverNumberForSMS].reciverNumberForSMS =
          value;
      } else {
        extensionElements.get('values').push(reciverNumberForSMSNode);
      }
    }
    modeling.updateProperties(props.element, {
      extensionElements,
    });
  };

  const validate = (value: any) => {
    if (!value) {
      return true;
    }
    return;
  };

  htmlElement = getTextElement(
    props,
    translate,
    getValue,
    setValue,
    debounce,
    validate
  );
  return htmlElement;
}

export function addMessageTextSMS(props: any) {
  const modeling: any = useService('modeling');
  const translate: any = useService('translate');
  const debounce: any = useService('debounceInput');
  const moddle: any = useService('moddle');
  let htmlElement: any;
  // composeBody
  const getValue = (value: any) => {
    const extensionElements: any[] =
      value?.businessObject?.extensionElements?.values;
    let result: any;
    const messageTextForSMSData = extensionElements?.find(
      (t) =>
        t?.$type == 'irancell:SMSConfiguration' &&
        t?.$attrs?.nodeId == 'messageTextForSMS' &&
        t?.$attrs?.parentNode == 'sms'
    );
    result = messageTextForSMSData?.messageTextForSMS;
    return result;
  };

  const setValue = (value: any) => {
    const messageTextForSMSNode = moddle.create('irancell:SMSConfiguration', {
      messageTextForSMS: value,
      parentNode: 'sms',
      nodeId: 'messageTextForSMS',
    });
    let extensionElements = getBusinessObject(props.element).extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements');
      const findIndexMessageTextForSMSNode = nodesValue.findIndex(
        (node) =>
          node.elId == props.element.businessObject.id &&
          node.label == 'messageTextForSMS' &&
          node.nodeId == 'messageTextForSMS'
      );
      if (findIndexMessageTextForSMSNode > -1) {
        nodesValue[findIndexMessageTextForSMSNode].node = messageTextForSMSNode;
      } else {
        nodesValue.push({
          elId: props.element.businessObject.id,
          label: 'messageTextForSMS',
          node: messageTextForSMSNode,
          nodeId: 'messageTextForSMS',
        });
      }
      const nodesExtensionElements = nodesValue.filter(
        (node) => node.elId == props.element.businessObject.id
      );
      nodesExtensionElements.map((node) => {
        extensionElements.get('values').push(node.node);
      });
    } else {
      const findMessageTextForSMS = extensionElements
        .get('values')
        .findIndex(
          (node: any) =>
            node?.$type == 'irancell:SMSConfiguration' &&
            node?.$attrs?.nodeId == 'messageTextForSMS' &&
            node?.$attrs?.parentNode == 'sms'
        );
      if (findMessageTextForSMS > -1) {
        extensionElements.values[findMessageTextForSMS].messageTextForSMS =
          value;
      } else {
        extensionElements.get('values').push(messageTextForSMSNode);
      }
    }
    modeling.updateProperties(props.element, {
      extensionElements,
    });
  };

  const validate = (value: any) => {
    if (!value) {
      return true;
    }
    return;
  };

  htmlElement = getTextAreaEntry(
    props,
    translate,
    getValue,
    setValue,
    debounce,
    validate
  );
  return htmlElement;
}

export function addSite(props: any) {
  const modeling: any = useService('modeling');
  const translate: any = useService('translate');
  const debounce: any = useService('debounceInput');
  const moddle: any = useService('moddle');
  let htmlElement: any;

  // reciverUser
  const getValue = (value: any) => {
    const extensionElements: any[] =
      value?.businessObject?.extensionElements?.values;
    let result: any;
    const siteData = extensionElements?.find(
      (t) =>
        t?.$type == 'irancell:Variables' &&
        t?.$attrs?.nodeId == 'site' &&
        t?.$attrs?.parentNode == 'variables'
    );
    result = siteData?.site;
    return result;
  };

  const setValue = (value: any) => {
    const siteNode = moddle.create('irancell:Variables', {
      site: value,
      parentNode: 'variables',
      nodeId: 'site',
    });
    let extensionElements = getBusinessObject(props.element).extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements');
      const findIndexSiteNode = nodesValue.findIndex(
        (node) =>
          node.elId == props.element.businessObject.id &&
          node.label == 'site' &&
          node.nodeId == 'site'
      );
      if (findIndexSiteNode > -1) {
        nodesValue[findIndexSiteNode].node = siteNode;
      } else {
        nodesValue.push({
          elId: props.element.businessObject.id,
          label: 'site',
          node: siteNode,
          nodeId: 'site',
        });
      }
      const nodesExtensionElements = nodesValue.filter(
        (node) => node.elId == props.element.businessObject.id
      );
      nodesExtensionElements.map((node) => {
        extensionElements.get('values').push(node.node);
      });
    } else {
      const findSite = extensionElements
        .get('values')
        .findIndex(
          (node: any) =>
            node?.$type == 'irancell:Variables' &&
            node?.$attrs?.nodeId == 'site' &&
            node?.$attrs?.parentNode == 'variables'
        );
      if (findSite > -1) {
        extensionElements.values[findSite].site = value;
      } else {
        extensionElements.get('values').push(siteNode);
      }
    }
    modeling.updateProperties(props.element, {
      extensionElements,
    });
  };

  const validate = (value: any) => {
    if (!value) {
      return true;
    }
    return;
  };

  htmlElement = getTextElement(
    props,
    translate,
    getValue,
    setValue,
    debounce,
    validate
  );
  return htmlElement;
}

export function addLocation(props: any) {
  const modeling: any = useService('modeling');
  const translate: any = useService('translate');
  const debounce: any = useService('debounceInput');
  const moddle: any = useService('moddle');
  let htmlElement: any;

  // reciverUser
  const getValue = (value: any) => {
    const extensionElements: any[] =
      value?.businessObject?.extensionElements?.values;
    let result: any;
    const locationData = extensionElements?.find(
      (t) =>
        t?.$type == 'irancell:Variables' &&
        t?.$attrs?.nodeId == 'location' &&
        t?.$attrs?.parentNode == 'variables'
    );
    result = locationData?.location;
    return result;
  };

  const setValue = (value: any) => {
    const locationNode = moddle.create('irancell:Variables', {
      location: value,
      parentNode: 'variables',
      nodeId: 'location',
    });
    let extensionElements = getBusinessObject(props.element).extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements');
      const findIndexLocationNode = nodesValue.findIndex(
        (node) =>
          node.elId == props.element.businessObject.id &&
          node.label == 'location' &&
          node.nodeId == 'location'
      );
      if (findIndexLocationNode > -1) {
        nodesValue[findIndexLocationNode].node = locationNode;
      } else {
        nodesValue.push({
          elId: props.element.businessObject.id,
          label: 'location',
          node: locationNode,
          nodeId: 'location',
        });
      }
      const nodesExtensionElements = nodesValue.filter(
        (node) => node.elId == props.element.businessObject.id
      );
      nodesExtensionElements.map((node) => {
        extensionElements.get('values').push(node.node);
      });
    } else {
      const findLocation = extensionElements
        .get('values')
        .findIndex(
          (node: any) =>
            node?.$type == 'irancell:Variables' &&
            node?.$attrs?.nodeId == 'location' &&
            node?.$attrs?.parentNode == 'variables'
        );
      if (findLocation > -1) {
        extensionElements.values[findLocation].location = value;
      } else {
        extensionElements.get('values').push(locationNode);
      }
    }
    modeling.updateProperties(props.element, {
      extensionElements,
    });
  };

  const validate = (value: any) => {
    if (!value) {
      return true;
    }
    return;
  };

  htmlElement = getTextElement(
    props,
    translate,
    getValue,
    setValue,
    debounce,
    validate
  );
  return htmlElement;
}

export function addAssignTo(props: any) {
  const modeling: any = useService('modeling');
  const translate: any = useService('translate');
  const debounce: any = useService('debounceInput');
  const moddle: any = useService('moddle');
  let htmlElement: any;

  // reciverUser
  const getValue = (value: any) => {
    const extensionElements: any[] =
      value?.businessObject?.extensionElements?.values;
    let result: any;
    const assignToData = extensionElements?.find(
      (t) =>
        t?.$type == 'irancell:Variables' &&
        t?.$attrs?.nodeId == 'assignTo' &&
        t?.$attrs?.parentNode == 'variables'
    );
    result = assignToData?.assignTo;
    return result;
  };

  const setValue = (value: any) => {
    const assignToNode = moddle.create('irancell:Variables', {
      assignTo: value,
      parentNode: 'variables',
      nodeId: 'assignTo',
    });
    let extensionElements = getBusinessObject(props.element).extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements');
      const findIndexAssignToNode = nodesValue.findIndex(
        (node) =>
          node.elId == props.element.businessObject.id &&
          node.label == 'assignTo' &&
          node.nodeId == 'assignTo'
      );
      if (findIndexAssignToNode > -1) {
        nodesValue[findIndexAssignToNode].node = assignToNode;
      } else {
        nodesValue.push({
          elId: props.element.businessObject.id,
          label: 'assignTo',
          node: assignToNode,
          nodeId: 'assignTo',
        });
      }
      const nodesExtensionElements = nodesValue.filter(
        (node) => node.elId == props.element.businessObject.id
      );
      nodesExtensionElements.map((node) => {
        extensionElements.get('values').push(node.node);
      });
    } else {
      const findAssignTo = extensionElements
        .get('values')
        .findIndex(
          (node: any) =>
            node?.$type == 'irancell:Variables' &&
            node?.$attrs?.nodeId == 'assignTo' &&
            node?.$attrs?.parentNode == 'variables'
        );
      if (findAssignTo > -1) {
        extensionElements.values[findAssignTo].assignTo = value;
      } else {
        extensionElements.get('values').push(assignToNode);
      }
    }
    modeling.updateProperties(props.element, {
      extensionElements,
    });
  };

  const validate = (value: any) => {
    if (!value) {
      return true;
    }
    return;
  };

  htmlElement = getTextElement(
    props,
    translate,
    getValue,
    setValue,
    debounce,
    validate
  );
  return htmlElement;
}

export function addLevel(props: any) {
  const modeling: any = useService('modeling');
  const translate: any = useService('translate');
  const debounce: any = useService('debounceInput');
  const moddle: any = useService('moddle');
  let htmlElement: any;

  // reciverUser
  const getValue = (value: any) => {
    const extensionElements: any[] =
      value?.businessObject?.extensionElements?.values;
    let result: any;
    const levelData = extensionElements?.find(
      (t) =>
        t?.$type == 'irancell:Variables' &&
        t?.$attrs?.nodeId == 'level' &&
        t?.$attrs?.parentNode == 'variables'
    );
    result = levelData?.level;
    return result;
  };

  const setValue = (value: any) => {
    const levelNode = moddle.create('irancell:Variables', {
      level: value,
      parentNode: 'variables',
      nodeId: 'level',
    });
    let extensionElements = getBusinessObject(props.element).extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements');
      const findIndexLevelNode = nodesValue.findIndex(
        (node) =>
          node.elId == props.element.businessObject.id &&
          node.label == 'level' &&
          node.nodeId == 'level'
      );
      if (findIndexLevelNode > -1) {
        nodesValue[findIndexLevelNode].node = levelNode;
      } else {
        nodesValue.push({
          elId: props.element.businessObject.id,
          label: 'level',
          node: levelNode,
          nodeId: 'level',
        });
      }
      const nodesExtensionElements = nodesValue.filter(
        (node) => node.elId == props.element.businessObject.id
      );
      nodesExtensionElements.map((node) => {
        extensionElements.get('values').push(node.node);
      });
    } else {
      const findLevel = extensionElements
        .get('values')
        .findIndex(
          (node: any) =>
            node?.$type == 'irancell:Variables' &&
            node?.$attrs?.nodeId == 'level' &&
            node?.$attrs?.parentNode == 'variables'
        );
      if (findLevel > -1) {
        extensionElements.values[findLevel].level = value;
      } else {
        extensionElements.get('values').push(levelNode);
      }
    }
    modeling.updateProperties(props.element, {
      extensionElements,
    });
  };

  const validate = (value: any) => {
    if (!value) {
      return true;
    }
    return;
  };

  htmlElement = getTextElement(
    props,
    translate,
    getValue,
    setValue,
    debounce,
    validate
  );
  return htmlElement;
}

function getTextElement(
  data: any,
  translate: any,
  getValue: any,
  setValue: any,
  debounce: any,
  validate: any
) {
  return html`<${TextFieldEntry}
    id=${data.id}
    element=${data.element}
    description=${translate(data.description)}
    label=${translate(data.label)}
    getValue=${getValue}
    setValue=${setValue}
    debounce=${debounce}
    validate=${data.required ? validate : false}
  />`;
}

function getTextAreaEntry(
  data: any,
  translate: any,
  getValue: any,
  setValue: any,
  debounce: any,
  validate: any
) {
  return html`<${TextAreaEntry}
    id=${data.id}
    element=${data.element}
    description=${translate(data.description)}
    label=${translate(data.label)}
    getValue=${getValue}
    setValue=${setValue}
    debounce=${debounce}
    validate=${data.required ? validate : false}
    }}
  />`;
}

function getSelectbox(
  data: any,
  translate: any,
  getValue: any,
  setValue: any,
  debounce: any,
  validate: any,
  getOptions: any,
  disabled: any,
  label: any,
  apiAddressForSearch:any
) {
  return html`<${SelectEntry}
    id=${data.id}
    element=${data.element}
    description=${translate(data.description)}
    label=${translate(data.label)}
    getValue=${getValue}
    setValue=${setValue}
    validate="${data.required ? validate : false}"
    getOptions="${getOptions}"
    disabled="${disabled ? true : false}"
    label="${label ? label : ''}"
    apiAddressForSearch="${apiAddressForSearch}"
  />`;
}

function getMultiselect(
  data: any,
  translate: any,
  getValue: any,
  setValue: any,
  debounce: any,
  validate: any,
  getOptions: any,
  disabled: any,
  label: any,
  apiName: any
) {
  return html`<${MultiSelectEntry}
    id=${data.id}
    element=${data.element}
    description=${translate(data.description)}
    getValue=${getValue}
    setValue=${setValue}
    getOptions="${getOptions}"
    apiName="${apiName}"
    label="${label}"
  />`;
}


function getRadio(
  data: any,
  translate: any,
  getValue: any,
  setValue: any,
  label: any,
  switcherLabel:any
) {
  return html`<${ToggleSwitchEntry}
    id=${data.id}
    element=${data.element}
    description=${translate(data.description)}
    getValue=${getValue}
    setValue=${setValue}
    label="${label}"
    switcherLabel="${switcherLabel}"
  />`;
}
