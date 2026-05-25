import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Input = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

export const bootstrapSuperAdmin = createServerFn({ method: "POST" })
  .inputValidator((input) => Input.parse(input))
  .handler(async ({ data }) => {
    // Refuse if a super_admin already exists
    const { data: existing, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin")
      .limit(1);
    if (roleErr) throw new Error(roleErr.message);
    if (existing && existing.length > 0) {
      throw new Error("Bootstrap ya fue ejecutado. Iniciá sesión normalmente.");
    }

    // Find existing auth user by email (paginate)
    let userId: string | null = null;
    let page = 1;
    while (page <= 20) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) throw new Error(error.message);
      const found = list.users.find(
        (u) => (u.email ?? "").toLowerCase() === data.email.toLowerCase(),
      );
      if (found) {
        userId = found.id;
        break;
      }
      if (list.users.length < 200) break;
      page++;
    }

    if (userId) {
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { password: data.password, email_confirm: true },
      );
      if (updErr) throw new Error(updErr.message);
    } else {
      const { data: created, error: createErr } =
        await supabaseAdmin.auth.admin.createUser({
          email: data.email,
          password: data.password,
          email_confirm: true,
        });
      if (createErr) throw new Error(createErr.message);
      userId = created.user!.id;
    }

    // Ensure profile + super_admin role
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, email: data.email }, { onConflict: "id" });

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "super_admin" });
    if (insErr && !insErr.message.includes("duplicate")) {
      throw new Error(insErr.message);
    }

    return { ok: true, email: data.email };
  });
