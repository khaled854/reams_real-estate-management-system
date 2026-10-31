import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

/**
 * useApi
 * Generic hook for making API calls with loading/error state management.
 *
 * @param {Function} apiFunction - An async function that performs the API call
 * @returns {{ execute, data, loading, error }}
 *
 * Usage:
 *   const { execute, data, loading } = useApi(propertyService.getAll);
 *   useEffect(() => { execute(); }, []);
 */
function useApi(apiFunction) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const execute = useCallback(
    async (...args) => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiFunction(...args);
        setData(result);
        return result;
      } catch (err) {
        const message =
          err.response?.data?.message ?? err.message ?? 'An error occurred';
        setError(message);
        toast.error(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiFunction]
  );

  return { execute, data, loading, error };
}

export default useApi;
