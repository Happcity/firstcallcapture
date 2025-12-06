export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { From, To, CallStatus } = req.body;
        
        console.log('Voice webhook called:', { From, To, CallStatus });

        // Return TwiML to handle the call
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Thank you for calling. We'll get back to you shortly.</Say>
    <Hangup/>
</Response>`;

        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twiml);

    } catch (error) {
        console.error('Voice webhook error:', error);
        return res.status(500).send('Error');
    }
}
