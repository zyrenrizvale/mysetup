const tiktokLiveModule = require('tiktok-live-connector');
const WebSocket = require('ws');

// 💡 MESIN PENDETEKSI OTOMATIS: Nyari Constructor biar anti-crash di Node v22!
let WebcastConnection;
if (typeof tiktokLiveModule.WebcastPushConnection === 'function') {
    WebcastConnection = tiktokLiveModule.WebcastPushConnection;
} else if (typeof tiktokLiveModule === 'function') {
    WebcastConnection = tiktokLiveModule;
} else if (tiktokLiveModule.default && typeof tiktokLiveModule.default.WebcastPushConnection === 'function') {
    WebcastConnection = tiktokLiveModule.default.WebcastPushConnection;
} else if (tiktokLiveModule.default && typeof tiktokLiveModule.default === 'function') {
    WebcastConnection = tiktokLiveModule.default;
} else {
    console.error("🚨 Gagal menemukan Constructor TikTok! Struktur modul:", Object.keys(tiktokLiveModule));
}

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

    // Auto-clean: Hapus simbol '@' dan spasi
    targetUsername = targetUsername.replace('@', '').trim();

    console.log(`[CONNECT] Overlay menghubungkan akun: ${targetUsername}`);

    try {
        if (!WebcastConnection) {
            throw new Error("Modul TikTok tidak valid. Cek console log di atas.");
        }

        // Jalankan penyadap pakai Constructor yang sudah ditemukan
        let tiktokLiveConnection = new WebcastConnection(targetUsername);

        tiktokLiveConnection.connect().then(state => {
            console.log(`[SUCCESS] 📡 Menyadap Live Room: ${targetUsername}`);
            ws.send(JSON.stringify({ type: 'system', message: `Berhasil menyadap live @${targetUsername}` }));
        }).catch(err => {
            console.error(`[ERROR] Gagal konek ke ${targetUsername}`);
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
            // Hindari spam gift berturut-turut
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
        console.error("🚨 Error Inisialisasi:", error.message);
        ws.send(JSON.stringify({ type: 'error', message: 'Gagal inisialisasi penyadap TikTok.' }));
    }
});
