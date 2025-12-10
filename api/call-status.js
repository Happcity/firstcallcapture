const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { CallStatus, From, To, ForwardedFrom } = req.body;
        
        console.log('Call status webhook - ALL params:', req.body);
        console.log('CallStatus:', CallStatus);
        console.log('From:', From);
        console.log('To:', To);
        console.log('ForwardedFrom:', ForwardedFrom);

        // Only send SMS when call is completed (missed)
        if (CallStatus === 'completed' || CallStatus === 'no-answer') {
            
            // The ACTUAL caller's number - prioritize From since that's who initiated
            const callerNumber = From;
            
            console.log('Identified caller as:', callerNumber);
            
            // Find which customer owns this Twilio number
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
            
            const { data: customer, error } = await supabase
                .from('customers')
                .select('*')
                .eq('twilio_phone_number', To)
                .single();

            if (error || !customer) {
                console.error('Customer not found for number:', To);
                return res.status(200).send('OK');
            }

            console.log('Found customer:', customer.email, 'Business owner:', customer.user_phone_number);

            const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
            
            // MESSAGE 1: Auto-reply to the CALLER (client)
            const clientMessage = customer.auto_reply_message || 
                `Thanks for calling ${customer.business_name || 'us'}! We missed your call but will get back to you ASAP.`;
            
            await twilioClient.messages.create({
                messagingServiceSid: 'MG0f9ea89c8fe16f24201ac16de37d0c45', // A2P Messaging Service
                to: callerNumber, // To the person who called
                body: clientMessage
            });
            
            console.log('✅ Auto-reply sent to caller:', callerNumber);

            // MESSAGE 2: Notification to BUSINESS OWNER
            const ownerMessage = customer.owner_notification_message || 
                `New missed call from ${callerNumber}`;
            
            await twilioClient.messages.create({
                messagingServiceSid: 'MG0f9ea89c8fe16f24201ac16de37d0c45', // A2P Messaging Service
                to: customer.user_phone_number, // To business owner
                body: ownerMessage
            });
            
            console.log('✅ Notification sent to business owner:', customer.user_phone_number);
        }

        return res.status(200).send('OK');

    } catch (error) {
        console.error('❌ Call status error:', error);
        return res.status(200).send('OK');
    }
}
