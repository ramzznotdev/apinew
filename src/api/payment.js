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

                if (!order_id || !amount) {
                    return res.status(400).json({
                        error: true,
                        message: 'order_id dan amount wajib diisi'
                    });
                }

                let qrString = '';
                let qrUrl = '';

                // Panggil Pakasir API
                try {
                    if (process.env.PAKASIR_API_KEY && process.env.PAKASIR_PROJECT) {
                        const qrRes = await axios.post(
                            'https://app.pakasir.com/api/transactioncreate/qris',
                            {
                                project: process.env.PAKASIR_PROJECT,
                                order_id: order_id,
                                amount: Number(amount),
                                api_key: process.env.PAKASIR_API_KEY
                            },
                            { 
                                headers: { 'Content-Type': 'application/json' },
                                timeout: 15000
                            }
                        );

                        console.log('Pakasir Response:', JSON.stringify(qrRes.data));

                        if (qrRes.data && qrRes.data.payment) {
                            qrString = qrRes.data.payment.payment_number || '';
                            if (qrString) {
                                qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrString)}`;
                            }
                        }
                    }
                } catch (e) {
                    console.error('Pakasir Error:', e.response?.data || e.message);
                }

                // Fallback QR mock
                if (!qrUrl) {
                    qrString = `QRIS-${order_id}`;
                    qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${order_id}`;
                }

                res.json({
                    success: true,
                    data: {
                        order_id,
                        amount: Number(amount),
                        qr_string: qrString,
                        qr_url: qrUrl,
                        expires_in: 900
                    }
                });

            } catch (err) {
                res.status(500).json({
                    error: true,
                    message: 'Gagal generate QR',
                    detail: err.message
                });
            }
        }
    },

    {
        name: "Check Payment Status",
        desc: "Cek status pembayaran by order_id",
        category: "Payment",
        path: "/api/payment/status?apikey=&order_id=",

        async run(req, res) {
            try {
                const { order_id } = req.query;

                if (!order_id) {
                    return res.status(400).json({
                        error: true,
                        message: 'order_id wajib diisi'
                    });
                }

                // Cek dari database
                const orders = global.readDB('orders.json');
                const order = orders.find(o => o.id === order_id);

                if (!order) {
                    return res.status(404).json({
                        error: true,
                        message: 'Order tidak ditemukan'
                    });
                }

                // Cek juga ke Pakasir untuk status real-time (opsional)
                let pakasirStatus = null;
                if (order.status === 'pending' && process.env.PAKASIR_API_KEY) {
                    try {
                        const statusRes = await axios.get(
                            'https://app.pakasir.com/api/transactionstatus',
                            {
                                params: {
                                    project: process.env.PAKASIR_PROJECT,
                                    order_id: order_id,
                                    api_key: process.env.PAKASIR_API_KEY
                                },
                                timeout: 10000
                            }
                        );

                        if (statusRes.data?.status === 'PAID' || statusRes.data?.payment?.status === 'PAID') {
                            // Update status di database
                            const idx = orders.findIndex(o => o.id === order_id);
                            if (idx !== -1) {
                                orders[idx].status = 'paid';
                                orders[idx].paid_at = new Date().toISOString();
                                global.writeDB('orders.json', orders);
                            }
                            pakasirStatus = 'PAID';
                        }
                    } catch (e) {
                        console.error('Pakasir Status Check Error:', e.message);
                    }
                }

                res.json({
                    success: true,
                    data: {
                        order_id,
                        status: pakasirStatus || order.status.toUpperCase(),
                        amount: order.amount,
                        paid_at: order.paid_at,
                        source: pakasirStatus ? 'pakasir' : 'local'
                    }
                });

            } catch (err) {
                res.status(500).json({
                    error: true,
                    message: err.message
                });
            }
        }
    }
];
