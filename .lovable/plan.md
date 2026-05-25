## Agregar recuperación de contraseña

### Cambios

1. **`src/routes/login.tsx`** — Agregar link "¿Olvidaste tu contraseña?" debajo del campo password. Abre un modal/vista con input de email y llama:
   ```ts
   supabase.auth.resetPasswordForEmail(email, {
     redirectTo: window.location.origin + "/reset-password"
   })
   ```
   Muestra toast confirmando el envío del email.

2. **`src/routes/reset-password.tsx`** (nuevo) — Página pública con formulario para nueva contraseña. Detecta el token de recuperación en el hash de la URL y llama `supabase.auth.updateUser({ password })`. Al éxito redirige a `/home`.

3. **Email de recuperación** — Supabase envía el email de reset por default usando su plantilla nativa, así que funcionará inmediatamente sin configuración adicional. Si querés branding propio (logo FlowIt, dominio custom), después podemos configurar Lovable Emails para auth — avisame.

### Resultado

Vas a poder hacer click en "¿Olvidaste tu contraseña?" en `/login`, recibir un email con un link, y setear una contraseña nueva. Una vez seteada, podés usar email + contraseña para entrar.
