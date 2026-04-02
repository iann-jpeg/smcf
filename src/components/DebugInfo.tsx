// Debug component to show app state
interface DebugInfoProps {
  userRole: string | null;
  currentUser: any;
  showAuth: boolean;
}

const DebugInfo = ({ userRole, currentUser, showAuth }: DebugInfoProps) => {
  return (
    <div className="fixed top-0 right-0 bg-red-600 text-white p-2 text-xs z-50 max-w-sm">
      <div><strong>Debug Info:</strong></div>
      <div>userRole: {userRole || 'null'}</div>
      <div>currentUser: {currentUser ? JSON.stringify(currentUser, null, 2) : 'null'}</div>
      <div>showAuth: {showAuth ? 'true' : 'false'}</div>
    </div>
  );
};

export default DebugInfo;