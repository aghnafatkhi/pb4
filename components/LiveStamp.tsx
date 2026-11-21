'use client';

import { useEffect, useState } from 'react';

const formatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

// Tanggal "hari ini" yang selalu segar di mock landing; dikosongkan saat SSR
// agar tidak bentrok dengan hydration.
export default function LiveStamp() {
  const [stamp, setStamp] = useState('');

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setStamp(formatter.format(new Date()).replace(/\//g, ' · '));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return <>{stamp}</>;
}
