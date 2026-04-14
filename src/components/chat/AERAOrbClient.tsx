"use client";

import { Canvas } from "@react-three/fiber";
import { AERAOrbScene, type OrbState } from "./AERAOrbScene";

export function AERAOrbClient({ orbState = "idle" }: { orbState?: OrbState }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "50%",
        /* Always a deep void — the orb is a space object regardless of theme */
        background: "radial-gradient(circle at 50% 45%, #0d1117 0%, #050507 70%)",
        overflow: "hidden",
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 3.6], fov: 38 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, 1.5]}
        performance={{ min: 0.75 }}
        style={{ background: "transparent", width: "100%", height: "100%" }}
      >
        <AERAOrbScene orbState={orbState} />
      </Canvas>
    </div>
  );
}
