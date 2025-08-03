import { is } from 'bpmn-js/lib/util/ModelUtil';
import {
  addAssignTo,
  addBodyCompose,
  addDataSender,
  addEmailReciever,
  addFormActivity,
  addFormName,
  addGroupReciver,
  addGroupReciverForSMS,
  addLevel,
  addLocation,
  addMessageTextSMS,
  addNumberReciverForSMS,
  addOnlineOffline,
  addPyClassEndExecution,
  addPyClassStartExecution,
  addSite,
  addSubjectCompose,
  addTags,
  addTaskType,
  addUserReciver,
  addUserReciverForSMS,
  messageType,
} from '../props/sendTaskProps';
import parametersProps from '../props/parametersProps';
import { isTextFieldEntryEdited } from '../../../../static/scripts/packages/processmaker/@bpmn-io/properties-panel';
import { ListGroup } from '../../../../static/scripts/packages/processmaker/@bpmn-io/properties-panel';
import GroupProps from '../props/groupsProps';

const LOW_PRIORITY = 500;
var pythonClasses: any[] = [];
var forms: any[] = [];
var tags: any[] = [];
var activityForEditOptions: any[] = [];
var activitiesList: any[] = [];
var taskTypeList: any[] = [];

/**
 * A provider with a `#getGroups(element)` method
 * that exposes groups for a diagram element.
 *
 * @param {PropertiesPanel} propertiesPanel
 * @param {Function} translate
 */
export default function CustomProvider(
  this: any,
  propertiesPanel: any,
  injector: any,
  translate: any
): void {
  // API ////////
  /**
   * Return the groups provided for the given element.
   *
   * @param {DiagramElement} element
   *
   * @return {(Object[]) => (Object[])} groups middleware
   *
   */

  // var elementRegistry = bpmnJS.get('elementRegistry');
  this.getGroups = function (element: any): (groups: any[]) => any[] {
    /**
     * We return a middleware that modifies
     * the existing groups.
     *
     * @param {Object[]} groups
     *
     * @return {Object[]} modified groups
     */
    return function (groups: any[]): any[] {
      groups.map((group) => {
        if (group.id == 'CamundaPlatform__Output') {
          addOutputsGroup(element, groups, injector, translate);
        }
      });
      getPythonClassOptions();
      getFormsOptions();
      getTagsList();
      getTaskTypeList();
      getActivityForEditOptions();
      removeGroup(element, groups);
      if (element.businessObject?.flowElements) {
        var activityOptions: any[] = [];
        element.businessObject?.flowElements?.map((flow: any) => {
          const findElement = activityForEditOptions
            .map((res) => res.label)
            .find((resp) => resp == flow.id);
          if (findElement) {
            activityOptions.push({ label: findElement, value: findElement });
          }
        });
        if (!activityOptions.map((res) => res.label).includes(' ')) {
          activityForEditOptions.push({
            label: ' ',
            value: null,
          });
        }
        activityForEditOptions = activityOptions;
      }
      if (is(element, 'bpmn:SendTask')) {
        addMessageType(element, groups, injector, translate);
        const extensionElements: any[] =
          element?.businessObject?.extensionElements?.values;
        let result: any;
        const findMessageTypeData = extensionElements?.find(
          (t) => t?.$type == 'irancell:MessageType'
        );
        result = findMessageTypeData?.$attrs?.data;
        if (result == 'email') {
          if (extensionElements && extensionElements.length > 0) {
            for (let i = extensionElements.length - 1; i >= 0; i--) {
              if (extensionElements[i].$attrs.parentNode == 'sms') {
                extensionElements.splice(i, 1);
              }
            }
          }
          addSenderGroup(element, groups, injector, translate);
          addReciverGroup(element, groups, injector, translate);
          addComposeGroup(element, groups, injector, translate);
        } else if (result == 'sms') {
          if (extensionElements && extensionElements.length > 0) {
            for (let i = extensionElements.length - 1; i >= 0; i--) {
              if (extensionElements[i].$attrs.parentNode == 'email') {
                extensionElements.splice(i, 1);
              }
            }
          }
          addSMSConfiguration(element, groups, injector, translate);
        } else {
          if (extensionElements && extensionElements.length > 0) {
            for (let i = extensionElements.length - 1; i >= 0; i--) {
              if (
                extensionElements[i].$attrs.parentNode == 'email' ||
                extensionElements[i].$attrs.parentNode == 'sms'
              ) {
                extensionElements.splice(i, 1);
              }
            }
          }
        }
      }
      if (is(element, 'bpmn:StartEvent') || is(element, 'bpmn:UserTask')) {
        if (!activityForEditOptions.map((res) => res.label).includes(' ')) {
          activityForEditOptions.push({
            label: ' ',
            value: null,
          });
        }
        addFormsGroup(element, groups, injector, translate);
      }
      if (is(element, 'bpmn:StartEvent')) {
        addOutputsGroup(element, groups, injector, translate);
      }
      if (is(element, 'bpmn:UserTask') || is(element, 'bpmn:SendTask')) {
        if (element.businessObject.loopCharacteristics) {
          addOutputsGroup(element, groups, injector, translate);
        }
      }
      if (is(element, 'bpmn:UserTask')) {
        const findIndexElId = activitiesList.findIndex(
          (el) =>  element.di.id == el.elId
        );
        if (findIndexElId == -1) {
          activitiesList.push({ label: element.id, value: element.id,elId: element.di.id });
        }else{
          activitiesList[findIndexElId].label = element.id;
          activitiesList[findIndexElId].value = element.id
        }
        addWFMGroup(element, groups, injector, translate);
      }
      if (!is(element, 'bpmn:UserTask')) {
        const findIndexElId = activitiesList.findIndex(
          (el) => element.di.id == el.elId
        );
        if (findIndexElId > -1) {
          activitiesList.splice(findIndexElId, 1);
        }
      }
      addStartExecutionListenerGroup(element, groups, injector, translate);
      addEndExecutionListenerGroup(element, groups, injector, translate);
      if (is(element, 'bpmn:Process')) {
        addGroupsGroup(element, groups, injector, translate);
        // addVariablesGroup(element, groups, injector, translate);
      }
      return groups;
    };
  };

  // registration ////////

  // Register our custom magic properties provider.
  // Use a lower priority to ensure it is loaded after
  // the basic BPMN properties.
  propertiesPanel.registerProvider(LOW_PRIORITY, this);
}

CustomProvider.$inject = ['propertiesPanel', 'injector', 'translate'];

function removeGroup(element: any, groups: any) {
  if (is(element, 'bpmn:SendTask')) {
    const findImplementGroup = groups.findIndex(
      (group: any) => group.label == 'Implementation'
    );
    groups.splice(findImplementGroup, 1);
  }
  if (is(element, 'bpmn:StartEvent') || is(element, 'bpmn:UserTask')) {
    const findImplementGroup = groups.findIndex(
      (group: any) => group.id == 'CamundaPlatform__Form'
    );
    groups.splice(findImplementGroup, 1);
  }
  const findOutputGroup = groups.findIndex(
    (group: any) => group.id == 'CamundaPlatform__Output'
  );
  groups.splice(findOutputGroup, 1);
}

// Create the custom parameters list group.
function addSenderGroup(
  element: any,
  groups: any,
  injector: any,
  translate: any
) {
  var entriesSender: any[] = [
    {
      type: 'text',
      label: 'Mail sender',
      description: 'Start typing "$" to create an variable',
      id: 'mailSender',
      name: 'mailSender',
      required: true,
      component: addDataSender,
      isEdited: isTextFieldEntryEdited,
    },
  ];
  const data = {
    id: translate('sender'),
    label: translate('Sender'),
    element: element,
    entries: entriesSender,
  };
  groups.push(data);
}

function addReciverGroup(
  element: any,
  groups: any,
  injector: any,
  translate: any
) {
  var entriesRiciver: any[] = [
    {
      type: 'text',
      label: 'Receiver Group',
      description: 'Start typing "$" to create a variable',
      id: 'reciverGroup',
      name: 'reciverGroup',
      required: true,
      component: addGroupReciver,
      isEdited: isTextFieldEntryEdited,
    },
    {
      type: 'text',
      label: 'Receiver User',
      description: 'Start typing "$" to create a variable',
      id: 'reciverUser',
      name: 'reciverUser',
      required: true,
      component: addUserReciver,
      isEdited: isTextFieldEntryEdited,
    },
    {
      type: 'text',
      label: 'Receiver Email',
      description: 'Start typing "$" to create a variable',
      id: 'reciverEmail',
      name: 'reciverEmail',
      required: true,
      component: addEmailReciever,
      isEdited: isTextFieldEntryEdited,
    },
  ];
  const data = {
    id: translate('reciver'),
    label: translate('Receiver'),
    element: element,
    entries: entriesRiciver,
  };
  groups.push(data);
}

function addComposeGroup(
  element: any,
  groups: any,
  injector: any,
  translate: any
) {
  var entriesCompose: any[] = [
    {
      type: 'text',
      label: 'Compose subject',
      description: 'Start typing "$" to create an variable',
      id: 'composeSubject',
      name: 'composeSubject',
      required: false,
      component: addSubjectCompose,
      isEdited: isTextFieldEntryEdited,
    },
    {
      type: 'textarea',
      label: 'Compose body',
      description: 'Start typing "$" to create an variable',
      id: 'composeBody',
      name: 'composeBody',
      required: true,
      component: addBodyCompose,
      isEdited: isTextFieldEntryEdited,
    },
  ];
  const data = {
    id: translate('compose'),
    label: translate('Compose'),
    element: element,
    entries: entriesCompose,
  };
  groups.push(data);
}

function addStartExecutionListenerGroup(
  element: any,
  groups: any,
  injector: any,
  translate: any
) {
  const mainTagName = 'irancell:StartDataFieldInjection';
  const parameterTagName = 'irancell:ParameterStartDataField';
  const entriesStartExecutionListener = [
    {
      type: 'selectbox',
      label: 'Python class',
      description: '',
      id: 'pythonClassStartExecutionListener',
      name: 'pythonClassStartExecutionListener',
      required: false,
      options: pythonClasses,
      component: addPyClassStartExecution,
      isEdited: isTextFieldEntryEdited,
    },
    {
      id: 'startDataFieldInjection',
      label: translate('Field injection'),
      component: ListGroup,
      ...parametersProps({
        element,
        injector,
        mainTagName,
        parameterTagName,
      }),
    },
  ];
  const data = {
    id: translate('start execution listener'),
    label: translate('Start execution listener'),
    element: element,
    entries: entriesStartExecutionListener,
  };
  groups.push(data);
}

function addEndExecutionListenerGroup(
  element: any,
  groups: any,
  injector: any,
  translate: any
) {
  const mainTagName = 'irancell:EndDataFieldInjection';
  const parameterTagName = 'irancell:ParameterEndDataField';
  const entriesEndExecutionListener = [
    {
      type: 'selectbox',
      label: 'Python class',
      description: '',
      id: 'pythonClassEndExecutionListener',
      name: 'pythonClassEndExecutionListener',
      required: false,
      options: pythonClasses,
      component: addPyClassEndExecution,
      isEdited: isTextFieldEntryEdited,
    },
    {
      id: 'endDataFieldInjection',
      label: translate('Field injection'),
      component: ListGroup,
      ...parametersProps({ element, injector, mainTagName, parameterTagName }),
    },
  ];
  const data = {
    id: translate('end execution listener'),
    label: translate('End execution listener'),
    element: element,
    entries: entriesEndExecutionListener,
  };
  groups.push(data);
}

function addVariablesGroup(
  element: any,
  groups: any,
  injector: any,
  translate: any
) {
  var entriesVariables: any[] = [
    {
      type: 'text',
      label: 'Site',
      description: '',
      id: 'site',
      name: 'site',
      required: false,
      component: addSite,
      isEdited: isTextFieldEntryEdited,
    },
    {
      type: 'text',
      label: 'Location',
      description: '',
      id: 'location',
      name: 'location',
      required: false,
      component: addLocation,
      isEdited: isTextFieldEntryEdited,
    },
    {
      type: 'text',
      label: 'Assign to',
      description: '',
      id: 'assignTo',
      name: 'assignTo',
      required: false,
      component: addAssignTo,
      isEdited: isTextFieldEntryEdited,
    },
    {
      type: 'text',
      label: 'Level',
      description: '',
      id: 'level',
      name: 'level',
      required: false,
      component: addLevel,
      isEdited: isTextFieldEntryEdited,
    },
  ];
  const data = {
    id: translate('variables'),
    label: translate('Variables'),
    element: element,
    entries: entriesVariables,
  };
  groups.push(data);
}

function addOutputsGroup(
  element: any,
  groups: any,
  injector: any,
  translate: any
) {
  const mainTagName = 'irancell:Outputs';
  const parameterTagName = 'irancell:ParameterOutputs';
  const data = {
    id: translate('outputs'),
    label: translate('Outputs'),
    element: element,
    component: ListGroup,
    ...parametersProps({ element, injector, mainTagName, parameterTagName }),
  };
  groups.push(data);
}

function addFormsGroup(
  element: any,
  groups: any,
  injector: any,
  translate: any
) {
  const findFormName = element.businessObject?.extensionElements?.values.find(
    (value: any) => value.formName
  );
  if (!activityForEditOptions.map((res) => res.label).includes(element.id)) {
    if (findFormName) {
      activityForEditOptions.push({ label: element.id, value: element.id });
    }
  } else {
    if (!findFormName) {
      const findIndexIdEl = activityForEditOptions
        .map((res) => res.label)
        .findIndex((el) => el == element.id);
      activityForEditOptions.splice(findIndexIdEl, 1);
    }
  }
  var entriesForm: any[] = [
    {
      type: 'selectbox',
      label: 'Form Name',
      description: '',
      id: 'formName',
      name: 'formName',
      required: false,
      component: addFormName,
      options: forms,
      isEdited: isTextFieldEntryEdited,
    },
    {
      type: 'selectbox',
      label: 'Activity',
      description: '',
      id: 'activity',
      name: 'activity',
      required: false,
      component: addFormActivity,
      options: activityForEditOptions,
      isEdited: isTextFieldEntryEdited,
    },
  ];
  const data = {
    id: translate('form'),
    label: translate('Form'),
    element: element,
    entries: entriesForm,
  };
  groups.push(data);
}

function addWFMGroup(element: any, groups: any, injector: any, translate: any) {
  // const findFormName = element.businessObject?.extensionElements?.values.find(
  //   (value: any) => value.formName
  // );
  // if (!activityForEditOptions.map((res) => res.label).includes(element.id)) {
  //   if (findFormName) {
  //     activityForEditOptions.push({ label: element.id, value: element.id });
  //   }
  // } else {
  //   if (!findFormName) {
  //     const findIndexIdEl = activityForEditOptions
  //       .map((res) => res.label)
  //       .findIndex((el) => el == element.id);
  //     activityForEditOptions.splice(findIndexIdEl, 1);
  //   }
  // }
  var entriesWFM: any[] = [
    {
      type: 'selectbox',
      label: 'Tag',
      description: '',
      id: 'tag',
      name: 'tag',
      required: false,
      component: addTags,
      options: tags,
      isEdited: isTextFieldEntryEdited,
    },
    {
      type: 'selectbox',
      label: 'Task Type',
      description: '',
      id: 'taskType',
      name: 'taskType',
      required: false,
      component: addTaskType,
      options: taskTypeList,
      isEdited: isTextFieldEntryEdited,
    },
    {
      type: 'radio',
      label: 'Online - Offline',
      description: '',
      id: 'onlineOffline',
      name: 'onlineOffline',
      required: false,
      component: addOnlineOffline,
    },
  ];
  const data = {
    id: translate('wfm'),
    label: translate('wfm'),
    element: element,
    entries: entriesWFM,
  };
  groups.push(data);
}

function addMessageType(
  element: any,
  groups: any,
  injector: any,
  translate: any
) {
  const messageTypeList = [
    {
      value: null,
      label: ' ',
    },
    {
      value: 'email',
      label: 'Email',
    },
    {
      value: 'sms',
      label: 'SMS',
    },
  ];
  const massageType = [
    {
      type: 'selectbox',
      label: 'Message Type',
      description: '',
      id: 'messageType',
      name: 'messageType',
      required: false,
      options: messageTypeList,
      component: messageType,
      isEdited: isTextFieldEntryEdited,
    },
  ];
  const data = {
    id: translate('message Type'),
    label: translate('Message Type'),
    element: element,
    entries: massageType,
  };
  groups.push(data);
}

function addSMSConfiguration(
  element: any,
  groups: any,
  injector: any,
  translate: any
) {
  var entriesSMSConfiguration: any[] = [
    {
      type: 'text',
      label: 'Receiver Group',
      description: 'Start typing "$" to create a variable',
      id: 'reciverGroupForSMS',
      name: 'reciverGroupForSMS',
      required: false,
      component: addGroupReciverForSMS,
      isEdited: isTextFieldEntryEdited,
    },
    {
      type: 'text',
      label: 'Receiver User',
      description: 'Start typing "$" to create a variable',
      id: 'reciverUserForSMS',
      name: 'reciverUserForSMS',
      required: false,
      component: addUserReciverForSMS,
      isEdited: isTextFieldEntryEdited,
    },
    {
      type: 'number',
      label: 'Receiver Number',
      description: 'Start typing "$" to create a variable',
      id: 'reciverNumberForSMS',
      name: 'reciverNumberForSMS',
      required: false,
      component: addNumberReciverForSMS,
      isEdited: isTextFieldEntryEdited,
    },
    {
      type: 'textarea',
      label: 'Message Text',
      description: '',
      id: 'messageTextForSMS',
      name: 'messageTextForSMS',
      required: true,
      component: addMessageTextSMS,
      isEdited: isTextFieldEntryEdited,
    },
  ];
  const data = {
    id: translate('smsConfiguration'),
    label: translate('SMS Configuration'),
    element: element,
    entries: entriesSMSConfiguration,
  };
  groups.push(data);
}

function addGroupsGroup(
  element: any,
  groups: any,
  injector: any,
  translate: any
) {
  const mainTagName = 'irancell:Groups';
  const parameterTagName = 'irancell:ParameterGroups';
  const data = {
    id: translate('groups'),
    label: translate('Groups'),
    element: element,
    component: ListGroup,
    ...GroupProps({ element, injector, mainTagName, parameterTagName,activitiesList }),
  };
  groups.push(data);
}

async function getPythonClassOptions() {
  const token = window.localStorage.getItem('ngx-app.current-user') || '';
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
    headers: myHeaders,
  };

  const formRequest = await new Request('/api/listener/', options);
  fetch(formRequest)
    .then((response) => response.json())
    .then((res: any) => {
      if (res) {
        pythonClasses = [];
        res?.map((pyClass: any) => {
          pythonClasses.push({
            value: pyClass.method,
            label: pyClass.method,
          });
        });
      }
    });
}

async function getActivityForEditOptions() {
  return activityForEditOptions;
}

async function getFormsOptions() {
  const token = window.localStorage.getItem('ngx-app.current-user') || '';
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
    headers: myHeaders,
  };

  const formRequest = await new Request(
    '/api/form-builder/published/forms?no_page',
    options
  );
  fetch(formRequest)
    .then((response) => response.json())
    .then((res: any) => {
      if (res) {
        forms = [
          {
            value: null,
            label: ' ',
          },
        ];
        res?.map((form: any) => {
          forms.push({
            value: form.id,
            label: `${form.name}_V${form.version}`,
          });
        });
      }
    });
}

async function getTagsList() {
  const token = window.localStorage.getItem('ngx-app.current-user') || '';
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
    headers: myHeaders,
  };

  const tagRequest = await new Request('/api/tag/', options);
  fetch(tagRequest)
    .then((response) => response.json())
    .then((res: any) => {
      tags = [];
      if (res) {
        res?.map((tag: any) => {
          tags.push({
            value: tag.code,
            label: tag.name,
          });
        });
      }
    });
}

async function getTaskTypeList() {
  const token = window.localStorage.getItem('ngx-app.current-user') || '';
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
    headers: myHeaders,
  };

  const taskTypeRequest = await new Request('/api/tasks/', options);
  fetch(taskTypeRequest)
    .then((response) => response.json())
    .then((res: any) => {
      taskTypeList = [];
      if (res) {
        res?.map((task: any) => {
          taskTypeList.push({
            value: task.num,
            label: task.task_name,
          });
        });
      }
    });
}
