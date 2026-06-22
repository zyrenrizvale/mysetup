const { TikTokLiveConnection, WebcastEvent } = require('tiktok-live-connector');
const WebSocket = require('ws');

// Gunakan Port dinamis dari Railway
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log(`🚀 Melodify TikTok Bridge Cloud berjalan di port ${PORT}`);

wss.on('connection', (ws, req) => {
    // Debug: log raw URL
    console.log(`[DEBUG] Raw URL: ${req.url}`);
    
    let targetUsername = null;
    
    // Parse URL dengan fallback untuk berbagai format
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        targetUsername = url.searchParams.get('username');
        console.log(`[DEBUG] Parsed username: ${targetUsername}`);
    } catch (e) {
        console.log(`[DEBUG] URL parse error: ${e.message}`);
    }

    if (!targetUsername) {
        console.log(`[ERROR] Username tidak ditemukan di query params`);
        ws.send(JSON.stringify({ type: 'error', message: 'Username TikTok tidak diberikan! Format: ?username=pahriramd' }));
        ws.close();
        return;
    }

    // AUTO-CLEANER: Bersihkan spasi dan simbol '@' biar TikTok nggak error
    targetUsername = targetUsername.replace('@', '').trim();

    console.log(`[CONNECT] Overlay menghubungkan akun: @${targetUsername}`);

    try {
        // Jalankan penyadap dengan API v2.4.0
        // Constructor menerima username langsung, bukan object
        const tiktokLiveConnection = new TikTokLiveConnection(targetUsername);

        tiktokLiveConnection.connect().then(state => {
            console.log(`[SUCCESS] 📡 Menyadap Live Room: @${targetUsername}`);
            ws.send(JSON.stringify({ type: 'system', message: `✅ Berhasil menyadap live @${targetUsername}` }));
        }).catch(err => {
            console.error(`[ERROR] Gagal konek ke @${targetUsername}:`, err.message);
            ws.send(JSON.stringify({ type: 'error', message: `❌ Gagal konek. Pastikan @${targetUsername} sedang LIVE!` }));
        });

        // TANGKAP CHAT
        tiktokLiveConnection.on(WebcastEvent.CHAT, data => {
            ws.send(JSON.stringify({
                type: 'chat',
                uniqueId: data.user.uniqueId,
                message: data.comment,
                profilePictureUrl: data.user.profilePictureUrl
            }));
        });

        // TANGKAP GIFT (JALUR VIP)
        tiktokLiveConnection.on(WebcastEvent.GIFT, data => {
            ws.send(JSON.stringify({
                type: 'gift',
                uniqueId: data.user.uniqueId,
                giftName: data.giftName,
                profilePictureUrl: data.user.profilePictureUrl
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
