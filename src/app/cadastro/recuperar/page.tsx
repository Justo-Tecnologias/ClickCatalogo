import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Recuperar cadastro",
};

export default function SignupRecoveryPage() {
  redirect("/painel/acessar-loja");
}
