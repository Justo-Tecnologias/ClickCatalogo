import { z } from "zod";

import { tenantSlugSchema } from "@/lib/tenants/slug";

export const signupSchema = z.object({
  email: z.string().trim().pipe(z.email("Digite um e-mail válido.")).transform((value) => value.toLowerCase()),
  nomeLoja: z.string().trim().min(2, "Digite o nome da loja.").max(100),
  privacyAccepted: z.literal(true, { error: "Aceite a política de privacidade." }),
  slug: tenantSlugSchema,
  tema: z.enum(["classico", "natural", "tech", "delivery", "elegante", "minimal"]),
  termsAccepted: z.literal(true, { error: "Aceite os termos de uso." }),
  whatsapp: z.string().transform((value) => value.replace(/\D/g, "")).pipe(z.string().regex(/^55\d{10,11}$/, "Informe o código do país 55, o DDD e o número.")),
});

export type SignupInput = z.input<typeof signupSchema>;
