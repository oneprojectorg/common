'use client';

import { cn } from '@op/ui/utils';
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
} from 'motion/react';
import { useEffect, useRef } from 'react';

const springConfig = { stiffness: 100, damping: 30 };

function usePrefersReducedMotion() {
  const mediaQuery =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

  const prefersReducedRef = useRef(mediaQuery?.matches ?? false);

  useEffect(() => {
    if (!mediaQuery) {
      return;
    }

    const handleChange = (e: MediaQueryListEvent) => {
      prefersReducedRef.current = e.matches;
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [mediaQuery]);

  return prefersReducedRef;
}

function useMouseGradient() {
  const gradientX = useMotionValue(50);
  const gradientY = useMotionValue(50);

  const smoothX = useSpring(gradientX, springConfig);
  const smoothY = useSpring(gradientY, springConfig);

  const prefersReducedMotion = usePrefersReducedMotion();

  // Track mouse offset from center (stored as ref to avoid re-renders)
  const mouseOffsetRef = useRef({ x: 0, y: 0 });

  // Handle mouse movement - store offset from center
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (prefersReducedMotion.current) {
        return;
      }
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      // Store as offset from center (50)
      mouseOffsetRef.current = { x: x - 50, y: y - 50 };
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [prefersReducedMotion]);

  // Ambient drift animation + mouse offset combined
  useEffect(() => {
    let animationId: number;
    const startTime = Date.now();

    const animate = () => {
      // If reduced motion is preferred, keep gradient centered
      if (prefersReducedMotion.current) {
        gradientX.set(50);
        gradientY.set(50);
        animationId = requestAnimationFrame(animate);
        return;
      }

      const elapsed = (Date.now() - startTime) / 1000;

      // Slow ambient drift using sine waves (15-20 second cycles)
      const driftX = Math.sin(elapsed * 0.5) * 15;
      const driftY = Math.cos(elapsed * 0.4) * 10;

      // Combine: center (50) + ambient drift + mouse offset
      const { x: mouseX, y: mouseY } = mouseOffsetRef.current;
      gradientX.set(50 + driftX + mouseX);
      gradientY.set(50 + driftY + mouseY);

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [gradientX, gradientY, prefersReducedMotion]);

  return { gradientX: smoothX, gradientY: smoothY };
}

export function AnimatedGradientBackground() {
  const { gradientX, gradientY } = useMouseGradient();

  const background = useMotionTemplate`radial-gradient(
    ellipse at ${gradientX}% ${gradientY}%,
    var(--color-teal-300),
    var(--color-teal-50)
  )`;

  return (
    <motion.div
      style={{ background }}
      className="absolute inset-0 -z-10 rounded"
    />
  );
}

export function AnimatedGradientText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { gradientX, gradientY } = useMouseGradient();

  const backgroundImage = useMotionTemplate`radial-gradient(
    50% 120% at ${gradientX}% ${gradientY}%,
    var(--color-green-500) 0%,
    var(--color-blue-700) 70%
  )`;

  return (
    <motion.span
      style={{ backgroundImage }}
      className={cn(className, 'bg-clip-text bg-center text-transparent')}
    >
      {children}
    </motion.span>
  );
}
