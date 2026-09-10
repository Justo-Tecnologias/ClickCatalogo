export default async function finalizeSubscriptionCancellations() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase não configurado para finalizar cancelamentos agendados.");
  }

  const response = await fetch(
    `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/finalize_due_subscription_cancellations`,
    {
      body: JSON.stringify({ p_now: new Date().toISOString() }),
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Falha ao finalizar cancelamentos (${response.status}): ${detail}`);
  }

  const finalized = await response.json();
  console.log(JSON.stringify({ finalized, ranAt: new Date().toISOString() }));
}

export const config = {
  schedule: "15 * * * *",
};
