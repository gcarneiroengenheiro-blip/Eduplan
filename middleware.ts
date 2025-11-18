import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const path = url.pathname;
  const publicPaths = ['/', '/login', '/signup', '/pricing', '/api'];
  if (publicPaths.some(p => path.startsWith(p))) return NextResponse.next();
  const token = req.cookies.get('sb:token')?.value;
  if (!token) return NextResponse.redirect(new URL('/login', req.url));
  return NextResponse.next();
}
