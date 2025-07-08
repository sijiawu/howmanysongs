import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// TODO: Replace with your actual Supabase project URL and anon key
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getSpotifyEmbedUrl(spotifyId) {
  return `https://open.spotify.com/embed/track/${spotifyId}`;
}

function getNextSong(currentSong, userGenres, responses, allSongs) {
  // 1. Build a set of already answered song IDs
  const answeredIds = new Set(responses.map(r => r.song.spotify_id));

  // 2. Build a count of (genre, tier) pairs already tested
  const tested = {};
  responses.forEach(r => {
    (r.song.genres || []).forEach(g => {
      const key = `${g}|${r.song.tier}`;
      tested[key] = (tested[key] || 0) + 1;
    });
  });

  // 3. Filter out already answered songs
  const remaining = allSongs.filter(song => !answeredIds.has(song.spotify_id));

  // 4. Helper to avoid over-testing same (genre, tier) 
  // - a song is considered “over-tested” if, for any of its genres, we've already asked the user about 3 or more songs in that same genre and tier combination.
  function notOverTested(song) {
    return (song.genres || []).every(g => (tested[`${g}|${song.tier}`] || 0) < 3);
  }

  // 5. Get last response
  const lastResponse = responses[responses.length - 1];
  if (!lastResponse) return remaining[0] || null; // fallback: first unasked

  const lastSong = lastResponse.song;
  const lastGenres = lastSong.genres || [];
  const lastTier = lastSong.tier;
  const saidYes = lastResponse.known;

  // 6. YES logic
  if (saidYes) {
    // a. Same tier, outside user's known genres
    let candidates = remaining.filter(song =>
      song.tier === lastTier &&
      !song.genres.some(g => userGenres.includes(g)) &&
      notOverTested(song)
    );
    if (candidates.length > 0) return candidates[0];

    // b. Same genre, one tier lower (deeper cut)
    candidates = remaining.filter(song =>
      song.tier === lastTier - 1 &&
      song.genres.some(g => lastGenres.includes(g)) &&
      notOverTested(song)
    );
    if (candidates.length > 0) return candidates[0];
  } else {
    // 7. NO logic
    // a. Same genre, one tier higher (easier)
    let candidates = remaining.filter(song =>
      song.tier === lastTier + 1 &&
      song.genres.some(g => lastGenres.includes(g)) &&
      notOverTested(song)
    );
    if (candidates.length > 0) return candidates[0];

    // b. New genre, mid-level tier (explore new domains)
    candidates = remaining.filter(song =>
      song.tier === 3 &&
      !song.genres.some(g => responses.some(r => (r.song.genres || []).includes(g))) &&
      notOverTested(song)
    );
    if (candidates.length > 0) return candidates[0];
  }

  // 8. Fallback: any not-over-tested song
  const fallback = remaining.find(notOverTested);
  if (fallback) return fallback;

  // 9. Last resort: any remaining song
  return remaining[0] || null;
}

function App() {
  const [songs, setSongs] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [responses, setResponses] = useState([]); // {song, known: true/false}
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);
  const [estimation, setEstimation] = useState(null);
  const [autoplayKey, setAutoplayKey] = useState(0);
  // New: onboarding state
  const [onboarding, setOnboarding] = useState(true);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [sessionId] = useState(() => {
    // Generate a simple session id (could use uuid in production)
    return 'sess_' + Math.random().toString(36).slice(2, 10) + Date.now();
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  // Example genre/language options (customize as needed)
  const GENRE_OPTIONS = [
    'pop', 'rock', 'hip hop', 'jazz', 'classical', 'indie', 'metal', 'lo-fi', 'r&b', 'electronic', 'folk', 'country', 'latin', 'kpop', 'jpop', 'afrobeat', 'ambient', 'other'
  ];
  const LANGUAGE_OPTIONS = [
    'English', 'Spanish', 'French', 'Japanese', 'Korean', 'Portuguese', 'Arabic', 'Other'
  ];

  // Fetch a batch of songs from Supabase, filtered by genre/language
  useEffect(() => {
    if (onboarding) return;
    async function fetchSongs() {
      setLoading(true);
      let query = supabase
        .from('songs')
        .select('*')
        .order('tier', { ascending: true })
        .limit(1000);
      // Filter by genre
      if (selectedGenres.length > 0) {
        // Supabase Postgres: genres is an array, so use 'overlaps' filter
        query = query.overlaps('genres', selectedGenres);
      }
      // Filter by language/region (basic: region field)
      if (selectedLanguages.length > 0 && selectedLanguages[0] !== 'English') {
        // Map language to region code if possible
        const langToRegion = {
          'Japanese': 'JP',
          'Korean': 'KR',
          'Portuguese': 'BR',
          'French': 'FR',
          'Arabic': 'AF',
          'Spanish': 'ES',
        };
        const regions = selectedLanguages.map(l => langToRegion[l]).filter(Boolean);
        if (regions.length > 0) {
          query = query.in('region', regions);
        }
      }
      let { data, error } = await query;
      if (error) {
        alert('Error fetching songs: ' + error.message);
        setLoading(false);
        return;
      }
      data = data.sort(() => 0.5 - Math.random()).slice(0, 30);
      setSongs(data);
      setLoading(false);
    }
    fetchSongs();
    // eslint-disable-next-line
  }, [onboarding]);

  function handleResponse(known) {
    setResponses([...responses, { song: songs[currentIdx], known }]);
    if (currentIdx + 1 < songs.length && responses.length + 1 < 30) {
      setCurrentIdx(currentIdx + 1);
      setAutoplayKey(autoplayKey + 1); // force iframe reload for autoplay
    } else {
      setFinished(true);
      estimateKnownSongs([...responses, { song: songs[currentIdx], known }]);
    }
  }

  // Update estimation logic to use 'known' instead of 'correct'
  function estimateKnownSongs(responsesArr) {
    // Group by tier
    const tierCounts = {};
    const tierHits = {};
    responsesArr.forEach(({ song, known }) => {
      const tier = song.tier || 5;
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
      if (known) tierHits[tier] = (tierHits[tier] || 0) + 1;
    });
    // Assume total songs per tier (example numbers, adjust as needed)
    const totalPerTier = { 1: 500, 2: 1500, 3: 3000, 4: 4000, 5: 6000 };
    let est = 0;
    Object.keys(tierCounts).forEach(tier => {
      const hitRate = (tierHits[tier] || 0) / tierCounts[tier];
      est += hitRate * (totalPerTier[tier] || 0);
    });
    setEstimation(Math.round(est));
  }

  useEffect(() => {
    if (!finished || submitted) return;
    async function submitResponses() {
      setSubmitting(true);
      const rows = responses.map(r => ({
        session_id: sessionId,
        song_id: r.song.spotify_id,
        known: r.known,
        created_at: new Date().toISOString(),
      }));
      // Insert all at once
      if (rows.length > 0) {
        const { error } = await supabase.from('responses').insert(rows);
        if (error) {
          alert('Error saving your results: ' + error.message);
        }
      }
      setSubmitting(false);
      setSubmitted(true);
    }
    submitResponses();
    // eslint-disable-next-line
  }, [finished, submitted, responses, sessionId]);

  if (onboarding) {
    return (
      <div style={{maxWidth:420,margin:'40px auto',padding:24,boxShadow:'0 2px 8px #ccc',borderRadius:12}}>
        <h2>How Many Songs Do You Know?</h2>
        <p>To get started, pick the genre(s) and language(s) of music you listen to most often.</p>
        <div style={{margin:'24px 0'}}>
          <b>Genres:</b>
          <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:8}}>
            {GENRE_OPTIONS.map(g => (
              <button
                key={g}
                onClick={() => setSelectedGenres(selectedGenres.includes(g) ? selectedGenres.filter(x => x !== g) : [...selectedGenres, g])}
                style={{
                  background: selectedGenres.includes(g) ? '#1976d2' : '#eee',
                  color: selectedGenres.includes(g) ? '#fff' : '#333',
                  border:'none',borderRadius:6,padding:'6px 14px',cursor:'pointer',fontSize:15
                }}
              >{g}</button>
            ))}
          </div>
        </div>
        <div style={{margin:'24px 0'}}>
          <b>Languages:</b>
          <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:8}}>
            {LANGUAGE_OPTIONS.map(l => (
              <button
                key={l}
                onClick={() => setSelectedLanguages(selectedLanguages.includes(l) ? selectedLanguages.filter(x => x !== l) : [...selectedLanguages, l])}
                style={{
                  background: selectedLanguages.includes(l) ? '#1976d2' : '#eee',
                  color: selectedLanguages.includes(l) ? '#fff' : '#333',
                  border:'none',borderRadius:6,padding:'6px 14px',cursor:'pointer',fontSize:15
                }}
              >{l}</button>
            ))}
          </div>
        </div>
        <button
          disabled={selectedGenres.length === 0 && selectedLanguages.length === 0}
          onClick={() => setOnboarding(false)}
          style={{marginTop:24,padding:'10px 32px',fontSize:18,background:'#4caf50',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',opacity:(selectedGenres.length === 0 && selectedLanguages.length === 0)?0.5:1}}
        >Start Quiz</button>
      </div>
    );
  }
  if (loading) return <div style={{textAlign:'center',marginTop:40}}>Loading songs...</div>;
  if (finished) {
    const numKnown = responses.filter(r => r.known).length;
    const total = responses.length;
    return (
      <div style={{textAlign:'center',marginTop:40}}>
        <h2>Quiz Complete!</h2>
        <p>🎧 You knew <b>{numKnown}</b> out of <b>{total}</b> songs!</p>
        <p>We estimate you know around <b>{estimation?.toLocaleString()}</b> songs.</p>
        {submitting && <p>Saving your results...</p>}
        {submitted && <p style={{color:'#4caf50'}}>Results saved!</p>}
        <h3 style={{marginTop:32}}>Your Answers</h3>
        <div style={{maxWidth:600,margin:'24px auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:15}}>
            <thead>
              <tr style={{background:'#eee'}}>
                <th style={{padding:6,border:'1px solid #ccc'}}>Title</th>
                <th style={{padding:6,border:'1px solid #ccc'}}>Artist</th>
                <th style={{padding:6,border:'1px solid #ccc'}}>Known?</th>
                <th style={{padding:6,border:'1px solid #ccc'}}>Popularity</th>
                <th style={{padding:6,border:'1px solid #ccc'}}>Genres</th>
              </tr>
            </thead>
            <tbody>
              {responses.map((r, i) => (
                <tr key={i} style={{background: r.known ? '#e8f5e9' : '#ffebee'}}>
                  <td style={{padding:6,border:'1px solid #ccc'}}>{r.song.title}</td>
                  <td style={{padding:6,border:'1px solid #ccc'}}>{r.song.artist}</td>
                  <td style={{padding:6,border:'1px solid #ccc'}}>{r.known ? 'Yes' : 'No'}</td>
                  <td style={{padding:6,border:'1px solid #ccc'}}>{r.song.popularity}</td>
                  <td style={{padding:6,border:'1px solid #ccc'}}>{Array.isArray(r.song.genres) ? r.song.genres.join(', ') : r.song.genres}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{marginTop:32,maxWidth:500,marginLeft:'auto',marginRight:'auto',textAlign:'left'}}>
          <h3>Feedback</h3>
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            rows={4}
            style={{width:'100%',fontSize:16,padding:8,borderRadius:6,border:'1px solid #ccc'}}
            placeholder="What did you think of this quiz? Any suggestions?"
            disabled={feedbackSubmitted}
          />
          <button
            style={{marginTop:12,padding:'8px 24px',fontSize:16,background:'#1976d2',color:'#fff',border:'none',borderRadius:6,cursor:'pointer',opacity:feedbackSubmitted?0.5:1}}
            disabled={feedbackSubmitted || !feedback.trim()}
            onClick={async () => {
              const { error } = await supabase.from('session_feedback').insert([
                { session_id: sessionId, feedback, created_at: new Date().toISOString() }
              ]);
              if (!error) setFeedbackSubmitted(true);
              else alert('Error saving feedback: ' + error.message);
            }}
          >Submit Feedback</button>
          {feedbackSubmitted && <span style={{marginLeft:16,color:'#4caf50'}}>Thank you for your feedback!</span>}
        </div>
        <button
          style={{marginTop:32,padding:'10px 32px',fontSize:18,background:'#1976d2',color:'#fff',border:'none',borderRadius:8,cursor:'pointer'}}
          onClick={() => {
            setOnboarding(true);
            setResponses([]);
            setFinished(false);
            setEstimation(null);
            setCurrentIdx(0);
            setSubmitted(false);
            setFeedback('');
            setFeedbackSubmitted(false);
          }}
        >Start Over</button>
      </div>
    );
  }
  if (!songs.length) return <div style={{textAlign:'center',marginTop:40}}>No songs found.</div>;

  const song = songs[currentIdx];

  return (
    <div style={{maxWidth:400,margin:'40px auto',padding:24,boxShadow:'0 2px 8px #ccc',borderRadius:12}}>
      <h3>Do you know this song?</h3>
      <div style={{margin:'16px 0'}}>
        <b>{song.title}</b><br/>
        <span style={{color:'#666'}}>{song.artist}</span>
        <div style={{fontSize:13,marginTop:4,color:'#888'}}>
          <b>Popularity:</b> {song.popularity} <br/>
          <b>Genres:</b> {Array.isArray(song.genres) ? song.genres.join(', ') : song.genres}
        </div>
      </div>
      <div style={{position:'relative',width:'100%',height:80,marginBottom:16}}>
        {/* Note: Spotify embed does not support autoplay reliably due to browser and Spotify restrictions. */}
        <iframe
          key={autoplayKey}
          title="Spotify Player"
          src={getSpotifyEmbedUrl(song.spotify_id)}
          width="100%"
          height="80"
          frameBorder="0"
          allowtransparency="true"
          allow="encrypted-media"
          style={{borderRadius:8,position:'absolute',top:0,left:0,width:'100%',height:'100%'}}
        />
      </div>
      <div style={{display:'flex',justifyContent:'center',gap:16,marginTop:16}}>
        <button onClick={()=>handleResponse(true)} style={{fontSize:18,padding:'8px 24px',background:'#4caf50',color:'#fff',border:'none',borderRadius:6}}>Yes 😀</button>
        <button onClick={()=>handleResponse(false)} style={{fontSize:18,padding:'8px 24px',background:'#f44336',color:'#fff',border:'none',borderRadius:6}}>No 🙂‍↔️</button>
      </div>
      <div style={{marginTop:24,color:'#888'}}>Song {currentIdx+1} of {songs.length}</div>
    </div>
  );
}

export default App;
