// Create Stripe checkout session
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { email, priceId } = req.body;
        
        if (!email || !priceId) {
            return res.status(400).json({ error: 'Email and priceId required' });
        }
        
        console.log('Creating checkout session for:', email, 'with priceId:', priceId);
        
        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            customer_email: email,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            subscription_data: {
                trial_period_days: 14,
            },
            success_url: `https://www.firstcallcapture.com/success.html?email=${encodeURIComponent(email)}`,
            cancel_url: 'https://www.firstcallcapture.com/checkout.html',
            allow_promotion_codes: true,
        });
        
        console.log('Checkout session created:', session.id);
        
        return res.status(200).json({
            url: session.url,
            sessionId: session.id
        });
        
    } catch (error) {
        console.error('Checkout creation error:', error);
        return res.status(500).json({
            error: 'Failed to create checkout session',
            details: error.message
        });
    }
}
