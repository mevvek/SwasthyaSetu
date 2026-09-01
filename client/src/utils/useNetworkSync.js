import { useState, useEffect } from 'react';
import { getPendingSyncRecords, markRecordsAsSynced } from '../db/offlineDb';
import { syncBulkApi } from './api';

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
      setSyncMessage(`Syncing ${totalPending} offline records with MongoDB Atlas...`);

      // Real API Sync to backend
      await syncBulkApi({
        patients: unsyncedPatients,
        triageRecords: unsyncedTriage
      });

      const pIds = unsyncedPatients.map(p => p.id);
      const tIds = unsyncedTriage.map(t => t.localId);
      await markRecordsAsSynced(pIds, tIds);

      setSyncMessage(`Successfully synced ${totalPending} records to Cloud!`);
      if (onSyncComplete) onSyncComplete();

      setTimeout(() => setSyncMessage(''), 3500);
    } catch (err) {
      console.error('Background cloud sync failed:', err);
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