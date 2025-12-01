const stripe = require('stripe')('sk_test_51SQwt1HK7i634yqwSNAyZG2s32o5O0a7RvBqdECkzhpE4RpRzF0T5uWjdXbEefFpFqRdE88ZvRex3BlS18niJzPT00KAEaucrh');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { priceId } = req.body;

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            subscription_data: {
                trial_period_days: 14, // 14-day free trial
            },
            success_url: `https://firstcallcapture.com/success.html`,
            cancel_url: `https://firstcallcapture.com/pricing.html`,
            allow_promotion_codes: true,
        });

        return res.status(200).json({ sessionId: session.id });

    } catch (error) {
        console.error('Stripe error:', error);
        return res.status(500).json({ 
            error: 'Failed to create checkout session',
            details: error.message 
        });
    }
}
