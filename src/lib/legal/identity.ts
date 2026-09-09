import "server-only";

import { z } from "zod";

export type LegalIdentity = {
  address: string | null;
  businessName: string | null;
  complete: boolean;
  supportEmail: string | null;
  taxId: string | null;
};

function optionalValue(value: string | undefined, maxLength: number, minLength = 1) {
  const normalized = value?.trim();
  return normalized && normalized.length >= minLength && normalized.length <= maxLength
    ? normalized
    : null;
}

export function getLegalIdentity(): LegalIdentity {
  const businessName = optionalValue(process.env.LEGAL_BUSINESS_NAME, 160, 2);
  const taxId = optionalValue(process.env.LEGAL_TAX_ID, 24, 11);
  const address = optionalValue(process.env.LEGAL_POSTAL_ADDRESS, 300, 5);
  const emailCandidate = optionalValue(process.env.LEGAL_SUPPORT_EMAIL, 254, 3);
  const supportEmail = emailCandidate && z.email().safeParse(emailCandidate).success
    ? emailCandidate.toLowerCase()
    : null;

  return {
    address,
    businessName,
    complete: Boolean(businessName && taxId && address && supportEmail),
    supportEmail,
    taxId,
  };
}
