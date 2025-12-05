// Stripe webhook handler - Fixed for new schema
import { createClient } from '@supabase/supabase-js';
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const event = req.body;
        
        console.log('Webhook received:', event.type);

        // Handle successful checkout
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const customerEmail = session.customer_email || session.customer_details?.email;
            
            console.log('Checkout completed for:', customerEmail);

            if (!customerEmail) {
                console.error('No email found in session');
                return res.status(200).json({ received: true });
            }

            // Initialize Supabase with service_role key
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

            // Update customer with Stripe IDs
            const { error: updateError } = await supabase
                .from('customers')
                .update({ 
                    stripe_customer_id: session.customer,
                    stripe_subscription_id: session.subscription
                })
                .eq('email', customerEmail);

            if (updateError) {
                console.error('Failed to update customer:', updateError);
            } else {
                console.log('Successfully updated subscription for:', customerEmail);
            }

            return res.status(200).json({ 
                received: true,
                updated: customerEmail 
            });
        }

        // Acknowledge other events
        return res.status(200).json({ received: true });

    } catch (error) {
        console.error('Webhook error:', error);
        return res.status(500).json({ 
            error: 'Webhook failed',
            details: error.message 
        });
    }
}
