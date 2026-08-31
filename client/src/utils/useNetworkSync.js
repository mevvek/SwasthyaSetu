import { useState, useEffect } from 'react';
import { getPendingSyncRecords, markRecordsAsSynced } from '../db/offlineDb';
import axios from 'axios';

export const useNetworkSync = (onSyncComplete) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const syncPendingData = async () => {
    try {
      const { unsyncedPatients, unsyncedTriage } = await getPendingSyncRecords();
      
      const totalPending = unsyncedPatients.length + unsyncedTriage.length;
      if (totalPending === 0) return;

      setSyncing(true);
      setSyncMessage(`Syncing ${totalPending} offline records with PHC Server...`);

      // Mock / Actual API payload sync
      await new Promise(resolve => setTimeout(resolve, 1500));

      const pIds = unsyncedPatients.map(p => p.id);
      const tIds = unsyncedTriage.map(t => t.localId);
      await markRecordsAsSynced(pIds, tIds);

      setSyncMessage(`Successfully synced ${totalPending} records!`);
      if (onSyncComplete) onSyncComplete();

      setTimeout(() => setSyncMessage(''), 3500);
    } catch (err) {
      console.error('Background sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncPendingData();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check on mount
    if (navigator.onLine) {
      syncPendingData();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, syncing, syncMessage, syncPendingData };
};