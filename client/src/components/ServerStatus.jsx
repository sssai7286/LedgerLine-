import React, { useEffect, useState } from 'react';
import axios from 'axios';

/**
 * Shows a red banner if the backend API is unreachable.
 * Polls every 15 seconds.
 */
export default function ServerStatus() {
  const [down, setDown] = useState(false);

  const check = async () => {
    try {
      await axios.get('/api/health', { timeout: 4000 });
      setDown(false);
    } catch {
      setDown(true);
    }
  };

  useEffect(() => {
    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, []);

  if (!down) return null;

  return (
    <div role="alert" style={s.banner}>
      ⚠️ <strong>Backend is not running.</strong> Start the server:&nbsp;
      <code style={s.code}>Set-Location server; npm run dev</code>
      &nbsp;and make sure PostgreSQL is running on port 5432.
    </div>
  );
}

const s = {
  banner: {
    background: '#fef2f2', borderBottom: '1px solid #fca5a5', color: '#991b1b',
    padding: '10px 24px', fontSize: 13, textAlign: 'center',
  },
  code: {
    background: '#fee2e2', borderRadius: 4, padding: '1px 6px',
    fontFamily: 'monospace', fontSize: 12,
  },
};
