// Send verification SMS via Twilio Verify
export default async function handler(req, res) {
    console.log('=== TWILIO VERIFY SMS API CALLED ===');
    console.log('Phone:', req.body.phoneNumber);
    
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { phoneNumber } = req.body;

    if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required' });
    }

    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const verifySid = 'VAbc24d231eb8ea6d12a0172ea07db453c'; // Your Verify Service SID

        console.log('Sending verification to:', phoneNumber);

        // Start verification using Twilio Verify API
        const response = await fetch(
            `https://verify.twilio.com/v2/Services/${verifySid}/Verifications`,
            {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    To: phoneNumber,
                    Channel: 'sms'
                })
            }
        );

        const data = await response.json();
        console.log('Twilio Verify response:', data);

        if (!response.ok) {
            console.error('Twilio Verify error:', data);
            return res.status(500).json({ error: 'Failed to send verification SMS', details: data });
        }

        return res.status(200).json({ 
            success: true,
            status: data.status,
            sid: data.sid
        });

    } catch (error) {
        console.error('SMS send error:', error);
        return res.status(500).json({ error: 'Failed to send verification SMS' });
    }
}
