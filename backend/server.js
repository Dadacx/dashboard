require('dotenv').config();
const express = require('express');
const cors = require('cors');
const si = require('systeminformation');
const SpotifyWebApi = require('spotify-web-api-node');
const path = require('path');
const fs = require('fs');
const colors = require('colors');
colors.enable()
const log = require('./log');
log.debugEnabled = true;

const app = express();
app.use(cors());

const PORT = 3100 //zmienić też w api spotify
const TOKEN_PATH = './token.json';
const cachedStatsUpdateInterval = 1000;
let cachedStats = { cpuLoad: 0, memUsed: 0, gpuLoad: [] };

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
        log.info('Automatycznie przywrócono sesję Spotify z pliku!');
    }).catch(err => {
        log.error('Nie udało się odświeżyć zapisanego tokenu:', err);
    });
} else {
    log.info(`Brak zapisanego tokenu. Zaloguj się: http://localhost:${PORT}/login`);
}

async function updateStatsInBackground() {
    try {
        const [cpu, mem, gpu] = await Promise.all([
            si.currentLoad(),
            si.mem(),
            si.graphics()
        ]);
        
        cachedStats = {
            cpuLoad: Math.round(cpu.currentLoad),
            memUsed: Math.round((mem.active / mem.total) * 100),
            gpuLoad: gpu.controllers.map(controller => ({
                model: controller.model,
                load: controller.utilizationGpu
            }))
        };
    } catch (e) {
        log.error("Błąd aktualizacji statystyk w tle:", e.message);
    }
    
    setTimeout(updateStatsInBackground, cachedStatsUpdateInterval);
}

updateStatsInBackground();

async function addToPlaylists(playlistIds, tracksUri) {
    var responses = [];
    for (const playlistId of playlistIds) {
        try {
            log.debug(`Dodawanie utworu do playlisty o ID: ${playlistId}`);
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
                log.error("Błąd API Spotify:", response_json);
                return { success: false, error: response_json.error };
            }
        } catch (error) {
            log.error("Nieoczekiwany błąd:", error);
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
    res.json(cachedStats);
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
                log.debug("Urządzenie uśpione. Próbuję wybudzić...");
                
                const devicesData = await spotifyApi.getMyDevices();
                const devices = devicesData.body.devices;

                if (devices.length > 0) {
                    const targetDeviceId = devices[0].id;
                    
                    // Wysyłamy komendę Play z wymuszeniem konkretnego ID
                    await spotifyApi.play({ device_id: targetDeviceId });
                    
                    log.debug("Urządzenie wybudzone i odtwarzanie wznowione.");
                    return res.status(200).json({ message: "Wybudzono urządzenie i wznowiono odtwarzanie" });
                } else {
                    return res.status(404).json({ error: "Brak włączonych urządzeń ze Spotify. Otwórz aplikację na komputerze." });
                }
            } catch (fallbackError) {
                log.error("Błąd wybudzania:", fallbackError);
                return res.status(500).json({ error: "Nie udało się wybudzić urządzenia." });
            }
        }
        
        // Obsługa innych błędów
        log.error("Inny błąd odtwarzania:", e);
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
            log.debug('Token odświeżony automatycznie w tle.');
        }
    } catch (e) {
        log.error('Błąd cyklicznego odświeżania tokenu:', e.message);
    }
}, 45 * 60 * 1000);

app.listen(PORT, async () => {
    try {
        const netInterfaces = await si.networkInterfaces();
        // Szukamy fizycznej karty sieciowej (nie wirtualnej) z adresem IPv4, ignorując localhost
        const mainIface = netInterfaces.find(
            iface => iface.ip4 && iface.ip4 !== '127.0.0.1' && !iface.virtual && !iface.internal
        );
        const ip = mainIface ? mainIface.ip4 : 'localhost';
        
        log(`Serwer działa! Otwórz dashboard: http://${ip}:${PORT}/app`.green.bold);
    } catch (e) {
        // console.error("Nie udało się pobrać IP:", e);
        log.error(`Nie udało się pobrać IP komputera. Sprawdź je ręcznie. Serwer działa na porcie ${PORT}.`);
    }
});