import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import apiRoutes from './routes/api.js';

const app = express();
const server = http.createServer(app);

// Configure Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  }
});

// Attach socket io instance to req so controllers can emit events
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Connect to MongoDB Atlas
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', apiRoutes);

app.get('/', (req, res) => {
  res.send('🏥 SwasthyaSetu Full-Stack & WebSocket Server is Running...');
});

// WebSocket Connection Events
io.on('connection', (socket) => {
  console.log(`⚡ Client connected via WebSocket: ${socket.id}`);

  // Join specific room based on role (ASHA, DOCTOR, ADMIN)
  socket.on('join_role_room', (role) => {
    socket.join(role);
    console.log(`👤 User joined room: ${role}`);
  });

  // Emergency Ambulance Dispatch Broadcast
  socket.on('dispatch_emergency_ambulance', (emergencyData) => {
    console.log('🚨 Emergency Dispatch Triggered:', emergencyData);
    io.emit('emergency_alert_broadcast', {
      ...emergencyData,
      timestamp: new Date().toISOString()
    });
  });

  // Real-time E-Prescription Relay: Doctor -> All ASHA Workers
  socket.on('prescription_dispatched', (rxData) => {
    console.log('💊 Prescription Dispatched by Doctor:', rxData?.patientName);
    io.emit('prescription_dispatched', rxData);
  });

  // Real-time Patient Triage Update: ASHA -> Doctor Queue
  socket.on('patient_queue_updated', (patientData) => {
    console.log('📋 Patient Queue Updated:', patientData?.name, `[${patientData?.severity}]`);
    io.emit('patient_queue_updated', patientData);
  });

  // Real-time Patient Delete / Discharge Relay
  socket.on('patient_deleted', (patientId) => {
    console.log('🗑️ Patient Removed from Queue:', patientId);
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