import twilio from 'twilio';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    console.log('📱 SMS Webhook called');
    console.log('Body:', req.body);

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { From, To, Body } = req.body;
        
        console.log(`SMS from ${From} to ${To}: ${Body}`);

        // Find customer by Twilio number
        const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select('*')
            .eq('twilio_phone_number', To)
            .single();

        if (customerError || !customer) {
            console.error('Customer not found for number:', To);
            return res.status(404).send('Customer not found');
        }

        console.log('Found customer:', customer.email);

        // Create TwiML response with auto-reply
        const twiml = new twilio.twiml.MessagingResponse();
        
        // Use custom message or default
        const replyMessage = customer.auto_reply_message || 
            `Thanks for texting ${customer.business_name}! We received your message and will get back to you soon.`;
        
        twiml.message(replyMessage);

        // Log the incoming SMS in database (optional - for analytics)
        await supabase
            .from('sms_logs')
            .insert([{
                customer_email: customer.email,
                from_number: From,
                to_number: To,
                message_body: Body,
                direction: 'inbound'
            }]);

        console.log('✅ Auto-reply sent successfully');

        // Return TwiML
        res.setHeader('Content-Type', 'text/xml');
        res.status(200).send(twiml.toString());

    } catch (error) {
        console.error('❌ SMS Webhook Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
