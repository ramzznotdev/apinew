const axios = require('axios');

module.exports = [
    {
        name: "Generate QRIS",
        desc: "Generate QR Code QRIS via Pakasir",
        category: "Payment",
        path: "/api/payment/qris?apikey=&order_id=&amount=",

        async run(req, res) {
            try {
                const { order_id, amount } = req.query;
                if (!order_id || !amount) return res.status(400).json({ error: true, message: 'order_id & amount wajib' });

                let qrString = '';
                let qrUrl = '';
                let feeAmount = 0;
                let totalPayment = Number(amount);

                try {
                    if (process.env.PAKASIR_API_KEY && process.env.PAKASIR_PROJECT) {
                        const qrRes = await axios.post(
                            'https://app.pakasir.com/api/transactioncreate/qris',
                            {
                                project: process.env.PAKASIR_PROJECT,
                                order_id,
                                amount: Number(amount),
                                api_key: process.env.PAKASIR_API_KEY
                            },
                            { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
                        );

                        if (qrRes.data && qrRes.data.payment) {
                            const payment = qrRes.data.payment;
                            qrString = payment.payment_number || '';
                            feeAmount = payment.fee || 0;
                            totalPayment = payment.total_payment || Number(amount);
                            
                            if (qrString) {
                                qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrString)}`;
                            }
                        }
                    }
                } catch (e) {
                    console.error('Pakasir Error:', e.message);
                }

                if (!qrUrl) {
                    qrString = `QRIS-${order_id}`;
                    qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${order_id}`;
                }

                res.json({
                    success: true,
                    data: { order_id, amount: Number(amount), fee: feeAmount, total_payment: totalPayment, qr_string: qrString, qr_url: qrUrl, expires_in: 900 }
                });
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
            try {
                const { order_id } = req.query;
                if (!order_id) return res.status(400).json({ error: true, message: 'order_id wajib' });

                const orders = global.readDB('orders.json');
                const order = orders.find(o => o.id === order_id);
                if (!order) return res.status(404).json({ error: true, message: 'Order tidak ditemukan' });

                res.json({
                    success: true,
                    data: { order_id, status: order.status.toUpperCase(), amount: order.amount, paid_at: order.paid_at }
                });
            } catch (err) {
                res.status(500).json({ error: true, message: err.message });
            }
        }
    }
];
