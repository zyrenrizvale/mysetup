const tiktokLiveModule = require('tiktok-live-connector');
const WebSocket = require('ws');

// 💡 PENCARIAN BRUTAL: Memaksa Node.js menemukan mesin penyadap TikTok
let WebcastConnection = tiktokLiveModule.WebcastPushConnection;

// Jika disembunyikan oleh Node.js, kita cari paksa dari 800+ item modulnya
if (!WebcastConnection) {
    const keys = Object.keys(tiktokLiveModule);
    const foundKey = keys.find(k => k.toLowerCase().includes('webcastpush'));
    if (foundKey) {
        WebcastConnection = tiktokLiveModule[foundKey];
    } else {
        // Fallback terakhir
        WebcastConnection = tiktokLiveModule.default?.WebcastPushConnection || tiktokLiveModule.default;
    }
}

// Gunakan Port dinamis dari Railway
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

    // AUTO-CLEANER: Bersihkan spasi dan simbol '@' biar TikTok nggak error
    targetUsername = targetUsername.replace('@', '').trim();

    console.log(`[CONNECT] Overlay menghubungkan akun: @${targetUsername}`);

    try {
        if (!WebcastConnection) {
            throw new Error("Gagal menemukan mesin TikTok Live Connector di server ini.");
        }

        // Jalankan penyadap
        let tiktokLiveConnection = new WebcastConnection(targetUsername);

        tiktokLiveConnection.connect().then(state => {
            console.log(`[SUCCESS] 📡 Menyadap Live Room: @${targetUsername}`);
            ws.send(JSON.stringify({ type: 'system', message: `✅ Berhasil menyadap live @${targetUsername}` }));
        }).catch(err => {
            console.error(`[ERROR] Gagal konek ke @${targetUsername}`);
            ws.send(JSON.stringify({ type: 'error', message: `❌ Gagal konek. Pastikan @${targetUsername} sedang LIVE!` }));
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
            if (data.giftType === 1 && !data.repeatEnd) return; 
            ws.send(JSON.stringify({
                type: 'gift',
                uniqueId: data.uniqueId,
                giftName: data.giftName,
                profilePictureUrl: data.profilePictureUrl
            }));
        });

        // BERSIHKAN SAAT OBS DITUTUP
        ws.on('close', () => {
            console.log(`[DISCONNECT] Overlay @${targetUsername} terputus.`);
            tiktokLiveConnection.disconnect();
        });

    } catch (error) {
        console.error("🚨 CRASH DICEGAH:", error.message);
        ws.send(JSON.stringify({ type: 'error', message: `Error Sistem: ${error.message}` }));
    }
});
