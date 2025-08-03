// ProcessMaker.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BpmnModeler from 'bpmn-js/lib/Modeler.js';

// Import BPMN properties panel modules
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
  CamundaPlatformPropertiesProviderModule,
} from 'bpmn-js-properties-panel';

// Import custom providers and descriptors
import CustomContextPadProvider from '../utils/bpmn-extensions/custom-context-pad';
import CustomPaletteProvider from '../utils/bpmn-extensions/custom-palette/';
import CustomContextMenuProvider from '../utils/bpmn-extensions/custom-context-menu';
import customProviderModule from '../utils/bpmn-extensions/custom-properties/provider';

// Import descriptors
import * as irancellModdleDescriptors from '../utils/bpmn-extensions/descriptor/irancell.json';
import * as camundaModdleDescriptors from '../utils/bpmn-extensions/descriptor/camunda.json';

// Import hooks and services
import { useProcesses } from '../hooks/useProcesses';
import { useNotification } from '../hooks/useNotification';
import { ConfirmOutputsDialog } from './ConfirmOutputsDialog';

interface ProcessMakerProps {
  processId?: number;
}

export const ProcessMaker: React.FC<ProcessMakerProps> = () => {
  const { processId } = useParams<{ processId: string }>();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLDivElement>(null);
  const propertiesRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<any>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [actionType, setActionType] = useState<'create' | 'update'>('create');
  
  const { 
    getDiagramByProcessId, 
    createProcess, 
    updateProcess,
    isCreating,
    isUpdating 
  } = useProcesses();
  const { showNotification } = useNotification();

  // Initialize BPMN Modeler
  useEffect(() => {
    if (!canvasRef.current || !propertiesRef.current) return;

    const modeler = new BpmnModeler({
      container: canvasRef.current,
      width: '100%',
      propertiesPanel: {
        parent: propertiesRef.current,
      },
      additionalModules: [
        BpmnPropertiesPanelModule,
        BpmnPropertiesProviderModule,
        CamundaPlatformPropertiesProviderModule,
        CustomPaletteProvider,
        CustomContextPadProvider,
        customProviderModule,
        CustomContextMenuProvider,
      ],
      moddleExtensions: {
        camunda: camundaModdleDescriptors,
        irancell: irancellModdleDescriptors,
      },
    });

    modelerRef.current = modeler;

    // Event listeners
    modeler.on('element.click', (event: any) => {
      console.log('Element clicked:', event.element);
    });

    // Load diagram
    if (processId) {
      loadExistingDiagram();
    } else {
      loadInitialDiagram();
    }

    return () => {
      modeler.destroy();
    };
  }, [processId]);

  const loadExistingDiagram = async () => {
    if (!processId) return;
    
    try {
      setIsLoading(true);
      const diagramData = await getDiagramByProcessId(parseInt(processId));
      const bpmnModel = diagramData.bpmn?.join('');
      await importXML(bpmnModel);
    } catch (error) {
      showNotification('Error loading diagram', 'error');
      console.error('Error loading diagram:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadInitialDiagram = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/static/data/empty_process-copy.bpmn');
      const bpmnXML = await response.text();
      await importXML(bpmnXML);
    } catch (error) {
      showNotification('Error loading initial diagram', 'error');
      console.error('Error loading initial diagram:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const importXML = async (xml: string) => {
    return new Promise((resolve, reject) => {
      if (!modelerRef.current) {
        reject(new Error('Modeler not initialized'));
        return;
      }

      modelerRef.current.importXML(xml, (err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(null);
        }
      });
    });
  };

  const exportProcess = async () => {
    if (!modelerRef.current) return;

    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      const blob = new Blob([xml], { type: 'application/xml' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.download = `${extractProcessName()}.bpmn`;
      anchor.href = url;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showNotification('Error exporting process', 'error');
      console.error('Export error:', error);
    }
  };

  const extractProcessName = (): string => {
    if (!modelerRef.current) return 'process';
    
    const canvas = modelerRef.current.get('canvas');
    const rootElement = canvas.getRootElement();
    return rootElement.businessObject.name || 'process';
  };

  const decidingShowConfirmDialog = async (action: 'create' | 'update') => {
    if (!modelerRef.current) return;

    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      const nodes = doc.querySelectorAll('*');
      const listNodes = Array.from(nodes);
      
      const findIndexTagNode = listNodes.findIndex(
        (n: any) => n?.nodeName === 'irancell:wFM' && n?.getAttribute('nodeId') === 'tag'
      );

      if (findIndexTagNode > -1 && listNodes[findIndexTagNode]?.textContent !== '') {
        setActionType(action);
        setShowConfirmDialog(true);
      } else {
        action === 'update' ? handleUpdateProcess() : handleCreateProcess();
      }
    } catch (error) {
      showNotification('Error processing diagram', 'error');
      console.error('Error:', error);
    }
  };

  const handleCreateProcess = async () => {
    if (!modelerRef.current) return;

    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      const file = new File([xml], 'filename.xml', { type: 'application/xml' });
      
      await createProcess(file);
      showNotification('Process created successfully', 'success');
      navigate('/workflow/process-list');
    } catch (error) {
      showNotification('Error creating process', 'error');
      console.error('Create error:', error);
    }
  };

  const handleUpdateProcess = async () => {
    if (!modelerRef.current || !processId) return;

    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      const file = new File([xml], 'filename.xml', { type: 'application/xml' });
      
      await updateProcess(parseInt(processId), file);
      showNotification('Process updated successfully', 'success');
      navigate('/workflow/process-list');
    } catch (error) {
      showNotification('Error updating process', 'error');
      console.error('Update error:', error);
    }
  };

  const handleConfirmDialogClose = (confirmed: boolean) => {
    setShowConfirmDialog(false);
    if (confirmed) {
      actionType === 'update' ? handleUpdateProcess() : handleCreateProcess();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <section className="flex flex-col h-screen">
      <div className="p-4 bg-white border-b">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Process Maker</h2>
      </div>
      
      <div className="flex-1 flex border-b">
        <div ref={canvasRef} className="flex-1 border-r" />
        <div ref={propertiesRef} className="w-80 bg-gray-50" />
      </div>
      
      <div className="p-4 bg-white flex justify-end space-x-3">
        <button
          onClick={exportProcess}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Export
        </button>
        
        {!processId ? (
          <button
            onClick={() => decidingShowConfirmDialog('create')}
            disabled={isCreating}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isCreating ? 'Creating...' : 'Create Process'}
          </button>
        ) : (
          <button
            onClick={() => decidingShowConfirmDialog('update')}
            disabled={isUpdating}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isUpdating ? 'Updating...' : 'Update Process'}
          </button>
        )}
      </div>

      {showConfirmDialog && (
        <ConfirmOutputsDialog
          isOpen={showConfirmDialog}
          onClose={handleConfirmDialogClose}
        />
      )}
    </section>
  );
};

export default ProcessMaker;