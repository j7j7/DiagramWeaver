import { useEffect, useRef, useState, useCallback } from 'react';

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
  const animationRef = useRef<number>();
  const timeRef = useRef(0);

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

// Hook to manage animation offsets for multiple nodes
export function useNodeAnimationOffsets(nodes: any[], selectedIds: Set<string>) {
  const [offsets, setOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const animationRef = useRef<number>();

  const updateOffsets = useCallback(() => {
    const time = Date.now() * 0.002;
    const newOffsets: Record<string, { x: number; y: number }> = {};
    
    nodes.forEach(node => {
      if (selectedIds.has(node.id)) {
        const x = Math.sin(time * 0.3) * 8;
        const y = Math.cos(time * 0.21) * 6.4;
        newOffsets[node.id] = { x, y };
      } else {
        newOffsets[node.id] = { x: 0, y: 0 };
      }
    });
    
    setOffsets(newOffsets);
  }, [nodes, selectedIds]);

  useEffect(() => {
    if (selectedIds.size === 0) {
      setOffsets({});
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const animate = () => {
      updateOffsets();
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [updateOffsets, selectedIds.size]);

  return offsets;
}