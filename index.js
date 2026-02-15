const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    disconnectReason, 
    downloadMediaMessage 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require('fs-extra');

// --- සැකසුම් (Settings) ---
const PHONE_NUMBER = "94741889930"; // ඔබේ අංකය 94 සමඟ මෙතනට දාන්න
const REACTION_EMOJI = "🤍"; // Status වලට වැටෙන්න ඕන Emoji එක

async function startBot() {
    // Session එක save වෙන්නේ 'auth' කියන folder එකේ
    const { state, saveCreds } = await useMultiFileAuthState('auth');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // --- Pairing Code එක ලබා ගැනීම ---
    if (!sock.authState.creds.registered) {
        console.log("Pairing code එක ලබා ගනිමින් පවතී...");
        setTimeout(async () => {
            let code = await sock.requestPairingCode(PHONE_NUMBER);
            console.log("\n------------------------------------");
            console.log("ඔබේ PAIRING CODE එක: " + code);
            console.log("------------------------------------\n");
        }, 5000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            let reason = lastDisconnect.error?.output?.statusCode;
            if (reason !== disconnectReason.loggedOut) startBot();
        } else if (connection === 'open') {
            console.log('බොට් සාර්ථකව සම්බන්ධ විය! ✅');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;

        // 1. Status Auto Seen & React
        if (msg.key.remoteJid === 'status@broadcast') {
            await sock.readMessages([msg.key]);
            await sock.sendMessage(msg.key.remoteJid, { 
                react: { key: msg.key, text: REACTION_EMOJI } 
            }, { statusJidList: [msg.key.participant] });
        }

        // 2. View Once Photo/Video Recovery
        const type = Object.keys(msg.message)[0];
        if (type === 'viewOnceMessageV2' || type === 'viewOnceMessage') {
            const media = await downloadMediaMessage(msg, 'buffer', {});
            const actualMsg = msg.message.viewOnceMessageV2?.message || msg.message.viewOnceMessage?.message;
            const mediaType = Object.keys(actualMsg)[0];

            await sock.sendMessage(sock.user.id, { 
                [mediaType === 'imageMessage' ? 'image' : 'video']: media, 
                caption: "♻️ Recovered Media" 
            });
        }
    });
}

startBot();
