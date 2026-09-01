require('dotenv').config();
const express = require('express');
const cors = require('cors');
const si = require('systeminformation');
const SpotifyWebApi = require('spotify-web-api-node');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
const PORT = 3100 //zmienić też w api spotify
const TOKEN_PATH = './token.json';

// Konfiguracja Spotify API
const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    // Podmień localhost na IP swojego komputera w sieci lokalnej, jeśli logujesz się z innego urządzenia
    redirectUri: `http://127.0.0.1:${PORT}/callback`
});

if (fs.existsSync(TOKEN_PATH)) {
    const tokenData = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    spotifyApi.setRefreshToken(tokenData.refresh_token);

    spotifyApi.refreshAccessToken().then(data => {
        spotifyApi.setAccessToken(data.body['access_token']);
        console.log('Automatycznie przywrócono sesję Spotify z pliku!');
    }).catch(err => {
        console.error('Nie udało się odświeżyć zapisanego tokenu:', err);
    });
}

async function addToPlaylists(playlistIds, tracksUri) {
    var responses = [];
    for (const playlistId of playlistIds) {
        try {
            console.log(`Dodawanie utworu do playlisty o ID: ${playlistId}`);
            const addTrackResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/items`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${spotifyApi.getAccessToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ uris: tracksUri })
            })
            const response_json = await addTrackResponse.json();
            responses.push({ playlistId, snapshot_id: response_json.snapshot_id });
            if (!addTrackResponse.ok) {
                console.error("Błąd API Spotify:", response_json);
                return { success: false, error: response_json.error };
            }
        } catch (error) {
            console.error("Nieoczekiwany błąd:", error);
            return { success: false, error: error.message };
        }
    }
    return { success: true, details: responses };
}

app.get('/login', (req, res) => {
    const scopes = [
        'user-read-playback-state',
        'user-modify-playback-state',
        'playlist-read-private',      // Czytanie Twoich playlist
        'playlist-modify-public',     // Modyfikowanie publicznych
        'playlist-modify-private'     // Modyfikowanie prywatnych
    ];
    res.redirect(spotifyApi.createAuthorizeURL(scopes));
});

app.get('/callback', (req, res) => {
    const code = req.query.code;
    spotifyApi.authorizationCodeGrant(code).then(data => {
        const accessToken = data.body['access_token'];
        const refreshToken = data.body['refresh_token'];

        spotifyApi.setAccessToken(accessToken);
        spotifyApi.setRefreshToken(refreshToken);

        fs.writeFileSync(TOKEN_PATH, JSON.stringify({ refresh_token: refreshToken }));

        res.send('Autoryzacja udana! Token zapisany na stałe. Możesz zamknąć tę kartę.');
    }).catch(err => res.send(`Błąd: ${err}`));
});

app.get('/api/stats', async (req, res) => {
    try {
        const cpu = await si.currentLoad();
        const mem = await si.mem();
        const gpu = await si.graphics();
        res.json({
            cpuLoad: Math.round(cpu.currentLoad),
            memUsed: Math.round((mem.active / mem.total) * 100),
            gpuLoad: gpu.controllers.map(controller => ({
                model: controller.model,
                load: controller.utilizationGpu
            }))
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/spotify/current', async (req, res) => {
    try {
        const data = await spotifyApi.getMyCurrentPlaybackState();
        if (data.body && data.body.is_playing) {
            res.json({
                isPlaying: data.body.is_playing,
                title: data.body.item.name,
                artist: data.body.item.artists.map(a => a.name).join(', '),
                image: data.body.item.album.images[0].url
            });
        } else {
            res.json({ isPlaying: false, title: 'Brak odtwarzania' });
        }
    } catch (e) {
        if (e.statusCode === 401) return res.json({
            error: {
                status: 401,
                message: `Token wygasł. Zaloguj się ponownie`
            }
        });
        res.status(500).json({ error: e });
    }
});

app.post('/api/spotify/add_current_to_playlists/:playlists_ids', async (req, res) => {
    const playlists_ids = req.params.playlists_ids.split(',');
    try {
        const current_playing = await spotifyApi.getMyCurrentPlaybackState();
        // const playlists = await spotifyApi.getUserPlaylists();
        // const matchingPlaylists = playlists.body.items.filter(playlist => playlist.name === playlist_name)
        if (playlists_ids.length > 0) {
            const addToPlaylistResponse = await addToPlaylists(playlists_ids, [current_playing.body.item.uri]);

            res.json(addToPlaylistResponse);

        } else {
            res.status(404).json({ error: "Brak playlisty o podanym ID" });
        }
    } catch (e) {
        res.status(500).json({ error: e });
    }
})

app.post('/api/spotify/:action', async (req, res) => {
    const action = req.params.action;
    try {
        const data = await spotifyApi.getMyCurrentPlaybackState();
        if (action === 'play') await spotifyApi.play();
        if (action === 'pause') await spotifyApi.pause();
        if (action === 'next') await spotifyApi.skipToNext();
        if (action === 'prev') {
            if (data.body && data.body.progress_ms > 10000) {
                spotifyApi.seek(0);
                return res.sendStatus(200);
            } else {
                await spotifyApi.skipToPrevious();
            }
        }
        res.sendStatus(200);
    } catch (e) {
        if (e.statusCode === 404) {
            try {
                console.log("Urządzenie uśpione. Próbuję wybudzić...");
                
                const devicesData = await spotifyApi.getMyDevices();
                const devices = devicesData.body.devices;

                if (devices.length > 0) {
                    const targetDeviceId = devices[0].id;
                    
                    // Wysyłamy komendę Play z wymuszeniem konkretnego ID
                    await spotifyApi.play({ device_id: targetDeviceId });
                    
                    console.log("Urządzenie wybudzone i odtwarzanie wznowione.");
                    return res.status(200).json({ message: "Wybudzono urządzenie i wznowiono odtwarzanie" });
                } else {
                    return res.status(404).json({ error: "Brak włączonych urządzeń ze Spotify. Otwórz aplikację na komputerze." });
                }
            } catch (fallbackError) {
                console.error("Błąd wybudzania:", fallbackError);
                return res.status(500).json({ error: "Nie udało się wybudzić urządzenia." });
            }
        }
        
        // Obsługa innych błędów
        console.error("Inny błąd odtwarzania:", e);
        res.status(500).json({ error: "Wystąpił problem z odtwarzaniem." });
    }
});

app.use('/app', express.static(path.join(__dirname, 'app')));
// 2. Przekierowanie wszystkich zapytań z /app/cokolwiek do index.html (zapobiega błędom 404)
app.use('/app', (req, res) => {
    res.sendFile(path.join(__dirname, 'app', 'index.html'));
});

setInterval(async () => {
    try {
        if (spotifyApi.getRefreshToken()) {
            const data = await spotifyApi.refreshAccessToken();
            spotifyApi.setAccessToken(data.body['access_token']);
            console.log('Token odświeżony automatycznie w tle.');
        }
    } catch (e) {
        console.error('Błąd cyklicznego odświeżania tokenu:', e.message);
    }
}, 45 * 60 * 1000);

app.listen(PORT, () => {
    console.log(`Serwer działa na porcie ${PORT}. Zaloguj się: http://localhost:${PORT}/login`);
});