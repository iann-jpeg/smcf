import { useState, useEffect } from 'react';
import AdminDashboard from '@/components/AdminDashboard';
import AuthDialog from '@/components/AuthDialog';
import io from 'socket.io-client';

const socket = io('http://localhost:4000');

const Admin = ({ userData, onLogout }) => {
  const [members, setMembers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [currentUser, setCurrentUser] = useState(userData);
  const [showAuth, setShowAuth] = useState(!userData);

  useEffect(() => {
    if (currentUser) {
      // Initial fetch
      fetch('http://localhost:4000/members').then(res => res.json()).then(setMembers);
      fetch('http://localhost:4000/announcements').then(res => res.json()).then(setAnnouncements);
      // Realtime updates
      socket.on('member:new', member => setMembers(prev => [member, ...prev]));
      socket.on('announcement:new', announcement => setAnnouncements(prev => [announcement, ...prev]));
      return () => {
        socket.off('member:new');
        socket.off('announcement:new');
      };
    }
  }, [currentUser]);

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

  return <AdminDashboard userData={currentUser} members={members} announcements={announcements} onLogout={handleLogout} />;
};

export default Admin;
