import React from 'react';
import type { OrbState } from '../types';
import { VoiceOrb } from './VoiceOrb';

interface LiquidOrbProps {
  state: OrbState;
  audioBands: { low: number; mid: number; high: number; all: number };
  onOrbClick?: () => void;
}

export const LiquidOrb: React.FC<LiquidOrbProps> = ({ state, audioBands, onOrbClick }) => {
  return (
    <VoiceOrb
      state={state}
      audioBands={audioBands}
      onOrbClick={onOrbClick}
      particles={12000}
    />
  );
};
