// utils/bpmn-helpers.ts
export const extractProcessName = (modeler: any): string => {
  if (!modeler) return 'process';
  
  try {
    const canvas = modeler.get('canvas');
    const rootElement = canvas.getRootElement();
    return rootElement.businessObject.name || 'process';
  } catch (error) {
    console.error('Error extracting process name:', error);
    return 'process';
  }
};

export const hasTagConfiguration = async (modeler: any): Promise<boolean> => {
  if (!modeler) return false;

  try {
    const { xml } = await modeler.saveXML({ format: true });
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const nodes = doc.querySelectorAll('*');
    const listNodes = Array.from(nodes);
    
    const findIndexTagNode = listNodes.findIndex(
      (n: any) => n?.nodeName === 'irancell:wFM' && n?.getAttribute('nodeId') === 'tag'
    );

    return findIndexTagNode > -1 && listNodes[findIndexTagNode]?.textContent !== '';
  } catch (error) {
    console.error('Error checking tag configuration:', error);
    return false;
  }
};