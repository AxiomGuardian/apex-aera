"use client";

import dynamic from "next/dynamic";
import type { OrbState } from "./AERAOrbScene";

// Dynamic import with ssr:false keeps WebGL out of the server render pass
const AERAOrbClient = dynamic(
  () => import("./AERAOrbClient").then((m) => ({ default: m.AERAOrbClient })),
  { ssr: false, loading: () => <div style={{ width: "100%", height: "100%" }} /> }
);

export function AERAOrb({
  size = 120,
  orbState = "idle",
}: {
  size?: number;
  orbState?: OrbState;
}) {
  return (
    <div style={{ width: size, height: size }}>
      <AERAOrbClient orbState={orbState} />
    </div>
  );
}
