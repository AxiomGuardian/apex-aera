"use client";

import { useState, useEffect } from "react";

function getPhoenixGreeting(): string {
  const now = new Date();
  const phoenixTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Phoenix" }));
  const hour = phoenixTime.getHours();
  if (hour < 12) return "Good morning.";
  if (hour < 17) return "Good afternoon.";
  return "Good evening.";
}

export function Greeting() {
  const [greeting, setGreeting] = useState("Good morning.");

  useEffect(() => {
    setGreeting(getPhoenixGreeting());
    const timer = setInterval(() => setGreeting(getPhoenixGreeting()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <h2
      className="text-[44px] font-bold leading-[1.04] tracking-[-0.035em]"
      style={{ color: "var(--text)" }}
    >
      {greeting}
    </h2>
  );
}
