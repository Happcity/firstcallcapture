// Send verification SMS via Twilio
export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { phoneNumber, verificationCode } = req.body;

    if (!phoneNumber || !verificationCode) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Twilio credentials from environment variables
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioPhoneNumber = '+17708096998'; // Your Twilio number

        // Send SMS using Twilio API
        const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
            {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    To: phoneNumber,
                    From: twilioPhoneNumber,
                    Body: `Your First Call Capture verification code is: ${verificationCode}\n\nThis code expires in 10 minutes.\n\nNo SMS charges apply to you.`
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error('Twilio error:', data);
            return res.status(500).json({ error: 'Failed to send SMS', details: data });
        }

        return res.status(200).json({ 
            success: true, 
            messageSid: data.sid 
        });

    } catch (error) {
        console.error('SMS send error:', error);
        return res.status(500).json({ error: 'Failed to send verification SMS' });
    }
}
