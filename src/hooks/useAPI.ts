// hooks/useAPI.ts
import { useState, useCallback } from 'react';

export const useAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async <T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> => {
    setLoading(true);
    setError(null);

    try {
      // Get auth token from localStorage
      const userStr = localStorage.getItem('ngx-app.current-user');
      const user = userStr ? JSON.parse(userStr) : null;
      
      // Get CSRF token from cookies
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];
        
// Replace the problematic header assignments:
const headers: Record<string, string> = {
  'Accept': 'application/json, text/plain, */*'
};

if (user?.auth_token) {
  headers['Authorization'] = `Token ${user.auth_token}`;
}

if (csrfToken) {
  headers['X-CSRFToken'] = csrfToken;
}
      const config: RequestInit = {
        ...options,
        headers,
      };

      const response = await fetch(url.startsWith('/') ? `/api${url}` : url, config);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text() as T;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const get = useCallback(<T>(url: string): Promise<T> => {
    return request<T>(url, { method: 'GET' });
  }, [request]);

  const post = useCallback(<T>(url: string, data?: any): Promise<T> => {
    const options: RequestInit = { method: 'POST' };
    
    if (data instanceof FormData) {
      options.body = data;
    } else if (data) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(data);
    }

    return request<T>(url, options);
  }, [request]);

  const put = useCallback(<T>(url: string, data?: any): Promise<T> => {
    const options: RequestInit = { method: 'PUT' };
    
    if (data instanceof FormData) {
      options.body = data;
    } else if (data) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(data);
    }

    return request<T>(url, options);
  }, [request]);

  const del = useCallback(<T>(url: string): Promise<T> => {
    return request<T>(url, { method: 'DELETE' });
  }, [request]);

  return {
    request,
    get,
    post,
    put,
    delete: del,
    loading,
    error,
  };
};