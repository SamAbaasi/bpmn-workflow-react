// hooks/useProcesses.ts
import { useState, useCallback } from 'react';
import { apiService } from '../services/api';

export interface Process {
  id: number;
  name: string;
  bpmn: string[];
}

export const useProcesses = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getDiagramByProcessId = useCallback(async (processId: number): Promise<Process> => {
    setIsLoading(true);
    setError(null);
    try {
// Add proper type assertion:
    const response = await apiService.get(`process/${processId}/bpmn`);
    return response as Process;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load diagram');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createProcess = useCallback(async (xmlFile: File): Promise<void> => {
    setIsCreating(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('xml', xmlFile);
      await apiService.post('bpmn/', formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create process');
      throw err;
    } finally {
      setIsCreating(false);
    }
  }, []);

  const updateProcess = useCallback(async (processId: number, xmlFile: File): Promise<void> => {
    setIsUpdating(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('xml', xmlFile);
      formData.append('prev_pk', processId.toString());
      await apiService.put('bpmn/', formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update process');
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  return {
    getDiagramByProcessId,
    createProcess,
    updateProcess,
    isLoading,
    isCreating,
    isUpdating,
    error,
  };
};