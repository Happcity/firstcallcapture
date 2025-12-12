// Stripe webhook handler - Provisions number AFTER payment
import { createClient } from '@supabase/supabase-js';
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const twilio = require('twilio');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

// A2P Messaging Service SID
const MESSAGING_SERVICE_SID = 'MG0f9ea89c8fe16f24201ac16de37d0c45';

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

            // Find the customer
            const { data: customer, error: customerError } = await supabase
                .from('customers')
                .select('*')
                .eq('email', customerEmail)
                .single();

            if (customerError || !customer) {
                console.error('Customer not found:', customerEmail);
                return res.status(200).json({ received: true });
            }

            // Check if they already have a Twilio number
            if (customer.twilio_phone_number) {
                console.log('Customer already has number:', customer.twilio_phone_number);
                
                // Just update Stripe IDs
                const { error: updateError } = await supabase
                    .from('customers')
                    .update({ 
                        stripe_customer_id: session.customer,
                        stripe_subscription_id: session.subscription
                    })
                    .eq('email', customerEmail);

                if (updateError) {
                    console.error('Failed to update Stripe IDs:', updateError);
                }

                return res.status(200).json({ 
                    received: true,
                    message: 'Subscription updated, number already exists'
                });
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

            // Purchase the number with webhooks configured
            const purchasedNumber = await twilioClient.incomingPhoneNumbers.create({
                phoneNumber: phoneNumberToBuy,
                voiceUrl: 'https://www.firstcallcapture.com/api/voice-webhook',
                voiceMethod: 'POST',
                statusCallback: 'https://www.firstcallcapture.com/api/call-status',
                statusCallbackMethod: 'POST'
            });

            console.log('Number purchased:', purchasedNumber.phoneNumber);
            console.log('Number SID:', purchasedNumber.sid);

            // ADD NUMBER TO A2P MESSAGING SERVICE SENDER POOL
            // This is required for A2P compliance - numbers must be in the pool to send SMS
            try {
                const phoneNumberSid = purchasedNumber.sid;
                
                await twilioClient.messaging.v1
                    .services(MESSAGING_SERVICE_SID)
                    .phoneNumbers
                    .create({ phoneNumberSid: phoneNumberSid });
                
                console.log('✅ Number added to Messaging Service Sender Pool:', purchasedNumber.phoneNumber);
            } catch (msgError) {
                console.error('⚠️ Failed to add number to Messaging Service:', msgError.message);
                // Don't fail the whole webhook - number is still purchased
            }

            // Update customer with Twilio number AND Stripe IDs
            const { error: updateError } = await supabase
                .from('customers')
                .update({ 
                    twilio_phone_number: purchasedNumber.phoneNumber,
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
                provisioned: purchasedNumber.phoneNumber,
                addedToMessagingService: true,
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
