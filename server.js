const { WebcastPushConnection } = require('tiktok-live-connector');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

console.log(`🚀 Melodify TikTok Bridge Cloud berjalan di port ${PORT}`);

wss.on('connection', (ws, req) => {
    // Tangkap username dari link OBS
    const url = new URL(req.url, `http://${req.headers.host}`);
    const targetUsername = url.searchParams.get('username');

    if (!targetUsername) {
        ws.send(JSON.stringify({ type: 'error', message: 'Username TikTok tidak diberikan!' }));
        ws.close();
        return;
    }

    console.log(`[CONNECT] Overlay menghubungkan akun: @${targetUsername}`);

    let tiktokLiveConnection = new WebcastPushConnection(targetUsername);

    tiktokLiveConnection.connect().then(state => {
        console.log(`[SUCCESS] 📡 Menyadap Live Room: @${targetUsername}`);
        ws.send(JSON.stringify({ type: 'system', message: `Berhasil menyadap live @${targetUsername}` }));
    }).catch(err => {
        console.error(`[ERROR] Gagal konek ke @${targetUsername}`, err);
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
        console.log(`[DISCONNECT] Overlay @${targetUsername} terputus.`);
        tiktokLiveConnection.disconnect();
    });
});
