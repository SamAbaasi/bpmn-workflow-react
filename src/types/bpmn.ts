
// types/bpmn.ts
export interface BPMNElement {
  id: string;
  type: string;
  businessObject: any;
  di?: any;
}

export interface BPMNExtensionElement {
  $type: string;
  $attrs?: { [key: string]: any };
  values?: any[];
  [key: string]: any;
}

export interface ProcessDefinition {
  id: number;
  name: string;
  version: number;
  bpmn: string[];
  createdAt: string;
  updatedAt: string;
}