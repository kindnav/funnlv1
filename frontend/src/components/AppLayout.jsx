import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { getIntegrationSettings } from '../lib/api';

export default function AppLayout({ user, onLogout, activePage, children }) {
  const [integrationSettings, setIntegrationSettings] = useState(null);

  useEffect(() => {
    getIntegrationSettings()
      .then(d => { if (d) setIntegrationSettings(d); })
      .catch(() => {});
  }, []);

  return (
    <div
      className="flex overflow-hidden"
      style={{ height: '100vh', width: '100vw', background: '#080810' }}
    >
      <Sidebar
        user={user}
        onLogout={onLogout}
        activePage={activePage}
        integrationSettings={integrationSettings}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
