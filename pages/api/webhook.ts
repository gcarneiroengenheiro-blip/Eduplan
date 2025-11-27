import type { NextApiRequest, NextApiResponse } from 'next';
import { stripe } from '../../lib/stripe';
import { supabaseServer } from '../../lib/supabaseServer';

export const config = {
  api: {
    bodyParser: false, // importante para Stripe
  },
};

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];

    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => reject(err));
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'] as string;

  let rawBody: Buffer;

  try {
    rawBody = await getRawBody(req);
  } catch (err) {
    console.error('Error reading raw body:', err);
    return res.status(400).send('Invalid body');
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('⚠️ Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'invoice.payment_succeeded': {
        const sub = event.data.object as any;
        const stripeSubscriptionId = sub.id;
        const stripePriceId = sub.items.data[0].price.id;
        const status = sub.status;
        const periodStart = new Date(sub.current_period_start * 1000).toISOString();
        const periodEnd = new Date(sub.current_period_end * 1000).toISOString();
        const userId = sub.metadata?.userId || null;

        if (userId) {
          await supabaseServer.from('subscriptions').upsert(
            {
              stripe_subscription_id: stripeSubscriptionId,
              user_id: userId,
              stripe_price_id: stripePriceId,
              status,
              current_period_start: periodStart,
              current_period_end: periodEnd,
            },
            { onConflict: 'stripe_subscription_id' }
          );
        }
      }
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (e) {
    console.error('Webhook handler error:', e);
  }

  res.json({ received: true });
}
