import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import apiRoutes from './routes/api.js';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  }
});

app.use((req, res, next) => {
  req.io = io;
  next();
});

connectDB();

app.use(cors());
app.use(express.json());

app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.send('🏥 SwasthyaSetu Full-Stack & WebSocket Server is Running...');
});

io.on('connection', (socket) => {
  console.log(`⚡ Client connected via WebSocket: ${socket.id}`);

  socket.on('join_role_room', (role) => {
    socket.join(role);
    console.log(`👤 User joined room: ${role}`);
  });

  /* =========================================================
     TELE-OPD MULTI-DEVICE & CROSS-BROWSER SIGNALING GATEWAY
     ========================================================= */

  // ASHA rings Doctor
  socket.on('tele_call_requested', (data) => {
    console.log('📞 Tele-Call Requested for Patient:', data?.patientName, `[ID: ${data?.patientId}]`);
    socket.broadcast.emit('tele_call_requested', data);
  });

  // Doctor rings ASHA
  socket.on('doctor_call_initiated', (data) => {
    console.log('👨‍⚕️ Doctor Calling ASHA for Patient:', data?.patientName, `[ID: ${data?.patientId}]`);
    socket.broadcast.emit('doctor_call_initiated', data);
  });

  // Call Accepted Handshakes
  socket.on('doctor_joined_call', (data) => {
    console.log('👨‍⚕️ Doctor Joined Call:', data?.patientId);
    socket.broadcast.emit('doctor_joined_call', data);
  });

  socket.on('asha_joined_call', (data) => {
    console.log('👩‍⚕️ ASHA Joined Call:', data?.patientId);
    socket.broadcast.emit('asha_joined_call', data);
  });

  socket.on('doctor_busy_reject', (data) => {
    console.log('⚠️ Doctor Busy for Patient:', data?.patientId);
    socket.broadcast.emit('doctor_busy_reject', data);
  });

  // WebRTC P2P
  socket.on('webrtc_offer', (data) => {
    socket.broadcast.emit('webrtc_offer', data);
  });

  socket.on('webrtc_answer', (data) => {
    socket.broadcast.emit('webrtc_answer', data);
  });

  socket.on('webrtc_ice_candidate', (data) => {
    socket.broadcast.emit('webrtc_ice_candidate', data);
  });

  // Remote Toggles
  socket.on('toggle_remote_video', (data) => {
    socket.broadcast.emit('toggle_remote_video', data);
  });

  // Termination Relay
  socket.on('call_terminated', (data) => {
    console.log('📴 Tele-Consultation Terminated for Patient:', data?.patientId);
    socket.broadcast.emit('call_terminated', data);
  });

  /* =========================================================
     CLINICAL & EMERGENCY RELAYS
     ========================================================= */

  socket.on('dispatch_emergency_ambulance', (emergencyData) => {
    console.log('🚨 Emergency Dispatch Triggered:', emergencyData);
    io.emit('emergency_alert_broadcast', {
      ...emergencyData,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('prescription_dispatched', (rxData) => {
    console.log('💊 Prescription Dispatched:', rxData?.patientName);
    io.emit('prescription_dispatched', rxData);
  });

  socket.on('patient_queue_updated', (patientData) => {
    console.log('📋 Patient Queue Updated:', patientData?.name);
    io.emit('patient_queue_updated', patientData);
  });

  socket.on('patient_deleted', (patientId) => {
    console.log('🗑️ Patient Removed:', patientId);
    io.emit('patient_deleted', patientId);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server with WebSockets running on port ${PORT}`);
});