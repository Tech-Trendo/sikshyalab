"use client";

import { useEffect, useRef } from "react";

/**
 * Mouse parallax for decorative shapes inside a container.
 *
 * Attach the returned ref to a container. Any descendant with `data-depth`
 * moves with the cursor (positive depth) or against it (negative depth).
 *
 * @param movementStrength Max displacement in px at the container edge when |depth| = 1 (default 20).
 */
export function useMouseParallax(movementStrength = 20) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const getShapes = () =>
      container.querySelectorAll<HTMLElement>("[data-depth]");

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      // Normalized cursor position: -0.5 (left/top) → 0.5 (right/bottom)
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;

      getShapes().forEach((shape) => {
        const depth = Number.parseFloat(shape.dataset.depth ?? "0");
        if (Number.isNaN(depth)) return;

        const x = nx * depth * movementStrength;
        const y = ny * depth * movementStrength;
        shape.style.transform = `translate(${x}px, ${y}px)`;
      });
    };

    const onMouseLeave = () => {
      getShapes().forEach((shape) => {
        shape.style.transform = "translate(0, 0)";
      });
    };

    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("mouseleave", onMouseLeave);

    return () => {
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [movementStrength]);

  return containerRef;
}
