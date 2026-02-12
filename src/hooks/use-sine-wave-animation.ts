import { useEffect, useRef, useState } from 'react';

interface SineWaveAnimationOptions {
  amplitude?: number;
  frequency?: number;
  speed?: number;
  enabled?: boolean;
}

export function useSineWaveAnimation(options: SineWaveAnimationOptions = {}) {
  const {
    amplitude = 10,
    frequency = 0.5,
    speed = 0.02,
    enabled = false
  } = options;

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const animationRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) {
      setOffset({ x: 0, y: 0 });
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const animate = () => {
      timeRef.current += speed;
      
      // Create smooth random circular motion using sine waves
      const x = Math.sin(timeRef.current * frequency) * amplitude;
      const y = Math.cos(timeRef.current * frequency * 0.7) * amplitude * 0.8;
      
      setOffset({ x, y });
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [enabled, amplitude, frequency, speed]);

  return offset;
}