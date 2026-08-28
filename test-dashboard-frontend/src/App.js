import React, { useState, useEffect } from 'react';
import './App.css'; 
import { PopupManager, showPopup } from './components/Popup/Popup';

// WAŻNE: Zmień adres na lokalne IP swojego komputera (np. 192.168.0.15)
const SERVER_URL =  window.prompt('Podaj adres serwera:','http://192.168.100.4:3100'); 

function App() {
    const [stats, setStats] = useState({ cpuLoad: 0, memUsed: 0 });
    const [spotify, setSpotify] = useState({ isPlaying: false, title: 'Czekam na dane...' });

    const fetchData = async () => {
        try {
            const statsRes = await fetch(`${SERVER_URL}/api/stats`);
            setStats(await statsRes.json());

            const spotifyRes = await fetch(`${SERVER_URL}/api/spotify/current`);
            setSpotify(await spotifyRes.json());
        } catch (error) {
            console.error('Brak połączenia z serwerem');
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 3000); 
        return () => clearInterval(interval);
    }, []);

    const controlSpotify = async (action) => {
        await fetch(`${SERVER_URL}/api/spotify/${action}`, { method: 'POST' });
        setTimeout(fetchData, 500); 
    };

    const addCurrentToPlaylists = async (playlistIds) => {
        const response = await fetch(`${SERVER_URL}/api/spotify/add_current_to_playlists/${playlistIds.join(',')}`, { method: 'POST' });
        const response_json = await response.json();
        if (!response_json.success) {
            showPopup({message: `Błąd podczas dodawania do playlisty: ${response_json.error.message}`, type: 'error'});
        } else {
            showPopup({message: `Dodano do playlist`, type: 'success'});
        }
        setTimeout(fetchData, 500);
    };

    return (
        <div className="dashboard">
            <PopupManager />
            <div style={{position: 'absolute', top: '10px'}}>{new Date().toLocaleTimeString()}</div>
            <div className="card stats-card">
                <h2>Osiągi PC</h2>
                <div className="stat">CPU: <span>{stats.cpuLoad}%</span></div>
                <div className="stat">RAM: <span>{stats.memUsed}%</span></div>
            </div>

            <div className="card spotify-card">
                <h2>Spotify</h2>
                {spotify.error && <p className="error">{spotify.error.message}</p>}
                {spotify.image && <img src={spotify.image} alt="Album Art" className="album-art" />}
                <p className="title">{spotify.title}</p>
                <p className="artist">{spotify.artist}</p>
                
                <div className="controls">
                    <button onClick={() => controlSpotify('prev')}>⏮</button>
                    {spotify.isPlaying ? (
                        <button onClick={() => controlSpotify('pause')}>⏸</button>
                    ) : (
                        <button onClick={() => controlSpotify('play')}>▶️</button>
                    )}
                    <button onClick={() => controlSpotify('next')}>⏭</button>
                    <button onClick={() => addCurrentToPlaylists(['4491ZqvuOYi5mqBYYQSxeQ','3mGZ9zXEikg3kG0tORZcFo'])}>+</button>
                </div>
            </div>
        </div>
    );
}

export default App;