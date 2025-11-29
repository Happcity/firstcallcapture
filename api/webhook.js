import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lhtrgutiqhqbnyfkdakd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxodHJndXRpcWhxYm55ZmtkYWtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzODk5MzMsImV4cCI6MjA3OTk2NTkzM30._j4fSrw3ybuYgdqevI-Mj-UjnbGe8rvNEF0hqe2uKC0';

const TWILIO_ACCOUNT_SID = 'AC0037c8735022c338abddd7c34ac40157';
const TWILIO_AUTH_TOKEN = '5908057a2c0a428e3678297841ee09d6';
const TWILIO_PHONE_NUMBER = '+17708096998';

export default async function handler(req, res) {
    // Only accept POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get the caller's phone number from Twilio
        const callerNumber = req.body.From;
        const twilioNumber = req.body.To;

        console.log('Incoming call from:', callerNumber, 'to:', twilioNumber);

        // Initialize Supabase
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

        // Find the customer who owns this Twilio number
        const { data: customer, error } = await supabase
            .from('customers')
            .select('*')
            .eq('phone_number', twilioNumber)
            .single();

        if (error || !customer) {
            console.log('Customer not found for number:', twilioNumber);
            return res.status(200).json({ message: 'Customer not found' });
        }

        // Get the auto-reply message
        const message = customer.auto_reply_message || 
            `Thanks for calling ${customer.business_name}! We'll get back to you ASAP.`;

        // Send SMS using Twilio
        const twilioClient = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
        
        await twilioClient.messages.create({
            body: message,
            from: TWILIO_PHONE_NUMBER,
            to: callerNumber
        });

        console.log('SMS sent to:', callerNumber);

        return res.status(200).json({ 
            success: true, 
            message: 'SMS sent successfully' 
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    }
}
