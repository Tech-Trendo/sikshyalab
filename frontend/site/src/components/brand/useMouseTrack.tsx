"use client";

import {
  createContext,
  useContext,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";

const TRACK_STRENGTH = 20;
const springConfig = { stiffness: 70, damping: 18, mass: 0.55 };

type MouseTrackContextValue = {
  normX: MotionValue<number>;
  normY: MotionValue<number>;
  containerRef: RefObject<HTMLElement | null>;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
};

const MouseTrackContext = createContext<MouseTrackContextValue | null>(null);

export function MouseTrackProvider({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const containerRef = useRef<HTMLElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const normX = useSpring(mx, springConfig);
  const normY = useSpring(my, springConfig);

  const onMouseMove = (e: React.MouseEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };

  const onMouseLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <MouseTrackContext.Provider
      value={{ normX, normY, containerRef, onMouseMove, onMouseLeave }}
    >
      <section
        ref={containerRef}
        className={className}
        style={style}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        {children}
      </section>
    </MouseTrackContext.Provider>
  );
}

export function useMouseTrackContext() {
  const ctx = useContext(MouseTrackContext);
  if (!ctx) {
    throw new Error("useMouseTrackContext must be used within MouseTrackProvider");
  }
  return ctx;
}

export function MouseTrackItem({
  depth,
  className,
  children,
  style,
}: {
  depth: number;
  className?: string;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  const { normX, normY } = useMouseTrackContext();
  const x = useTransform(normX, (v) => v * depth * TRACK_STRENGTH);
  const y = useTransform(normY, (v) => v * depth * TRACK_STRENGTH);

  return (
    <motion.div className={className} style={{ x, y, ...style }}>
      {children}
    </motion.div>
  );
}
