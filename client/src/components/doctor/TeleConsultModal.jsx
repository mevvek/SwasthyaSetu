import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  PhoneOff, 
  Signal, 
  User, 
  HeartPulse, 
  ShieldAlert,
  Maximize2
} from 'lucide-react';

export default function TeleConsultModal({ patient, onClose, onEndCall }) {
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState('Good (Low-Bandwidth Mode)');
  const localVideoRef = useRef(null);
  const streamRef = useRef(null);

  // Initialize camera stream with rural-friendly low bandwidth constraints
  useEffect(() => {
    let active = true;

    async function startMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 480, max: 640 },
            height: { ideal: 360, max: 480 },
            frameRate: { ideal: 15, max: 20 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        });

        if (active && localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          streamRef.current = stream;
        }
      } catch (err) {
        console.warn('Camera access denied or unavailable. Running in audio/simulated mode.', err);
      }
    }

    startMedia();

    // Call timer interval
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => {
      active = false;
      clearInterval(timer);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const toggleVideo = () => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
      <div className="bg-slate-900 w-full max-w-4xl rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        
        {/* Top Video Header */}
        <div className="px-6 py-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                Tele-OPD Live: {patient?.patientName || 'Field Patient'}
                <span className="text-[10px] font-mono font-normal text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                  {formatTime(callDuration)}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Village: {patient?.village} • Facilitated by ASHA: {patient?.ashaName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
            <Signal className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline text-[11px] text-emerald-400">{connectionQuality}</span>
          </div>
        </div>

        {/* Video Feeds Grid */}
        <div className="relative flex-1 bg-slate-950 p-4 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-[320px] sm:min-h-[400px]">
          
          {/* Remote Feed (ASHA Field Video) */}
          <div className="relative bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center">
            <div className="text-center p-6 space-y-2">
              <div className="w-16 h-16 rounded-full bg-teal-950 text-teal-400 border border-teal-700 flex items-center justify-center mx-auto text-xl font-bold">
                {patient?.patientName?.charAt(0) || 'P'}
              </div>
              <h4 className="text-sm font-bold text-white">{patient?.patientName}</h4>
              <p className="text-xs text-slate-400">ASHA Field Camera Feed Connected</p>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-[10px] text-teal-400 font-mono">
                <HeartPulse className="w-3 h-3 text-rose-500" /> BP: {patient?.vitals?.bp} | SpO2: {patient?.vitals?.spO2}
              </div>
            </div>

            <span className="absolute bottom-3 left-3 bg-slate-950/80 text-white text-[10px] font-semibold px-2 py-0.5 rounded backdrop-blur-sm">
              ASHA Field Unit ({patient?.ashaName})
            </span>
          </div>

          {/* Local Feed (Doctor Camera) */}
          <div className="relative bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center">
            {isVideoEnabled ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover mirror"
              />
            ) : (
              <div className="text-center text-slate-500 text-xs">
                <VideoOff className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                Doctor Camera Paused
              </div>
            )}

            <span className="absolute bottom-3 left-3 bg-slate-950/80 text-white text-[10px] font-semibold px-2 py-0.5 rounded backdrop-blur-sm">
              Doctor (PHC MO)
            </span>
          </div>

        </div>

        {/* Call Controls Bar */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAudio}
              className={`p-3 rounded-2xl transition-all ${
                isAudioEnabled ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-rose-600 text-white'
              }`}
              title={isAudioEnabled ? 'Mute Mic' : 'Unmute Mic'}
            >
              {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>

            <button
              onClick={toggleVideo}
              className={`p-3 rounded-2xl transition-all ${
                isVideoEnabled ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-rose-600 text-white'
              }`}
              title={isVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
            >
              {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
          </div>

          {/* End Call Button */}
          <button
            onClick={() => {
              if (onEndCall) onEndCall();
              onClose();
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all active:scale-95"
          >
            <PhoneOff className="w-4 h-4" />
            End Tele-Consult
          </button>
        </div>

      </div>
    </div>
  );
}