import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { MapPin, Search, PlusCircle, LayoutDashboard, LogOut, LogIn } from 'lucide-react';

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <Link to="/" className="flex items-center gap-2 text-primary-700 font-bold text-xl">
          <MapPin className="w-6 h-6" />
          FixMyCampus
        </Link>

        <nav className="flex items-center gap-3">
          <Link to="/search" className="p-2 text-gray-600 hover:text-primary-600 rounded-lg hover:bg-gray-100" title="Search">
            <Search className="w-5 h-5" />
          </Link>

          {user && (
            <Link to="/report" className="flex items-center gap-1 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
              <PlusCircle className="w-4 h-4" />
              Report Issue
            </Link>
          )}

          {user && (user.role === 'admin' || user.role === 'department_head') && (
            <Link to="/admin" className="p-2 text-gray-600 hover:text-primary-600 rounded-lg hover:bg-gray-100" title="Dashboard">
              <LayoutDashboard className="w-5 h-5" />
            </Link>
          )}

          {user ? (
            <button onClick={() => { logout(); navigate('/'); }} className="flex items-center gap-1 px-3 py-2 text-gray-600 hover:text-red-600 rounded-lg hover:bg-gray-100 text-sm">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{user.name}</span>
            </button>
          ) : (
            <Link to="/login" className="flex items-center gap-1 px-3 py-2 text-gray-600 hover:text-primary-600 rounded-lg hover:bg-gray-100 text-sm">
              <LogIn className="w-4 h-4" />
              Login
            </Link>
          )}
        </nav>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
