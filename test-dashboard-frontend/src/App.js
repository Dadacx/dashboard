import React, { useState, useEffect, useRef } from 'react';
import NoSleep from 'nosleep.js';
import './App.css';
import { PopupManager, showPopup } from './components/Popup/Popup';

import playIcon from './icons/play.svg';
import pauseIcon from './icons/pause.svg';
import nextIcon from './icons/next.svg';
import prevIcon from './icons/prev.svg';
import addIcon from './icons/add.svg';

// WAŻNE: Zmień adres na lokalne IP swojego komputera (np. 192.168.0.15)
const SERVER_URL = window.location.origin || window.prompt('Podaj adres serwera:', 'http://192.168.100.4:3100');

function App() {
    const [stats, setStats] = useState({ cpuLoad: 0, memUsed: 0, gpuLoad: [] });
    const [spotify, setSpotify] = useState({ isPlaying: false, title: 'Czekam na dane...' });
    const [isAwake, setIsAwake] = useState(false);
    const noSleepRef = useRef(null);

    useEffect(() => {
        // Inicjalizacja instancji
        noSleepRef.current = new NoSleep();

        return () => {
            // Sprzątanie po zamknięciu komponentu
            if (noSleepRef.current) {
                noSleepRef.current.disable();
            }
        };
    }, []);

    const toggleScreenLock = () => {
        if (!isAwake) {
            noSleepRef.current.enable(); // Musi być wywołane bezpośrednio przez kliknięcie (onClick)
            setIsAwake(true);            // można wymusić automatycznie kliknięcie przez .click
        } else {
            noSleepRef.current.disable();
            setIsAwake(false);
        }
    };

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
            showPopup({ message: `Błąd podczas dodawania do playlisty: ${response_json.error.message}`, type: 'error' });
        } else {
            showPopup({ message: `Dodano do playlist`, type: 'success' });
        }
        setTimeout(fetchData, 500);
    };

    return (
        <div className="dashboard">
            <PopupManager />
            <div style={{ position: 'absolute', top: '10px' }}>{new Date().toLocaleTimeString()}</div>
            <button className="screen-lock-btn" onClick={toggleScreenLock} style={{position: 'absolute', top: '10px', left:'10px'}}>
                {isAwake ? 'Wyłącz blokadę ekranu' : 'Włącz blokadę ekranu'}
            </button>

            <div className="card stats-card">
                <h2>Osiągi PC</h2>
                <div className="stat">CPU: <span>{stats.cpuLoad}%</span></div>
                <div className="stat">RAM: <span>{stats.memUsed}%</span></div>
                {stats.gpuLoad.map(gpu => (
                    <div key={gpu.model} className="stat">GPU ({gpu.model}): <span>{gpu.load || 'N/A'}%</span></div>
                ))}
            </div>

            <div className="card spotify-card">
                <h2>Spotify</h2>
                {spotify.error && <p className="error">{spotify.error.message}</p>}
                {spotify.image && <img src={spotify.image} alt="Album Art" className="album-art" />}
                <p className="title">{spotify.title}</p>
                <p className="artist">{spotify.artist}</p>

                <div className="controls">
                    <button onClick={() => controlSpotify('prev')}><img src={prevIcon} alt="Previous" /></button>
                    {spotify.isPlaying ? (
                        <button onClick={() => controlSpotify('pause')}><img src={pauseIcon} alt="Pause" /></button>
                    ) : (
                        <button onClick={() => controlSpotify('play')}><img src={playIcon} alt="Play" /></button>
                    )}
                    <button onClick={() => controlSpotify('next')}><img src={nextIcon} alt="Next" /></button>
                    <button onClick={() => addCurrentToPlaylists(['4491ZqvuOYi5mqBYYQSxeQ', '3mGZ9zXEikg3kG0tORZcFo'])}><img src={addIcon} alt="Add to Playlists" /></button>
                </div>
            </div>
        </div>
    );
}

export default App;