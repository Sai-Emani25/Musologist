
import { Song, AudioFeatures } from './types';

const generateFeatures = (base: Partial<AudioFeatures>): AudioFeatures => ({
  mfccs: Math.floor(Math.random() * 40) + (base.mfccs || 30),
  spectralCentroid: Math.floor(Math.random() * 40) + (base.spectralCentroid || 30),
  zcr: Math.floor(Math.random() * 40) + (base.zcr || 30),
  chroma: Math.floor(Math.random() * 40) + (base.chroma || 30),
  tempo: Math.floor(Math.random() * 100) + 70,
  energy: Math.floor(Math.random() * 40) + (base.energy || 30),
});

export const MOCK_LIBRARY: Song[] = [
  {
    id: 'm1',
    title: 'Discover Weekly Intro',
    artist: 'Musologist AI',
    genre: 'Ambient',
    features: generateFeatures({ energy: 20 }),
    embedding: [0, 0],
    clusterId: 0,
  }
];

export const IMPORTED_USER_LIBRARY: Song[] = [
  {
    id: 's1',
    title: 'Midnight City',
    artist: 'M83',
    genre: 'Synthpop',
    features: generateFeatures({ energy: 85, spectralCentroid: 80, mfccs: 70 }),
    embedding: [0.45, 0.78],
    clusterId: 1,
  },
  {
    id: 's2',
    title: 'Starboy',
    artist: 'The Weeknd',
    genre: 'R&B/Pop',
    features: generateFeatures({ energy: 70, zcr: 60, mfccs: 80 }),
    embedding: [0.12, 0.45],
    clusterId: 1,
  },
  {
    id: 's3',
    title: 'Weightless',
    artist: 'Marconi Union',
    genre: 'Ambient',
    features: generateFeatures({ energy: 10, spectralCentroid: 20, mfccs: 10 }),
    embedding: [-0.85, -0.62],
    clusterId: 2,
  },
  {
    id: 's4',
    title: 'Levitating',
    artist: 'Dua Lipa',
    genre: 'Dance-Pop',
    features: generateFeatures({ energy: 90, chroma: 85, tempo: 124 }),
    embedding: [0.72, 0.88],
    clusterId: 1,
  },
  {
    id: 's5',
    title: 'Blue in Green',
    artist: 'Miles Davis',
    genre: 'Jazz',
    features: generateFeatures({ energy: 25, chroma: 95, spectralCentroid: 30 }),
    embedding: [-0.35, -0.75],
    clusterId: 3,
  },
  {
    id: 's6',
    title: 'Lose Yourself',
    artist: 'Eminem',
    genre: 'Hip Hop',
    features: generateFeatures({ energy: 95, zcr: 85, tempo: 171 }),
    embedding: [0.92, 0.15],
    clusterId: 4,
  },
  {
    id: 's7',
    title: 'After Hours',
    artist: 'The Weeknd',
    genre: 'R&B',
    features: generateFeatures({ energy: 60, mfccs: 75, spectralCentroid: 45 }),
    embedding: [0.25, 0.32],
    clusterId: 1,
  },
  {
    id: 's8',
    title: 'Stairway to Heaven',
    artist: 'Led Zeppelin',
    genre: 'Rock',
    features: generateFeatures({ energy: 50, chroma: 70, spectralCentroid: 55 }),
    embedding: [-0.15, -0.22],
    clusterId: 3,
  }
];
