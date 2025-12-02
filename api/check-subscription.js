export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const { createClient } = require('@supabase/supabase-js');
    
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email required' });
        }

        // Get customer from database
        const { data: customer, error: dbError } = await supabase
            .from('customers')
            .select('stripe_subscription_id, stripe_customer_id')
            .eq('email', email)
            .single();

        if (dbError || !customer) {
            return res.status(200).json({ 
                hasAccess: false, 
                reason: 'no_customer_record' 
            });
        }

        // If no subscription ID, they haven't paid
        if (!customer.stripe_subscription_id) {
            return res.status(200).json({ 
                hasAccess: false, 
                reason: 'no_subscription' 
            });
        }

        // Check subscription status with Stripe
        const subscription = await stripe.subscriptions.retrieve(
            customer.stripe_subscription_id
        );

        // Allow access if: active, trialing, or past_due (grace period)
        const hasAccess = ['active', 'trialing', 'past_due'].includes(subscription.status);

        return res.status(200).json({
            hasAccess: hasAccess,
            status: subscription.status,
            trialEnd: subscription.trial_end,
            currentPeriodEnd: subscription.current_period_end,
            cancelAtPeriodEnd: subscription.cancel_at_period_end
        });

    } catch (error) {
        console.error('Subscription check error:', error);
        return res.status(500).json({ 
            error: 'Failed to check subscription',
            hasAccess: false 
        });
    }
}
