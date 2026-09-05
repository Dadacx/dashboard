import React, { useState, useEffect, useRef } from 'react';
import NoSleep from 'nosleep.js';
import './App.css';
import { PopupManager, showPopup } from './components/Popup/Popup';

import playIcon from './icons/play.svg';
import pauseIcon from './icons/pause.svg';
import nextIcon from './icons/next.svg';
import prevIcon from './icons/prev.svg';
import addIcon from './icons/add.svg';

const SERVER_URL = !window.location.origin.includes('localhost') ? window.location.origin : window.prompt('Podaj adres serwera:', 'http://192.168.100.4:3100');

function App() {
    const [stats, setStats] = useState({ cpuLoad: 0, memUsed: 0, gpuLoad: [] });
    const [spotify, setSpotify] = useState({ isPlaying: false, title: 'Czekam na dane...' });
    const [isAwake, setIsAwake] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(3);
    const [ping, setPing] = useState(0);
    const noSleepRef = useRef(null);
    const appStartTime = useRef(Date.now())
    const lastWarningTime = useRef(0);
    const pingAlert = 5000
    // const REFRESH_INTERVAL = 3; // Czas odświeżania w sekundach

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
            const startTime = Date.now();

            // Puszczamy oba żądania do serwera w tym samym momencie
            const [statsRes, spotifyRes] = await Promise.all([
                fetch(`${SERVER_URL}/api/stats`),
                fetch(`${SERVER_URL}/api/spotify/current`)
            ]);

            // Równolegle parsujemy odpowiedzi JSON
            const [newStats, newSpotify] = await Promise.all([
                statsRes.json(),
                spotifyRes.json()
            ]);

            setStats(newStats);
            setSpotify(newSpotify);

            const currentPing = Date.now() - startTime;
            setPing(currentPing);

            if (currentPing > pingAlert /*refreshInterval * 1000*/) {
                const now = Date.now();
                const timeSinceStart = now - appStartTime.current;
                const timeSinceLastWarning = now - lastWarningTime.current;

                if (timeSinceStart > 10000 && timeSinceLastWarning > 15000) {
                    showPopup({
                        message: `Serwer jest obciążony (ping: ${currentPing} ms). Zalecane jest zwiększenie częstotliwości odświeżania.`,
                        type: 'warning',
                        duration: 10000,
                        icon: true
                    });
                    lastWarningTime.current = now;
                }
            }
        } catch (error) {
            console.error('Brak połączenia z serwerem');
        }
    };

    // useEffect(() => {
    //     fetchData();
    //     const interval = setInterval(fetchData, 3000);
    //     return () => clearInterval(interval);
    // }, []);

    useEffect(() => {
        let timeoutId;
        let isActive = true;

        const fetchDataLoop = async () => {
            await fetchData();
            if (!isActive) return;

            timeoutId = setTimeout(fetchDataLoop, refreshInterval * 1000);
        };

        fetchDataLoop();

        return () => {
            isActive = false;
            clearTimeout(timeoutId);
        };
    }, [refreshInterval]);

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
            <div style={{ position: 'absolute', top: '10px', textAlign: 'center' }} title='CCO (Całkowity czas odświeżania)'>Ping: {ping} ms<br /> CCO: {(refreshInterval + ping / 1000).toFixed(3)}s</div>
            <button style={{ position: 'absolute', top: '10px', right: '10px' }} onClick={() => {
                const newInterval = prompt('Podaj nową częstotliwość odświeżania (w sekundach):');
                if (newInterval && !isNaN(newInterval)) {
                    setRefreshInterval(parseInt(newInterval));
                }
            }}>
                Czestotliwość odświeżania: {refreshInterval}s
            </button>
            <button className="screen-lock-btn" onClick={toggleScreenLock} style={{ position: 'absolute', top: '10px', left: '10px' }}>
                {isAwake ? 'Wyłącz blokadę ekranu' : 'Włącz blokadę ekranu'}
            </button>

            <div className="card stats-card">
                <h2>Osiągi PC</h2>
                <div className="stat">CPU: <span>{stats.cpuLoad}%</span></div>
                <div className="stat">RAM: <span>{stats.memUsed}%</span></div>
                {stats.gpuLoad && stats.gpuLoad.map(gpu => (
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