import React from 'react';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Login from './components/auth/Login';
import Navbar from './components/common/Navbar';
import AshaDashboard from './components/asha/AshaDashboard';
import DoctorDashboard from './components/doctor/DoctorDashboard';
import AdminDashboard from './components/admin/AdminDashboard';
import EmergencyBanner from './components/common/EmergencyBanner';

function AppContent() {
  const { user } = useAuth();

  // If user is not logged in, render the Login Gateway
  if (!user) {
    return <Login />;
  }

  // Once authenticated, render Navbar and respective role dashboard
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />
      <EmergencyBanner />
      
      <main className="flex-1">
        {user.role === 'ASHA_WORKER' && <AshaDashboard />}
        {user.role === 'DOCTOR' && <DoctorDashboard />}
        {user.role === 'ADMIN' && <AdminDashboard />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <SocketProvider>
          <AppContent />
        </SocketProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}