const axios = require('axios');

module.exports = [
    {
        name: "Send Email",
        desc: "Kirim email struk via Resend",
        category: "Notification",
        path: "/api/notif/email?apikey=&order_id=&email=",

        async run(req, res) {
            try {
                const params = req.method === 'POST' ? req.body : req.query;
                const { order_id, email } = params;
                if (!order_id || !email) return res.status(400).json({ error: true, message: 'order_id & email wajib' });

                const orders = global.readDB('orders.json');
                const order = orders.find(o => o.id === order_id);

                const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#0a0a0a;font-family:sans-serif;"><div style="max-width:480px;margin:40px auto;background:#111;border-radius:16px;padding:30px;border:1px solid #222;"><div style="text-align:center;margin-bottom:20px;"><h1 style="color:#f59e0b;">⚡ RAMZZ HOSTING</h1></div><div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:16px;text-align:center;margin-bottom:20px;"><h2 style="color:#22c55e;">✅ Pembayaran Berhasil!</h2></div><table style="width:100%;color:#fff;font-size:14px;"><tr><td style="color:#888;">Order ID</td><td style="font-weight:600;">${order_id}</td></tr><tr><td style="color:#888;">Produk</td><td>${order?.product || '-'}</td></tr><tr><td colspan="2"><hr style="border-color:#333;margin:12px 0;"></td></tr><tr><td style="font-size:16px;font-weight:700;">TOTAL</td><td style="font-size:18px;font-weight:800;color:#f59e0b;">${global.formatRupiah(order?.amount || 0)}</td></tr></table></div></body></html>`;

                if (process.env.RESEND_API_KEY) {
                    try {
                        await axios.post('https://api.resend.com/emails', {
                            from: 'RAMZZ HOSTING <noreply@ramzzhosting.com>',
                            to: [email],
                            subject: `✅ Pembayaran Berhasil - #${order_id}`,
                            html
                        }, { headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' } });
                        res.json({ success: true, message: `Email sent to ${email}` });
                    } catch (e) {
                        res.json({ success: true, message: 'Email mock (Resend not configured)' });
                    }
                } else {
                    res.json({ success: true, message: 'Email mock (no API key)' });
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
                const params = req.method === 'POST' ? req.body : req.query;
                const { order_id, message } = params;
                if (!order_id) return res.status(400).json({ error: true, message: 'order_id wajib' });

                const orders = global.readDB('orders.json');
                const order = orders.find(o => o.id === order_id);
                const text = message || `🔔 *PEMBAYARAN BARU!*\n\nOrder ID: \`${order_id}\`\nProduk: ${order?.product || '-'}\nJumlah: ${order ? global.formatRupiah(order.amount) : '-'}\nStatus: ${order?.status || '-'}`;

                if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
                    try {
                        await axios.post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
                            chat_id: process.env.TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown'
                        });
                        res.json({ success: true, message: 'Telegram sent' });
                    } catch (e) {
                        res.json({ success: true, message: 'Telegram mock (error)' });
                    }
                } else {
                    res.json({ success: true, message: 'Telegram mock (no config)' });
                }
            } catch (err) {
                res.status(500).json({ error: true, message: err.message });
            }
        }
    }
];
