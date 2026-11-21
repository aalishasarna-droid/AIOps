"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";

// Web Audio API enterprise alert chime (0 dependencies)
export function playAnomalyChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine"; // Smooth, non-harsh enterprise tone
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

      // Smooth fade-in and fade-out (prevents speaker popping)
      gain.gain.setValueAtTime(0.001, ctx.currentTime + startTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    };

    // Rising two-note enterprise alert (A4 -> D5)
    playTone(440, 0, 0.18);
    playTone(587.33, 0.14, 0.35);
  } catch (err) {
    console.warn("[AIOps Audio] Unable to play anomaly chime:", err);
  }
}

// Subtle confirmation click/ping when turning Audio Alerts ON
export function playConfirmationPing() {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5 crisp confirmation tone

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch {}
}

interface AudioAlertContextType {
  audioEnabled: boolean;
  toggleAudioAlerts: () => void;
  setAudioEnabled: (enabled: boolean) => void;
  playAnomalyAlert: () => void;
}

const AudioAlertContext = createContext<AudioAlertContextType | undefined>(undefined);

export function AudioAlertProvider({ children }: { children: React.ReactNode }) {
  // Default to true (Audio Alerts: ON)
  const [audioEnabled, setAudioEnabledState] = useState<boolean>(true);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize from localStorage safely
  useEffect(() => {
    try {
      const stored = localStorage.getItem("aiops_audio_alerts");
      if (stored !== null) {
        setAudioEnabledState(stored === "true");
      } else {
        setAudioEnabledState(true);
      }
    } catch {
      setAudioEnabledState(true);
    }
  }, []);

  // Ensure AudioContext is unlocked on user interaction to comply with browser autoplay policies
  const unlockAudioContext = () => {
    if (typeof window === "undefined") return;
    try {
      if (!audioContextRef.current) {
        const AudioContextClass =
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          audioContextRef.current = new AudioContextClass();
        }
      }
      if (audioContextRef.current && audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume().catch(() => {});
      }
    } catch {}
  };

  const setAudioEnabled = (enabled: boolean) => {
    setAudioEnabledState(enabled);
    try {
      localStorage.setItem("aiops_audio_alerts", String(enabled));
    } catch {}
    if (enabled) {
      unlockAudioContext();
      playConfirmationPing();
    }
  };

  const toggleAudioAlerts = () => {
    unlockAudioContext();
    setAudioEnabledState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("aiops_audio_alerts", String(next));
      } catch {}
      if (next) {
        // Subtle confirmation sound when toggling from OFF to ON
        playConfirmationPing();
      }
      return next;
    });
  };

  const playAnomalyAlert = () => {
    if (!audioEnabled) return;
    unlockAudioContext();
    playAnomalyChime();
  };

  return (
    <AudioAlertContext.Provider
      value={{
        audioEnabled,
        toggleAudioAlerts,
        setAudioEnabled,
        playAnomalyAlert,
      }}
    >
      {children}
    </AudioAlertContext.Provider>
  );
}

export function useAudioAlerts() {
  const context = useContext(AudioAlertContext);
  if (!context) {
    throw new Error("useAudioAlerts must be used within an AudioAlertProvider");
  }
  return context;
}
