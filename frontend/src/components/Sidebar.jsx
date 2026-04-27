import { useNavigate } from 'react-router-dom';
import {
  Inbox, Layers, Zap, Users, Settings, LogOut,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', icon: Inbox,  label: 'Dashboard',   path: '/',         testId: 'dashboard-btn' },
  { id: 'pipeline',  icon: Layers, label: 'Pipeline',    path: '/pipeline', testId: 'pipeline-btn' },
  { id: 'review',    icon: Zap,    label: 'Review Mode', path: '/review',   testId: 'review-mode-btn' },
  { id: 'contacts',  icon: Users,  label: 'Contacts',    path: '/contacts', testId: 'contacts-btn' },
];

function getInitials(email) {
  if (!email) return 'U';
  const local = email.split('@')[0];
  const parts = local.split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local[0].toUpperCase();
}

export default function Sidebar({ user, onLogout, activePage }) {
  const navigate = useNavigate();

  return (
    <div
      data-testid="app-sidebar"
      className="flex flex-col items-center shrink-0"
      style={{
        width: 60,
        height: '100vh',
        background: '#0d0d1a',
        borderRight: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Logo mark */}
      <div className="mt-4 mb-2 shrink-0">
        <div
          className="flex items-center justify-center font-bold select-none"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #7c6dfa, #5b4de8)',
            color: '#fff',
            fontSize: 15,
            letterSpacing: '-0.03em',
          }}
        >
          f
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1 flex flex-col items-center justify-center gap-1 w-full py-4">
        {NAV_ITEMS.map(({ id, icon: Icon, label, path, testId }) => {
          const isActive = activePage === id;
          return (
            <button
              key={id}
              data-testid={testId}
              onClick={() => navigate(path)}
              title={label}
              className="flex items-center justify-center transition-all"
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: isActive ? 'rgba(124,109,250,0.15)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: isActive ? '#7c6dfa' : 'rgba(255,255,255,0.35)',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.75)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.35)';
                }
              }}
            >
              <Icon size={18} />
            </button>
          );
        })}
      </div>

      {/* Bottom items */}
      <div className="flex flex-col items-center gap-1 pb-4 shrink-0">
        {/* Settings */}
        <button
          data-testid="settings-btn"
          onClick={() => navigate('/settings')}
          title="Settings"
          className="flex items-center justify-center transition-all"
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: activePage === 'settings' ? 'rgba(124,109,250,0.15)' : 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: activePage === 'settings' ? '#7c6dfa' : 'rgba(255,255,255,0.35)',
          }}
          onMouseEnter={(e) => {
            if (activePage !== 'settings') {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.75)';
            }
          }}
          onMouseLeave={(e) => {
            if (activePage !== 'settings') {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgba(255,255,255,0.35)';
            }
          }}
        >
          <Settings size={18} />
        </button>

        {/* User avatar */}
        {user && (
          <div
            title={user.email || 'Account'}
            className="flex items-center justify-center font-bold select-none"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(124,109,250,0.2)',
              color: '#a89cf7',
              fontSize: 11,
              fontWeight: 700,
              marginTop: 2,
            }}
          >
            {getInitials(user.email)}
          </div>
        )}

        {/* Logout */}
        <button
          onClick={onLogout}
          title="Log out"
          className="flex items-center justify-center transition-all mt-1"
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.25)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(240,82,82,0.08)';
            e.currentTarget.style.color = '#f05252';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'rgba(255,255,255,0.25)';
          }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
}
