"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "rebound.largeText";

export function LargeTextToggle() {
  const [largeText, setLargeText] = useState(false);

  useEffect(() => {
    setLargeText(document.documentElement.dataset.largeText === "true");
  }, []);

  const toggle = () => {
    const next = !largeText;
    setLargeText(next);
    document.documentElement.dataset.largeText = String(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={largeText}
      style={{ fontSize: "0.875rem", padding: "0.5rem 0.75rem" }}
    >
      {largeText ? "Normal text" : "Large text"}
    </button>
  );
}
