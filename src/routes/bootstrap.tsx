import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { bootstrapSuperAdmin } from "@/lib/bootstrap.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/bootstrap")({
  head: () => ({ meta: [{ title: "Bootstrap — FlowIt" }] }),
  component: BootstrapPage,
});

function BootstrapPage() {
  const navigate = useNavigate();
  const bootstrap = useServerFn(bootstrapSuperAdmin);
  const [email, setEmail] = useState("nkolliker@chillit.com");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setBusy(true);
    try {
      await bootstrap({ data: { email, password } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Super admin creado. Bienvenido.");
      navigate({ to: "/home" });
    } catch (err: any) {
      toast.error(err?.message ?? "No se pudo ejecutar el bootstrap.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] px-4">
      <div className="w-full max-w-md rounded-xl border border-[#EBEBEB] bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">Bootstrap super admin</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Disponible una sola vez, mientras no exista ningún super admin en el sistema.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">Contraseña (mín. 8)</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-[#5B6CF8] hover:bg-[#4856E0]"
            disabled={busy}
          >
            {busy ? "Creando..." : "Crear super admin e iniciar sesión"}
          </Button>
        </form>
      </div>
    </div>
  );
}
