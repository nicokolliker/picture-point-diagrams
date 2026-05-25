import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — FlowIt" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery token from the URL hash automatically
    // and emits a PASSWORD_RECOVERY event.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // Fallback: if there's already a session (link just opened), allow update.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Contraseña actualizada.");
      navigate({ to: "/home" });
    } catch (err: any) {
      toast.error(err.message ?? "No se pudo actualizar la contraseña.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] px-4">
      <div className="w-full max-w-md rounded-xl border border-[#EBEBEB] bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#5B6CF8] text-white font-bold">F</div>
          <span className="text-lg font-semibold">FlowIt</span>
        </div>
        <h1 className="text-xl font-semibold">Elegí una nueva contraseña</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          {ready
            ? "Ingresá la nueva contraseña para tu cuenta."
            : "Verificando el link de recuperación..."}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <div>
            <Label htmlFor="password">Nueva contraseña</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!ready || busy}
            />
          </div>
          <div>
            <Label htmlFor="confirm">Confirmar contraseña</Label>
            <Input
              id="confirm"
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={!ready || busy}
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-[#5B6CF8] hover:bg-[#4856E0]"
            disabled={!ready || busy}
          >
            Guardar contraseña
          </Button>
        </form>

        <button
          type="button"
          onClick={() => navigate({ to: "/login" })}
          className="mt-4 w-full text-sm text-[#5B6CF8] hover:underline"
        >
          Volver al inicio de sesión
        </button>
      </div>
    </div>
  );
}
