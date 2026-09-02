import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [activeEmergency, setActiveEmergency] = useState(null);

  useEffect(() => {
    // Connect to WebSocket server
    const socketInstance = io('http://localhost:5000', {
      transports: ['websocket']
    });

    socketInstance.on('connect', () => {
      console.log('⚡ Connected to WebSocket Server:', socketInstance.id);
      if (user?.role) {
        socketInstance.emit('join_role_room', user.role);
      }
    });

    // Listen for high-priority emergency alerts
    socketInstance.on('critical_emergency_alert', (data) => {
      setActiveEmergency(data);
      // Play brief alert sound using Web Audio API
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } catch (err) {
        console.warn('Audio feedback blocked by browser policies:', err);
      }
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [user?.role]);

  const clearEmergency = () => setActiveEmergency(null);

  return (
    <SocketContext.Provider value={{ socket, activeEmergency, clearEmergency }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);