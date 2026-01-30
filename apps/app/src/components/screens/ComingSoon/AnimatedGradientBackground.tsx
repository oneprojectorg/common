'use client';

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
} from 'motion/react';
import { useEffect, useRef } from 'react';

const springConfig = { stiffness: 100, damping: 30 };

export function AnimatedGradientBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(50);
  const mouseY = useMotionValue(50);

  // Smooth the values with spring physics
  const gradientX = useSpring(mouseX, springConfig);
  const gradientY = useSpring(mouseY, springConfig);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Calculate percentage directly - no transforms needed
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      mouseX.set(x);
      mouseY.set(y);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  const background = useMotionTemplate`radial-gradient(
      circle at ${gradientX}% ${gradientY}%,
      var(--color-teal-300),
      var(--color-teal-50)
    )`;

  return (
    <motion.div
      ref={containerRef}
      style={{ background }}
      className="absolute inset-0 -z-10 rounded"
    />
  );
}
