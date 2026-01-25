
import { GoogleGenAI } from "@google/genai";
import { AudioFeatures, Song, LiveDiscovery, SearchSource } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Explains musical matches using the standard flash model for low latency.
 */
export const getMusicalExplanation = async (song: Song, userPref: AudioFeatures): Promise<string> => {
  const prompt = `
    Acts as a intuitive music discovery AI. Explain why a song matches a user's current "vibe" based on underlying acoustic patterns.
    
    CRITICAL: DO NOT mention technical terms like MFCC, Spectral Centroid, ZCR, or Chroma. 
    
    Target Song: "${song.title}" by ${song.artist}
    Acoustic Profile:
    - Vibe: ${song.features.energy > 70 ? 'High Energy' : 'Chilled'}
    - Texture: ${song.features.mfccs > 60 ? 'Rich and Layered' : 'Clean and Minimal'}
    - Tone: ${song.features.spectralCentroid > 60 ? 'Bright and Airy' : 'Deep and Warm'}
    - Rhythm: ${song.features.tempo} BPM

    Write a single, natural sentence explaining the match. 
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text?.trim() || "This track perfectly complements the sound patterns in your recent playlist.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "This track aligns with the unique acoustic signature of your music library.";
  }
};

/**
 * Standard search grounding for discovery.
 */
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
  } catch (error) {
    console.error("Live Discovery Error:", error);
    return { text: "Could not fetch live recommendations.", sources: [] };
  }
};

/**
 * ADVANCED THINKING MODE: Uses Gemini 3 Pro to handle complex feedback-driven refinement.
 */
export const getComplexRefinement = async (
  currentSong: Song, 
  userPref: AudioFeatures, 
  feedback: boolean
): Promise<LiveDiscovery> => {
  const prompt = `
    COMPLEX QUERY: The user just listened to "${currentSong.title}" by ${currentSong.artist} and provided feedback: ${feedback ? 'POSITIVE (Liked it)' : 'NEGATIVE (Disliked it)'}.
    
    User Sonic Profile (Averages):
    - Energy: ${userPref.energy}
    - Brightness: ${userPref.spectralCentroid}
    - Complexity: ${userPref.mfccs}
    - Tempo: ${userPref.tempo}
    
    TASK: 
    1. Reason deeply about why the user might have ${feedback ? 'loved' : 'rejected'} this song based on the profile.
    2. If negative, identify which acoustic dimension to pivot away from.
    3. Use Google Search to find 3 groundbreaking or trending tracks (2024-2025) that satisfy this refined preference.
    4. Provide a high-intelligence explanation for the pivot/reinforcement.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 32768 },
        tools: [{ googleSearch: {} }],
      },
    });

    return processSearchResponse(response);
  } catch (error) {
    console.error("Pro Thinking Error:", error);
    return getLiveDiscovery(currentSong, userPref); // Fallback
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
