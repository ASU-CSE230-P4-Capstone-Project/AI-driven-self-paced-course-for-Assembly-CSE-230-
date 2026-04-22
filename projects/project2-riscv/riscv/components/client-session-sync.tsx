'use client';

import { useLayoutEffect } from 'react';
import {
  clearClientSessionData,
  setClientSessionData,
  type ClientSessionData,
} from '@/components/client-session';

type ClientSessionSyncProps = {
  session: ClientSessionData | null;
};

export default function ClientSessionSync({
  session,
}: ClientSessionSyncProps) {
  useLayoutEffect(() => {
    if (!session?.username) {
      clearClientSessionData();
      return;
    }

    setClientSessionData(session);
  }, [session]);

  return null;
}
