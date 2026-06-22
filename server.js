const { WebcastPushConnection } = require('tiktok-live-connector');
const WebSocket = require('ws');

// Gunakan Port dinamis bawaan Railway
const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

console.log(`🚀 Melodify TikTok Bridge Cloud berjalan di port ${PORT}`);

wss.on('connection', (ws, req) => {
    // 💡 INI KUNCINYA: Otomatis ngambil username dari link OBS masing-masing user
    const url = new URL(req.url, `http://${req.headers.host}`);
    const targetUsername = url.searchParams.get('username');

    // Tolak kalau usernamenya kosong
    if (!targetUsername) {
        ws.send(JSON.stringify({ type: 'error', message: 'Username TikTok tidak diberikan!' }));
        ws.close();
        return;
    }

    console.log(`[CONNECT] User OBS menghubungkan akun: @${targetUsername}`);

    // Buka jalur sadap khusus untuk username yang ditangkap tadi
    let tiktokLiveConnection = new WebcastPushConnection(targetUsername);

    tiktokLiveConnection.connect().then(state => {
        console.log(`[SUCCESS] 📡 Menyadap Live Room: @${targetUsername}`);
        ws.send(JSON.stringify({ type: 'system', message: `Berhasil terhubung ke live @${targetUsername}` }));
    }).catch(err => {
        console.error(`[ERROR] Gagal konek ke @${targetUsername}`, err);
        ws.send(JSON.stringify({ type: 'error', message: `Gagal konek ke @${targetUsername}. Pastikan sedang LIVE!` }));
    });

    // TANGKAP CHAT
    tiktokLiveConnection.on('chat', data => {
        ws.send(JSON.stringify({
            type: 'chat',
            uniqueId: data.uniqueId,
            message: data.comment,
            profilePictureUrl: data.profilePictureUrl
        }));
    });

    // TANGKAP GIFT (JALUR VIP)
    tiktokLiveConnection.on('gift', data => {
        // Filter animasi berulang biar nggak spam
        if (data.giftType === 1 && !data.repeatEnd) return; 
        ws.send(JSON.stringify({
            type: 'gift',
            uniqueId: data.uniqueId,
            giftName: data.giftName,
            profilePictureUrl: data.profilePictureUrl
        }));
    });

    // BERSIHKAN KONEKSI KALAU OBS DITUTUP
    ws.on('close', () => {
        console.log(`[DISCONNECT] Overlay @${targetUsername} terputus.`);
        tiktokLiveConnection.disconnect();
    });
});
