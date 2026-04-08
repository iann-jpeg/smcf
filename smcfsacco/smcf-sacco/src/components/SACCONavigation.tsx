import { Link, useLocation } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  Briefcase,
  BarChart3,
  Settings,
  Home,
  LogOut,
  Bell,
  Search
} from 'lucide-react';

export function SACCONavbar() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname.startsWith(path);

  const navItems = [
    { icon: Home, label: 'Dashboard', path: '/sacco', badge: null },
    { icon: Users, label: 'Shareholders', path: '/sacco/shareholders', badge: '234' },
    { icon: Briefcase, label: 'Share Structure', path: '/sacco/shares', badge: '45.6K' },
    { icon: BarChart3, label: 'Analytics', path: '/sacco/analytics', badge: null }
  ];

  return (
    <nav className="border-b bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Branding */}
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-yellow-500 to-green-500 p-2 rounded-lg">
              <Users className="h-6 w-6 text-white" />
            </div>
            <Link to="/sacco" className="flex flex-col">
              <span className="font-bold text-lg text-gray-900">
                <span className="text-yellow-600">SMCF</span><span className="text-green-600"> SACCO</span>
              </span>
              <span className="text-xs text-gray-600">Shareholders Module</span>
            </Link>
          </div>

          {/* Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="search"
                placeholder="Search shareholders, documents..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative" title="Notifications">
              <Bell className="h-5 w-5" />
              <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-600" variant="default">
                3
              </Badge>
            </Button>

            {/* Settings */}
            <Button variant="ghost" size="icon" title="Settings">
              <Settings className="h-5 w-5" />
            </Button>

            {/* Logout */}
            <Button variant="ghost" size="icon" title="Logout">
              <LogOut className="h-5 w-5" />
            </Button>

            {/* User Avatar */}
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l">
              <div className="h-8 w-8 bg-yellow-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                AD
              </div>
              <div className="hidden md:flex flex-col">
                <span className="text-sm font-medium text-gray-900">Admin</span>
                <span className="text-xs text-gray-600">Administrator</span>
              </div>
            </div>
          </div>
        </div>

        {/* Secondary Navigation */}
        <div className="flex gap-1 -mb-px">
          {navItems.map(({ icon: Icon, label, path, badge }) => (
            <Link
              key={path}
              to={path}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                isActive(path)
                  ? 'border-yellow-500 text-yellow-600 bg-yellow-50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {badge && <Badge variant="outline" className="ml-1 text-xs">{badge}</Badge>}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

export function SACCOSidebar() {
  const menuGroups = [
    {
      label: 'Main',
      items: [
        { icon: Home, label: 'Dashboard', path: '/sacco' },
        { icon: Users, label: 'Shareholders', path: '/sacco/shareholders' },
        { icon: Briefcase, label: 'Share Structure', path: '/sacco/shares' }
      ]
    },
    {
      label: 'Finance',
      items: [
        { icon: BarChart3, label: 'Dividends', path: '/sacco/dividends' },
        { icon: BarChart3, label: 'Reserves', path: '/sacco/reserves' },
        { icon: BarChart3, label: 'Reports', path: '/sacco/reports' }
      ]
    },
    {
      label: 'Administration',
      items: [
        { icon: Settings, label: 'Policies', path: '/sacco/policies' },
        { icon: Settings, label: 'Settings', path: '/sacco/settings' }
      ]
    }
  ];

  const location = useLocation();

  return (
    <aside className="w-56 border-r bg-gray-50 h-screen overflow-auto">
      <div className="p-4 space-y-8">
        {menuGroups.map((group) => (
          <div key={group.label}>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider px-3 mb-2">
              {group.label}
            </p>
            <nav className="space-y-1">
              {group.items.map(({ icon: Icon, label, path }) => (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === path
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        ))}
      </div>
    </aside>
  );
}
