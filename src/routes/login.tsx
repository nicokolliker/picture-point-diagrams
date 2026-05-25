import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — FlowIt" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const onForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (error) throw error;
      toast.success("Te enviamos un email con el link para restablecer tu contraseña.");
      setMode("signin");
    } catch (err: any) {
      toast.error(err.message ?? "No se pudo enviar el email.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home" });
    });
  }, [navigate]);

  const onGoogle = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/home",
    });
    if ("error" in result && result.error) {
      toast.error(result.error.message);
      setBusy(false);
      return;
    }
    if (!("redirected" in result && result.redirected)) {
      navigate({ to: "/home" });
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name },
            emailRedirectTo: window.location.origin + "/home",
          },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/home" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
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
        <h1 className="text-xl font-semibold">
          {mode === "signin"
            ? "Sign in to FlowIt"
            : mode === "signup"
            ? "Create your account"
            : "Recuperar contraseña"}
        </h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          {mode === "signin"
            ? "Welcome back."
            : mode === "signup"
            ? "Get started in seconds."
            : "Te vamos a enviar un link a tu email."}
        </p>

        {mode !== "forgot" && (
          <>
            <Button
              type="button"
              variant="outline"
              className="mt-6 w-full"
              onClick={onGoogle}
              disabled={busy}
            >
              Continue with Google
            </Button>

            <div className="my-4 flex items-center gap-2 text-xs text-[#9CA3AF]">
              <div className="h-px flex-1 bg-[#EBEBEB]" />
              or
              <div className="h-px flex-1 bg-[#EBEBEB]" />
            </div>
          </>
        )}

        {mode === "forgot" ? (
          <form onSubmit={onForgot} className="mt-6 space-y-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" className="w-full bg-[#5B6CF8] hover:bg-[#4856E0]" disabled={busy}>
              Enviar link de recuperación
            </Button>
          </form>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-xs text-[#5B6CF8] hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full bg-[#5B6CF8] hover:bg-[#4856E0]" disabled={busy}>
              {mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
        )}

        <button
          type="button"
          onClick={() =>
            setMode(mode === "signin" ? "signup" : "signin")
          }
          className="mt-4 w-full text-sm text-[#5B6CF8] hover:underline"
        >
          {mode === "signin"
            ? "Need an account? Sign up"
            : mode === "signup"
            ? "Have an account? Sign in"
            : "Volver al inicio de sesión"}
        </button>
      </div>
    </div>
  );
}
