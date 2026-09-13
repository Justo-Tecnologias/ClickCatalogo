import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Continuar cadastro",
};

export default function ContinueSignupPage() {
  redirect("/painel/acessar-loja/continuar");
}
