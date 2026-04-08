import { useState, useEffect } from 'react';
import AdminDashboard from '@/components/AdminDashboard';
import AuthDialog from '@/components/AuthDialog';
import io from 'socket.io-client';
import API_BASE from '@/lib/api';

const existingSocket = (window as any).socket;
const socket = existingSocket || io(API_BASE);
if (!existingSocket) {
  (window as any).socket = socket;
}

const Admin = ({ userData, onLogout }) => {
  const [members, setMembers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [currentUser, setCurrentUser] = useState(userData);
  const [showAuth, setShowAuth] = useState(!userData);

  useEffect(() => {
    if (currentUser) {
      refreshMembers();
      fetch(`${API_BASE}/announcements`).then(res => res.json()).then(setAnnouncements);
      // Realtime updates
      socket.on('member:new', member => setMembers(prev => [member, ...prev]));
      socket.on('announcement:new', announcement => setAnnouncements(prev => [announcement, ...prev]));
      return () => {
        socket.off('member:new');
        socket.off('announcement:new');
      };
    }
  }, [currentUser]);

  const refreshMembers = () => {
    fetch(`${API_BASE}/members`).then(res => res.json()).then(setMembers).catch(err => console.error('Refresh members failed', err));
  };

  const handleLogin = (role: 'admin' | 'member', userData: any) => {
    if (role === 'admin') {
      setCurrentUser(userData);
      setShowAuth(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setShowAuth(true);
    if (onLogout) onLogout();
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-primary/5 flex items-center justify-center">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">SMCF Admin Access</h1>
          <p className="text-muted-foreground">Please login with admin credentials</p>
        </div>
        <AuthDialog 
          open={showAuth} 
          onOpenChange={setShowAuth}
          onLogin={handleLogin}
        />
      </div>
    );
  }

  return <AdminDashboard userData={currentUser} members={members} announcements={announcements} onLogout={handleLogout} refreshMembers={refreshMembers} />;
};

export default Admin;
