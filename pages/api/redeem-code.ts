import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServer } from '../../lib/supabaseServer';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, userId } = req.body;
  const { data } = await supabaseServer.from('activation_codes').select('*').eq('code', code).single();
  if (!data) return res.status(404).json({ error: 'Código inválido' });
  if (data.expires_at < new Date().toISOString()) return res.status(400).json({ error: 'Código expirado' });
  await supabaseServer.from('activation_codes').update({ used_by: userId, used_at: new Date().toISOString() }).eq('code', code);
  const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabaseServer.from('subscriptions').insert({ user_id: userId, stripe_subscription_id: null, stripe_price_id: 'TRIAL', status: 'active', current_period_start: new Date().toISOString(), current_period_end: trialEnd });
  return res.status(200).json({ ok: true, trial_ends_at: trialEnd });
}
