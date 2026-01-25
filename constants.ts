
import { Song, AudioFeatures } from './types';

const generateFeatures = (base: Partial<AudioFeatures>): AudioFeatures => ({
  mfccs: Math.floor(Math.random() * 40) + (base.mfccs || 30),
  spectralCentroid: Math.floor(Math.random() * 40) + (base.spectralCentroid || 30),
  zcr: Math.floor(Math.random() * 40) + (base.zcr || 30),
  chroma: Math.floor(Math.random() * 40) + (base.chroma || 30),
  tempo: Math.floor(Math.random() * 100) + 70,
  energy: Math.floor(Math.random() * 40) + (base.energy || 30),
});

// Using some publicly available demo mp3s for functional playback
const AUDIO_SOURCES = [
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3'
];

export const MOCK_LIBRARY: Song[] = [
  {
    id: 'm1',
    title: 'Initialize Connection',
    artist: 'Musologist AI',
    genre: 'Ambient',
    duration: '6:12',
    audioUrl: AUDIO_SOURCES[0],
    features: generateFeatures({ energy: 20 }),
    embedding: [0, 0],
    clusterId: 0,
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300&h=300&fit=crop',
  }
];

export const IMPORTED_USER_LIBRARY: Song[] = [
  {
    id: 's1',
    title: 'Midnight City',
    artist: 'M83',
    genre: 'Synthpop',
    duration: '4:03',
    audioUrl: AUDIO_SOURCES[0],
    features: generateFeatures({ energy: 85, spectralCentroid: 80, mfccs: 70 }),
    embedding: [0.45, 0.78],
    clusterId: 1,
    coverUrl: 'https://images.unsplash.com/photo-1459749411177-042180ce673c?q=80&w=300&h=300&fit=crop',
  },
  {
    id: 's2',
    title: 'Starboy',
    artist: 'The Weeknd',
    genre: 'R&B/Pop',
    duration: '3:50',
    audioUrl: AUDIO_SOURCES[1],
    features: generateFeatures({ energy: 70, zcr: 60, mfccs: 80 }),
    embedding: [0.12, 0.45],
    clusterId: 1,
    coverUrl: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=300&h=300&fit=crop',
  },
  {
    id: 's3',
    title: 'Weightless',
    artist: 'Marconi Union',
    genre: 'Ambient',
    duration: '8:00',
    audioUrl: AUDIO_SOURCES[2],
    features: generateFeatures({ energy: 10, spectralCentroid: 20, mfccs: 10 }),
    embedding: [-0.85, -0.62],
    clusterId: 2,
    coverUrl: 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=300&h=300&fit=crop',
  },
  {
    id: 's4',
    title: 'Levitating',
    artist: 'Dua Lipa',
    genre: 'Dance-Pop',
    duration: '3:23',
    audioUrl: AUDIO_SOURCES[3],
    features: generateFeatures({ energy: 90, chroma: 85, tempo: 124 }),
    embedding: [0.72, 0.88],
    clusterId: 1,
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=300&h=300&fit=crop',
  },
  {
    id: 's5',
    title: 'Blue in Green',
    artist: 'Miles Davis',
    genre: 'Jazz',
    duration: '5:37',
    audioUrl: AUDIO_SOURCES[4],
    features: generateFeatures({ energy: 25, chroma: 95, spectralCentroid: 30 }),
    embedding: [-0.35, -0.75],
    clusterId: 3,
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=300&h=300&fit=crop',
  },
  {
    id: 's6',
    title: 'Lose Yourself',
    artist: 'Eminem',
    genre: 'Hip Hop',
    duration: '5:26',
    audioUrl: AUDIO_SOURCES[5],
    features: generateFeatures({ energy: 95, zcr: 85, tempo: 171 }),
    embedding: [0.92, 0.15],
    clusterId: 4,
    coverUrl: 'https://images.unsplash.com/photo-1514525253361-bee8718a300a?q=80&w=300&h=300&fit=crop',
  },
  {
    id: 's7',
    title: 'After Hours',
    artist: 'The Weeknd',
    genre: 'R&B',
    duration: '6:01',
    audioUrl: AUDIO_SOURCES[6],
    features: generateFeatures({ energy: 60, mfccs: 75, spectralCentroid: 45 }),
    embedding: [0.25, 0.32],
    clusterId: 1,
    coverUrl: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?q=80&w=300&h=300&fit=crop',
  },
  {
    id: 's8',
    title: 'Stairway to Heaven',
    artist: 'Led Zeppelin',
    genre: 'Rock',
    duration: '8:02',
    audioUrl: AUDIO_SOURCES[7],
    features: generateFeatures({ energy: 50, chroma: 70, spectralCentroid: 55 }),
    embedding: [-0.15, -0.22],
    clusterId: 3,
    coverUrl: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=300&h=300&fit=crop',
  }
];
