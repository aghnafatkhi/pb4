'use client';

import { useState, useEffect } from 'react';
import MainApp from '@/components/duo/MainApp';
import { getLocalUid } from '@/components/duo/shared';

export default function App() {
  const [user, setUser] = useState<{uid: string} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setUser({ uid: getLocalUid() });
      setLoading(false);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 text-zinc-600 font-mono text-sm">
        Memuat...
      </div>
    );
  }

  if (!user) return null;

  return <MainApp user={user} />;
}
