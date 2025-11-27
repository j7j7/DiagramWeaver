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
  const [randomPhases, setRandomPhases] = useState<Record<string, { phaseX: number; phaseY: number; freqX: number; freqY: number }>>({});
  const animationRef = useRef<number>();
  const randomPhasesRef = useRef(randomPhases);
  const nodesRef = useRef(nodes);
  const selectedIdsRef = useRef(selectedIds);

  // Keep refs in sync with props/state
  useEffect(() => {
    randomPhasesRef.current = randomPhases;
  }, [randomPhases]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  // Generate random phases and frequencies for each node when it gets selected
  useEffect(() => {
    const currentPhases = randomPhasesRef.current;
    const newPhases: Record<string, { phaseX: number; phaseY: number; freqX: number; freqY: number }> = { ...currentPhases };
    
    nodes.forEach(node => {
      if (selectedIds.has(node.id) && !currentPhases[node.id]) {
        // Generate random phase and frequency for this node
        newPhases[node.id] = {
          phaseX: Math.random() * Math.PI * 2, // Random phase for X
          phaseY: Math.random() * Math.PI * 2, // Random phase for Y
          freqX: 0.2 + Math.random() * 0.2, // Random frequency between 0.2-0.4 for X
          freqY: 0.14 + Math.random() * 0.14, // Random frequency between 0.14-0.28 for Y
        };
      } else if (!selectedIds.has(node.id) && currentPhases[node.id]) {
        // Clean up when node is deselected
        delete newPhases[node.id];
      }
    });
    
    // Only update if phases actually changed
    const phasesChanged = JSON.stringify(newPhases) !== JSON.stringify(currentPhases);
    if (phasesChanged) {
      setRandomPhases(newPhases);
    }
  }, [nodes, selectedIds]); // Remove randomPhases from dependencies

  const updateOffsets = useCallback(() => {
    const time = Date.now() * 0.004;
    const newOffsets: Record<string, { x: number; y: number }> = {};
    const currentPhases = randomPhasesRef.current;
    const currentNodes = nodesRef.current;
    const currentSelectedIds = selectedIdsRef.current;
    
    currentNodes.forEach(node => {
      if (currentSelectedIds.has(node.id)) {
        const phase = currentPhases[node.id];
        if (phase) {
          // Use node-specific random phase and frequency
          const x = Math.sin(time * phase.freqX + phase.phaseX) * 8;
          const y = Math.cos(time * phase.freqY + phase.phaseY) * 6.4;
          newOffsets[node.id] = { x, y };
        } else {
          // Fallback to default animation
          const x = Math.sin(time * 0.3) * 8;
          const y = Math.cos(time * 0.21) * 6.4;
          newOffsets[node.id] = { x, y };
        }
      } else {
        newOffsets[node.id] = { x: 0, y: 0 };
      }
    });
    
    setOffsets(newOffsets);
  }, []); // No dependencies - uses refs only

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
  }, [selectedIds.size, updateOffsets]);

  return offsets;
}