
export interface AudioFeatures {
  mfccs: number; // Timbral texture (0-100)
  spectralCentroid: number; // Brightness (0-100)
  zcr: number; // Timbre roughness/percussion (0-100)
  chroma: number; // Harmonic complexity (0-100)
  tempo: number; // BPM (60-180)
  energy: number; // Overall intensity (0-100)
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: string; // Track length (e.g., "3:45")
  audioUrl?: string; // Real audio source URL
  features: AudioFeatures;
  embedding: [number, number]; // 2D projection for visualization
  clusterId: number;
  coverUrl?: string; // Album artwork URL
}

export interface UserProfile {
  preferenceVector: AudioFeatures;
  history: string[]; // Song IDs
  liked: string[]; // Song IDs
}

export interface Recommendation {
  song: Song;
  similarity: number;
  explanation: string;
}

export interface SearchSource {
  title: string;
  uri: string;
}

export interface LiveDiscovery {
  text: string;
  sources: SearchSource[];
}
