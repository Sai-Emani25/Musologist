
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { MOCK_LIBRARY, IMPORTED_USER_LIBRARY } from './constants';
import { Song, UserProfile, Recommendation, AudioFeatures, LiveDiscovery } from './types';
import EmbeddingMap from './components/EmbeddingMap';
import SonicOrb from './components/SonicOrb';
import { getMusicalExplanation, getLiveDiscovery, getComplexRefinement, getBatchedMusicalExplanations } from './services/geminiService';

type AuthStep = 'landing' | 'google-auth' | 'syncing' | 'authenticated';
type Tab = 'thinking-lab' | 'spotify-sync';
type SearchCriteria = 'all' | 'title' | 'artist' | 'genre' | 'album';
type SortDirection = 'asc' | 'desc' | 'none';

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
  const [queue, setQueue] = useState<Song[]>([]);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  
  const [importProgress, setImportProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>('all');
  const [durationSort, setDurationSort] = useState<SortDirection>('none');
  const [isCriteriaOpen, setIsCriteriaOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  
  // Milestone Discovery State
  const [completedSongsCount, setCompletedSongsCount] = useState(0);
  const [milestoneRec, setMilestoneRec] = useState<LiveDiscovery | null>(null);
  const [isMilestoneLoading, setIsMilestoneLoading] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const processedMilestones = useRef<Set<number>>(new Set());

  // Audio Engine Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);

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
  const [isThinking, setIsThinking] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const playbackFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const criteriaRef = useRef<HTMLDivElement>(null);
  const lastApiCallRef = useRef<number>(0);

  // Improved Audio Playback handling
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = async () => {
      if (isPlaying) {
        try {
          if (playPromiseRef.current) await playPromiseRef.current;
          playPromiseRef.current = audio.play();
          await playPromiseRef.current;
          playPromiseRef.current = null;
        } catch (e: any) {
          if (e.name !== 'AbortError') console.error("Playback failed:", e);
        }
      } else {
        audio.pause();
      }
    };

    handlePlay();
  }, [isPlaying, selectedSong]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, selectedSong]);

  // Track playback for discovery feedback and milestones
  useEffect(() => {
    if (selectedSong && authStep === 'authenticated' && isPlaying) {
      if (playbackFeedbackTimerRef.current) clearTimeout(playbackFeedbackTimerRef.current);
      
      // Completion trigger (5 seconds for rapid testing / screenshot)
      playbackFeedbackTimerRef.current = setTimeout(() => {
        setCompletedSongsCount(prev => {
          const nextCount = prev + 1;
          
          /**
           * Feedback Schedule:
           * - 1 (Demo/Screenshot override)
           * - 3
           * - 5
           * - Permanently 7, 14, 21...
           */
          const shouldShowFeedback = 
            nextCount === 1 ||
            nextCount === 3 || 
            nextCount === 5 || 
            (nextCount >= 7 && nextCount % 7 === 0);

          if (shouldShowFeedback) {
            setShowFeedback(true);
          }
          
          return nextCount;
        });
      }, 5000); 
    } else {
      if (playbackFeedbackTimerRef.current) clearTimeout(playbackFeedbackTimerRef.current);
    }
    return () => {
      if (playbackFeedbackTimerRef.current) clearTimeout(playbackFeedbackTimerRef.current);
    };
  }, [selectedSong, authStep, isPlaying]);

  // Milestone logic for every 3 songs
  useEffect(() => {
    if (completedSongsCount > 0 && completedSongsCount % 3 === 0 && !processedMilestones.current.has(completedSongsCount)) {
      processedMilestones.current.add(completedSongsCount);
      handleMilestoneDiscovery();
    }
  }, [completedSongsCount]);

  const handleMilestoneDiscovery = async () => {
    if (!selectedSong) return;
    setIsMilestoneLoading(true);
    setShowMilestoneModal(true);
    try {
      const discovery = await getLiveDiscovery(selectedSong, userProfile.preferenceVector);
      setMilestoneRec(discovery);
    } catch (err) {
      console.error("Milestone Discovery Error:", err);
    } finally {
      setIsMilestoneLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
      if (criteriaRef.current && !criteriaRef.current.contains(event.target as Node)) {
        setIsCriteriaOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (authStep === 'syncing') {
      let progress = 0;
      const interval = setInterval(() => {
        progress += 4 + Math.random() * 8;
        if (progress >= 100) {
          progress = 100;
          setImportProgress(100);
          setImportStatus('Analysis Complete');
          clearInterval(interval);
          setTimeout(() => {
            setLibrary(IMPORTED_USER_LIBRARY);
            setAuthStep('authenticated');
          }, 800);
        } else {
          setImportProgress(progress);
          setImportStatus(['Reading Spotify DNA...', 'Mapping Latent Space...', 'Clustering Clusters...'][Math.floor((progress / 100) * 3)]);
        }
      }, 300);
      return () => clearInterval(interval);
    }
  }, [authStep]);

  const handleStartAuth = () => setAuthStep('google-auth');

  const handleSelectGoogleAccount = (name: string, email: string) => {
    setGoogleUser({ name, email });
    setIsAuthenticating(true);
    setTimeout(() => {
      setIsAuthenticating(false);
      setAuthStep('syncing');
    }, 1500);
  };

  const updateRecommendations = useCallback(async (pref: AudioFeatures, currentSong: Song, lib: Song[]) => {
    if (!currentSong || lib.length <= 1) return;
    const now = Date.now();
    if (now - lastApiCallRef.current < 2000) return;
    lastApiCallRef.current = now;

    setLoading(true);
    try {
      const others = lib.filter(s => s.id !== currentSong.id);
      const shuffled = [...others].sort(() => 0.5 - Math.random());
      const selectedSongs = shuffled.slice(0, 3);
      
      const explanations = await getBatchedMusicalExplanations(selectedSongs, pref);
      
      const newRecs: Recommendation[] = selectedSongs.map((song, i) => ({
        song,
        similarity: 0.75 + Math.random() * 0.2,
        explanation: explanations[i]
      }));
      
      setRecommendations(newRecs);
    } catch (err) {
      console.error("Discovery Engine Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
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
    audioRef.current.currentTime = percentage * duration;
  };

  const cyclePlaybackSpeed = () => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    setPlaybackSpeed(PLAYBACK_SPEEDS[nextIndex]);
  };

  const handleNextSong = useCallback(() => {
    if (queue.length > 0) {
      const nextSong = queue[0];
      setQueue(prev => prev.slice(1));
      handleSelectSong(nextSong, false); 
      return;
    }
    if (!selectedSong || library.length === 0) return;
    const currentIndex = library.findIndex(s => s.id === selectedSong.id);
    const nextIndex = (currentIndex + 1) % library.length;
    handleSelectSong(library[nextIndex], true);
  }, [selectedSong, library, queue]);

  const handlePreviousSong = useCallback(() => {
    if (!selectedSong || library.length === 0) return;
    const currentIndex = library.findIndex(s => s.id === selectedSong.id);
    const prevIndex = (currentIndex - 1 + library.length) % library.length;
    handleSelectSong(library[prevIndex], true);
  }, [selectedSong, library]);

  const handleSelectSong = (song: Song, resetQueue: boolean = true) => {
    setSelectedSong(song);
    setIsPlaying(true);
    setShowFeedback(false); 
    
    if (resetQueue) {
      const currentIndex = library.findIndex(s => s.id === song.id);
      if (currentIndex !== -1) setQueue(library.slice(currentIndex + 1));
    }

    const alpha = 0.35;
    const currentPref = userProfile.preferenceVector;
    const newPref: AudioFeatures = {
      mfccs: Math.round(currentPref.mfccs * (1 - alpha) + song.features.mfccs * alpha),
      spectralCentroid: Math.round(currentPref.spectralCentroid * (1 - alpha) + song.features.spectralCentroid * alpha),
      zcr: Math.round(currentPref.zcr * (1 - alpha) + song.features.zcr * alpha),
      chroma: Math.round(currentPref.chroma * (1 - alpha) + song.features.chroma * alpha),
      tempo: Math.round(currentPref.tempo * (1 - alpha) + song.features.tempo * alpha),
      energy: Math.round(currentPref.energy * (1 - alpha) + song.features.energy * alpha),
    };

    setUserProfile(prev => ({
      ...prev,
      preferenceVector: newPref,
      history: [song.id, ...prev.history.filter(id => id !== song.id)].slice(0, 10),
    }));

    updateRecommendations(newPref, song, library);
  };

  const submitFeedback = async (satisfied: boolean) => {
    setShowFeedback(false);
    if (!selectedSong) return;
    setIsThinking(true);
    setActiveTab('thinking-lab');
    try {
      const discovery = await getComplexRefinement(selectedSong, userProfile.preferenceVector, satisfied);
      setLiveDiscovery(discovery);
    } catch (err) {
      console.error(err);
    } finally {
      setIsThinking(false);
    }
  };

  const handleShareOnSpotify = (e: React.MouseEvent | null, song: { title: string, artist: string }) => {
    e?.stopPropagation(); 
    window.open(`https://open.spotify.com/search/${encodeURIComponent(`${song.artist} ${song.title}`)}`, '_blank');
  };

  const filteredLibrary = useMemo(() => {
    const query = searchQuery.toLowerCase();
    let result = library.filter(song => {
      let matchesSearch = song.title.toLowerCase().includes(query) || song.artist.toLowerCase().includes(query) || song.genre.toLowerCase().includes(query) || song.album.toLowerCase().includes(query);
      const matchesGenre = selectedGenre ? song.genre === selectedGenre : true;
      return matchesSearch && matchesGenre;
    });

    if (durationSort !== 'none') {
      result = [...result].sort((a, b) => {
        const secA = a.duration.split(':').map(Number).reduce((m, s) => m * 60 + s);
        const secB = b.duration.split(':').map(Number).reduce((m, s) => m * 60 + s);
        return durationSort === 'asc' ? secA - secB : secB - secA;
      });
    }
    return result;
  }, [library, searchQuery, selectedGenre, durationSort]);

  const uniqueGenres = useMemo(() => Array.from(new Set(library.map(s => s.genre))).sort(), [library]);

  if (authStep === 'landing') return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center mb-10 shadow-2xl rotate-3">
        <i className="fas fa-wave-square text-black text-5xl"></i>
      </div>
      <h1 className="text-7xl font-black mb-6 italic tracking-tighter">Musologist</h1>
      <p className="text-gray-400 mb-12 max-w-sm font-medium">Map your sonic genome. Discover what's next.</p>
      <button onClick={handleStartAuth} className="px-14 py-6 bg-[#1DB954] text-black font-black rounded-full text-lg hover:scale-105 transition-all shadow-xl">Connect Spotify</button>
    </div>
  );

  if (authStep === 'google-auth') return (
    <div className="fixed inset-0 bg-[#f8f9fa] flex items-center justify-center p-6 text-black">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-2xl p-10 border border-gray-200">
        <h2 className="text-2xl mb-8 font-medium">Link Account</h2>
        <button onClick={() => handleSelectGoogleAccount('Alex Rivera', 'alex@example.com')} className="w-full py-4 flex items-center gap-4 hover:bg-gray-50 border-t border-b text-left">
           <div className="w-10 h-10 bg-blue-500 rounded-full text-white flex items-center justify-center font-bold">A</div>
           <div className="flex-1 min-w-0"><p className="text-sm font-bold">Alex Rivera</p><p className="text-xs text-gray-500">alex@example.com</p></div>
        </button>
      </div>
    </div>
  );

  if (authStep === 'syncing') return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-12 text-center">
       <SonicOrb energy={70} brightness={85} intensity={90} />
       <h2 className="text-2xl font-black mt-10 uppercase italic tracking-widest">{importStatus}</h2>
       <div className="w-64 h-1 bg-white/10 rounded-full mt-6 overflow-hidden"><div className="h-full bg-[#1DB954]" style={{ width: `${importProgress}%` }}></div></div>
    </div>
  );

  return (
    <div className="flex h-screen bg-black text-gray-200 overflow-hidden font-sans">
      <audio ref={audioRef} src={selectedSong?.audioUrl} onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onEnded={handleNextSong} />

      <nav className="w-64 bg-black border-r border-white/5 flex flex-col p-6 space-y-8 z-50">
        <h1 className="text-xl font-black italic text-white flex items-center gap-2"><i className="fas fa-wave-square text-[#1DB954]"></i> Musologist</h1>
        <div className="space-y-1">
          <button onClick={() => setActiveTab('thinking-lab')} className={`w-full text-left px-4 py-3 rounded-xl font-black text-sm transition-all ${activeTab === 'thinking-lab' ? 'bg-[#1DB954] text-black' : 'hover:bg-white/5 text-gray-400'}`}>Thinking Lab</button>
          <button onClick={() => setActiveTab('spotify-sync')} className={`w-full text-left px-4 py-3 rounded-xl font-black text-sm transition-all ${activeTab === 'spotify-sync' ? 'bg-[#1DB954] text-black' : 'hover:bg-white/5 text-gray-400'}`}>Spotify Sync</button>
        </div>
        <div className="mt-auto p-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-[10px] font-black">{googleUser?.name[0]}</div>
          <p className="text-[11px] font-black truncate">{googleUser?.name}</p>
        </div>
      </nav>

      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#0a0a0a]">
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          {activeTab === 'thinking-lab' ? (
            <div className="space-y-12 pb-32 animate-fade-in">
               <EmbeddingMap songs={library} selectedSongId={selectedSong?.id} onSelectSong={(s) => handleSelectSong(s, true)} searchQuery={searchQuery} />
               <div className="flex flex-col lg:flex-row gap-12 items-start">
                 <div className="p-10 bg-white/[0.02] rounded-[3rem] border border-white/5">
                   <SonicOrb energy={userProfile.preferenceVector.energy} brightness={userProfile.preferenceVector.spectralCentroid} intensity={userProfile.preferenceVector.mfccs} />
                 </div>
                 <div className="flex-1 space-y-6">
                    <h3 className="text-sm font-black uppercase tracking-widest text-[#1DB954] mb-8">Discovery Pipeline</h3>
                    {recommendations.map(rec => (
                      <div key={rec.song.id} onClick={() => handleSelectSong(rec.song)} className="p-6 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-3xl cursor-pointer flex gap-6 group transition-all">
                         <div className="w-12 h-12 bg-black rounded-xl overflow-hidden shadow-lg group-hover:scale-110 transition-transform">
                           <img src={rec.song.coverUrl} className="w-full h-full object-cover" />
                         </div>
                         <div className="flex-1 min-w-0">
                           <h4 className="font-black text-white truncate">{rec.song.title}</h4>
                           <p className="text-[10px] uppercase font-bold text-gray-500">{rec.song.artist}</p>
                         </div>
                         <div className="max-w-[200px] text-[10px] text-gray-500 italic hidden sm:block">{rec.explanation}</div>
                      </div>
                    ))}
                 </div>
               </div>
            </div>
          ) : (
            <div className="space-y-8 pb-32 animate-fade-in">
               <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                  <button onClick={() => setSelectedGenre(null)} className={`px-6 py-3 rounded-full text-[10px] font-black uppercase transition-all ${!selectedGenre ? 'bg-[#1DB954] text-black shadow-lg shadow-[#1DB954]/20' : 'bg-white/5 text-gray-500'}`}>All</button>
                  {uniqueGenres.map(g => <button key={g} onClick={() => setSelectedGenre(g)} className={`px-6 py-3 rounded-full text-[10px] font-black uppercase transition-all ${selectedGenre === g ? 'bg-[#1DB954] text-black shadow-lg shadow-[#1DB954]/20' : 'bg-white/5 text-gray-500'}`}>{g}</button>)}
                  <button onClick={() => setDurationSort(d => d === 'asc' ? 'desc' : 'asc')} className="ml-auto px-6 py-3 rounded-full bg-white/5 text-[10px] font-black uppercase text-gray-400">Sort {durationSort === 'asc' ? '↑' : '↓'}</button>
               </div>
               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                 {filteredLibrary.map(song => (
                   <div key={song.id} onClick={() => handleSelectSong(song)} className={`group p-4 bg-white/[0.02] border rounded-[2rem] cursor-pointer transition-all ${selectedSong?.id === song.id ? 'border-[#1DB954]/40 bg-[#1DB954]/5' : 'border-white/5 hover:bg-white/5'}`}>
                     <div className="aspect-square bg-gray-900 rounded-2xl mb-4 overflow-hidden shadow-xl"><img src={song.coverUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /></div>
                     <h4 className="font-black text-sm text-white truncate">{song.title}</h4>
                     <p className="text-[10px] text-gray-500 font-bold uppercase truncate">{song.artist}</p>
                     <div className="flex items-center justify-between mt-3">
                       <span className="text-[9px] text-gray-600 font-black uppercase">{song.genre}</span>
                       <span className="text-[9px] text-[#1DB954] font-black">{song.duration}</span>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          )}
        </div>

        {showMilestoneModal && milestoneRec && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-2xl">
            <div className="w-full max-w-lg bg-[#0c0c0c] border border-white/10 rounded-[3rem] p-12 text-center shadow-[0_0_100px_rgba(29,185,84,0.1)] animate-slide-up">
              <div className="w-20 h-20 bg-[#1DB954] rounded-3xl mx-auto flex items-center justify-center mb-8 rotate-6">
                <i className="fas fa-sparkles text-black text-3xl"></i>
              </div>
              <h2 className="text-4xl font-black italic mb-4 tracking-tighter">Wanna try?</h2>
              <p className="text-gray-400 mb-10 leading-relaxed font-medium">{milestoneRec.text}</p>
              {milestoneRec.sources[0] && (
                <button onClick={() => { handleShareOnSpotify(null, { title: milestoneRec.sources[0].title, artist: '' }); setShowMilestoneModal(false); }} className="w-full py-6 bg-[#1DB954] text-black font-black rounded-3xl hover:scale-105 transition-all text-lg shadow-xl">Listen to: {milestoneRec.sources[0].title}</button>
              )}
              <button onClick={() => setShowMilestoneModal(false)} className="mt-6 text-[10px] font-black text-gray-600 hover:text-white uppercase tracking-widest transition-colors">Maybe later</button>
            </div>
          </div>
        )}

        {showFeedback && (
          <div className="absolute bottom-28 left-1/2 -translate-x-1/2 w-full max-w-sm p-6 z-50 animate-slide-up">
            <div className="bg-white p-10 rounded-[3rem] text-center shadow-[0_50px_100px_rgba(0,0,0,0.5)] border border-gray-100">
              <div className="w-14 h-14 bg-[#1DB954] rounded-2xl mx-auto flex items-center justify-center mb-6 -rotate-3">
                <i className="fas fa-brain text-black text-2xl"></i>
              </div>
              <h4 className="text-black font-black text-xl mb-8 italic">Accurate discovery?</h4>
              <div className="flex gap-4">
                <button onClick={() => submitFeedback(true)} className="flex-1 py-5 bg-black text-white font-black rounded-full hover:scale-105 transition-all shadow-lg shadow-black/20">YES</button>
                <button onClick={() => submitFeedback(false)} className="flex-1 py-5 bg-gray-100 text-black font-black rounded-full hover:scale-105 transition-all">NO</button>
              </div>
            </div>
          </div>
        )}

        <footer className="h-28 bg-black/80 border-t border-white/5 px-10 flex items-center justify-between z-40 backdrop-blur-xl">
           <div className="w-1/4 flex items-center gap-4">
              {selectedSong && (
                <div className="flex items-center gap-4 animate-fade-in">
                  <div className="w-16 h-16 bg-gray-900 rounded-2xl overflow-hidden shadow-2xl"><img src={selectedSong.coverUrl} className="w-full h-full object-cover" /></div>
                  <div className="min-w-0">
                    <p className="font-black text-white truncate text-sm">{selectedSong.title}</p>
                    <p className="text-[10px] text-gray-500 font-bold uppercase truncate">{selectedSong.artist}</p>
                  </div>
                </div>
              )}
           </div>
           <div className="w-1/2 flex flex-col items-center gap-2">
              <div className="flex items-center gap-10 text-gray-500">
                 <i onClick={handlePreviousSong} className="fas fa-step-backward cursor-pointer hover:text-white transition-colors text-lg"></i>
                 <div onClick={() => setIsPlaying(!isPlaying)} className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-black cursor-pointer hover:scale-110 transition-all shadow-xl">
                    <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} text-xl`}></i>
                 </div>
                 <i onClick={handleNextSong} className="fas fa-step-forward cursor-pointer hover:text-white transition-colors text-lg"></i>
              </div>
              <div className="w-full flex items-center gap-4">
                 <span className="text-[9px] font-black text-gray-500 tabular-nums">{formatTime(currentTime)}</span>
                 <div ref={progressRef} onClick={handleProgressClick} className="flex-1 h-1 bg-white/10 rounded-full cursor-pointer relative overflow-hidden group">
                   <div className="absolute inset-y-0 left-0 bg-white group-hover:bg-[#1DB954] transition-colors" style={{ width: `${(currentTime / (duration || 1)) * 100}%` }}></div>
                 </div>
                 <span className="text-[9px] font-black text-gray-500 tabular-nums">{formatTime(duration)}</span>
              </div>
           </div>
           <div className="w-1/4 flex justify-end gap-6 items-center">
              <button onClick={() => setIsQueueOpen(!isQueueOpen)} className={`text-sm transition-colors ${isQueueOpen ? 'text-[#1DB954]' : 'text-gray-500 hover:text-white'}`}><i className="fas fa-layer-group"></i></button>
              <button onClick={cyclePlaybackSpeed} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-black text-gray-500 hover:text-white hover:border-white/20 transition-all">{playbackSpeed}x</button>
              <div className="flex items-center gap-2">
                <i className="fas fa-volume-up text-gray-600 text-xs"></i>
                <div className="w-20 h-1 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-gray-600" style={{ width: '80%' }}></div></div>
              </div>
           </div>
        </footer>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        @keyframes slideUp { from { transform: translate(-50%, 150%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        .animate-slide-up { animation: slideUp 0.6s cubic-bezier(0.19, 1, 0.22, 1) forwards; }
      `}</style>
    </div>
  );
};

export default App;
