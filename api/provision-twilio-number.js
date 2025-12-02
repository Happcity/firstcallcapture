// Provision Twilio phone number
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lhtrgutiqhqbnyfkdakd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxodHJndXRpcWhxYm55ZmtkYWtkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDM4OTkzMywiZXhwIjoyMDc5OTY1OTMzfQ.8GIHdKstFqg10r33e3o86dQFGAdBmQ5ZAP0U7rcGJXk';

export default async function handler(req, res) {
    console.log('=== PROVISION TWILIO NUMBER API CALLED ===');
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;

        console.log('Provisioning number for:', email);

        // Step 1: Search for available phone number
        const searchResponse = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/AvailablePhoneNumbers/US/Local.json?SmsEnabled=true&VoiceEnabled=true`,
            {
                method: 'GET',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
                }
            }
        );

        const availableNumbers = await searchResponse.json();
        console.log('Available numbers found:', availableNumbers.available_phone_numbers?.length);

        if (!availableNumbers.available_phone_numbers || availableNumbers.available_phone_numbers.length === 0) {
            return res.status(500).json({ error: 'No available phone numbers found' });
        }

        const phoneNumber = availableNumbers.available_phone_numbers[0].phone_number;
        console.log('Selected number:', phoneNumber);

        // Step 2: Purchase the phone number
        const purchaseResponse = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`,
            {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    PhoneNumber: phoneNumber,
                    SmsUrl: 'https://www.firstcallcapture.com/api/sms-webhook',
                    VoiceUrl: 'https://www.firstcallcapture.com/api/voice-webhook',
                    StatusCallback: 'https://www.firstcallcapture.com/api/call-status'
                })
            }
        );

        const purchaseData = await purchaseResponse.json();
        console.log('Purchase response:', purchaseData);

        if (!purchaseResponse.ok) {
            console.error('Failed to purchase number:', purchaseData);
            return res.status(500).json({ error: 'Failed to purchase phone number' });
        }

        // Step 3: Update customer in Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

const { error: updateError } = await supabase
    .from('customers')
    .update({ twilio_phone_number: phoneNumber })
    .eq('email', email);

        if (updateError) {
            console.error('Failed to update customer:', updateError);
            return res.status(500).json({ error: 'Failed to update customer record' });
        }

        console.log('Successfully provisioned number:', phoneNumber);

        return res.status(200).json({
            success: true,
            phoneNumber: phoneNumber
        });

    } catch (error) {
        console.error('Provisioning error:', error);
        return res.status(500).json({ error: 'Failed to provision phone number' });
    }
}
