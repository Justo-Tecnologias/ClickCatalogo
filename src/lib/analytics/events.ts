export const productMetricNames = [
  "landing_view",
  "how_it_works_view",
  "signup_started",
  "signup_step_completed",
  "draft_created",
  "email_verified",
  "checkout_created",
  "payment_confirmed",
  "password_created",
  "first_category_created",
  "first_product_created",
  "fifth_product_created",
  "catalog_shared",
  "catalog_view",
  "whatsapp_order_clicked",
  "store_brand_clicked",
  "cancellation_requested",
  "cancellation_reverted",
  "subscription_reactivated",
] as const;

export type ProductMetricName = (typeof productMetricNames)[number];

export const publicProductMetricNames = [
  "landing_view",
  "how_it_works_view",
  "signup_started",
  "signup_step_completed",
  "catalog_shared",
  "catalog_view",
  "whatsapp_order_clicked",
  "store_brand_clicked",
] as const satisfies readonly ProductMetricName[];

export type PublicProductMetricName = (typeof publicProductMetricNames)[number];
