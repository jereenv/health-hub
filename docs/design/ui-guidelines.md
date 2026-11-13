# UI guidelines

The owner supplied these rules on 2026-11-12 and approved the mockups built from them (https://claude.ai/artifact/8uDe8Ymp5q2ZHK6mpSKYVH). Every Health Hub screen follows them. The rules are written in web/Tailwind terms; the app implements the same intent in React Native (for example, `active:scale-[0.98]` becomes a `Pressable` with a Reanimated scale, and `backdrop-blur` becomes `expo-blur`).

## Approved tokens

| Token | Dark | Light | Use |
|---|---|---|---|
| `bg` | `#0A0A0B` | `#FFFFFF` | Base canvas |
| `card` | `#141416` | `#F6F6F8` | Elevated card |
| `raised` | `#1E1E22` | `#FFFFFF` + 1px border | Interactive / sheet surface |
| `line` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.07)` | 1px borders, dividers |
| `ink` | `#F5F5F7` | `#111111` | Primary text |
| `muted` | `#9A9AA2` | `#6B6B73` | Labels, metadata (passes 4.5:1 on `card`) |
| `accent` | `#D2FF52` | `#D2FF52` | Fill for primary actions and active states; text on it uses `on-accent` |
| `on-accent` | `#0A0A0B` | `#111111` | Text/icons on accent |
| `accent-ink` | `#D2FF52` | `#4D6B00` | Accent as a line or text on the canvas |
| `status-low` | `#5A82E6` | `#3A63D8` | Below range |
| `status-ok` | `#14A086` | `#0F8A73` | Healthy range |
| `status-high` | `#BF8228` | `#B8741A` | Above range |

Status colours passed the dataviz palette validator (lightness band, chroma, colour-blind separation, contrast) against `card` in both modes, and always appear with a text label.

**Type:** Geist (UI) and Geist Mono (export preview). Display 28–34px bold with -0.02em tracking; hero numbers 44–64px semibold; body 15–16px; labels 11–13px medium in `muted`. All numbers use tabular figures.

**Shape:** cards radius 20–24px, chips and buttons fully rounded, 1px borders, no drop shadows.

**Navigation:** bottom tab bar (Today, Body, Workouts, Activity, Export) with a pill-shaped accent indicator behind the active icon; primary actions sit just above the tab bar.

---

## Source rules (as supplied by the owner)

### Role and aesthetic goal
Ultra-clean, tactile, modern mobile interfaces that look like top-tier consumer apps (Linear Mobile, Arc Search, Opal, Cash App, Flighty), never like a shrunk desktop website or generic template.

### 1. Layout and ergonomics (the thumb zone)
- **Bottom-heavy navigation:** primary navigation, tab bars and main call-to-action buttons in the bottom 30% of the screen. Keep the top bar minimal (screen title, back chevron, or one utility icon).
- **Safe areas and spacing:** always account for the status bar / notch and the bottom home indicator. Outer screen margins of 16–20px.
- **Touch targets:** every interactive element at least 44×44px, with at least 8px between adjacent tappable items.
- **Mobile viewport in web previews:** a centred mobile frame (max width 430px, full dynamic viewport height, no horizontal overflow).

### 2. Visual hierarchy and surface system
- No generic purple/blue gradients.
- No heavy drop shadows; separate cards with 1px borders or slight surface tone shifts.
- No cluttered 3-column grids or desktop-style tables; use horizontal snap carousels or clean vertical grouped lists.
- Three-tier surfaces: base canvas, elevated card, interactive/modal surface.
- Colour discipline: about 90% neutral surfaces, 8% ink typography, 2% one high-contrast accent reserved for primary actions and active states.

### 3. Typography and micro-copy
- Tight tracking (-0.02em) on large display headers (28–34px, bold); body 15–16px regular; metadata 12–13px medium at about 60% opacity.
- Tabular numbers for all metrics, timers and values so digits never jitter.
- Concise copy: card descriptions limited to 1–2 short lines.

### 4. Native mobile patterns and motion
- Bottom sheets (with a drag handle and backdrop blur) instead of centred pop-up modals.
- Subtle press feedback (scale to 0.98 over 150ms) on cards and primary buttons.
- Skeleton placeholders matching the card geometry instead of spinners.

### Workflow before building any screen
1. Define the three-tier colour tokens and the single accent.
2. Map the thumb-zone layout: top bar → scrollable content → sticky bottom bar / navigation.
3. Build reusable atomic components (for example `MobileHeader`, `StatCard`, `ActionRow`, `BottomSheet`) before assembling the screen.
