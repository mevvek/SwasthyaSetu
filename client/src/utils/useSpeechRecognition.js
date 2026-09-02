import { useState, useEffect, useRef } from 'react';

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);

  // Native Web Audio API sound (Beep "tunnnnnnn")
  const playBeep = (freq = 880, type = 'sine', duration = 0.18) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio feedback failed:', e);
    }
  };

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognizer = new SpeechRecognition();
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.lang = 'hi-IN'; // Mixed Hindi/English Indian dialect support

    recognizer.onresult = (event) => {
      let liveText = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          liveText += event.results[i][0].transcript + ' ';
        }
      }
      if (liveText.trim()) {
        setTranscript(liveText.trim());
      }
    };

    recognizer.onerror = (err) => {
      console.error('Speech recognition error:', err);
      setIsListening(false);
    };

    recognizer.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognizer;
  }, []);

  const startListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please use Google Chrome or Edge.');
      return;
    }
    try {
      playBeep(880, 'sine', 0.22); // "Tunnnnnnn" chime on start
      setTranscript('');
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      console.warn('Recognition already started or permission pending', e);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      playBeep(440, 'sine', 0.15); // Low tone on stop
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    hasSupport: !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  };
}