
import { GoogleGenAI } from "@google/genai";
import { AudioFeatures, Song } from "../types";

export const getMusicalExplanation = async (song: Song, userPref: AudioFeatures): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Acts as a intuitive music discovery AI. Explain why a song matches a user's current "vibe" based on underlying acoustic patterns.
    
    CRITICAL: DO NOT mention technical terms like MFCC, Spectral Centroid, ZCR, or Chroma. 
    The user should not know about these metrics.
    
    Target Song: "${song.title}" by ${song.artist}
    Acoustic Profile:
    - Vibe: ${song.features.energy > 70 ? 'High Energy' : 'Chilled'}
    - Texture: ${song.features.mfccs > 60 ? 'Rich and Layered' : 'Clean and Minimal'}
    - Tone: ${song.features.spectralCentroid > 60 ? 'Bright and Airy' : 'Deep and Warm'}
    - Rhythm: ${song.features.tempo} BPM

    User Preference:
    - Prefers Intensity: ${userPref.energy}/100
    - Prefers Brightness: ${userPref.spectralCentroid}/100

    Write a single, natural sentence explaining the match. 
    Examples: 
    - "This flows perfectly with the warm, deep textures you've been listening to lately."
    - "Matches your current preference for high-energy rhythms and bright melodic tones."
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: prompt,
    });
    return response.text || "This track perfectly complements the sound patterns in your recent playlist.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "This track aligns with the unique acoustic signature of your music library.";
  }
};
