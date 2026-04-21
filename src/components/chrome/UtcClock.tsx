import { useEffect, useState } from 'react';
import { Text } from '@mantine/core';

function formatUtc(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

export function UtcClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <Text size="xs" ff="monospace" c="dimmed" data-mono>
      {formatUtc(now)}
    </Text>
  );
}
