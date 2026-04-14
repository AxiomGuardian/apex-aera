"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ─────────────────────────────────────────────────────────────
   AERA Orb — Cosmic intelligence presence.

   Performance rewrite: all animation logic merged into a single
   useFrame callback at the scene level. This replaces the original
   8 separate useFrame hooks (one per sub-component) which caused
   8× per-frame function overhead and dropped to ~2 FPS during
   active states.

   Visual design: elegant icosahedron wireframe with soft inner
   glow sphere and three concentric torus rings at different
   orbital planes, speeds, and tilts.

   Four distinct states:
   - "idle"      → very slow, meditative breathing. Alive but still.
   - "listening" → outer wireframe + rings gently brighten + expand.
   - "thinking"  → inner core glows brighter, rings accelerate.
   - "speaking"  → rings settle to smooth vocal wave cadence.

   All materials: MeshBasicMaterial (unlit) for clean WebGL perf.
─────────────────────────────────────────────────────────────── */

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

/** Pick a number by state */
function sv(s: OrbState, think: number, speak: number, listen: number, idle: number): number {
  return s === "thinking" ? think : s === "speaking" ? speak : s === "listening" ? listen : idle;
}

// ── Shared geometry singletons — created once, never recreated ────────────────
const GEO_OUTER  = new THREE.IcosahedronGeometry(1.22, 1);
const GEO_MID    = new THREE.IcosahedronGeometry(0.86, 1);
const GEO_CORE   = new THREE.IcosahedronGeometry(0.50, 0);
const GEO_GLOWA  = new THREE.SphereGeometry(0.72, 10, 10);
const GEO_GLOWB  = new THREE.SphereGeometry(0.42, 8, 8);
const GEO_HALOP  = new THREE.TorusGeometry(0.96, 0.018, 3, 56);
const GEO_RINGA  = new THREE.TorusGeometry(1.48, 0.007, 3, 72);
const GEO_RINGB  = new THREE.TorusGeometry(1.70, 0.005, 3, 72);
const GEO_RINGC  = new THREE.TorusGeometry(1.95, 0.004, 3, 72);

// ── Shared material factory ───────────────────────────────────────────────────
function mat(color: string, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, wireframe: false });
}
function wireMat(color: string, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, wireframe: true });
}

/* ── Main scene component with a SINGLE useFrame ── */
export function AERAOrbScene({ orbState = "idle" }: { orbState?: OrbState }) {
  // ── Create all meshes up-front with useMemo ───────────────────────────────
  const meshes = useMemo(() => {
    const outerShell = new THREE.Mesh(GEO_OUTER, wireMat("#2DD4FF", 0.28));
    const midShell   = new THREE.Mesh(GEO_MID,   wireMat("#c8d8e8", 0.09));
    const innerCore  = new THREE.Mesh(GEO_CORE,  wireMat("#ffffff", 0.12));
    const glowA      = new THREE.Mesh(GEO_GLOWA, mat("#2DD4FF",  0.03));
    const glowB      = new THREE.Mesh(GEO_GLOWB, mat("#a8ecff",  0.05));
    const halo       = new THREE.Mesh(GEO_HALOP, mat("#2DD4FF",  0.00));
    const ringA      = new THREE.Mesh(GEO_RINGA, mat("#2DD4FF",  0.09));
    const ringB      = new THREE.Mesh(GEO_RINGB, mat("#c8d8e8",  0.05));
    const ringC      = new THREE.Mesh(GEO_RINGC, mat("#2DD4FF",  0.04));

    halo.rotation.x = Math.PI / 2;

    return { outerShell, midShell, innerCore, glowA, glowB, halo, ringA, ringB, ringC };
  }, []);

  // ── Time accumulators ─────────────────────────────────────────────────────
  const t = useRef({ outer: 0, mid: 0, core: 0, glow: 0, ring: 0, halo: 0 });

  // ── Lerped speed multipliers — smooth state transitions ───────────────────
  // Instead of hard-cutting between speed values when orbState changes,
  // we lerp toward the target. LERP_RATE controls how fast it ramps (per second).
  const LERP_RATE = 2.5; // full transition in ~400ms
  const lerpedSpd = useRef({ outer: 0.65, mid: 0.58, core: 0.82, glow: 0.45, ring: 0.55 });

  // ── Single unified useFrame — all animation in one pass ───────────────────
  useFrame((_, delta) => {
    const s  = orbState;
    const tc = t.current;
    const { outerShell, midShell, innerCore, glowA, glowB, halo, ringA, ringB, ringC } = meshes;

    // ─ Lerp speeds toward targets for smooth state transitions ─
    const lerp = (a: number, b: number) => a + (b - a) * Math.min(1, delta * LERP_RATE);
    lerpedSpd.current.outer = lerp(lerpedSpd.current.outer, sv(s, 3.0, 2.2, 1.8, 0.65));
    lerpedSpd.current.mid   = lerp(lerpedSpd.current.mid,   sv(s, 2.3, 1.8, 1.4, 0.58));
    lerpedSpd.current.core  = lerp(lerpedSpd.current.core,  sv(s, 3.4, 2.6, 2.2, 0.82));
    lerpedSpd.current.glow  = lerp(lerpedSpd.current.glow,  sv(s, 2.6, 2.0, 1.4, 0.45));
    lerpedSpd.current.ring  = lerp(lerpedSpd.current.ring,  sv(s, 2.6, 1.9, 1.6, 0.55));

    // ─ Time step — use lerped speeds ─
    const outerSpd = lerpedSpd.current.outer;
    const midSpd   = lerpedSpd.current.mid;
    const coreSpd  = lerpedSpd.current.core;
    const glowSpd  = lerpedSpd.current.glow;
    const ringSpd  = lerpedSpd.current.ring;

    tc.outer += delta * outerSpd;
    tc.mid   += delta * midSpd;
    tc.core  += delta * coreSpd;
    tc.glow  += delta * glowSpd;
    tc.ring  += delta * ringSpd;
    tc.halo  += delta;

    const breathFreq = sv(s, 1.8, 1.4, 1.3, 0.8);

    // ─ Outer icosahedron ─
    outerShell.rotation.x += delta * sv(s, 0.22, 0.14, 0.14, 0.06);
    outerShell.rotation.y += delta * sv(s, 0.32, 0.22, 0.20, 0.09);
    outerShell.rotation.z += delta * sv(s, 0.08, 0.05, 0.04, 0.02);
    {
      const breath = Math.sin(tc.outer * breathFreq);
      outerShell.scale.setScalar(sv(s, 1.13, 1.09, 1.06, 1.0) + breath * sv(s, 0.19, 0.16, 0.13, 0.06));
      (outerShell.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0.08, sv(s, 0.72, 0.62, 0.55, 0.30) + breath * sv(s, 0.24, 0.18, 0.20, 0.10));
    }

    // ─ Mid icosahedron ─
    midShell.rotation.x -= delta * sv(s, 0.17, 0.12, 0.10, 0.045);
    midShell.rotation.z += delta * sv(s, 0.24, 0.17, 0.14, 0.07);
    {
      const breath = Math.sin(tc.mid * breathFreq + 1.2);
      midShell.scale.setScalar(1 + breath * sv(s, 0.09, 0.07, 0.06, 0.02));
      (midShell.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0.03, sv(s, 0.34, 0.27, 0.22, 0.10) + breath * sv(s, 0.14, 0.11, 0.10, 0.05));
    }

    // ─ Inner core ─
    innerCore.rotation.x -= delta * sv(s, 0.28, 0.20, 0.17, 0.09);
    innerCore.rotation.z += delta * sv(s, 0.22, 0.16, 0.13, 0.07);
    {
      const breath = Math.sin(tc.core * breathFreq + 0.8);
      innerCore.scale.setScalar(1 + breath * sv(s, 0.17, 0.13, 0.11, 0.03));
      (innerCore.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0.04, sv(s, 0.52, 0.42, 0.36, 0.14) + breath * sv(s, 0.24, 0.18, 0.17, 0.07));
    }

    // ─ Glow spheres ─
    {
      const gA = glowA.material as THREE.MeshBasicMaterial;
      gA.opacity = Math.max(0, sv(s, 0.14, 0.11, 0.08, 0.03) + Math.sin(tc.glow * 1.2) * sv(s, 0.07, 0.06, 0.04, 0.015));
      const gB = glowB.material as THREE.MeshBasicMaterial;
      gB.opacity = Math.max(0, sv(s, 0.22, 0.17, 0.13, 0.05) + Math.sin(tc.glow * 1.6 + 0.9) * sv(s, 0.10, 0.08, 0.06, 0.02));
      glowB.scale.setScalar(sv(s, 1.10, 1.07, 1.04, 1.0) + Math.sin(tc.glow * 1.4) * sv(s, 0.12, 0.09, 0.07, 0.02));
    }

    // ─ Halo pulse ─
    {
      const active = s === "thinking" || s === "speaking";
      const haloMat = halo.material as THREE.MeshBasicMaterial;
      if (!active) {
        haloMat.opacity = Math.max(0, haloMat.opacity - delta * 2);
      } else {
        const speed = s === "thinking" ? 1.6 : 1.2;
        tc.halo = (tc.halo + delta * speed) % (Math.PI * 2);
        const frac = (Math.sin(tc.halo) + 1) * 0.5;
        halo.scale.setScalar(1.3 + frac * 1.1);
        haloMat.opacity = Math.max(0, (s === "thinking" ? 0.16 : 0.11) * (1 - frac * 0.92));
      }
    }

    // ─ Ring A ─
    {
      ringA.rotation.x = Math.PI / 2.4 + Math.sin(tc.ring * 0.18) * 0.38;
      ringA.rotation.z += delta * sv(s, 0.055, 0.038, 0.032, 0.010);
      (ringA.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0, sv(s, 0.52, 0.40, 0.32, 0.09) + Math.sin(tc.ring * breathFreq) * sv(s, 0.22, 0.17, 0.15, 0.06));
    }

    // ─ Ring B ─
    {
      const rb = tc.mid; // reuse mid timer
      ringB.rotation.y = Math.PI / 3.2 + Math.sin(rb * 0.15) * 0.28;
      ringB.rotation.x += delta * sv(s, 0.030, 0.022, 0.018, 0.007);
      (ringB.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0, sv(s, 0.26, 0.19, 0.16, 0.05) + Math.sin(rb * breathFreq + 1.8) * sv(s, 0.12, 0.09, 0.08, 0.025));
    }

    // ─ Ring C ─
    {
      const rc = tc.core; // reuse core timer
      ringC.rotation.z = Math.PI / 5 + Math.sin(rc * 0.12) * 0.22;
      ringC.rotation.y -= delta * sv(s, 0.020, 0.014, 0.012, 0.005);
      (ringC.material as THREE.MeshBasicMaterial).opacity =
        Math.max(0, sv(s, 0.18, 0.13, 0.11, 0.035) + Math.sin(rc * breathFreq + 3.2) * sv(s, 0.09, 0.07, 0.06, 0.02));
    }
  });

  // ── Render all meshes via primitive ──────────────────────────────────────
  const { outerShell, midShell, innerCore, glowA, glowB, halo, ringA, ringB, ringC } = meshes;
  const ambientIntensity = sv(orbState, 0.32, 0.26, 0.22, 0.09);

  return (
    <>
      <ambientLight intensity={ambientIntensity} />
      <pointLight position={[2, 2, 2]}     color="#2DD4FF" intensity={sv(orbState, 4.0, 3.2, 2.8, 1.8)} distance={11} />
      <pointLight position={[0, -3, 1]}    color="#ffffff" intensity={0.45} distance={8} />
      <pointLight position={[-2, -1.5, -2.5]} color="#ffffff" intensity={0.35} distance={9} />
      <pointLight position={[0.5, 2.5, -1]}   color="#2DD4FF" intensity={0.45} distance={7} />

      <primitive object={glowA} />
      <primitive object={glowB} />
      <primitive object={innerCore} />
      <primitive object={midShell} />
      <primitive object={outerShell} />
      <primitive object={halo} />
      <primitive object={ringA} />
      <primitive object={ringB} />
      <primitive object={ringC} />
    </>
  );
}
