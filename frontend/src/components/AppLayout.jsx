import Sidebar from './Sidebar';

export default function AppLayout({ user, onLogout, activePage, children }) {
  return (
    <div
      className="flex overflow-hidden"
      style={{ height: '100vh', width: '100vw', background: '#080810' }}
    >
      <Sidebar user={user} onLogout={onLogout} activePage={activePage} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
