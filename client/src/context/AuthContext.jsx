import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

const profiles = {
  ASHA_WORKER: {
    id: 'u-asha-01',
    name: 'Sunita Devi (Field ASHA)',
    role: 'ASHA_WORKER',
    phcCenter: 'PHC Kunda Hub',
    token: 'mock-jwt-token-asha'
  },
  DOCTOR: {
    id: 'u-doc-01',
    name: 'Dr. Arvind Sharma (MO)',
    role: 'DOCTOR',
    phcCenter: 'PHC Tele-OPD Hub',
    token: 'mock-jwt-token-doctor'
  },
  ADMIN: {
    id: 'u-admin-01',
    name: 'District Medical Officer (Admin)',
    role: 'ADMIN',
    phcCenter: 'District Health Directorate',
    token: 'mock-jwt-token-admin'
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('swasthya_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing stored user', e);
      }
    }
    return null; // By default shows Login Page
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('swasthya_user', JSON.stringify(user));
      localStorage.setItem('swasthya_token', user.token || 'mock-token');
    } else {
      localStorage.removeItem('swasthya_user');
      localStorage.removeItem('swasthya_token');
    }
  }, [user]);

  const loginWithRole = (role) => {
    if (profiles[role]) {
      setUser(profiles[role]);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('swasthya_user');
    localStorage.removeItem('swasthya_token');
  };

  return (
    <AuthContext.Provider value={{ user, loginWithRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);