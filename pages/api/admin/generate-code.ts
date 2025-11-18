import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServer } from '../../../lib/supabaseServer';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  const { adminId } = req.body;
  const code = 'EDU' + Math.random().toString(36).substring(2, 9).toUpperCase();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabaseServer.from('activation_codes').insert({ code, created_by: adminId, expires_at: expiresAt });
  res.status(200).json({ code, expiresAt });
}
