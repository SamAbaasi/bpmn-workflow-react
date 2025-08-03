// import { TextFieldEntry } from '@bpmn-io/properties-panel';
import { html } from 'htm/preact';
import { useService } from '../../../../static/scripts/packages/processmaker/bpmn-js-properties-panel';
import { TextFieldEntry } from '../../../../static/scripts/packages/processmaker/@bpmn-io/properties-panel';

interface ParameterProps {
  idPrefix: string;
  parameter: any;
}

export default function ParameterProps(props: any): any[] {
  const { idPrefix, parameter } = props;

  const entries: any[] = [
    {
      id: idPrefix + '-name',
      component: Name,
      idPrefix,
      parameter,
    },
    {
      id: idPrefix + '-value',
      component: Value,
      idPrefix,
      parameter,
    },
  ];

  return entries;
}

interface NameProps {
  idPrefix: string;
  element: any;
  parameter: any;
}

function Name(props: NameProps): any {
  const { idPrefix, element, parameter } = props;

  const commandStack: any = useService('commandStack');
  const translate: any = useService('translate');
  const debounce: any = useService('debounceInput');

  const setValue = (value: string) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: parameter,
      properties: {
        name: value,
      },
    });
  };

  const getValue = (parameter: any) => {
    return parameter.name;
  };

  return html`<${TextFieldEntry}
    id=${idPrefix + '-name'}
    element=${parameter}
    label=${translate('Name')}
    getValue=${getValue}
    setValue=${setValue}
    debounce=${debounce}
  />`;

  // return TextFieldEntry({
  //   element: parameter,
  //   id: idPrefix + '-name',
  //   label: translate('Name'),
  //   getValue,
  //   setValue,
  //   debounce
  // });
}

interface ValueProps {
  idPrefix: string;
  element: any;
  parameter: any;
}

function Value(props: ValueProps): any {
  const { idPrefix, element, parameter } = props;

  const commandStack: any = useService('commandStack');
  const translate: any = useService('translate');
  const debounce: any = useService('debounceInput');

  const setValue = (value: string) => {
    commandStack.execute('element.updateModdleProperties', {
      element,
      moddleElement: parameter,
      properties: {
        value: value,
      },
    });
  };

  const getValue = (parameter: any) => {
    return parameter.value;
  };

  return html`<${TextFieldEntry}
    id=${idPrefix + '-value'}
    element=${parameter}
    label=${translate('Value')}
    getValue=${getValue}
    setValue=${setValue}
    debounce=${debounce}
  />`;
  // return TextFieldEntry({
  //   element: parameter,
  //   id: idPrefix + '-value',
  //   label: translate('Value'),
  //   getValue,
  //   setValue,
  //   debounce
  // });
}
