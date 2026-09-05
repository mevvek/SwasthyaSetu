import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useSocket } from '../../context/SocketContext';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  PhoneOff, 
  Stethoscope, 
  Radio, 
  CheckCircle2, 
  AlertCircle, 
  Minimize2, 
  Maximize2, 
  Move, 
  Activity, 
  Pill,
  User
} from 'lucide-react';

export default function TeleConsultModal({ 
  patient, 
  isDoctor = false, 
  onClose, 
  onEndCall 
}) {
  const { socket } = useSocket() || {};

  const uniquePatientId = useMemo(() => {
    return String(patient?._id || patient?.id || patient?.patientId || '').trim();
  }, [patient]);

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [videoMuted, setVideoMuted] = useState(false);
  const [remoteVideoMuted, setRemoteVideoMuted] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  
  const [callStatus, setCallStatus] = useState('CONNECTING');
  const [busyReason, setBusyReason] = useState('');
  const [callSeconds, setCallSeconds] = useState(0);

  // Position & PiP Controls
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState(() => {
    const width = typeof window !== 'undefined' ? Math.min(window.innerWidth * 0.9, 820) : 820;
    const height = typeof window !== 'undefined' ? Math.min(window.innerHeight * 0.8, 480) : 480;
    const initialX = typeof window !== 'undefined' ? Math.max(15, (window.innerWidth - width) / 2) : 50;
    const initialY = typeof window !== 'undefined' ? Math.max(15, (window.innerHeight - height) / 2) : 50;
    return { x: initialX, y: initialY };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, posX: 0, posY: 0 });

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const timerRef = useRef(null);
  const channelRef = useRef(null);
  const masterTracksRef = useRef([]);

  const handleMouseDown = (e) => {
    if (e.target.closest('button')) return;
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragStartRef.current.startX;
      const deltaY = e.clientY - dragStartRef.current.startY;

      const currentWidth = isMinimized ? 330 : 820;
      const currentHeight = isMinimized ? 220 : 480;
      const maxX = Math.max(10, window.innerWidth - currentWidth - 10);
      const maxY = Math.max(10, window.innerHeight - currentHeight - 10);

      setPosition({
        x: Math.max(10, Math.min(maxX, dragStartRef.current.posX + deltaX)),
        y: Math.max(10, Math.min(maxY, dragStartRef.current.posY + deltaY))
      });
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isMinimized]);

  // Teardown Hardware Media
  const killHardwareMedia = useCallback(() => {
    masterTracksRef.current.forEach((track) => {
      try {
        track.stop();
        track.enabled = false;
      } catch (e) {}
    });
    masterTracksRef.current = [];

    if (localStream) {
      try {
        localStream.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
      } catch (e) {}
    }

    if (remoteStream) {
      try {
        remoteStream.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
      } catch (e) {}
    }

    if (localVideoRef.current) {
      localVideoRef.current.pause();
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.pause();
      remoteVideoRef.current.srcObject = null;
    }

    if (pcRef.current) {
      try {
        pcRef.current.getSenders().forEach((sender) => {
          if (sender.track) sender.track.stop();
        });
        pcRef.current.close();
      } catch (e) {}
      pcRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
  }, [localStream, remoteStream]);

  // Request Camera & Mic
  useEffect(() => {
    let activeStream = null;

    navigator.mediaDevices.getUserMedia({ 
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, 
      audio: { echoCancellation: true, noiseSuppression: true } 
    })
      .then((stream) => {
        activeStream = stream;
        masterTracksRef.current = stream.getTracks();
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      })
      .catch(() => {
        navigator.mediaDevices.getUserMedia({ video: false, audio: true })
          .then((aStream) => {
            activeStream = aStream;
            masterTracksRef.current = aStream.getTracks();
            setLocalStream(aStream);
          })
          .catch((e) => console.warn('Media fallback:', e));
      });

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((t) => {
          t.stop();
          t.enabled = false;
        });
      }
      killHardwareMedia();
    };
  }, []);

  // Sync ref to stream on rerenders
  useEffect(() => {
    if (localVideoRef.current && localStream && localVideoRef.current.srcObject !== localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, videoMuted]);

  // Signaling & Handshake
  useEffect(() => {
    if (!uniquePatientId) return;

    let channel = null;
    try {
      channel = new BroadcastChannel('swasthya_teleconsult_channel');
      channelRef.current = channel;
    } catch (e) {}

    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
    const pc = new RTCPeerConnection(configuration);
    pcRef.current = pc;

    if (localStream) {
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    }

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const candidatePayload = { candidate: event.candidate, patientId: uniquePatientId };
        if (socket) socket.emit('webrtc_ice_candidate', candidatePayload);
        if (channel) channel.postMessage({ type: 'WEBRTC_ICE_CANDIDATE', payload: candidatePayload });
      }
    };

    if (!isDoctor) {
      const payload = { patientId: uniquePatientId };
      if (socket) socket.emit('asha_joined_call', payload);
      if (channel) channel.postMessage({ type: 'ASHA_JOINED_CALL', payload });
      setCallStatus('CONNECTED');
    } else {
      setCallStatus('CONNECTED');
    }

    if (isDoctor && localStream) {
      pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          const offerPayload = { sdp: pc.localDescription, patientId: uniquePatientId };
          if (socket) socket.emit('webrtc_offer', offerPayload);
          if (channel) channel.postMessage({ type: 'WEBRTC_OFFER', payload: offerPayload });
        })
        .catch(() => {});
    }

    const handleIncomingSignal = async (type, payload) => {
      const incomingId = String(payload?.patientId || '').trim();
      if (incomingId !== uniquePatientId) return;

      if (type === 'DOCTOR_JOINED_CALL' || type === 'ASHA_JOINED_CALL') {
        setCallStatus('CONNECTED');
      } else if (type === 'DOCTOR_BUSY_REJECT') {
        setCallStatus('BUSY_REJECTED');
        setBusyReason(payload?.reason || 'Doctor is occupied with physical queue.');
      } else if (type === 'CALL_TERMINATED') {
        triggerEndSequence();
      } else if (type === 'TOGGLE_REMOTE_VIDEO') {
        const senderIsDoctor = payload?.senderRole === 'DOCTOR';
        if (isDoctor && !senderIsDoctor) {
          setRemoteVideoMuted(Boolean(payload?.videoMuted));
        } else if (!isDoctor && senderIsDoctor) {
          setRemoteVideoMuted(Boolean(payload?.videoMuted));
        }
      } else if (type === 'WEBRTC_OFFER' && !isDoctor && pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          const answerPayload = { sdp: pc.localDescription, patientId: uniquePatientId };
          if (socket) socket.emit('webrtc_answer', answerPayload);
          if (channel) channel.postMessage({ type: 'WEBRTC_ANSWER', payload: answerPayload });
          setCallStatus('CONNECTED');
        } catch (e) {}
      } else if (type === 'WEBRTC_ANSWER' && isDoctor && pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          setCallStatus('CONNECTED');
        } catch (e) {}
      } else if (type === 'WEBRTC_ICE_CANDIDATE' && pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } catch (e) {}
      }
    };

    if (channel) {
      channel.onmessage = (event) => {
        const { type, payload } = event.data || {};
        handleIncomingSignal(type, payload);
      };
    }

    if (socket) {
      socket.on('doctor_joined_call', (data) => handleIncomingSignal('DOCTOR_JOINED_CALL', data));
      socket.on('asha_joined_call', (data) => handleIncomingSignal('ASHA_JOINED_CALL', data));
      socket.on('doctor_busy_reject', (data) => handleIncomingSignal('DOCTOR_BUSY_REJECT', data));
      socket.on('webrtc_offer', (data) => handleIncomingSignal('WEBRTC_OFFER', data));
      socket.on('webrtc_answer', (data) => handleIncomingSignal('WEBRTC_ANSWER', data));
      socket.on('webrtc_ice_candidate', (data) => handleIncomingSignal('WEBRTC_ICE_CANDIDATE', data));
      socket.on('toggle_remote_video', (data) => handleIncomingSignal('TOGGLE_REMOTE_VIDEO', data));
      socket.on('call_terminated', (data) => handleIncomingSignal('CALL_TERMINATED', data));
    }

    return () => {
      if (channel) channel.close();
      if (socket) {
        socket.off('doctor_joined_call');
        socket.off('asha_joined_call');
        socket.off('doctor_busy_reject');
        socket.off('webrtc_offer');
        socket.off('webrtc_answer');
        socket.off('webrtc_ice_candidate');
        socket.off('toggle_remote_video');
        socket.off('call_terminated');
      }
      if (pc) pc.close();
    };
  }, [uniquePatientId, isDoctor, localStream, socket]);

  // Timer
  useEffect(() => {
    if (callStatus === 'CONNECTED') {
      timerRef.current = setInterval(() => setCallSeconds((p) => p + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const toggleVideo = () => {
    if (localStream) {
      const nextMuted = !videoMuted;
      localStream.getVideoTracks().forEach((t) => {
        t.enabled = !nextMuted;
      });
      setVideoMuted(nextMuted);

      const payload = { 
        patientId: uniquePatientId, 
        videoMuted: nextMuted,
        senderRole: isDoctor ? 'DOCTOR' : 'ASHA'
      };

      if (socket) socket.emit('toggle_remote_video', payload);
      try {
        const ch = new BroadcastChannel('swasthya_teleconsult_channel');
        ch.postMessage({ type: 'TOGGLE_REMOTE_VIDEO', payload });
        ch.close();
      } catch (e) {}
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const nextMuted = !audioMuted;
      localStream.getAudioTracks().forEach((t) => {
        t.enabled = !nextMuted;
      });
      setAudioMuted(nextMuted);
    }
  };

  // Guaranteed 1.2-second transition screen before unmounting
  const triggerEndSequence = useCallback(() => {
    setCallStatus('ENDING');
    killHardwareMedia();

    setTimeout(() => {
      if (onEndCall) onEndCall();
      if (onClose) onClose();
    }, 1200);
  }, [killHardwareMedia, onEndCall, onClose]);

  const handleUserEndClick = () => {
    const payload = { patientId: uniquePatientId };
    if (socket) socket.emit('call_terminated', payload);

    try {
      const ch = new BroadcastChannel('swasthya_teleconsult_channel');
      ch.postMessage({ type: 'CALL_TERMINATED', payload });
      ch.close();
    } catch (e) {}

    triggerEndSequence();
  };

  const triage = patient?.lastTriage || patient?.triage || {};

  const modalContent = (
    <div
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        position: 'fixed',
        zIndex: 999999
      }}
      className={`select-none shadow-2xl rounded-3xl overflow-hidden border border-slate-700/80 bg-slate-900 flex flex-col font-sans transition-[width] duration-200 ${
        isMinimized ? 'w-[330px]' : 'w-[94vw] sm:w-[820px] max-w-[820px]'
      }`}
    >
      {/* Draggable Header */}
      <div
        onMouseDown={handleMouseDown}
        className="p-3 sm:px-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-white cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2">
          <Move className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <div className="w-7 h-7 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center border border-teal-500/30 shrink-0">
            <Stethoscope className="w-3.5 h-3.5" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-black tracking-tight text-slate-100">
                SwasthyaSetu Tele-OPD
              </h3>
              <span className="px-1.5 py-0.2 rounded bg-teal-500/20 text-teal-300 text-[9px] font-extrabold uppercase">
                {isDoctor ? 'Doctor Desk' : 'Sub-Center'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate max-w-[170px]">
              {patient?.name || patient?.patientName} • {patient?.age}y
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {callStatus === 'CONNECTED' && (
            <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-[11px] font-mono font-bold border border-emerald-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {formatTimer(callSeconds)}
            </span>
          )}

          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={handleUserEndClick}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
            title="End Session"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      {callStatus === 'ENDING' ? (
        <div className="p-10 flex flex-col items-center justify-center text-center space-y-3 bg-slate-900 animate-fadeIn min-h-[220px]">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-black text-white tracking-wide">Consultation Completed</h4>
            <p className="text-xs text-slate-400 mt-1">Camera & microphone released • Syncing desk...</p>
          </div>
        </div>
      ) : (
        <div className={`p-3 sm:p-4 flex gap-3 bg-slate-900 ${isMinimized ? 'flex-col' : 'flex-col md:flex-row'}`}>
          {/* Video Streams */}
          <div className="flex-1 space-y-2.5">
            <div className={`grid gap-2.5 ${isMinimized ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
              
              {/* Local Box */}
              <div className={`relative rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner transition-all ${
                isMinimized ? 'h-28' : 'min-h-[190px]'
              }`}>
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`w-full h-full object-cover transform -scale-x-100 ${videoMuted ? 'hidden' : 'block'}`}
                />
                {videoMuted && (
                  <div className="flex flex-col items-center gap-1.5 text-slate-400 text-xs">
                    <VideoOff className="w-6 h-6 text-rose-400" />
                    <span className="text-[10px] font-bold">Your Camera is Off</span>
                  </div>
                )}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-slate-900/80 backdrop-blur-sm border border-slate-700/60 text-slate-200 text-[9px] font-bold">
                  {isDoctor ? 'Doctor (You)' : 'Field Desk (You)'}
                </div>
              </div>

              {/* Remote Box */}
              <div className={`relative rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center p-1.5 shadow-inner transition-all ${
                isMinimized ? 'h-28' : 'min-h-[190px]'
              }`}>
                {callStatus === 'CONNECTED' ? (
                  <div className="w-full h-full relative flex items-center justify-center">
                    {remoteVideoMuted ? (
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                          <User className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] font-bold text-slate-300">
                          {isDoctor ? 'ASHA Camera is Off' : 'Doctor Camera is Off'}
                        </span>
                      </div>
                    ) : (
                      <video
                        ref={(el) => {
                          if (!el) return;
                          remoteVideoRef.current = el;
                          if (remoteStream) {
                            if (el.srcObject !== remoteStream) el.srcObject = remoteStream;
                          } else if (localStream) {
                            if (el.srcObject !== localStream) el.srcObject = localStream;
                          }
                        }}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover rounded-xl"
                      />
                    )}

                    {!remoteVideoMuted && (
                      <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-sm text-[9px] font-bold text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                        {isDoctor ? 'ASHA Feed' : 'Doctor Feed'}
                      </div>
                    )}
                  </div>
                ) : callStatus === 'CONNECTING' ? (
                  <div className="text-center p-2 space-y-1.5">
                    <div className="w-8 h-8 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                      <Radio className="w-4 h-4 animate-pulse" />
                    </div>
                    <p className="text-[11px] font-bold text-white">Connecting consultation...</p>
                  </div>
                ) : callStatus === 'BUSY_REJECTED' ? (
                  <div className="text-center p-2 space-y-1.5">
                    <AlertCircle className="w-6 h-6 text-rose-400 mx-auto" />
                    <p className="text-[10px] font-bold text-white">Doctor is currently busy in OPD</p>
                    <button
                      type="button"
                      onClick={triggerEndSequence}
                      className="px-2.5 py-0.5 bg-slate-800 text-[10px] font-bold text-white rounded-lg"
                    >
                      Acknowledge
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between pt-0.5">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleAudio}
                  className={`p-2 rounded-xl font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                    audioMuted ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-slate-800 text-white'
                  }`}
                >
                  {audioMuted ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5 text-teal-400" />}
                </button>

                <button
                  type="button"
                  onClick={toggleVideo}
                  className={`p-2 rounded-xl font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                    videoMuted ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-slate-800 text-white'
                  }`}
                >
                  {videoMuted ? <VideoOff className="w-3.5 h-3.5 text-rose-400" /> : <Video className="w-3.5 h-3.5 text-teal-400" />}
                </button>
              </div>

              <button
                type="button"
                onClick={handleUserEndClick}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>End Call</span>
              </button>
            </div>
          </div>

          {/* Vitals Assist Panel */}
          {!isMinimized && (
            <div className="w-full md:w-64 bg-slate-950/80 rounded-2xl border border-slate-800 p-3 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                    <Activity className="w-3 h-3 text-teal-400" /> Vitals Finding
                  </span>
                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                    Live
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-center font-mono">
                  <div className="p-1.5 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-[8px] text-slate-400 block uppercase">BP</span>
                    <span className="text-xs font-black text-white">
                      {triage.bpSystolic ? `${triage.bpSystolic}/${triage.bpDiastolic || 80}` : (patient?.bp || '120/80')}
                    </span>
                  </div>
                  <div className="p-1.5 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-[8px] text-slate-400 block uppercase">SpO2</span>
                    <span className="text-xs font-black text-teal-400">
                      {triage.spo2 || patient?.spo2 || 98}%
                    </span>
                  </div>
                  <div className="p-1.5 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-[8px] text-slate-400 block uppercase">Pulse</span>
                    <span className="text-xs font-black text-white">
                      {triage.pulse || patient?.pulse || 72} bpm
                    </span>
                  </div>
                  <div className="p-1.5 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-[8px] text-slate-400 block uppercase">Temp</span>
                    <span className="text-xs font-black text-white">
                      {triage.temp || patient?.temp || 98.6}°F
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    ASHA Notes:
                  </span>
                  <p className="text-[10px] text-slate-300 bg-slate-900 p-2 rounded-xl border border-slate-800/80 italic leading-snug line-clamp-3">
                    "{patient?.fieldNotes || triage.notes || 'No symptoms recorded.'}"
                  </p>
                </div>
              </div>

              <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-[9px] text-teal-300 flex items-center gap-1">
                <Pill className="w-3.5 h-3.5 shrink-0" />
                <span>Rx form auto-focuses on call end.</span>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );

  return typeof document !== 'undefined'
    ? ReactDOM.createPortal(modalContent, document.body)
    : modalContent;
}