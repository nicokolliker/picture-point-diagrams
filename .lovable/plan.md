## Problema

Nunca te creé un usuario — el sistema no permite que yo cree usuarios desde el chat. Lo que hice fue dejar configurado que **cuando vos te registres con el email `nkolliker@chillit.com`**, automáticamente te asignen el rol `super_admin` (vía trigger en la base de datos).

El setter de contraseña que armamos en `/admin` solo funciona **una vez que ya estás logueado como super_admin**, así que ahora mismo no te sirve (huevo y gallina).

## Opciones para desbloquearte

### Opción A — Login con Google (recomendado, 10 segundos)
1. Ir a `/login`
2. Click en **"Continue with Google"**
3. Elegir la cuenta `nkolliker@chillit.com`
4. Listo: el trigger te asigna `super_admin` automáticamente y entrás a `/home`

Después, si querés contraseña además de Google, vas a `/admin` → "Setear contraseña de usuario" y te ponés la que quieras.

**Requisito:** que Google esté habilitado como provider en Lovable Cloud. Si al hacer click te tira `Unsupported provider`, lo habilito con una llamada (`configure_social_auth`).

### Opción B — Sign up clásico con email + contraseña
1. Ir a `/login` → "Need an account? Sign up"
2. Usar email `nkolliker@chillit.com` y la contraseña que quieras
3. Confirmar el email (Supabase manda mail de verificación — el mismo problema de delivery que tuvimos antes puede aplicar)
4. Login normal

### Opción C — Bootstrap público temporal (si A y B fallan)
Crear un server function público de un solo uso `bootstrapSuperAdmin({ email, password })` que:
- Solo funciona si **todavía no existe ningún super_admin** en la DB
- Crea el usuario con `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true })`
- Le asigna `super_admin`
- Después de la primera ejecución exitosa queda inactivo automáticamente

Y una página `/bootstrap` con un form simple para llamarlo. La borramos apenas entrás.

## Mi recomendación

Probá **Opción A** primero (Google). Si funciona, en 10 segundos estás adentro y ni hace falta tocar código. Si Google tira error de provider no habilitado, avisame y lo habilito + reintento. Si por algún motivo no querés/podés usar Google, vamos a la **Opción C** que es la más confiable.

¿Avanzamos con A, o preferís que arme directamente la C?
