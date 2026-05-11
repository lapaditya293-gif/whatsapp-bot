const {
    Client,
    LocalAuth,
    MessageMedia
} = require('whatsapp-web.js');

const TelegramBot = require('node-telegram-bot-api');
const QRCode = require('qrcode');
const fs = require('fs');
/* ================= CRASH PROTECTION ================= */

process.on("uncaughtException", err => {
    console.log("Uncaught:", err);
});

process.on("unhandledRejection", err => {
    console.log("Unhandled:", err);
});

/* ================= TELEGRAM TOKEN ================= */

const telegramToken = "8644412218:AAGprUnTuvzRFBKpTk41MLsDblyiASp8tsY";

/* ================= START BOT ================= */

const bot = new TelegramBot(
    telegramToken,
    { polling: true }
);

bot.on("polling_error", (err) => {
    console.log("Polling error:", err.code);
});

console.log("Bot Started...");

/* ================= USER STORAGE ================= */

let userState = {};

/* ================= DELAY ================= */

function sleep(ms) {
    return new Promise(resolve =>
        setTimeout(resolve, ms)
    );
}

/* ================= START MENU ================= */

bot.onText(/\/start|\/menu/, async (msg) => {

    const chatId = msg.chat.id;

    let activeAccounts = 0;

    if (
        userState[chatId] &&
        userState[chatId].clients
    ) {

        activeAccounts =
            userState[chatId]
            .clients.length;
    }

    const panelText = `🤖 <b>WS AUTOMATION PANEL</b>

👋 Welcome!

📊 <b>System Status</b>

🟢 Active Accounts: ${activeAccounts}

⚡ Bot Status: ONLINE`;

    bot.sendMessage(

        chatId,

        panelText,

        {

            parse_mode: "HTML",

            reply_markup: {

              keyboard: [
                  ["/start"]
                ],

                resize_keyboard: true
            }
        }
    );

    bot.sendMessage(

        chatId,

        "Choose an option below:",

        {

            reply_markup: {

                inline_keyboard: [

                    [
                        {
                            text: "🟢 Connect WhatsApp",
                            callback_data: "connect"
                        }
                    ],

                    [
                        {
                            text: "📊 Status",
                            callback_data: "status"
                        },

                        {
                            text: "🔄 Refresh",
                            callback_data: "refresh"
                        }
                    ],

                    [
                        {
                            text: "🔴 Disconnect",
                            callback_data: "disconnect"
                        }
                    ]
                ]
            }
        }
    );
});

/* ================= INLINE BUTTON HANDLER ================= */

bot.on("callback_query", async (query) => {

    const chatId =
        query.message.chat.id;

    const data =
        query.data;

    /* CONNECT */

    if (data === "connect") {

        userState[chatId] = {
            step: "askAccounts"
        };

        bot.sendMessage(

            chatId,

            `🟢 CONNECT WHATSAPP

How many WhatsApp accounts do you want to connect?

Minimum: 2`
        );
    }

    /* STATUS */

    if (data === "status") {

        let activeAccounts = 0;

        if (
            userState[chatId] &&
            userState[chatId].clients
        ) {

            activeAccounts =
                userState[chatId]
                .clients.length;
        }

        bot.sendMessage(

            chatId,

`📊 BOT STATUS

🟢 Active Accounts: ${activeAccounts}

⚡ Bot Status: ONLINE`
        );
    }

    /* REFRESH */

   if (data === "refresh") {

    bot.sendMessage(
        chatId,
        "/menu"
    );

    bot.emit(
        "text",
        {
            chat: { id: chatId }
        },
        ["/menu"]
    );
}

    /* DISCONNECT */

    if (data === "disconnect") {

        if (
            !userState[chatId] ||
            !userState[chatId].clients
        ) {

            bot.sendMessage(
                chatId,
                "❌ No WhatsApp connected"
            );

            return;
        }

        const clients =
            userState[chatId]
            .clients;

        for (const client of clients) {

            try {

                await client.logout();

                await client.destroy();

            } catch (err) {

                console.log(err);
            }
        }

        delete userState[chatId];

        bot.sendMessage(
            chatId,
            "🔴 All WhatsApp accounts disconnected"
        );
    }

    bot.answerCallbackQuery(
        query.id
    );
});


/* ================= CONNECT BUTTON ================= */

bot.on("message", async (msg) => {

    const chatId = msg.chat.id;
     
        /* ACCOUNT COUNT INPUT */

    if (
        userState[chatId] &&
        userState[chatId].step === "askAccounts"
    ) {

        const totalAccounts =
            parseInt(msg.text);

        if (
            isNaN(totalAccounts) ||
            totalAccounts < 2
        ) {

            bot.sendMessage(
                chatId,
                "❌ Minimum 2 accounts required"
            );

            return;
        }

        userState[chatId] = {

            step: "connecting",

            totalAccounts,

            currentAccount: 1,

            clients: []
        };

        bot.sendMessage(
            chatId,
            `Starting ${totalAccounts} WhatsApp accounts...`
        );

        createWhatsAppClient(chatId);

        return;
    }

});

/* ================= CREATE CLIENT ================= */

async function createWhatsAppClient(chatId) {

    const state = userState[chatId];

    const accountNumber =
        state.currentAccount;

    const totalAccounts =
        state.totalAccounts;

    bot.sendMessage(
        chatId,
        `📲 Scan QR for Account ${accountNumber}`
    );

    let alreadyConnected = false;

    const client = new Client({

        authStrategy: new LocalAuth({

            clientId:
                `${chatId}_account${accountNumber}`
        }),

      puppeteer: {

    headless: true,

    timeout: 0,

    args: [

        "--no-sandbox",

        "--disable-setuid-sandbox",

        "--disable-dev-shm-usage",

        "--disable-accelerated-2d-canvas",

        "--no-first-run",

        "--no-zygote",

        "--disable-gpu",

        "--disable-features=site-per-process"
    ]
}

    });

    /* ================= QR EVENT ================= */

    client.on("qr", async (qr) => {

        try {

            console.log(
                `QR RECEIVED ACCOUNT ${accountNumber}`
            );

            const qrImage =
                await QRCode.toBuffer(qr);

            await bot.sendPhoto(
                chatId,
                qrImage,
                {
                    caption:
                        `📲 Scan QR for Account ${accountNumber}`
                }
            );

        } catch (err) {

            console.log(
                "QR Error:",
                err
            );
        }
    });

    /* ================= READY EVENT ================= */

    client.on("ready", async () => {

        if (alreadyConnected) return;

        alreadyConnected = true;

        console.log(
            `ACCOUNT ${accountNumber} READY`
        );

        await bot.sendMessage(
            chatId,
            `✅ Account ${accountNumber} connected`
        );

        state.clients.push(client);

        /* NEXT ACCOUNT */

        if (
            state.currentAccount <
            totalAccounts
        ) {

            state.currentAccount++;

            createWhatsAppClient(chatId);

        } else {

            await bot.sendMessage(
                chatId,
                "🎉 All accounts connected successfully!\n\nAutomation Started..."
            );

            startAutomation(chatId);
        }

    });

    /* ================= DISCONNECTED ================= */

    client.on("disconnected", async () => {

        bot.sendMessage(
            chatId,
            `⚠️ Account ${accountNumber} disconnected`
        );

    });

    /* ================= INITIALIZE ================= */

    client.initialize();
}

/* ================= SEND RANDOM IMAGE ================= */

async function sendRandomImage(
    sender,
    receiverNumber
) {

    try {

        const imageFolder =
            "./images";

        const files =
            fs.readdirSync(imageFolder);

        if (files.length === 0) return;

        const randomFile =
            files[
                Math.floor(
                    Math.random() *
                    files.length
                )
            ];

        const imagePath =
            `${imageFolder}/${randomFile}`;

        const media =
            MessageMedia.fromFilePath(
                imagePath
            );

        await sender.sendMessage(

            `${receiverNumber}@c.us`,

            media,

            {
                caption:
                    "📸 Random Image"
            }
        );

        console.log(
            `Image Sent: ${randomFile}`
        );

    } catch (err) {

        console.log(
            "Image Error:",
            err
        );
    }
}

/* ================= AUTOMATION ================= */

async function startAutomation(chatId) {

    const state =
        userState[chatId];

    const clients =
        state.clients;

   const messages = [

    "Hello 👋",

    "How are you?",

    "What's up?",

    "Automation working 😂",

    "Nice 👍",

    "Testing...",

    "Everything good?",

    "Hey bro 😄",

    "System running ⚡",

    "Working perfectly ✅",

    "Bot online 🤖",

    "Have a nice day 🌸",

    "Good morning ☀️",

    "Good night 🌙",

    "Amazing 😎",

    "Let's go 🚀",

    "All good here 👍",

    "How’s your day?",

    "Stay happy 😊",

    "Great 🔥",

    "Perfect 💯",

    "Cool 😄",

    "Enjoying automation 😂",

    "Working smooth ⚡",

    "Done successfully ✅"
];
    while (true) {

    for (
        let i = 0;
        i < clients.length;
        i++
    ) {

        const sender =
            clients[i];

        for (
            let j = 0;
            j < clients.length;
            j++
        ) {

            // SKIP SELF MESSAGE
            if (i === j) continue;

            const receiver =
                clients[j];

            try {

                const receiverNumber =
                    receiver.info.wid.user;

                const randomMessage =
                    messages[
                        Math.floor(
                            Math.random() *
                            messages.length
                        )
                    ];

                await sender.sendMessage(

                    `${receiverNumber}@c.us`,

                    randomMessage
                );

/* RANDOM IMAGE EVERY 30 MIN */

const now =
    Date.now();

if (
    !state.lastImageTime ||
    now - state.lastImageTime >=
    1800000
) {

    await sendRandomImage(
        sender,
        receiverNumber
    );

    state.lastImageTime = now;
}

                console.log(

                    `Account ${i + 1} → Account ${j + 1}`

                );

            } catch (err) {

                console.log(err);
            }

            // DELAY
            await sleep(20000);
        }
    }
}
}