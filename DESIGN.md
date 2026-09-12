# AlquilaWeb — Diseño Visual

## Identidad del Proyecto

**Nombre:** AlquilaWeb
**Propósito:** Plataforma SaaS que crea dominios, los aloja en servidor y genera sitios web o cartas digitales para restaurantes y negocios de comida.
**Audiencia:** Dueños de restaurantes, emprendedores gastronómicos, negocios de comida en Perú.
**Tono:** Elegante, profesional, de confianza. Transmite que el cliente está en buenas manos.

---

## Paleta de Colores

| Rol | HEX | Tailwind Class | Uso |
|---|---|---|---|
| Primary | `#7C3AED` | `bg-violet-600` | Botones principales, acentos, links |
| Primary Hover | `#6D28D9` | `bg-violet-700` | Hover de botones primarios |
| Primary Light | `#DDD6FE` | `bg-violet-200` | Badges, tags, fondos sutiles |
| Dark BG | `#0F172A` | `bg-slate-900` | Header, Hero, secciones oscuras |
| Dark BG Alt | `#1E293B` | `bg-slate-800` | Cards en secciones oscuras |
| Light BG | `#F8FAFC` | `bg-slate-50` | Secciones claras (Demos, Reseñas) |
| White | `#FFFFFF` | `bg-white` | Cards, contenido principal |
| Text Dark | `#0F172A` | `text-slate-900` | Títulos en fondos claros |
| Text Muted | `#64748B` | `text-slate-500` | Descripciones, texto secundario |
| Text Light | `#F8FAFC` | `text-slate-500` | Texto en fondos oscuros |
| Yellow Accent | `#FBBF24` | `text-amber-400` | Estrellas de rating |

### Contraste WCAG AAA

- `#7C3AED` sobre `#FFFFFF` → Ratio 4.6:1 (AA para texto grande)
- `#FFFFFF` sobre `#0F172A` → Ratio 16.8:1 (AAA)
- `#F8FAFC` sobre `#0F172A` → Ratio 15.7:1 (AAA)
- `#0F172A` sobre `#FFFFFF` → Ratio 16.8:1 (AAA)

---

## Tipografía

**Google Fonts:**

| Uso | Fuente | Peso | Tailwind |
|---|---|---|---|
| Titulares | `Plus Jakarta Sans` | 700, 800 | `font-bold`, `font-extrabold` |
| Cuerpo | `Inter` | 400, 500, 600 | `font-normal`, `font-medium`, `font-semibold` |

**Escala de tamaños:**
- H1: `text-5xl md:text-6xl font-extrabold` (Hero headline)
- H2: `text-3xl md:text-4xl font-bold` (Secciones)
- H3: `text-xl font-semibold` (Cards)
- Body: `text-base md:text-lg` (Descripciones)
- Small: `text-sm` (Badges, metadata)

---

## Estilo Visual

**Concepto:** Minimalista elegante con acentos púrpura. Fondos oscuros tipo "dark mode" para Hero y secciones clave, alternando con fondos claros para variedad visual.

**Características:**
- Bordes redondeados suaves (`rounded-xl`, `rounded-2xl`)
- Sombras sutiles en cards (`shadow-lg`, `shadow-xl`)
- Gradientes púrpura en botones primarios
- Transiciones suaves en hover (`transition-all duration-300`)
- Badges con fondo púrpura claro y texto púrpura oscuro
- Secciones alternando fondo oscuro → claro → oscuro

**Logotipo:**
- Icono circular con gradiente púrpura y símbolo de globo/web
- Texto "AlquilaWeb" en Plus Jakarta Sans bold
- Versión clara (sobre fondo oscuro) y oscura (sobre fondo claro)

---

## Estructura de la Landing Page

```
1. Header (fijo, fondo oscuro translúcido)
   - Logo + Navegación + Botones (Iniciar Sesión / Regístrate)

2. Hero Section (fondo oscuro con imagen de restaurante)
   - Badge "La plataforma #1 para restaurantes en Perú"
   - Headline: "Tu restaurante en internet, sin complicaciones."
   - Subtítulo descriptivo
   - CTAs: "Ver planes" (sólido) / "Empezar ahora" (outlined)
   - Social proof: avatares + rating + "+120 restaurantes"

3. Demos Reales (fondo claro)
   - Badge púrpura
   - Título + subtítulo
   - Grid de 3 cards con demos de restaurantes

4. Cómo Funciona (fondo oscuro)
   - 4 pasos numerados con iconos
   - Cards oscuras con borde sutil

5. Reseñas Verificadas (fondo claro)
   - Testimonios con estrellas amarillas
   - Cards con foto, nombre y cargo

6. Precios (fondo claro)
   - 3 planes: Básico, Profesional (destacado), Añadidos
   - Plan Profesional con fondo púrpura

7. Footer (fondo oscuro)
   - Logo + Descripción + Redes sociales
   - Links: Plataforma, Soporte
   - Contacto + CTA "Regístrate gratis"
```

---

## Iconografía

Usar **Lucide React** (ya instalado en el proyecto) para todos los iconos.
Estilo: stroke, tamaño consistente (`w-5 h-5` para inline, `w-6 h-6` para cards).
