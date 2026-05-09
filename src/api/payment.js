const axios = require('axios');

module.exports = [
    {
        name: "Generate QRIS",
        desc: "Generate QR Code QRIS",
        category: "Payment",
        path: "/api/payment/qris?apikey=&order_id=&amount=",

        async run(req, res) {
            try {
                const { order_id, amount } = req.query;
                if (!order_id || !amount) return res.status(400).json({ error: true, message: 'order_id & amount wajib' });

                let qrUrl = '';

                try {
                    const qrRes = await axios.post('https://app.pakasir.com/api/transactioncreate/qris', {
                        project: process.env.PAKASIR_PROJECT || '',
                        order_id,
                        amount: Number(amount),
                        api_key: process.env.PAKASIR_API_KEY || ''
                    }, { headers: { 'Content-Type': 'application/json' } });

                    if (qrRes.data?.success) qrUrl = qrRes.data.data?.qr_url || '';
                } catch (e) {
                    qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${order_id}`;
                }

                res.json({ success: true, data: { order_id, amount: Number(amount), qr_url: qrUrl } });
            } catch (err) {
                res.status(500).json({ error: true, message: err.message });
            }
        }
    },

    {
        name: "Check Payment Status",
        desc: "Cek status pembayaran",
        category: "Payment",
        path: "/api/payment/status?apikey=&order_id=",

        async run(req, res) {
            const { order_id } = req.query;
            if (!order_id) return res.status(400).json({ error: true, message: 'order_id wajib' });

            const orders = global.readDB('orders.json');
            const order = orders.find(o => o.id === order_id);
            if (!order) return res.status(404).json({ error: true, message: 'Order tidak ditemukan' });

            res.json({ success: true, data: { order_id, status: order.status.toUpperCase(), amount: order.amount, paid_at: order.paid_at } });
        }
    }
];
