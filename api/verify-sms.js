// Verify SMS code using Twilio Verify
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lhtrgutiqhqbnyfkdakd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxodHJndXRpcWhxYm55ZmtkYWtkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDM4OTkzMywiZXhwIjoyMDc5OTY1OTMzfQ.5v_IPLme7x7F_e7lPW_LEkcantqXRLYwKBeJyVdLJ-w';

export default async function handler(req, res) {
    console.log('=== TWILIO VERIFY CHECK API CALLED ===');
    
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code, phoneNumber } = req.body;

    if (!code || !phoneNumber) {
        return res.status(400).json({ error: 'Code and phone number are required' });
    }

    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const verifySid = 'VAbc24d231eb8ea6d12a0172ea07db453c';

        console.log('Verifying code for:', phoneNumber);

        // Check verification code with Twilio Verify
        const response = await fetch(
            `https://verify.twilio.com/v2/Services/${verifySid}/VerificationCheck`,
            {
                method: 'POST',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    To: phoneNumber,
                    Code: code
                })
            }
        );

        const data = await response.json();
        console.log('Twilio Verify check response:', data);

        if (!response.ok || data.status !== 'approved') {
            return res.status(400).json({ error: 'Invalid or expired verification code' });
        }

        // Code is valid! Now mark customer as verified in Supabase
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { error: updateError } = await supabase
            .from('customers')
            .update({ 
                is_verified: true,
                verification_code: null,
                verification_code_expires_at: null
            })
            .eq('phone_number', phoneNumber);

        if (updateError) {
            console.error('Supabase update error:', updateError);
            return res.status(500).json({ error: 'Failed to update verification status' });
        }

        return res.status(200).json({ 
            success: true,
            message: 'Account verified successfully'
        });

    } catch (error) {
        console.error('Verification error:', error);
        return res.status(500).json({ error: 'Verification failed' });
    }
}
