import React, { useEffect, useRef } from 'react';

interface ConfettiParticle {
  sprite: OffscreenCanvas | HTMLCanvasElement;
  x: number;
  y: number;
  xVelocity: number;
  yVelocity: number;
  rotation: number;
  rotationVelocity: number;
  scale: number;
  opacity: number;
}

const EMOJIS = ['🌹', '🍞'];
const PARTICLE_DENSITY = 0.1;
const ANIMATION_DURATION_MS = 6000;
const GRAVITY = 200;
const DRAG = 0.98;
const FADE_RATE = 0.3;
const SPRITE_SIZE = 48;

function createSprite(emoji: string): OffscreenCanvas | HTMLCanvasElement {
  const size = SPRITE_SIZE;
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(size, size)
      : document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d') as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D;
  if (ctx) {
    ctx.font = `${size * 0.7}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2);
  }
  return canvas;
}

function createParticles(
  canvasWidth: number,
  canvasHeight: number,
  sprites: Map<string, OffscreenCanvas | HTMLCanvasElement>,
): ConfettiParticle[] {
  const count = Math.round(canvasWidth * PARTICLE_DENSITY);
  return Array.from({ length: count }, () => {
    const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)] as string;
    return {
      sprite: sprites.get(emoji)!,
      x: Math.random() * canvasWidth,
      y: Math.random() * 1.3 * canvasHeight,
      xVelocity: (Math.random() * 30 - 15) * (canvasWidth / 100),
      yVelocity: (-Math.random() * 150 - 10) * (canvasHeight / 100),
      rotation: Math.random() * Math.PI * 2,
      rotationVelocity: (Math.random() * 10 - 5) * (Math.PI / 180),
      scale: Math.random() * 0.5 + 0.5,
      opacity: 1,
    };
  });
}

export const Confetti: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<ConfettiParticle[]>([]);
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    if (prefersReducedMotion) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const resizeCanvas = (): void => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const sprites = new Map<string, OffscreenCanvas | HTMLCanvasElement>();
    for (const emoji of EMOJIS) {
      sprites.set(emoji, createSprite(emoji));
    }

    particlesRef.current = createParticles(
      canvas.width,
      canvas.height,
      sprites,
    );
    lastTimeRef.current = performance.now();

    const halfSprite = SPRITE_SIZE / 2;

    const animate = (currentTime: number): void => {
      const deltaTime = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      let aliveCount = 0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;

        p.xVelocity *= DRAG;
        p.yVelocity += GRAVITY * deltaTime;
        p.yVelocity *= DRAG;
        p.x += p.xVelocity * deltaTime;
        p.y += p.yVelocity * deltaTime;
        p.rotation += p.rotationVelocity;

        p.opacity -= FADE_RATE * deltaTime;

        if (p.opacity <= 0) {
          continue;
        }

        aliveCount++;

        const s = p.scale;
        const cos = Math.cos(p.rotation) * s;
        const sin = Math.sin(p.rotation) * s;

        ctx.globalAlpha = p.opacity;
        ctx.setTransform(cos, sin, -sin, cos, p.x, p.y);
        ctx.drawImage(p.sprite, -halfSprite, -halfSprite);
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;

      if (aliveCount > 0) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    const timeoutId = setTimeout(() => {
      cancelAnimationFrame(animationFrameRef.current);
      particlesRef.current = [];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, ANIMATION_DURATION_MS);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      clearTimeout(timeoutId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 -z-10"
    />
  );
};

export default Confetti;
