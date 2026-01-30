'use client';

import { cn } from '@op/ui/utils';
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
} from 'motion/react';
import { useEffect } from 'react';

const springConfig = { stiffness: 100, damping: 30 };

function useMouseGradient() {
  const mouseX = useMotionValue(50);
  const mouseY = useMotionValue(50);

  const gradientX = useSpring(mouseX, springConfig);
  const gradientY = useSpring(mouseY, springConfig);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      mouseX.set(x);
      mouseY.set(y);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [mouseX, mouseY]);

  return { gradientX, gradientY };
}

export function AnimatedGradientBackground() {
  const { gradientX, gradientY } = useMouseGradient();

  const background = useMotionTemplate`radial-gradient(
    circle at ${gradientX}% ${gradientY}%,
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
    circle at ${gradientX}% ${gradientY}%,
    var(--color-green-500),
    var(--color-blue-700)
  )`;

  return (
    <motion.span
      style={{ backgroundImage }}
      className={cn(className, 'bg-clip-text text-transparent')}
    >
      {children}
    </motion.span>
  );
}
