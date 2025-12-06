const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { From, To, CallStatus } = req.body;
        
        console.log('Voice webhook called:', { From, To, CallStatus });

        // Find which customer owns this Twilio number
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        const { data: customer, error } = await supabase
            .from('customers')
            .select('*')
            .eq('twilio_phone_number', To)
            .single();

        let voiceMessage = "Thank you for calling. We'll get back to you shortly.";
        
        // Use custom voice message if available
        if (customer && customer.voice_message) {
            voiceMessage = customer.voice_message;
        }

        // Return TwiML to speak the message
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>${voiceMessage}</Say>
    <Hangup/>
</Response>`;

        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(twiml);

    } catch (error) {
        console.error('Voice webhook error:', error);
        
        // Fallback message if error
        const fallbackTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Thank you for calling. We'll get back to you shortly.</Say>
    <Hangup/>
</Response>`;
        
        res.setHeader('Content-Type', 'text/xml');
        return res.status(200).send(fallbackTwiml);
    }
}
