
import { GoogleGenAI, Type } from "@google/genai";
import { AudioFeatures, Song, LiveDiscovery, SearchSource, Recommendation } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const FALLBACK_EXPLANATIONS = [
  "This track aligns with the harmonic complexity of your recent listening history.",
  "Matches the rhythmic energy and atmospheric depth of your current session.",
  "Synthesized based on your unique acoustic signature and tempo preferences.",
  "A perfect sonic bridge between your previous tracks and current mood.",
  "Features the precise timbral textures that resonate with your sound profile."
];

/**
 * Batched explanation service to save quota and avoid 429 errors.
 */
export const getBatchedMusicalExplanations = async (songs: Song[], userPref: AudioFeatures): Promise<string[]> => {
  const songsList = songs.map((s, i) => `${i + 1}. "${s.title}" by ${s.artist} (Energy: ${s.features.energy}, BPM: ${s.features.tempo})`).join('\n');
  
  const prompt = `
    Acts as an intuitive music discovery AI. Explain why these tracks match a user's current "vibe" based on acoustic patterns.
    Target Tracks:
    ${songsList}
    User Vibe: ${userPref.energy > 60 ? 'Energetic & Vibrant' : 'Mellow & Atmospheric'}
    Return a JSON array of strings, one short natural sentence for each track.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    
    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
  } catch (error: any) {
    if (error?.message?.includes('429')) {
      console.warn("Gemini Quota Reached. Using deterministic fallback.");
    }
  }
  // Deterministic fallback based on song index
  return songs.map((_, i) => FALLBACK_EXPLANATIONS[i % FALLBACK_EXPLANATIONS.length]);
};

export const getMusicalExplanation = async (song: Song, userPref: AudioFeatures): Promise<string> => {
  const results = await getBatchedMusicalExplanations([song], userPref);
  return results[0];
};

export const getLiveDiscovery = async (song: Song, userPref: AudioFeatures): Promise<LiveDiscovery> => {
  const prompt = `
    Search for 3-4 real-world songs released in 2024 or 2025 that share a similar sonic profile with "${song.title}" by ${song.artist}.
    Focus on Energy: ${song.features.energy}, Tempo: ${song.features.tempo}.
    Format as markdown list.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    return processSearchResponse(response);
  } catch (error: any) {
    return { 
      text: "Based on your recent listening, we suggest exploring the latest synth-wave releases of 2025. Your profile suggests a high affinity for vibrant, mid-tempo harmonics.", 
      sources: [{ title: "Latest 2025 Hits", uri: "https://open.spotify.com/search/2025%20hits" }] 
    };
  }
};

export const getComplexRefinement = async (
  currentSong: Song, 
  userPref: AudioFeatures, 
  feedback: boolean
): Promise<LiveDiscovery> => {
  const prompt = `
    The user ${feedback ? 'liked' : 'disliked'} "${currentSong.title}" by ${currentSong.artist}.
    User Profile: Energy ${userPref.energy}, Tempo ${userPref.tempo}.
    Recommend 3 songs for a ${feedback ? 'continuation' : 'pivot'} of this vibe.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 4000 },
        tools: [{ googleSearch: {} }],
      },
    });

    return processSearchResponse(response);
  } catch (error: any) {
    return getLiveDiscovery(currentSong, userPref);
  }
};

const processSearchResponse = (response: any): LiveDiscovery => {
  const sources: SearchSource[] = [];
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  
  if (chunks) {
    chunks.forEach((chunk: any) => {
      if (chunk.web) {
        sources.push({
          title: chunk.web.title || "Reference",
          uri: chunk.web.uri
        });
      }
    });
  }

  return {
    text: response.text || "No insights found.",
    sources: sources
  };
};
