
import React, { useState, useEffect, useCallback } from 'react';
import { MOCK_LIBRARY, IMPORTED_USER_LIBRARY } from './constants';
import { Song, UserProfile, Recommendation, AudioFeatures } from './types';
import EmbeddingMap from './components/EmbeddingMap';
import SonicOrb from './components/SonicOrb';
import { getMusicalExplanation } from './services/geminiService';

const App: React.FC = () => {
  const [library, setLibrary] = useState<Song[]>(MOCK_LIBRARY);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  
  const [userProfile, setUserProfile] = useState<UserProfile>({
    preferenceVector: { mfccs: 50, spectralCentroid: 50, zcr: 50, chroma: 50, tempo: 120, energy: 50 },
    history: [],
    liked: [],
  });
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const calculateSimilarity = (f1: AudioFeatures, f2: AudioFeatures) => {
    const keys: (keyof AudioFeatures)[] = ['mfccs', 'spectralCentroid', 'zcr', 'chroma', 'energy'];
    let sumSquares = 0;
    keys.forEach(key => {
      sumSquares += Math.pow(f1[key] - f2[key], 2);
    });
    sumSquares += Math.pow((f1.tempo - f2.tempo) / 2, 2);
    return 1 / (1 + Math.sqrt(sumSquares));
  };

  const updateRecommendations = useCallback(async (currentPref: AudioFeatures) => {
    setLoading(true);
    // Use the latest library state to ensure we're recommending from the imported songs
    const currentLib = spotifyConnected ? IMPORTED_USER_LIBRARY : library;
    
    const sorted = [...currentLib]
      .map(song => ({
        song,
        similarity: calculateSimilarity(song.features, currentPref),
        explanation: 'Interpreting sound patterns...',
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);

    const withExplanations = await Promise.all(sorted.map(async (rec) => {
      const explanation = await getMusicalExplanation(rec.song, currentPref);
      return { ...rec, explanation };
    }));

    setRecommendations(withExplanations);
    setLoading(false);
  }, [library, spotifyConnected]);

  const handleSpotifyLogin = () => {
    setIsLoggingIn(true);
    // Simulate Spotify OAuth Popup
    setTimeout(() => {
      setIsLoggingIn(false);
      setIsImporting(true);
      
      const steps = [
        { progress: 15, msg: 'Initializing Spotify Auth...' },
        { progress: 40, msg: 'Syncing Liked Songs & Playlists...' },
        { progress: 65, msg: 'Deconstructing acoustic signatures...' },
        { progress: 90, msg: 'Populating latent vector space...' },
      ];

      steps.forEach((step, i) => {
        setTimeout(() => {
          setImportProgress(step.progress);
          setImportStatus(step.msg);
          if (i === steps.length - 1) {
            setTimeout(() => {
              setLibrary(IMPORTED_USER_LIBRARY);
              setSpotifyConnected(true);
              setIsImporting(false);
              handleSelectSong(IMPORTED_USER_LIBRARY[0]);
            }, 1000);
          }
        }, (i + 1) * 700);
      });
    }, 1500);
  };

  const handleSelectSong = (song: Song) => {
    setSelectedSong(song);
    setShowFeedback(true);
    
    const alpha = 0.35;
    setUserProfile(prev => {
      const newPref: AudioFeatures = {
        mfccs: Math.round(prev.preferenceVector.mfccs * (1 - alpha) + song.features.mfccs * alpha),
        spectralCentroid: Math.round(prev.preferenceVector.spectralCentroid * (1 - alpha) + song.features.spectralCentroid * alpha),
        zcr: Math.round(prev.preferenceVector.zcr * (1 - alpha) + song.features.zcr * alpha),
        chroma: Math.round(prev.preferenceVector.chroma * (1 - alpha) + song.features.chroma * alpha),
        tempo: Math.round(prev.preferenceVector.tempo * (1 - alpha) + song.features.tempo * alpha),
        energy: Math.round(prev.preferenceVector.energy * (1 - alpha) + song.features.energy * alpha),
      };

      const updatedHistory = [song.id, ...prev.history.filter(id => id !== song.id)].slice(0, 10);
      updateRecommendations(newPref);

      return {
        ...prev,
        preferenceVector: newPref,
        history: updatedHistory,
      };
    });
  };

  const submitFeedback = (satisfied: boolean) => {
    setShowFeedback(false);
    if (!satisfied) {
      const jitteredPref = { ...userProfile.preferenceVector };
      jitteredPref.energy = Math.max(0, Math.min(100, jitteredPref.energy + (Math.random() - 0.5) * 40));
      updateRecommendations(jitteredPref);
    }
  };

  if (!spotifyConnected && !isImporting) {
    return (
      <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center p-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-[#1DB954]/10 via-black to-[#1DB954]/5 pointer-events-none"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-500/5 via-transparent to-transparent opacity-50"></div>
        
        <div className="relative z-10 flex flex-col items-center max-w-lg w-full">
          <div className="w-28 h-28 bg-white rounded-[2.5rem] flex items-center justify-center mb-12 shadow-[0_0_60px_rgba(29,185,84,0.15)] transform -rotate-3 hover:rotate-0 transition-transform duration-500">
            <i className="fas fa-wave-square text-black text-6xl"></i>
          </div>
          
          <div className="text-center mb-12">
            <h1 className="text-6xl font-black text-white mb-4 tracking-tighter italic">Musologist</h1>
            <p className="text-gray-400 text-lg font-medium max-w-md mx-auto leading-relaxed">
              Connect your Spotify account to extract your listening history and unlock deep sound pattern analysis.
            </p>
          </div>
          
          <button 
            onClick={handleSpotifyLogin}
            disabled={isLoggingIn}
            className="group w-full max-w-sm py-6 bg-[#1DB954] hover:bg-[#1ed760] text-black font-black rounded-full flex items-center justify-center gap-5 transition-all transform hover:scale-[1.05] active:scale-[0.98] shadow-2xl shadow-green-500/30"
          >
            {isLoggingIn ? (
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 border-3 border-black/20 border-t-black rounded-full animate-spin"></div>
                <span className="text-lg uppercase tracking-widest">Connecting...</span>
              </div>
            ) : (
              <>
                <i className="fab fa-spotify text-4xl group-hover:rotate-12 transition-transform duration-300"></i>
                <span className="text-xl">CONNECT SPOTIFY</span>
              </>
            )}
          </button>
          
          <div className="mt-16 flex items-center gap-10 opacity-60">
             <div className="flex flex-col items-center">
                <span className="text-2xl font-black text-white">400+</span>
                <span className="text-[10px] uppercase font-black tracking-widest text-gray-500">Signal Nodes</span>
             </div>
             <div className="w-px h-10 bg-white/10"></div>
             <div className="flex flex-col items-center">
                <span className="text-2xl font-black text-white">SECURE</span>
                <span className="text-[10px] uppercase font-black tracking-widest text-gray-500">API SYNC</span>
             </div>
             <div className="w-px h-10 bg-white/10"></div>
             <div className="flex flex-col items-center">
                <span className="text-2xl font-black text-white">HI-RES</span>
                <span className="text-[10px] uppercase font-black tracking-widest text-gray-500">MAPPING</span>
             </div>
          </div>

          <p className="mt-12 text-[10px] text-gray-700 uppercase tracking-[0.4em] font-black">Powered by Gemini AI Engine</p>
        </div>
      </div>
    );
  }

  if (isImporting) {
    return (
      <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center p-6">
        <div className="relative mb-8">
          <SonicOrb energy={60} brightness={90} intensity={70} />
          <div className="absolute inset-0 flex items-center justify-center">
             <span className="text-4xl font-black text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]">{importProgress}%</span>
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-3xl font-black text-white mb-4 tracking-tighter">Synchronizing Library</h2>
          <p className="text-indigo-400 text-sm font-bold uppercase tracking-widest h-6 transition-all duration-300">{importStatus}</p>
        </div>
        
        <div className="w-80 h-1.5 bg-white/5 rounded-full mt-12 overflow-hidden shadow-inner">
           <div className="h-full bg-gradient-to-r from-indigo-600 to-blue-400 transition-all duration-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]" style={{ width: `${importProgress}%` }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black text-gray-200 overflow-hidden font-sans">
      
      {/* Sidebar */}
      <nav className="w-64 flex-none bg-black flex flex-col p-6 space-y-8 border-r border-white/5 shadow-2xl">
        <div className="flex items-center gap-3 px-2">
          <i className="fas fa-wave-square text-[#1DB954] text-2xl"></i>
          <span className="text-xl font-black tracking-tighter italic text-white">Musologist</span>
        </div>

        <div className="space-y-4 px-2">
          <div className="flex items-center gap-4 text-gray-400 hover:text-white cursor-pointer transition-colors group py-1">
            <i className="fas fa-home text-xl group-hover:scale-110 transition-transform"></i>
            <span className="text-sm font-black">Home</span>
          </div>
          <div className="flex items-center gap-4 text-gray-400 hover:text-white cursor-pointer transition-colors group py-1">
            <i className="fas fa-search text-xl group-hover:scale-110 transition-transform"></i>
            <span className="text-sm font-black">Sonic Search</span>
          </div>
          <div className="flex items-center gap-4 text-white cursor-pointer transition-colors group py-1">
            <i className="fas fa-compact-disc text-xl text-[#1DB954]"></i>
            <span className="text-sm font-black">Your Spotify</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pt-6 border-t border-white/5 custom-scrollbar px-2">
          <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mb-4">Account Library</p>
          {['Liked Songs', 'Top Tracks 2024', 'Late Night Beats', 'Ambient Focus', 'Workout Vault', 'Jazz Archives'].map(p => (
            <div key={p} className="flex items-center gap-3 text-sm text-gray-500 hover:text-gray-200 cursor-pointer transition-colors truncate py-1.5 group">
               <div className="w-7 h-7 bg-white/5 rounded-lg flex items-center justify-center group-hover:bg-[#1DB954]/20 group-hover:text-[#1DB954] transition-colors">
                 <i className="fas fa-music text-[10px]"></i>
               </div>
               {p}
            </div>
          ))}
        </div>

        <div className="pt-6 px-2">
          <div className="bg-[#1DB954]/5 p-5 rounded-[2rem] border border-[#1DB954]/10 group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3">
               <div className="w-1.5 h-1.5 rounded-full bg-[#1DB954] animate-pulse"></div>
            </div>
            <p className="text-[10px] text-[#1DB954] font-black uppercase tracking-widest mb-2">Sound Signature</p>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-[#1DB954] animate-pulse-slow shadow-[0_0_10px_rgba(29,185,84,0.5)]" style={{ width: '88%' }}></div>
            </div>
            <p className="text-[9px] text-gray-600 mt-3 font-bold leading-tight uppercase tracking-tighter">Identity successfully mapped to Spotify data.</p>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-gradient-to-b from-gray-950 via-black to-black overflow-hidden relative">
        <header className="h-24 flex items-center justify-between px-12 bg-transparent sticky top-0 z-20 backdrop-blur-md">
          <div className="flex gap-4">
            <button className="w-10 h-10 bg-black/80 rounded-full flex items-center justify-center text-gray-400 hover:text-white border border-white/5"><i className="fas fa-chevron-left"></i></button>
            <button className="w-10 h-10 bg-black/80 rounded-full flex items-center justify-center text-gray-400 hover:text-white border border-white/5"><i className="fas fa-chevron-right"></i></button>
          </div>
          <div className="flex items-center gap-8">
             <div className="bg-white/5 hover:bg-white/10 px-5 py-2 rounded-full flex items-center gap-4 border border-white/5 cursor-pointer transition-all hover:scale-105">
                <div className="w-8 h-8 bg-gradient-to-tr from-[#1DB954] to-green-300 rounded-full flex items-center justify-center text-[11px] text-black font-black">SP</div>
                <div className="flex flex-col">
                  <span className="text-xs font-black text-gray-100 leading-none">Spotify Account</span>
                  <span className="text-[9px] text-gray-500 uppercase font-bold tracking-tighter italic">Library Synced</span>
                </div>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-12 pt-0 custom-scrollbar">
          {/* Top Hero: The Sound Map */}
          <section className="mb-16">
            <div className="flex items-end justify-between mb-10">
               <div className="max-w-xl">
                  <div className="flex items-center gap-3 mb-2">
                     <span className="px-2 py-0.5 bg-[#1DB954]/10 text-[#1DB954] text-[9px] font-black uppercase rounded border border-[#1DB954]/20">Active Analysis</span>
                     <h2 className="text-4xl font-black tracking-tighter text-white">Your Acoustic Genome</h2>
                  </div>
                  <p className="text-gray-500 font-medium text-lg">Every dot is a song from your Spotify library, mapped by its invisible sonic signature.</p>
               </div>
               <div className="flex gap-3">
                  <button className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 transition-all">Vector View</button>
                  <button className="px-6 py-3 bg-[#1DB954] text-black rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-green-500/10 transition-all hover:scale-105">Cluster Map</button>
               </div>
            </div>
            <div className="bg-white/[0.01] rounded-[3rem] border border-white/5 p-4 shadow-2xl">
              <EmbeddingMap 
                songs={library} 
                selectedSongId={selectedSong?.id} 
                onSelectSong={handleSelectSong} 
              />
            </div>
          </section>

          {/* Grid: Your Songs */}
          <section>
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-3xl font-black tracking-tighter text-white">Your Spotify Tracks <span className="text-gray-600 ml-2 font-medium">({library.length})</span></h3>
              <div className="flex items-center gap-6">
                 <button className="text-gray-500 hover:text-white transition-colors"><i className="fas fa-filter mr-2"></i> <span className="text-[10px] font-black uppercase tracking-widest">Filter Sound</span></button>
                 <div className="flex gap-2">
                    <button className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-white"><i className="fas fa-th-large"></i></button>
                    <button className="w-10 h-10 flex items-center justify-center text-gray-300"><i className="fas fa-list"></i></button>
                 </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-10">
              {library.map(song => (
                <div 
                  key={song.id}
                  onClick={() => handleSelectSong(song)}
                  className={`group p-6 rounded-[2.5rem] transition-all duration-500 cursor-pointer relative overflow-hidden flex flex-col items-center text-center ${
                    selectedSong?.id === song.id ? 'bg-[#1DB954]/10 ring-2 ring-[#1DB954]/30' : 'bg-white/[0.02] hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="aspect-square w-full bg-gradient-to-br from-gray-900 to-black rounded-3xl mb-6 flex items-center justify-center relative shadow-2xl overflow-hidden group-hover:scale-[1.03] transition-transform duration-500">
                    <i className={`fas fa-compact-disc text-6xl transition-all duration-1000 ${selectedSong?.id === song.id ? 'text-[#1DB954] scale-110 rotate-[720deg]' : 'text-gray-800 group-hover:text-gray-600'}`}></i>
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-2xl transform translate-y-8 group-hover:translate-y-0 transition-all duration-300">
                          <i className="fas fa-play text-black text-xl ml-1"></i>
                       </div>
                    </div>
                    {selectedSong?.id === song.id && (
                      <div className="absolute top-4 left-4">
                         <div className="flex gap-0.5 items-end h-3">
                            {[1,2,3].map(i => <div key={i} className={`w-1 bg-[#1DB954] animate-bounce-slow`} style={{animationDelay: `${i*0.2}s`, height: `${i*30}%`}}></div>)}
                         </div>
                      </div>
                    )}
                  </div>
                  <h4 className="font-black text-base truncate w-full px-2 text-gray-100 tracking-tight">{song.title}</h4>
                  <p className="text-sm text-gray-500 truncate w-full px-2 mt-1 font-medium">{song.artist}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Floating Feedback Overlay */}
        {showFeedback && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-full max-w-sm px-6 animate-slide-up z-30">
            <div className="bg-white p-10 rounded-[3.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.95)] border border-white/10 flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-[#1DB954] rounded-3xl flex items-center justify-center mb-8 rotate-3 shadow-xl shadow-green-500/20">
                <i className="fas fa-fingerprint text-black text-2xl"></i>
              </div>
              <p className="text-black font-black text-[12px] uppercase tracking-[0.4em] mb-3">Pattern Recognition</p>
              <h4 className="text-gray-950 text-xl font-black mb-8 leading-tight tracking-tighter">Is this discovery matching your current sound identity?</h4>
              <div className="flex gap-4 w-full">
                <button onClick={() => submitFeedback(true)} className="flex-1 py-4 bg-black text-white text-[11px] font-black rounded-[2rem] hover:bg-gray-800 transition-all hover:scale-[1.05] shadow-lg">YES, PERFECT</button>
                <button onClick={() => submitFeedback(false)} className="flex-1 py-4 bg-gray-100 text-gray-900 text-[11px] font-black rounded-[2rem] hover:bg-gray-200 transition-all">TRY ANOTHER</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Discovery Right Sidebar */}
      <aside className="w-[26rem] bg-black border-l border-white/5 flex flex-col p-10 overflow-hidden relative">
        <div className="flex items-center justify-between mb-12">
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-600">The AI Musologist</p>
          <div className="flex items-center gap-3">
             <div className="w-2.5 h-2.5 rounded-full bg-[#1DB954] animate-pulse"></div>
             <span className="text-[11px] font-black text-[#1DB954] uppercase tracking-widest">Active</span>
          </div>
        </div>

        <div className="flex-none mb-12">
           <SonicOrb 
              energy={userProfile.preferenceVector.energy} 
              brightness={userProfile.preferenceVector.spectralCentroid} 
              intensity={userProfile.preferenceVector.mfccs}
           />
           <div className="text-center mt-8">
              <p className="text-sm text-gray-400 font-bold uppercase tracking-widest italic opacity-80">Synthesizing Latent Recommendations</p>
           </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 relative">
          <h3 className="text-lg font-black mb-10 flex items-center gap-4 text-white">
            <i className="fas fa-sparkles text-[#1DB954]"></i>
            Deep Sound Matches
          </h3>
          
          <div className="flex-1 overflow-y-auto space-y-12 custom-scrollbar pb-12 pr-2">
            {loading ? (
              <div className="space-y-8">
                {[1,2,3].map(i => (
                  <div key={i} className="space-y-4">
                     <div className="h-4 w-1/3 bg-white/5 rounded-full animate-pulse"></div>
                     <div className="h-32 bg-white/5 rounded-[2.5rem] animate-pulse"></div>
                  </div>
                ))}
              </div>
            ) : (
              recommendations.map((rec, idx) => (
                <div key={rec.song.id} className="group animate-fade-in relative">
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-[10px] font-black text-gray-800 tracking-[0.3em]">MATCH NODE 0{idx+1}</span>
                    <span className="text-[11px] font-black bg-[#1DB954]/10 text-[#1DB954] px-4 py-1 rounded-full border border-[#1DB954]/20 shadow-lg">{Math.round(rec.similarity * 100)}% Sync</span>
                  </div>
                  <div 
                    className="bg-white/[0.03] p-8 rounded-[3rem] border border-white/5 hover:border-[#1DB954]/50 hover:bg-white/[0.06] transition-all duration-300 cursor-pointer group-hover:-translate-y-2 relative" 
                    onClick={() => handleSelectSong(rec.song)}
                  >
                    <div className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                       <div className="w-10 h-10 bg-[#1DB954] rounded-full flex items-center justify-center text-black">
                         <i className="fas fa-play text-xs ml-1"></i>
                       </div>
                    </div>
                    <h4 className="font-black text-lg mb-2 text-white group-hover:text-[#1DB954] transition-colors tracking-tight">{rec.song.title}</h4>
                    <p className="text-sm text-gray-500 mb-6 font-bold tracking-tight">{rec.song.artist}</p>
                    <div className="relative pl-5 border-l-4 border-[#1DB954]/20 py-2 bg-black/20 rounded-r-xl">
                      <p className="text-xs text-gray-400 leading-relaxed italic font-medium">"{rec.explanation}"</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Player Bar */}
      <footer className="fixed bottom-0 left-0 right-0 h-32 bg-black/95 backdrop-blur-3xl border-t border-white/5 px-12 flex items-center justify-between z-50 shadow-[0_-20px_50px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-8 w-1/4">
          {selectedSong ? (
            <>
              <div className="w-20 h-20 bg-gradient-to-br from-gray-800 to-black rounded-3xl flex items-center justify-center shadow-2xl relative overflow-hidden group border border-white/5">
                <i className="fas fa-compact-disc text-[#1DB954] text-4xl animate-spin-slow"></i>
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <i className="fas fa-expand-alt text-white text-sm"></i>
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-base font-black text-white truncate hover:text-[#1DB954] transition-colors cursor-pointer tracking-tight">{selectedSong.title}</p>
                <p className="text-sm text-gray-500 truncate font-bold hover:text-gray-300 transition-colors cursor-pointer uppercase tracking-tighter">{selectedSong.artist}</p>
              </div>
              <button className="text-gray-500 hover:text-red-500 ml-4 transition-all hover:scale-125"><i className="far fa-heart text-xl"></i></button>
            </>
          ) : (
             <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-white/5 rounded-3xl animate-pulse"></div>
                <div className="text-[11px] text-gray-700 font-black uppercase tracking-[0.3em]">Awaiting Selection</div>
             </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-4 w-1/2 max-w-2xl">
          <div className="flex items-center gap-12">
            <button className="text-gray-600 hover:text-[#1DB954] transition-colors"><i className="fas fa-random text-base"></i></button>
            <button className="text-gray-400 hover:text-white transition-colors"><i className="fas fa-step-backward text-2xl"></i></button>
            <button className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-[0_0_40px_rgba(255,255,255,0.25)]">
              <i className="fas fa-play text-2xl ml-1"></i>
            </button>
            <button className="text-gray-400 hover:text-white transition-colors"><i className="fas fa-step-backward text-2xl"></i></button>
            <button className="text-gray-600 hover:text-[#1DB954] transition-colors"><i className="fas fa-redo text-base"></i></button>
          </div>
          <div className="w-full flex items-center gap-5">
            <span className="text-[11px] font-mono text-gray-600 w-14 text-right">0:42</span>
            <div className="flex-1 h-1.5 bg-white/10 rounded-full cursor-pointer group relative">
              <div className="h-full bg-white group-hover:bg-[#1DB954] rounded-full transition-all duration-300" style={{ width: '35%' }}></div>
              <div className="absolute top-1/2 -translate-y-1/2 left-[35%] w-4 h-4 bg-white rounded-full scale-0 group-hover:scale-100 transition-transform shadow-2xl"></div>
            </div>
            <span className="text-[11px] font-mono text-gray-600 w-14">3:30</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-10 w-1/4">
          <i className="fas fa-microphone-alt text-lg text-gray-500 hover:text-[#1DB954] cursor-pointer transition-colors"></i>
          <i className="fas fa-layer-group text-lg text-gray-500 hover:text-[#1DB954] cursor-pointer transition-colors"></i>
          <i className="fas fa-desktop text-lg text-gray-500 hover:text-[#1DB954] cursor-pointer transition-colors"></i>
          <div className="flex items-center gap-4">
            <i className="fas fa-volume-up text-base text-gray-500"></i>
            <div className="w-32 h-1.5 bg-white/10 rounded-full group cursor-pointer relative">
               <div className="h-full bg-gray-500 group-hover:bg-[#1DB954] rounded-full transition-all w-2/3"></div>
               <div className="absolute top-1/2 -translate-y-1/2 left-[66%] w-4 h-4 bg-white rounded-full scale-0 group-hover:scale-100 transition-transform"></div>
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
        .animate-spin-slow { animation: spin 20s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translate(-50%, 150%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        .animate-slide-up { animation: slideUp 1s cubic-bezier(0.19, 1, 0.22, 1) forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.19, 1, 0.22, 1) forwards; }
        .animate-pulse-slow { animation: pulseSlow 6s infinite ease-in-out; }
        @keyframes pulseSlow { 0%, 100% { opacity: 0.2; transform: scaleX(0.9); } 50% { opacity: 0.7; transform: scaleX(1); } }
        .animate-bounce-slow { animation: bounceSlow 1.5s infinite ease-in-out; }
        @keyframes bounceSlow { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.4); } }
      `}</style>
    </div>
  );
};

export default App;
