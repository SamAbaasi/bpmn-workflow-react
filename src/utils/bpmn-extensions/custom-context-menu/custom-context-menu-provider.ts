import { is, isAny } from 'bpmn-js/lib/features/modeling/util/ModelingUtil';

export default class CustomContextMenuProvider {
  replaceElement: any;
  static $inject: string[];
  constructor(popupMenu: any, bpmnReplace: any) {
    popupMenu.registerProvider('bpmn-replace', this);
    this.replaceElement = bpmnReplace.replaceElement;
  }

  getPopupMenuHeaderEntries(element: any) {
    return function (entries: any) {
      return entries;
    };
  }

  getPopupMenuEntries(element: any) {
    const self = this;
    return function (entries: any) {
      // console.log(entries);

      // console.log(entries, element, 'in');
      if (is(element, 'bpmn:IntermediateThrowEvent')) {
        delete entries['replace-with-none-start'];
        delete entries['replace-with-compensation-intermediate-throw'];
        delete entries['replace-with-conditional-intermediate-catch'];
        delete entries['replace-with-escalation-intermediate-throw'];
        delete entries['replace-with-link-intermediate-catch'];
        delete entries['replace-with-link-intermediate-throw'];
        delete entries['replace-with-message-intermediate-catch'];
        delete entries['replace-with-message-intermediate-throw'];
        delete entries['replace-with-none-end'];
        delete entries['replace-with-signal-intermediate-catch'];
        delete entries['replace-with-signal-intermediate-throw'];
      }
      if (is(element, 'bpmn:BoundaryEvent')) {
        delete entries['replace-with-non-interrupting-escalation-boundary'];
        delete entries['replace-with-message-boundary'];
        delete entries['replace-with-escalation-boundary'];
        delete entries['replace-with-conditional-boundary'];
        delete entries['replace-with-error-boundary'];
        delete entries['replace-with-signal-boundary'];
        delete entries['replace-with-compensation-boundary'];
        delete entries['replace-with-non-interrupting-message-boundary'];
        delete entries['replace-with-non-interrupting-timer-boundary'];
        delete entries['replace-with-non-interrupting-conditional-boundary'];
        delete entries['replace-with-non-interrupting-signal-boundary'];
      }
      return entries;
    };
  }
}

CustomContextMenuProvider.$inject = ['popupMenu', 'bpmnReplace'];
