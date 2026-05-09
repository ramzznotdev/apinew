const axios = require('axios');

module.exports = [
  {
    name: "Send Email Struk",
    desc: "Kirim email struk pembayaran via Resend API",
    category: "Notification",
    path: "/api/notif/email?apikey=&order_id=&email=",
    
    async run(req, res) {
      try {
        const { order_id, email } = req.query;
        
        if (!order_id || !email) {
          return res.status(400).json({
            error: true,
            message: 'order_id dan email wajib diisi'
          });
        }
        
        const orders = global.readDB('orders.json');
        const order = orders.find(o => o.id === order_id);
        
        if (!order) {
          return res.status(404).json({
            error: true,
            message: 'Order tidak ditemukan'
          });
        }
        
        // Kirim via Resend API
        const resendResponse = await axios.post(
          'https://api.resend.com/emails',
          {
            from: 'RAMZZ HOSTING <noreply@ramzzhosting.com>',
            to: [email],
            subject: `✅ Pembayaran Berhasil - Order #${order_id}`,
            html: `
              <div style="background:#0a0a0a;color:#fff;padding:30px;border-radius:16px;font-family:sans-serif;">
                <h1 style="color:#f59e0b;">✅ Pembayaran Berhasil!</h1>
                <p>Order ID: <strong>#${order_id}</strong></p>
                <p>Produk: <strong>${order.product}</strong></p>
                <p>Jumlah: <strong>${global.formatRupiah(order.amount)}</strong></p>
                <p>Tanggal: ${new Date(order.paid_at || order.created_at).toLocaleString('id-ID')}</p>
                <hr style="border-color:#333;">
                <p style="color:#888;font-size:12px;">Terima kasih telah menggunakan RAMZZ HOSTING</p>
              </div>
            `
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        res.json({
          success: true,
          message: `Email struk dikirim ke ${email}`,
          data: resendResponse.data
        });
        
      } catch (err) {
        console.error('Email Error:', err.response?.data || err.message);
        res.status(500).json({
          error: true,
          message: 'Gagal mengirim email',
          detail: err.response?.data || err.message
        });
      }
    }
  },
  
  {
    name: "Send Telegram Notif",
    desc: "Kirim notifikasi ke Telegram",
    category: "Notification",
    path: "/api/notif/telegram?apikey=&order_id=&message=",
    
    async run(req, res) {
      try {
        const { order_id, message } = req.query;
        
        const orders = global.readDB('orders.json');
        const order = orders.find(o => o.id === order_id);
        
        const text = message || `
🔔 *Pembayaran Baru!*
        
Order ID: #${order_id || 'N/A'}
Produk: ${order?.product || 'N/A'}
Jumlah: ${order ? global.formatRupiah(order.amount) : 'N/A'}
Status: ${order?.status || 'N/A'}

🕐 ${new Date().toLocaleString('id-ID')}
        `;
        
        const telegramResponse = await axios.post(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text,
            parse_mode: 'Markdown'
          }
        );
        
        res.json({
          success: true,
          message: 'Notifikasi Telegram terkirim',
          data: telegramResponse.data
        });
        
      } catch (err) {
        res.status(500).json({
          error: true,
          message: 'Gagal kirim notif Telegram',
          detail: err.response?.data || err.message
        });
      }
    }
  }
];