import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Navbar from './components/common/Navbar';
import Login from './components/auth/Login';
import EmergencyBanner from './components/common/EmergencyBanner';
import AshaDashboard from './components/asha/AshaDashboard';
import DoctorDashboard from './components/doctor/DoctorDashboard';
import AdminDashboard from './components/admin/AdminDashboard';

function MainApp() {
  const { user } = useAuth();

  // Show Login page if not logged in
  if (!user) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      <Navbar />
      <EmergencyBanner />
      <main>
        {user.role === 'ASHA_WORKER' && <AshaDashboard />}
        {user.role === 'DOCTOR' && <DoctorDashboard />}
        {user.role === 'ADMIN' && <AdminDashboard />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <MainApp />
      </SocketProvider>
    </AuthProvider>
  );
}