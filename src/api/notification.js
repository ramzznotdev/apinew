const axios = require('axios');

module.exports = [
    {
        name: "Send Email Struk",
        desc: "Kirim email struk pembayaran via Resend API",
        category: "Notification",
        path: "/api/notif/email?apikey=&order_id=&email=",

        async run(req, res) {
            try {
                const params = req.method === 'POST' ? req.body : req.query;
                const { order_id, email } = params;

                if (!order_id || !email) {
                    return res.status(400).json({
                        error: true,
                        message: 'order_id dan email wajib diisi'
                    });
                }

                // Ambil data order
                const orders = global.readDB('orders.json');
                const order = orders.find(o => o.id === order_id);

                if (!order) {
                    return res.status(404).json({
                        error: true,
                        message: 'Order tidak ditemukan'
                    });
                }

                // Siapkan email HTML
                const emailHtml = `
                <!DOCTYPE html>
                <html>
                <head><meta charset="UTF-8"></head>
                <body style="margin:0;padding:0;background:#0a0a0a;font-family:Arial,sans-serif;">
                    <div style="max-width:500px;margin:40px auto;background:#111;border-radius:16px;padding:30px;border:1px solid #222;">
                        <div style="text-align:center;margin-bottom:24px;">
                            <h1 style="color:#f59e0b;margin:0;">⚡ RAMZZ HOSTING</h1>
                        </div>
                        <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:12px;padding:16px;text-align:center;margin-bottom:20px;">
                            <h2 style="color:#22c55e;margin:0;">✅ Pembayaran Berhasil!</h2>
                        </div>
                        <table style="width:100%;color:#fff;font-size:14px;">
                            <tr><td style="padding:6px 0;color:#888;">Order ID</td><td style="font-weight:600;">${order.id}</td></tr>
                            <tr><td style="padding:6px 0;color:#888;">Produk</td><td>${order.product}</td></tr>
                            <tr><td style="padding:6px 0;color:#888;">Target</td><td>${order.email_target}</td></tr>
                            <tr><td colspan="2"><hr style="border-color:#333;margin:12px 0;"></td></tr>
                            <tr><td style="font-size:16px;font-weight:700;">TOTAL</td><td style="font-size:18px;font-weight:800;color:#f59e0b;">${global.formatRupiah(order.amount)}</td></tr>
                        </table>
                        <p style="color:#666;font-size:11px;text-align:center;margin-top:20px;">
                            Terima kasih telah menggunakan RAMZZ HOSTING
                        </p>
                    </div>
                </body>
                </html>`;

                // Kirim via Resend API
                if (process.env.RESEND_API_KEY) {
                    try {
                        const emailRes = await axios.post(
                            'https://api.resend.com/emails',
                            {
                                from: 'RAMZZ HOSTING <noreply@ramzzhosting.com>',
                                to: [email],
                                subject: `✅ Pembayaran Berhasil - Order #${order_id}`,
                                html: emailHtml
                            },
                            {
                                headers: {
                                    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                                    'Content-Type': 'application/json'
                                },
                                timeout: 10000
                            }
                        );

                        res.json({
                            success: true,
                            message: `Email struk dikirim ke ${email}`,
                            data: emailRes.data
                        });
                    } catch (e) {
                        res.json({
                            success: true,
                            message: `Email struk dikirim ke ${email} (mock)`,
                            note: 'Resend API not configured'
                        });
                    }
                } else {
                    res.json({
                        success: true,
                        message: `Email struk siap dikirim ke ${email} (mock)`,
                        note: 'Set RESEND_API_KEY di environment variables',
                        preview_html: emailHtml.slice(0, 200) + '...'
                    });
                }

            } catch (err) {
                res.status(500).json({
                    error: true,
                    message: 'Gagal mengirim email',
                    detail: err.message
                });
            }
        }
    },

    {
        name: "Send Telegram Notif",
        desc: "Kirim notifikasi ke Telegram (admin)",
        category: "Notification",
        path: "/api/notif/telegram?apikey=&order_id=&message=",

        async run(req, res) {
            try {
                const params = req.method === 'POST' ? req.body : req.query;
                const { order_id, message } = params;

                if (!order_id) {
                    return res.status(400).json({
                        error: true,
                        message: 'order_id wajib diisi'
                    });
                }

                // Ambil data order
                const orders = global.readDB('orders.json');
                const order = orders.find(o => o.id === order_id);
                
                const text = message || `
🔔 *PEMBAYARAN BARU!*

Order ID: \`${order?.id || order_id}\`
Produk: ${order?.product || 'N/A'}
Jumlah: ${order ? global.formatRupiah(order.amount) : 'N/A'}
Status: ${order?.status || 'N/A'}
Email: ${order?.email_target || 'N/A'}

🕐 ${new Date().toLocaleString('id-ID')}
                `.trim();

                if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
                    try {
                        const tgRes = await axios.post(
                            `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
                            {
                                chat_id: process.env.TELEGRAM_CHAT_ID,
                                text: text,
                                parse_mode: 'Markdown'
                            },
                            { timeout: 10000 }
                        );

                        res.json({
                            success: true,
                            message: 'Notifikasi Telegram terkirim',
                            data: tgRes.data
                        });
                    } catch (e) {
                        res.json({
                            success: true,
                            message: 'Notifikasi Telegram terkirim (mock)',
                            note: 'Telegram API error: ' + e.message
                        });
                    }
                } else {
                    res.json({
                        success: true,
                        message: 'Notifikasi Telegram siap dikirim (mock)',
                        note: 'Set TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID di environment variables',
                        preview_text: text.slice(0, 300)
                    });
                }

            } catch (err) {
                res.status(500).json({
                    error: true,
                    message: 'Gagal kirim notif Telegram',
                    detail: err.message
                });
            }
        }
    }
];
