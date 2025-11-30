import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lhtrgutiqhqbnyfkdakd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxodHJndXRpcWhxYm55ZmtkYWtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzODk5MzMsImV4cCI6MjA3OTk2NTkzM30._j4fSrw3ybuYgdqevI-Mj-UjnbGe8rvNEF0hqe2uKC0';

const TWILIO_ACCOUNT_SID = 'AC0037c8735022c338abddd7c34ac40157';
const TWILIO_AUTH_TOKEN = '5908057a2c0a428e3678297841ee09d6';
const TWILIO_PHONE_NUMBER = '+17708096998';

export default async function handler(req, res) {
    console.log('===== WEBHOOK CALLED =====');
    console.log('Method:', req.method);
    console.log('Body:', req.body);
    
    // Twilio sends both initial call AND status updates
    // Accept all POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const callStatus = req.body.CallStatus;
        const callerNumber = req.body.From;
        const twilioNumber = req.body.To;

        console.log('Parsed:', { callStatus, callerNumber, twilioNumber });

        // Initial call - respond with TwiML
        if (!callStatus || callStatus === 'ringing') {
            console.log('Initial call - responding with TwiML');
            res.setHeader('Content-Type', 'text/xml');
            return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Thank you for calling. Your message has been received.</Say>
    <Hangup/>
</Response>`);
        }

        // Call completed - send SMS
        if (callStatus === 'completed' || callStatus === 'no-answer' || callStatus === 'busy' || callStatus === 'failed') {
            console.log('Call ended with status:', callStatus, '- sending SMS');

            const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

            // Find customer
            const { data: customers } = await supabase
                .from('customers')
                .select('*');

            const customer = customers?.find(c => {
                const cleanCustomerPhone = c.phone_number?.replace(/\D/g, '');
                const cleanTwilioNumber = twilioNumber?.replace(/\D/g, '');
                return cleanCustomerPhone === cleanTwilioNumber;
            });

            if (!customer) {
                console.log('No customer found for number:', twilioNumber);
                return res.status(200).json({ message: 'No customer found' });
            }

            console.log('Found customer:', customer.business_name);

            // Get message
            const message = customer.auto_reply_message || 
                `Thanks for calling ${customer.business_name}! We'll get back to you ASAP.`;

            // Send SMS
            const twilio = require('twilio');
            const client = new twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
            
            const sms = await client.messages.create({
                body: message,
                from: TWILIO_PHONE_NUMBER,
                to: callerNumber
            });

            console.log('SMS sent! SID:', sms.sid);

            return res.status(200).json({ 
                success: true,
                message: 'SMS sent',
                sid: sms.sid
            });
        }

        // Other statuses - just acknowledge
        console.log('Other status:', callStatus);
        return res.status(200).json({ message: 'Status received' });

    } catch (error) {
        console.error('ERROR:', error);
        return res.status(500).json({ 
            error: 'Internal error',
            details: error.message 
        });
    }
}
