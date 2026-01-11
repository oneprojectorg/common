import React, { useEffect, useState } from 'react';

// Define types for confetti pieces
interface ConfettiPiece {
  emoji: string;
  x: number;
  y: number;
  xVelocity: number;
  yVelocity: number;
  rotation: number;
  rotationVelocity: number;
  size: number;
  opacity: number;
}

export const Confetti: React.FC = () => {
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [isExploding, setIsExploding] = useState<boolean>(false);

  // Array of emojis to use as confetti
  // const emojis: Array<string> = ['🌱', '🦋', '🐝'];
  const emojis: Array<string> = ['🌹', '🍞'];
  // const emojis: Array<string> = ['🐚', '🥬'];

  const explode = (): void => {
    setIsExploding(true);

    // Generate 200 confetti pieces
    const newConfetti: ConfettiPiece[] = Array.from({ length: 400 }, () => {
      // Random starting position across the entire screen
      const x = Math.random() * 100; // Any x position (0-100%)
      const y = Math.random() * 100; // Any y position (0-100%)

      return {
        emoji: emojis[Math.floor(Math.random() * emojis.length)] as string,
        x: x,
        y: y,
        xVelocity: Math.random() * 30 - 15, // Stronger horizontal velocity
        yVelocity: -Math.random() * 20 - 10, // Stronger upward velocity
        rotation: Math.random() * 360,
        rotationVelocity: Math.random() * 10 - 5,
        size: Math.random() * 1 + 0.5, // Random size between 1 and 2.5
        opacity: 1,
      };
    });

    setConfetti(newConfetti);

    // Reset after animation completes
    setTimeout(() => {
      setIsExploding(false);
      setConfetti([]);
    }, 6000);
  };

  useEffect(() => {
    let animationFrameId: number;

    if (isExploding) {
      let lastTime = performance.now();

      const updateConfetti = (currentTime: number): void => {
        const deltaTime = (currentTime - lastTime) / 1000; // in seconds
        lastTime = currentTime;

        setConfetti((prev) =>
          prev
            .map((piece) => {
              // Apply gravity
              const gravity = 9.8;

              return {
                ...piece,
                x: piece.x + piece.xVelocity * deltaTime,
                y: piece.y + piece.yVelocity * deltaTime,
                yVelocity: piece.yVelocity + gravity * deltaTime,
                rotation: piece.rotation + piece.rotationVelocity * deltaTime,
                opacity: piece.y > 90 ? 0 : piece.opacity - 0.01, // Fade out as it falls
              };
            })
            .filter((piece) => piece.opacity > 0),
        );

        animationFrameId = requestAnimationFrame(updateConfetti);
      };

      animationFrameId = requestAnimationFrame(updateConfetti);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isExploding]);

  useEffect(() => {
    if (!isExploding) {
      explode();
    }
  }, []);

  return (
    <div className="size-0 -z-10">
      {confetti.map((piece, index) => (
        <div
          key={index}
          className="pointer-events-none fixed h-[50vh] w-[50vw]"
          style={{
            left: `${piece.x}%`,
            top: `${piece.y}%`,
            transform: `rotate(${piece.rotation}deg) scale(${piece.size})`,
            opacity: piece.opacity,
            fontSize: '24px',
            transition: 'opacity 0.3s ease-out',
          }}
        >
          {piece.emoji}
        </div>
      ))}
    </div>
  );
};

export default Confetti;
