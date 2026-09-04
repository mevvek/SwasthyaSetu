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
  // Always start with null so fresh launch/tab strictly lands on Login Gateway
  const [user, setUser] = useState(() => {
    // sessionStorage maintains state on page reload, but resets when tab/browser restarts
    const saved = sessionStorage.getItem('swasthya_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing stored session', e);
      }
    }
    return null; // By default ALWAYS show Login
  });

  useEffect(() => {
    if (user) {
      sessionStorage.setItem('swasthya_user', JSON.stringify(user));
      sessionStorage.setItem('swasthya_token', user.token || 'mock-token');
    } else {
      sessionStorage.removeItem('swasthya_user');
      sessionStorage.removeItem('swasthya_token');
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
    sessionStorage.clear();
    localStorage.clear();
  };

  return (
    <AuthContext.Provider value={{ user, loginWithRole, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);