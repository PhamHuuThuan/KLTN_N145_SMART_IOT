import { useState, useCallback } from 'react';
import apiService from '../services/apiService';

export const useOutletControl = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Control outlet
  const controlOutlet = useCallback(async (action, deviceId, outletId = 'o1') => {
    if (!deviceId) {
      setError('No device selected');
      return false;
    }

    try {
      setLoading(true);
      setError(null);

      let response;
      switch (action) {
        case 'toggle':
          response = await apiService.toggleOutlet(deviceId, outletId);
          break;
        case 'on':
          response = await apiService.turnOnOutlet(deviceId, outletId);
          break;
        case 'off':
          response = await apiService.turnOffOutlet(deviceId, outletId);
          break;
        default:
          throw new Error('Invalid action');
      }

      return response.success;
    } catch (err) {
      console.error('Error controlling outlet:', err);
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    controlOutlet,
  };
};
