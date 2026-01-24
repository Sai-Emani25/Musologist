
import React from 'react';

interface SonicOrbProps {
  energy: number;
  brightness: number;
  intensity: number;
}

const SonicOrb: React.FC<SonicOrbProps> = ({ energy, brightness, intensity }) => {
  // Map internal metrics to visual properties
  const size = 120 + (energy * 0.5);
  const blur = 20 + (brightness * 0.3);
  const pulseSpeed = 10 - (intensity * 0.05);

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div 
        className="relative rounded-full transition-all duration-1000"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          background: `radial-gradient(circle, rgba(99, 102, 241, 0.8) 0%, rgba(59, 130, 246, 0.4) 50%, rgba(30, 58, 138, 0) 100%)`,
          filter: `blur(${blur}px)`,
          animation: `pulse ${pulseSpeed}s infinite ease-in-out`
        }}
      >
        <div 
          className="absolute inset-0 rounded-full bg-white/10"
          style={{ transform: `scale(${0.8 + (intensity * 0.002)})` }}
        ></div>
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.15); opacity: 1; }
        }
      `}</style>
      <p className="mt-6 text-[10px] text-indigo-400 font-bold tracking-[0.3em] uppercase">Syncing your sonic profile</p>
    </div>
  );
};

export default SonicOrb;
