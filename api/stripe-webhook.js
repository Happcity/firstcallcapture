// Stripe webhook handler - Updated December 1
import { createClient } from '@supabase/supabase-js';
const stripe = require('stripe')('sk_test_51SQwt1HK7i634yqwSNAyZG2s32o5O0a7RvBqdECkzhpE4RpRzF0T5uWjdXbEefFpFqRdE88ZvRex3BlS18niJzPT00KAEaucrh');
const twilio = require('twilio');

const SUPABASE_URL = 'https://lhtrgutiqhqbnyfkdakd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxodHJndXRpcWhxYm55ZmtkYWtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzODk5MzMsImV4cCI6MjA3OTk2NTkzM30._j4fSrw3ybuYgdqevI-Mj-UjnbGe8rvNEF0hqe2uKC0';

const TWILIO_ACCOUNT_SID = 'AC0037c8735022c338abddd7c34ac40157';
const TWILIO_AUTH_TOKEN = 'a6e7bb0ddba34c3ab3d9d27c40fcd4cd';

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

            // Initialize Supabase
            const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

            // Find the customer in our database
            const { data: customer, error: customerError } = await supabase
                .from('customers')
                .select('*')
                .eq('email', customerEmail)
                .single();

            if (customerError || !customer) {
                console.error('Customer not found:', customerEmail);
                return res.status(200).json({ received: true });
            }

            // Check if they already have a phone number
            if (customer.phone_number && customer.phone_number.startsWith('+1')) {
                console.log('Customer already has a Twilio number:', customer.phone_number);
                return res.status(200).json({ received: true });
            }

            // Initialize Twilio client
            const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

            // Buy a new phone number for this customer
            console.log('Buying Twilio number for:', customerEmail);
            
            const availableNumbers = await twilioClient.availablePhoneNumbers('US')
                .local
                .list({ limit: 1 });

            if (availableNumbers.length === 0) {
                console.error('No available phone numbers');
                return res.status(200).json({ received: true });
            }

            const phoneNumberToBuy = availableNumbers[0].phoneNumber;
            console.log('Found available number:', phoneNumberToBuy);

            // Purchase the number
            const purchasedNumber = await twilioClient.incomingPhoneNumbers.create({
                phoneNumber: phoneNumberToBuy,
                voiceUrl: 'https://www.firstcallcapture.com/api/webhook',
                voiceMethod: 'POST',
                statusCallback: 'https://www.firstcallcapture.com/api/webhook',
                statusCallbackMethod: 'POST',
                smsUrl: 'https://www.firstcallcapture.com/api/webhook',
                smsMethod: 'POST'
            });

            console.log('Number purchased:', purchasedNumber.phoneNumber);

            // Save the Twilio number to the customer's record
            const { error: updateError } = await supabase
                .from('customers')
                .update({ 
                    phone_number: purchasedNumber.phoneNumber,
                    stripe_customer_id: session.customer,
                    stripe_subscription_id: session.subscription
                })
                .eq('email', customerEmail);

            if (updateError) {
                console.error('Failed to update customer:', updateError);
            } else {
                console.log('Successfully provisioned number for:', customerEmail);
            }

            return res.status(200).json({ 
                received: true,
                provisioned: purchasedNumber.phoneNumber 
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
