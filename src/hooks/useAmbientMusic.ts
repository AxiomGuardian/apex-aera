"use client";

import { useRef, useCallback, useState } from "react";

/*
  useAmbientMusic — procedural ambient space drone via Web Audio API.
  No external files required. Creates a layered sound from:
  - 3 detuned sine oscillators (deep drone)
  - Filtered noise (soft airy texture)
  - Slow LFO tremolo (breathing feel)
  Volume stays very low (≤ 0.06 master gain) so it never distracts.
*/

export function useAmbientMusic() {
  const [isPlaying, setIsPlaying] = useState(false);
  const ctxRef     = useRef<AudioContext | null>(null);
  const masterRef  = useRef<GainNode | null>(null);
  const nodesRef   = useRef<AudioNode[]>([]);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (fadeTimerRef.current) { clearTimeout(fadeTimerRef.current); fadeTimerRef.current = null; }
    if (masterRef.current && ctxRef.current) {
      const gain = masterRef.current.gain;
      const now  = ctxRef.current.currentTime;
      gain.setValueAtTime(gain.value, now);
      gain.linearRampToValueAtTime(0, now + 1.8); // fade out
      fadeTimerRef.current = setTimeout(() => {
        nodesRef.current.forEach((n) => { try { (n as OscillatorNode | AudioBufferSourceNode).stop?.(); } catch { /* ignore */ } });
        nodesRef.current = [];
        ctxRef.current?.close().catch(() => {});
        ctxRef.current = null;
        masterRef.current = null;
        setIsPlaying(false);
      }, 2000);
    } else {
      setIsPlaying(false);
    }
  }, []);

  const start = useCallback(async () => {
    if (ctxRef.current) return;

    try {
      const ctx = new AudioContext();
      await ctx.resume();
      ctxRef.current = ctx;

      // ── Master gain (very quiet) ──────────────────────────────
      const master = ctx.createGain();
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.055, ctx.currentTime + 3); // fade in
      master.connect(ctx.destination);
      masterRef.current = master;

      // ── Reverb (convolver with synthesized IR) ────────────────
      const revLen  = ctx.sampleRate * 3.5;
      const revBuf  = ctx.createBuffer(2, revLen, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = revBuf.getChannelData(c);
        for (let i = 0; i < revLen; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / revLen, 1.8);
        }
      }
      const reverb = ctx.createConvolver();
      reverb.buffer = revBuf;

      const revGain = ctx.createGain();
      revGain.gain.value = 0.55;
      reverb.connect(revGain);
      revGain.connect(master);

      // ── Drone oscillators (3 detuned sines) ──────────────────
      const droneFreqs = [55, 55.4, 82.5]; // A1, slight detune, E2
      droneFreqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;

        const oscGain = ctx.createGain();
        oscGain.gain.value = 0.18 - i * 0.03;

        // Slow LFO tremolo per oscillator (different rates for organic feel)
        const lfo = ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 0.08 + i * 0.025;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.06;
        lfo.connect(lfoGain);
        lfoGain.connect(oscGain.gain);
        lfo.start();
        nodesRef.current.push(lfo);

        osc.connect(oscGain);
        oscGain.connect(master);
        oscGain.connect(reverb);
        osc.start();
        nodesRef.current.push(osc);
      });

      // ── Soft filtered noise (airy texture) ───────────────────
      const noiseLen = ctx.sampleRate * 4;
      const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
      const noiseData = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseLen; i++) noiseData[i] = Math.random() * 2 - 1;

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;
      noise.loop   = true;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.value = 320;
      noiseFilter.Q.value = 0.4;

      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.03;

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(reverb);
      noise.start();
      nodesRef.current.push(noise);

      // ── High shimmer (very quiet high-freq sine) ─────────────
      const shimmer = ctx.createOscillator();
      shimmer.type = "sine";
      shimmer.frequency.value = 2200;
      const shimGain = ctx.createGain();
      shimGain.gain.value = 0.004;
      // Slow shimmer LFO
      const shimLfo = ctx.createOscillator();
      shimLfo.type = "sine";
      shimLfo.frequency.value = 0.05;
      const shimLfoGain = ctx.createGain();
      shimLfoGain.gain.value = 0.003;
      shimLfo.connect(shimLfoGain);
      shimLfoGain.connect(shimGain.gain);
      shimLfo.start();
      shimmer.connect(shimGain);
      shimGain.connect(reverb);
      shimmer.start();
      nodesRef.current.push(shimmer, shimLfo);

      setIsPlaying(true);
    } catch (err) {
      console.warn("[AERA Ambient] Audio init failed:", err);
    }
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) stop();
    else start();
  }, [isPlaying, start, stop]);

  return { isPlaying, toggle };
}
