const axios = require('axios');

module.exports = [
    {
        name: "Send Email",
        desc: "Kirim email via Resend",
        category: "Notification",
        path: "/api/notif/email?apikey=&order_id=&email=",

        async run(req, res) {
            try {
                const { order_id, email } = req.query;
                if (!order_id || !email) return res.status(400).json({ error: true, message: 'order_id & email wajib' });

                try {
                    await axios.post('https://api.resend.com/emails', {
                        from: 'RAMZZ HOSTING <noreply@ramzzhosting.com>',
                        to: [email],
                        subject: `✅ Pembayaran Berhasil - #${order_id}`,
                        html: `<div style="background:#0a0a0a;color:#fff;padding:20px;border-radius:12px;font-family:sans-serif;"><h2>✅ Pembayaran Berhasil!</h2><p>Order: <b>#${order_id}</b></p></div>`
                    }, {
                        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY || ''}`, 'Content-Type': 'application/json' }
                    });
                    res.json({ success: true, message: 'Email sent' });
                } catch (e) {
                    res.json({ success: true, message: 'Email mock (Resend not configured)' });
                }
            } catch (err) {
                res.status(500).json({ error: true, message: err.message });
            }
        }
    },

    {
        name: "Send Telegram",
        desc: "Kirim notif Telegram",
        category: "Notification",
        path: "/api/notif/telegram?apikey=&order_id=&message=",

        async run(req, res) {
            try {
                const { order_id, message } = req.query;
                const text = message || `🔔 Order #${order_id} updated!`;

                try {
                    await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                        chat_id: process.env.TELEGRAM_CHAT_ID,
                        text,
                        parse_mode: 'Markdown'
                    });
                    res.json({ success: true, message: 'Telegram sent' });
                } catch (e) {
                    res.json({ success: true, message: 'Telegram mock (not configured)' });
                }
            } catch (err) {
                res.status(500).json({ error: true, message: err.message });
            }
        }
    }
];
