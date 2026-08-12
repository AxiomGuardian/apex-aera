// DEPRECATED — auth moved to Supabase (see src/lib/supabase/*, middleware.ts).
export async function GET()  { return new Response("Gone", { status: 410 }); }
export async function POST() { return new Response("Gone", { status: 410 }); }
