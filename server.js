// Cara import yang lebih aman (Bulletproof) untuk mencegah error "Not a constructor"
const TikTokLive = require('tiktok-live-connector');
const WebcastPushConnection = TikTokLive.WebcastPushConnection || TikTokLive;
const WebSocket = require('ws');

// Railway kadang menggunakan port 8080 secara dinamis
const PORT = process.env.PORT || 8080; 
const wss = new WebSocket.Server({ port: PORT });

console.log(`🚀 Melodify TikTok Bridge Cloud berjalan di port ${PORT}`);

wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let targetUsername = url.searchParams.get('username');

    if (!targetUsername) {
        ws.send(JSON.stringify({ type: 'error', message: 'Username TikTok tidak diberikan!' }));
        ws.close();
        return;
    }

    // 💡 AUTO-CLEANER: Hapus spasi dan simbol '@' kalau user terlanjur ngetik pakai '@'
    targetUsername = targetUsername.replace('@', '').trim();

    console.log(`[CONNECT] Overlay menghubungkan akun: ${targetUsername}`);

    try {
        // Karena import-nya sudah diperbaiki, baris ini tidak akan crash lagi
        let tiktokLiveConnection = new WebcastPushConnection(targetUsername);

        tiktokLiveConnection.connect().then(state => {
            console.log(`[SUCCESS] 📡 Menyadap Live Room: ${targetUsername}`);
            ws.send(JSON.stringify({ type: 'system', message: `Berhasil menyadap live @${targetUsername}` }));
        }).catch(err => {
            console.error(`[ERROR] Gagal konek ke ${targetUsername}`, err);
            ws.send(JSON.stringify({ type: 'error', message: `Gagal konek ke @${targetUsername}. Pastikan sedang LIVE!` }));
        });

        tiktokLiveConnection.on('chat', data => {
            ws.send(JSON.stringify({
                type: 'chat',
                uniqueId: data.uniqueId,
                message: data.comment,
                profilePictureUrl: data.profilePictureUrl
            }));
        });

        tiktokLiveConnection.on('gift', data => {
            if (data.giftType === 1 && !data.repeatEnd) return; 
            ws.send(JSON.stringify({
                type: 'gift',
                uniqueId: data.uniqueId,
                giftName: data.giftName,
                profilePictureUrl: data.profilePictureUrl
            }));
        });

        ws.on('close', () => {
            console.log(`[DISCONNECT] Overlay ${targetUsername} terputus.`);
            tiktokLiveConnection.disconnect();
        });

    } catch (error) {
        // Menangkap error agar server tidak mati (crash)
        console.error("🚨 Crash dicegah oleh Try-Catch:", error);
        ws.send(JSON.stringify({ type: 'error', message: 'Gagal inisialisasi penyadap TikTok.' }));
    }
});
