import { useCallback, useEffect, useRef, useState } from 'react';
import { enqueueOfflineAction, readQueuedActions, removeQueuedAction } from './mysteryOfflineDb';
import { chooseInvestigationBranch, setEvidenceTrust, submitFinalCase, unlockEvidenceByQr } from '../services/mystery.api';

async function runAction(teamId, action) {
  switch (action.type) {
    case 'unlock-qr': return unlockEvidenceByQr(teamId, action.payload.qrSecret);
    case 'branch': return chooseInvestigationBranch(teamId, action.payload.branchId, action.payload.leadId);
    case 'trust': return setEvidenceTrust(teamId, action.payload.evidenceId, action.payload.decision);
    case 'final-submit': return submitFinalCase(teamId, action.payload);
    default: return null;
  }
}

export function useMysteryOfflineQueue(teamId) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const flushingRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    if (!teamId) return;
    const items = await readQueuedActions(teamId);
    setPendingCount(items.length);
  }, [teamId]);

  const flush = useCallback(async () => {
    if (!teamId || flushingRef.current || !navigator.onLine) return;
    flushingRef.current = true;
    try {
      let items = await readQueuedActions(teamId);
      items = items.sort((a, b) => a.queuedAt - b.queuedAt);
      for (const item of items) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await runAction(teamId, item);
          // eslint-disable-next-line no-await-in-loop
          await removeQueuedAction(item.id);
        } catch { break; }
      }
    } finally {
      flushingRef.current = false;
      refreshPendingCount();
    }
  }, [teamId, refreshPendingCount]);

  const queueAction = useCallback(async (action) => {
    if (!teamId) return;
    await enqueueOfflineAction(teamId, action);
    refreshPendingCount();
  }, [teamId, refreshPendingCount]);

  useEffect(() => { refreshPendingCount(); }, [refreshPendingCount]);

  useEffect(() => {
    const onOnline = () => { setIsOnline(true); flush(); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    if (navigator.onLine) flush();
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [flush]);

  return { isOnline, pendingCount, queueAction, flush };
}