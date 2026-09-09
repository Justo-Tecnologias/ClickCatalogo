import { NextResponse } from "next/server";

import { getSiteUrl } from "@/lib/env/server";
import { getPublicSupabaseEnv } from "@/lib/env/public";
import { enforceSameOrigin } from "@/lib/security/same-origin";

function validRecoveryConfirmationUrl(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || value.length > 4_096) return null;

  const supabaseEnv = getPublicSupabaseEnv();
  if (!supabaseEnv) return null;

  try {
    const confirmationUrl = new URL(value);
    const supabaseUrl = new URL(supabaseEnv.url);
    const redirectValue = confirmationUrl.searchParams.get("redirect_to");
    const redirectUrl = redirectValue ? new URL(redirectValue) : null;
    const siteUrl = new URL(getSiteUrl());
    const hasToken = Boolean(
      confirmationUrl.searchParams.get("token")
      || confirmationUrl.searchParams.get("token_hash"),
    );

    if (
      confirmationUrl.origin !== supabaseUrl.origin
      || confirmationUrl.pathname !== "/auth/v1/verify"
      || confirmationUrl.searchParams.get("type") !== "recovery"
      || !hasToken
      || !redirectUrl
      || redirectUrl.origin !== siteUrl.origin
      || redirectUrl.pathname !== "/auth/callback"
      || redirectUrl.searchParams.get("next") !== "/painel/nova-senha"
    ) {
      return null;
    }

    return confirmationUrl;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const originResponse = enforceSameOrigin(request);
  if (originResponse) return originResponse;

  const formData = await request.formData().catch(() => null);
  const confirmationUrl = validRecoveryConfirmationUrl(
    formData?.get("confirmation_url") ?? null,
  );

  if (!confirmationUrl) {
    return NextResponse.redirect(
      new URL("/painel/recuperar-senha?erro=link-invalido", request.url),
      303,
    );
  }

  return NextResponse.redirect(confirmationUrl, 303);
}
