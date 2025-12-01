// Verify SMS code
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lhtrgutiqhqbnyfkdakd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxodHJndXRpcWhxYm55ZmtkYWtkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDM4OTkzMywiZXhwIjoyMDc5OTY1OTMzfQ.5v_IPLme7x7F_e7lPW_LEkcantqXRLYwKBeJyVdLJ-w';

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Verification code is required' });
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Find customer with this verification code
        const { data: customer, error: findError } = await supabase
            .from('customers')
            .select('*')
            .eq('verification_code', code)
            .single();

        if (findError || !customer) {
            return res.status(400).json({ error: 'Invalid verification code' });
        }

        // Check if code is expired (10 minutes)
        const expiresAt = new Date(customer.verification_code_expires_at);
        const now = new Date();

        if (now > expiresAt) {
            return res.status(400).json({ error: 'Verification code has expired' });
        }

        // Mark customer as verified
        const { error: updateError } = await supabase
            .from('customers')
            .update({ 
                is_verified: true,
                verification_code: null, // Clear the code after use
                verification_code_expires_at: null
            })
            .eq('id', customer.id);

        if (updateError) {
            console.error('Update error:', updateError);
            return res.status(500).json({ error: 'Failed to verify account' });
        }

        return res.status(200).json({ 
            success: true,
            message: 'Account verified successfully',
            email: customer.email
        });

    } catch (error) {
        console.error('Verification error:', error);
        return res.status(500).json({ error: 'Verification failed' });
    }
}
