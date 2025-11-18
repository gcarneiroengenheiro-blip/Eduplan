import { buffer } from 'micro';
import type { NextApiRequest, NextApiResponse } from 'next';
import { stripe } from '../../lib/stripe';
import { supabaseServer } from '../../lib/supabaseServer';
export const config = { api: { bodyParser: false } };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const sig = req.headers['stripe-signature']!;
  const raw = await buffer(req);
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig as string, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error('Webhook signature error', err);
    return res.status(400).send(`Webhook Error: ${err}`);
  }
  try {
    switch (event.type) {
      case 'checkout.session.completed': break;
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
          await supabaseServer.from('subscriptions').upsert({
            stripe_subscription_id: stripeSubscriptionId,
            user_id: userId,
            stripe_price_id: stripePriceId,
            status,
            current_period_start: periodStart,
            current_period_end: periodEnd
          }, { onConflict: 'stripe_subscription_id' });
        }
      } break;
      default: console.log(`Unhandled event ${event.type}`);
    }
  } catch (e) { console.error(e); }
  res.json({ received: true });
}
