// Latido diario: mantiene activa la base gratuita de Supabase (se pausa tras días sin uso)
// y sirve para comprobar a qué base apunta la página publicada.
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  let ok = false;
  try {
    const r = await fetch(`${url}/rest/v1/lineas?select=id&limit=1`, { headers: { apikey: key }, cache: "no-store" });
    ok = r.ok;
  } catch {}
  let base = "sin configurar";
  try {
    base = new URL(url).hostname.split(".")[0];
  } catch {}
  return Response.json({ ok, base });
}
