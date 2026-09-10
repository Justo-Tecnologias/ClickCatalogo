import "server-only";

import { CLICKCATALOGO_MONTHLY_PLAN } from "@/lib/billing/plan";

export function getAsaasCheckoutPlan() {
  return CLICKCATALOGO_MONTHLY_PLAN;
}
