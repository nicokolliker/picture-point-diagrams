## Plan: Skill "flowit-design-system"

### Objetivo
Capturar como skill reutilizable todo el lenguaje visual, tokens de diseño, patrones de componentes y convenciones de datos que definieron el look & feel actual de FlowIt.

### Estructura del skill
```
.agents/skills/flowit-design-system/
├── SKILL.md
└── references/
    ├── tokens.md          # Colores, tipografia, espaciado, sombras
    ├── components.md      # Patrones de cards, navegacion, badges, modales
    ├── animations.md      # Keyframes y clases de animacion custom
    └── data-conventions.md # Modelo de datos: areas, estados, prioridades
```

### Contenido por archivo

**SKILL.md** — Overview con triggers:
- Cuando se pida rediseñar, mejorar visualmente, o crear nuevas pantallas en FlowIt
- Cuando se mencione "look & feel", "estilo", "diseño", "UI de FlowIt"
- Cuando se cree un nuevo componente o vista

**references/tokens.md**:
- Paleta: Sky (#0EA5E9) a Violet (#A78BFA) como gradiente principal
- Primary = sky-500, Accent = violet-400
- Tipografia: Outfit (headings/display) + Figtree (body), ambos via Google Fonts
- Fondo de app: #FAFBFF, canvas: #FAFAFA con dot grid radial
- Semantic tokens en oklch en `styles.css`

**references/components.md**:
- Card pattern: rounded-2xl, border #EBEBEB, hover:-translate-y-0.5, sombra suave sky-10%
- Hero cards: gradiente de fondo sutil (sky-50 → violet-50), icono en circulo con gradiente
- Top nav: h-14, borde inferior #EBEBEB, buscador redondeado
- Sidebar: w-[232px], items con rounded-lg, estado activo con gradiente sutil
- Badges de estado: esquinas redondeadas full, icono + texto, backdrop-blur
- Logo SVG: rect con gradiente sky→violet, 3 nodos circulares blancos + conectores

**references/animations.md**:
- `.flowit-popup`: fade+scale 150ms
- `.flowit-slide-in-right`: translateX 200ms
- `.flowit-entry`: translateY 150ms
- Canvas dot grid: radial-gradient 20px

**references/data-conventions.md**:
- `DiagramDocument` tiene `areaId` (opcional) y `status: "draft" | "published"`
- `STATUS_COLORS` y `PRIORIDAD_META` con colores semanticos fijos
- `Area` entidad separada con `name` + `color`
- Convencion de nombres en espanol para labels visibles

### Entrega
1. Crear la estructura de archivos en `.agents/skills/flowit-design-system/`
2. Aplicar el skill via `skills--apply_draft`
3. Confirmar al usuario que quedo activo

### Notas
- No modificar codigo existente del proyecto
- Este skill es puramente de referencia: ensena *como se ve* FlowIt, no un workflow
