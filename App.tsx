
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MOCK_LIBRARY, IMPORTED_USER_LIBRARY } from './constants';
import { Song, UserProfile, Recommendation, AudioFeatures, LiveDiscovery } from './types';
import EmbeddingMap from './components/EmbeddingMap';
import SonicOrb from './components/SonicOrb';
import { getMusicalExplanation, getLiveDiscovery, getComplexRefinement } from './services/geminiService';

type AuthStep = 'landing' | 'google-auth' | 'syncing' | 'authenticated';
type Tab = 'thinking-lab' | 'spotify-sync';

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const App: React.FC = () => {
  const [authStep, setAuthStep] = useState<AuthStep>('landing');
  const [activeTab, setActiveTab] = useState<Tab>('thinking-lab');
  const [library, setLibrary] = useState<Song[]>(MOCK_LIBRARY);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  
  // Audio Engine Ref
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Auth State
  const [googleUser, setGoogleUser] = useState<{name: string, email: string} | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Discovery State
  const [userProfile, setUserProfile] = useState<UserProfile>({
    preferenceVector: { mfccs: 50, spectralCentroid: 50, zcr: 50, chroma: 50, tempo: 120, energy: 50 },
    history: [],
    liked: [],
  });
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [liveDiscovery, setLiveDiscovery] = useState<LiveDiscovery | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [completedSongsCount, setCompletedSongsCount] = useState(0);

  const playbackFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Handle Audio State Changes
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error("Playback failed:", e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, selectedSong]);

  // Handle Playback Speed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, selectedSong]);

  // Track playback for discovery feedback
  useEffect(() => {
    if (selectedSong && authStep === 'authenticated' && isPlaying) {
      if (playbackFeedbackTimerRef.current) clearTimeout(playbackFeedbackTimerRef.current);
      playbackFeedbackTimerRef.current = setTimeout(() => {
        setCompletedSongsCount(prev => {
          const nextCount = prev + 1;
          if (prev >= 1) {
            setShowFeedback(true);
          }
          return nextCount;
        });
      }, 15000); 
    } else {
      if (playbackFeedbackTimerRef.current) clearTimeout(playbackFeedbackTimerRef.current);
    }
    return () => {
      if (playbackFeedbackTimerRef.current) clearTimeout(playbackFeedbackTimerRef.current);
    };
  }, [selectedSong, authStep, isPlaying]);

  // Click outside listener for suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      audioRef.current.playbackRate = playbackSpeed;
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !audioRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const targetTime = percentage * duration;
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const handleImageError = (id: string) => {
    setImageErrors(prev => ({ ...prev, [id]: true }));
  };

  const cyclePlaybackSpeed = () => {
    setPlaybackSpeed(current => {
      const nextIndex = (PLAYBACK_SPEEDS.indexOf(current) + 1) % PLAYBACK_SPEEDS.length;
      return PLAYBACK_SPEEDS[nextIndex];
    });
  };

  const calculateSimilarity = (f1: AudioFeatures, f2: AudioFeatures) => {
    const keys: (keyof AudioFeatures)[] = ['mfccs', 'spectralCentroid', 'zcr', 'chroma', 'energy'];
    let sumSquares = 0;
    keys.forEach(key => {
      sumSquares += Math.pow(f1[key] - f2[key], 2);
    });
    sumSquares += Math.pow((f1.tempo - f2.tempo) / 2, 2);
    return 1 / (1 + Math.sqrt(sumSquares));
  };

  const updateRecommendations = useCallback(async (currentPref: AudioFeatures, song: Song, targetLibrary: Song[], isRefining = false) => {
    setLoading(true);
    setSearchLoading(true);
    if (isRefining) setIsThinking(true);
    
    const sorted = [...targetLibrary]
      .filter(s => s.id !== song.id)
      .map(s => ({
        song: s,
        similarity: calculateSimilarity(s.features, currentPref),
        explanation: 'Synthesizing recommendation rationale...',
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);

    const withExplanations = await Promise.all(sorted.map(async (rec) => {
      const explanation = await getMusicalExplanation(rec.song, currentPref);
      return { ...rec, explanation };
    }));

    setRecommendations(withExplanations);
    setLoading(false);

    try {
      let discovery;
      if (isRefining) {
        discovery = await getComplexRefinement(song, currentPref, true); 
      } else {
        discovery = await getLiveDiscovery(song, currentPref);
      }
      setLiveDiscovery(discovery);
    } catch (err) {
      console.error(err);
    } finally {
      setSearchLoading(false);
      setIsThinking(false);
    }
  }, []);

  const handleStartAuth = () => {
    setAuthStep('google-auth');
  };

  const handleSelectGoogleAccount = (name: string, email: string) => {
    setIsAuthenticating(true);
    setGoogleUser({ name, email });
    setTimeout(() => {
      setIsAuthenticating(false);
      startSyncProcess(email);
    }, 1200);
  };

  const startSyncProcess = (email: string) => {
    setAuthStep('syncing');
    setIsImporting(true);
    setSyncLogs([`Initiating high-fidelity sync for ${email}...`]);
    
    const runSync = async () => {
      await new Promise(r => setTimeout(r, 800));
      setImportProgress(5);
      setSyncLogs(['Authenticating via Spotify Secure Bridge...']);
      
      for (let i = 0; i < IMPORTED_USER_LIBRARY.length; i++) {
        const song = IMPORTED_USER_LIBRARY[i];
        setImportStatus(`Syncing: ${song.title}`);
        setSyncLogs([`Retrieving Artwork & Artist Credentials: ${song.artist}`]);
        setImportProgress(10 + Math.floor((i / IMPORTED_USER_LIBRARY.length) * 80));
        await new Promise(r => setTimeout(r, 120));
      }

      setImportProgress(95);
      setSyncLogs(['Verifying cover art metadata and latent embeddings...']);
      await new Promise(r => setTimeout(r, 400));
      setImportProgress(100);
      setSyncLogs(['Sync Complete: Library Reconstructed with full metadata.']);
      await new Promise(r => setTimeout(r, 600));
      
      const now = new Date();
      setLastSyncedAt(now.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      }));
      setLibrary(IMPORTED_USER_LIBRARY);
      setIsImporting(false);
      setAuthStep('authenticated');
      setActiveTab('thinking-lab');
      
      const firstSong = IMPORTED_USER_LIBRARY[0];
      setSelectedSong(firstSong);
      setIsPlaying(true);
      
      const initialPref = firstSong.features;
      setUserProfile(prev => ({
        ...prev,
        preferenceVector: initialPref,
        history: [firstSong.id],
      }));

      updateRecommendations(initialPref, firstSong, IMPORTED_USER_LIBRARY);
    };
    runSync();
  };

  const handleSelectSong = (song: Song) => {
    setSelectedSong(song);
    setIsPlaying(true);
    setShowFeedback(false); 
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
      updateRecommendations(newPref, song, library);

      return {
        ...prev,
        preferenceVector: newPref,
        history: updatedHistory,
      };
    });
  };

  const submitFeedback = async (satisfied: boolean) => {
    setShowFeedback(false);
    if (!selectedSong) return;
    setSearchLoading(true);
    setIsThinking(true);
    setActiveTab('thinking-lab');

    try {
      const discovery = await getComplexRefinement(selectedSong, userProfile.preferenceVector, satisfied);
      setLiveDiscovery(discovery);
      
      if (!satisfied) {
        setUserProfile(prev => ({
          ...prev,
          preferenceVector: {
            ...prev.preferenceVector,
            energy: Math.max(0, Math.min(100, prev.preferenceVector.energy + (Math.random() - 0.5) * 20)),
          }
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsThinking(false);
      setSearchLoading(false);
    }
  };

  const handleShareOnSpotify = (e: React.MouseEvent, song: Song) => {
    e.stopPropagation(); // Prevent card selection logic
    const query = encodeURIComponent(`${song.artist} ${song.title}`);
    window.open(`https://open.spotify.com/search/${query}`, '_blank');
  };

  const filteredLibrary = useMemo(() => {
    return library.filter(song => {
      const matchesSearch = song.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            song.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            song.genre.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGenre = selectedGenre ? song.genre === selectedGenre : true;
      return matchesSearch && matchesGenre;
    });
  }, [library, searchQuery, selectedGenre]);

  const genreCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    library.forEach(s => {
      counts[s.genre] = (counts[s.genre] || 0) + 1;
    });
    return counts;
  }, [library]);

  const uniqueGenres = useMemo(() => {
    if (authStep !== 'authenticated') return [];
    return Object.keys(genreCounts).sort();
  }, [genreCounts, authStep]);

  const dynamicClusters = useMemo(() => {
    if (authStep !== 'authenticated') return [];
    const genres = Array.from(new Set(library.map(s => s.genre))).sort();
    return genres;
  }, [library, authStep]);

  const suggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    
    const query = searchQuery.toLowerCase();
    const results: { type: 'song' | 'artist' | 'genre', value: string, id: string }[] = [];
    
    library.forEach(s => {
      if (s.genre.toLowerCase().includes(query)) {
        if (!results.some(r => r.type === 'genre' && r.value === s.genre)) {
          results.push({ type: 'genre', value: s.genre, id: `g-${s.genre}` });
        }
      }
      if (s.artist.toLowerCase().includes(query)) {
        if (!results.some(r => r.type === 'artist' && r.value === s.artist)) {
          results.push({ type: 'artist', value: s.artist, id: `a-${s.artist}` });
        }
      }
      if (s.title.toLowerCase().includes(query)) {
        results.push({ type: 'song', value: `${s.title} - ${s.artist}`, id: `s-${s.id}` });
      }
    });

    return results.slice(0, 8);
  }, [library, searchQuery]);

  const ContentSearchBar = () => (
    <div className="relative group w-full max-w-2xl mx-auto mb-10" ref={searchContainerRef}>
      <i className="fas fa-search absolute left-6 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#1DB954] transition-all duration-300 text-sm pointer-events-none"></i>
      <input 
        type="text"
        placeholder="Filter collection by title, artist, or acoustic genre..."
        value={searchQuery}
        onFocus={() => setShowSuggestions(true)}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setShowSuggestions(true);
        }}
        className="w-full bg-white/[0.03] border border-white/5 rounded-[2rem] py-5 pl-14 pr-14 text-sm font-black text-white placeholder-gray-700 focus:outline-none focus:ring-1 focus:ring-[#1DB954]/40 focus:bg-white/[0.06] shadow-2xl transition-all"
      />
      {searchQuery && (
        <button 
          onClick={() => { setSearchQuery(''); setShowSuggestions(false); }}
          className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
        >
          <i className="fas fa-times-circle"></i>
        </button>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-3 bg-[#0c0c0c]/95 backdrop-blur-2xl border border-white/10 rounded-[2rem] overflow-hidden z-[100] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.8)] animate-fade-in">
          <div className="py-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                onClick={() => {
                  setSearchQuery(suggestion.type === 'song' ? suggestion.value.split(' - ')[0] : suggestion.value);
                  if (suggestion.type === 'genre') setSelectedGenre(suggestion.value);
                  setShowSuggestions(false);
                }}
                className="w-full flex items-center gap-4 px-6 py-4 hover:bg-[#1DB954]/10 transition-colors text-left group"
              >
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[10px] group-hover:bg-[#1DB954]/20 group-hover:text-[#1DB954] transition-all">
                  {suggestion.type === 'song' && <i className="fas fa-music"></i>}
                  {suggestion.type === 'artist' && <i className="fas fa-user"></i>}
                  {suggestion.type === 'genre' && <i className="fas fa-tag"></i>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black text-white truncate uppercase tracking-tight">{suggestion.value}</p>
                  <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">{suggestion.type}</p>
                </div>
                <i className="fas fa-arrow-right text-[10px] text-gray-800 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all"></i>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  if (authStep === 'landing') {
    return (
      <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center p-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-tr from-[#1DB954]/20 via-black to-[#1DB954]/5 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col items-center max-w-lg w-full text-center">
          <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center mb-10 shadow-[0_0_50px_rgba(29,185,84,0.3)] transform -rotate-3 hover:rotate-0 transition-transform duration-500 cursor-default">
            <i className="fas fa-wave-square text-black text-5xl"></i>
          </div>
          <h1 className="text-7xl font-black text-white mb-4 tracking-tighter italic">Musologist</h1>
          <p className="text-gray-400 text-lg font-medium mb-12 leading-relaxed max-w-sm">
            Deep acoustic mapping for the curious listener. Connect your Spotify to decode your sonic DNA.
          </p>
          <div className="w-full flex flex-col gap-4 max-w-sm">
            <button onClick={handleStartAuth} className="group w-full py-5 bg-[#1DB954] hover:bg-[#1ed760] text-black font-black rounded-full flex items-center justify-center gap-4 transition-all transform hover:scale-[1.05] active:scale-[0.98] shadow-[0_15px_40px_rgba(29,185,84,0.2)]">
              <i className="fab fa-spotify text-2xl"></i>
              <span className="text-lg">Connect Spotify</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (authStep === 'google-auth') {
    return (
      <div className="fixed inset-0 bg-[#f8f9fa] z-[100] flex items-center justify-center p-6 text-black">
        <div className="w-full max-w-[440px] bg-white rounded-lg shadow-xl p-10 border border-[#dadce0] animate-fade-in">
          <div className="flex flex-col items-center text-center">
            <img src="https://www.gstatic.com/images/branding/googlelogo/1x/googlelogo_color_92x30dp.png" alt="Google" className="mb-6 w-24" />
            <h2 className="text-2xl font-normal text-[#202124] mb-2">Link Account</h2>
            <p className="text-base text-[#202124] mb-8">to authorize <span className="font-medium">Musologist AI</span> access</p>
            {isAuthenticating ? (
              <div className="flex flex-col items-center py-10">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-sm text-[#5f6368] font-medium">Securing Spotify Bridge...</p>
              </div>
            ) : (
              <div className="w-full border-t border-b border-[#dadce0] mb-8">
                <button onClick={() => handleSelectGoogleAccount('Alex Rivera', 'alex.rivera@gmail.com')} className="w-full py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors px-2 text-left group">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">A</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#3c4043]">Alex Rivera</p>
                    <p className="text-xs text-[#5f6368]">alex.rivera@gmail.com</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (authStep === 'syncing') {
    return (
      <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center p-12 text-center">
        <div className="w-full max-w-2xl">
          <SonicOrb energy={70} brightness={85} intensity={90} />
          <h2 className="text-3xl font-black text-white mt-10 tracking-tighter uppercase italic">{importStatus || 'Extracting Spotify Genome'}</h2>
          <div className="w-full h-1.5 bg-white/5 rounded-full mt-8 overflow-hidden">
            <div className="h-full bg-[#1DB954] transition-all duration-300" style={{ width: `${importProgress}%` }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black text-gray-200 overflow-hidden font-sans">
      <audio 
        ref={audioRef} 
        src={selectedSong?.audioUrl} 
        onTimeUpdate={handleTimeUpdate} 
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      <nav className="w-64 flex-none bg-black flex flex-col p-6 space-y-8 border-r border-white/5 z-50">
        <div className="flex items-center gap-3 px-2 mb-4">
          <i className="fas fa-wave-square text-[#1DB954] text-2xl"></i>
          <span className="text-xl font-black tracking-tighter italic text-white">Musologist</span>
        </div>
        <div className="space-y-2">
          <button onClick={() => setActiveTab('thinking-lab')} className={`w-full flex items-center gap-4 py-3 px-4 rounded-xl font-black text-sm transition-all group ${activeTab === 'thinking-lab' ? 'bg-[#1DB954] text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
            <i className="fas fa-brain"></i> Thinking Lab
          </button>
          <button onClick={() => setActiveTab('spotify-sync')} className={`w-full flex items-center gap-4 py-3 px-4 rounded-xl font-black text-sm transition-all group ${activeTab === 'spotify-sync' ? 'bg-[#1DB954] text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
            <i className="fas fa-sync-alt"></i> Spotify Sync
          </button>
        </div>
        <div className="flex-1 border-t border-white/5 mt-4 pt-6 overflow-y-auto custom-scrollbar">
           <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mb-4 px-4">Synced Clusters</p>
           {dynamicClusters.map(cluster => (
             <div key={cluster} onClick={() => { setSelectedGenre(cluster); setActiveTab('spotify-sync'); }} className={`px-4 py-2 text-xs cursor-pointer transition-colors flex items-center gap-2 group ${selectedGenre === cluster ? 'text-white' : 'text-gray-500 hover:text-white'}`}>
               <span className={`w-1.5 h-1.5 rounded-full ${selectedGenre === cluster ? 'bg-[#1DB954]' : 'bg-[#1DB954]/40 group-hover:bg-[#1DB954]'}`}></span> {cluster}
             </div>
           ))}
        </div>
        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-[10px] font-black text-white">{googleUser?.name.charAt(0)}</div>
              <div className="min-w-0">
                <p className="text-[11px] font-black text-white truncate">{googleUser?.name}</p>
                <p className="text-[9px] text-[#1DB954] font-black uppercase">Active Account</p>
              </div>
           </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col bg-[#0a0a0a] overflow-hidden relative">
        <header className="h-20 flex items-center justify-between px-10 border-b border-white/[0.03] backdrop-blur-md z-40">
          <h2 className="text-sm font-black text-white uppercase tracking-widest italic">{activeTab.replace('-', ' ')}</h2>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-[#1DB954] animate-pulse"></div>
               <span className="text-[10px] font-black uppercase tracking-widest text-[#1DB954]">Engine Live</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          {activeTab === 'thinking-lab' ? (
            <div className="animate-fade-in space-y-12 pb-32">
               <ContentSearchBar />
               <div className="bg-white/[0.01] rounded-[3rem] border border-white/5 p-8 shadow-inner overflow-hidden">
                 <EmbeddingMap songs={library} selectedSongId={selectedSong?.id} onSelectSong={handleSelectSong} searchQuery={searchQuery} />
               </div>
               <div className="flex flex-col lg:flex-row gap-12 items-start">
                 <div className="flex-none w-full lg:w-80 flex flex-col items-center bg-white/[0.02] p-8 rounded-[3rem] border border-white/5">
                    <SonicOrb energy={userProfile.preferenceVector.energy} brightness={userProfile.preferenceVector.spectralCentroid} intensity={userProfile.preferenceVector.mfccs} />
                 </div>
                 <div className="flex-1 space-y-10 w-full">
                    <section>
                       <h3 className="text-sm font-black mb-6 text-white uppercase tracking-widest flex items-center gap-3">
                          <i className="fas fa-microchip text-[#1DB954]"></i> Discovery Pipeline
                       </h3>
                       <div className="grid gap-4">
                          {loading ? (
                            Array(3).fill(0).map((_, i) => <div key={i} className="h-24 bg-white/5 rounded-3xl animate-pulse"></div>)
                          ) : recommendations.map(rec => (
                            <div key={rec.song.id} onClick={() => handleSelectSong(rec.song)} className="group bg-white/[0.02] hover:bg-white/[0.05] p-6 rounded-[2rem] border border-white/5 transition-all cursor-pointer flex items-center gap-6">
                               <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center border border-white/5 group-hover:scale-110 transition-transform overflow-hidden relative">
                                  {rec.song.coverUrl && !imageErrors[rec.song.id] ? (
                                    <img src={rec.song.coverUrl} alt={rec.song.title} className="w-full h-full object-cover" onError={() => handleImageError(rec.song.id)} />
                                  ) : (
                                    <i className="fas fa-compact-disc text-xl text-gray-800"></i>
                                  )}
                                  {selectedSong?.id === rec.song.id && isPlaying && <div className="absolute inset-0 bg-[#1DB954]/20 flex items-center justify-center"><i className="fas fa-pause text-white text-[10px]"></i></div>}
                               </div>
                               <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-3 mb-1">
                                     <h4 className="font-black text-sm text-white truncate">{rec.song.title}</h4>
                                     <span className="text-[9px] font-black text-[#1DB954] uppercase tracking-tighter bg-[#1DB954]/10 px-2 py-0.5 rounded-full">{Math.round(rec.similarity * 100)}% Match</span>
                                  </div>
                                  <p className="text-[10px] text-gray-500 font-bold uppercase">{rec.song.artist}</p>
                               </div>
                               <div className="hidden xl:block max-w-[280px] text-[10px] text-gray-500 italic leading-snug">{rec.explanation}</div>
                            </div>
                          ))}
                       </div>
                    </section>
                 </div>
               </div>
            </div>
          ) : (
            <div className="animate-fade-in space-y-8 pb-32">
               <ContentSearchBar />
               
               {/* Explicit Genre Filter Row */}
               <div className="flex items-center gap-3 overflow-x-auto pb-6 no-scrollbar relative mb-4">
                 <button 
                   onClick={() => setSelectedGenre(null)} 
                   className={`flex-none px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${!selectedGenre ? 'bg-[#1DB954] text-black shadow-[0_10px_25px_rgba(29,185,84,0.4)]' : 'bg-white/5 text-gray-500 hover:text-white hover:bg-white/10 border border-white/5'}`}
                 >
                   All Tracks <span className="opacity-40 ml-1">({library.length})</span>
                 </button>
                 {uniqueGenres.map(genre => (
                   <button 
                     key={genre} 
                     onClick={() => setSelectedGenre(genre)} 
                     className={`flex-none px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all transform hover:scale-105 active:scale-95 ${selectedGenre === genre ? 'bg-[#1DB954] text-black shadow-[0_10px_25px_rgba(29,185,84,0.4)]' : 'bg-white/5 text-gray-500 hover:text-white hover:bg-white/10 border border-white/5'}`}
                   >
                     {genre} <span className="opacity-40 ml-1">({genreCounts[genre]})</span>
                   </button>
                 ))}
               </div>
               
               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                 {filteredLibrary.map(song => (
                   <div key={song.id} onClick={() => handleSelectSong(song)} className={`group p-5 rounded-[2rem] transition-all cursor-pointer relative flex flex-col items-start text-left ${selectedSong?.id === song.id ? 'bg-[#1DB954]/10 ring-1 ring-[#1DB954]/30' : 'bg-white/[0.02] hover:bg-white/5 shadow-xl border border-white/5'}`}>
                     <div className="aspect-square w-full bg-black rounded-2xl mb-4 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform overflow-hidden relative border border-white/5">
                       {song.coverUrl && !imageErrors[song.id] ? (
                         <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" onError={() => handleImageError(song.id)} />
                       ) : (
                         <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900/40 text-gray-700">
                           <i className={`fas fa-compact-disc text-4xl transition-all duration-1000 ${selectedSong?.id === song.id && isPlaying ? 'text-[#1DB954] animate-spin-slow' : 'text-gray-800'}`}></i>
                         </div>
                       )}
                       {selectedSong?.id === song.id && <div className="absolute inset-0 bg-[#1DB954]/5 flex items-center justify-center backdrop-blur-[1px]"><div className="w-2 h-2 rounded-full bg-[#1DB954] animate-ping"></div></div>}
                     </div>
                     <h4 className="font-black text-sm truncate w-full text-white mb-1 leading-tight">{song.title}</h4>
                     <p className="text-[11px] text-gray-400 truncate w-full font-bold uppercase tracking-wide mb-1">{song.artist}</p>
                     <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold mb-3">
                        <i className="fas fa-clock text-[9px] opacity-60"></i>
                        <span>{song.duration}</span>
                     </div>
                     <div className="flex items-center justify-between w-full mt-auto">
                        <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest bg-white/5 px-2 py-1 rounded-md">{song.genre}</span>
                        {/* Share on Spotify Button */}
                        <button 
                          onClick={(e) => handleShareOnSpotify(e, song)}
                          className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-[#1DB954] hover:bg-[#1DB954]/10 transition-all group/btn"
                          title="Search on Spotify"
                        >
                          <i className="fab fa-spotify text-sm transform group-hover/btn:scale-110"></i>
                        </button>
                     </div>
                   </div>
                 ))}
               </div>
               
               {filteredLibrary.length === 0 && (
                 <div className="py-20 flex flex-col items-center justify-center text-center opacity-40">
                    <i className="fas fa-filter text-5xl mb-6"></i>
                    <p className="text-sm font-black uppercase tracking-widest">No tracks match your current filter manifold</p>
                    <button onClick={() => { setSelectedGenre(null); setSearchQuery(''); }} className="mt-6 px-8 py-3 bg-white/5 hover:bg-white/10 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10 transition-all">Clear All Filters</button>
                 </div>
               )}
            </div>
          )}
        </div>

        {showFeedback && (
          <div className="absolute bottom-28 left-1/2 -translate-x-1/2 w-full max-w-sm px-6 animate-slide-up z-50">
            <div className="bg-white p-10 rounded-[3rem] shadow-[0_50px_100px_rgba(0,0,0,0.8)] border border-white/10 flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-[#1DB954] rounded-2xl flex items-center justify-center mb-6 rotate-3">
                <i className="fas fa-brain text-black text-2xl"></i>
              </div>
              <h4 className="text-gray-950 text-lg font-black mb-8 leading-tight italic text-black">Accurate discovery?</h4>
              <div className="flex gap-4 w-full">
                <button onClick={() => submitFeedback(true)} className="flex-1 py-4 bg-black text-white text-[11px] font-black rounded-full hover:scale-105 transition-all">YES</button>
                <button onClick={() => submitFeedback(false)} className="flex-1 py-4 bg-gray-100 text-gray-900 text-[11px] font-black rounded-full hover:bg-gray-200 transition-all">NO</button>
              </div>
            </div>
          </div>
        )}

        <footer className="h-28 bg-black/90 border-t border-white/5 px-10 flex items-center justify-between z-40 backdrop-blur-xl">
           <div className="w-1/4 flex items-center gap-6">
              {selectedSong && (
                 <div className="flex items-center gap-4 animate-fade-in">
                    <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center border border-white/5 overflow-hidden">
                       {selectedSong.coverUrl && !imageErrors[selectedSong.id] ? (
                         <img src={selectedSong.coverUrl} alt={selectedSong.title} className="w-full h-full object-cover" onError={() => handleImageError(selectedSong.id)} />
                       ) : (
                         <i className={`fas fa-compact-disc text-[#1DB954] text-3xl ${isPlaying ? 'animate-spin-slow' : ''}`}></i>
                       )}
                    </div>
                    <div className="min-w-0">
                       <p className="text-sm font-black text-white truncate">{selectedSong.title}</p>
                       <p className="text-[10px] text-gray-500 font-bold uppercase truncate">{selectedSong.artist}</p>
                    </div>
                 </div>
              )}
           </div>
           <div className="w-1/2 flex flex-col items-center gap-3">
              <div className="flex items-center gap-10 text-gray-500">
                 <i onClick={() => setIsShuffle(!isShuffle)} className={`fas fa-random text-sm cursor-pointer transition-colors ${isShuffle ? 'text-[#1DB954]' : 'hover:text-white'}`}></i>
                 <i className="fas fa-step-backward text-lg hover:text-white cursor-pointer transition-colors"></i>
                 <div onClick={() => setIsPlaying(!isPlaying)} className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-black hover:scale-110 transition-transform cursor-pointer shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                    <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-xl ${!isPlaying ? 'ml-1' : ''}`}></i>
                 </div>
                 <i className="fas fa-step-forward text-lg hover:text-white cursor-pointer transition-colors"></i>
                 <i onClick={() => setIsRepeat(!isRepeat)} className={`fas fa-redo text-sm cursor-pointer transition-colors ${isRepeat ? 'text-[#1DB954]' : 'hover:text-white'}`}></i>
              </div>
              <div className="w-full max-md flex items-center gap-4">
                 <span className="text-[9px] font-black text-gray-500 tabular-nums">{formatTime(currentTime)}</span>
                 <div ref={progressRef} onClick={handleProgressClick} className="flex-1 h-1 bg-white/10 rounded-full relative overflow-hidden cursor-pointer group">
                    <div className="absolute inset-0 bg-white/5 group-hover:bg-white/10 transition-colors"></div>
                    <div className="absolute inset-y-0 left-0 bg-white rounded-full" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}></div>
                 </div>
                 <span className="text-[9px] font-black text-gray-500 tabular-nums">{formatTime(duration)}</span>
              </div>
           </div>
           <div className="w-1/4 flex justify-end items-center gap-6">
              <button 
                onClick={cyclePlaybackSpeed}
                className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-gray-400 hover:text-white hover:border-white/20 transition-all"
                title="Playback Speed"
              >
                {playbackSpeed}x
              </button>
              <i className="fas fa-volume-up text-gray-500 text-sm"></i>
              <div className="w-24 h-1 bg-white/10 rounded-full relative overflow-hidden">
                 <div className="absolute inset-y-0 left-0 bg-gray-400 rounded-full" style={{ width: '80%' }}></div>
              </div>
           </div>
        </footer>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .animate-spin-slow { animation: spin 15s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translate(-50%, 150%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        .animate-slide-up { animation: slideUp 0.6s cubic-bezier(0.19, 1, 0.22, 1) forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default App;
