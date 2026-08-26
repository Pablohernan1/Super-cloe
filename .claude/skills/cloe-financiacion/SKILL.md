---
name: cloe-financiacion
description: Contexto y plan de trabajo del proyecto Supermercado Cloe (sistema interno de financiación propia: clientes, garantes, límites, préstamos, cobranza, mora/bloqueo, alertas). USAR SIEMPRE que se trabaje en este repo (C:\Proyectos\super-cloe) — antes de tocar el schema SQL en /scripts, el motor de tasas (lib/services/interest-rates.ts), permisos (lib/permissions.ts), o cualquier pantalla de clientes/garantes/créditos/préstamos/cobranza/alertas. También usar cuando el usuario pregunte "en qué quedamos", "seguimos con Cloe", "aplicá la migración", "che dale con el súper", o mencione Vilmer/Supermercado Cloe/financiación propia. Contiene la auditoría completa spec-vs-código, las decisiones de arquitectura ya tomadas (NO preguntar de nuevo) y el checklist de fases para saber qué falta.
---

# Supermercado Cloe — Financiación propia

Sistema interno (cajeros, supervisores, administradores) para otorgar y cobrar
préstamos propios del supermercado en Vilmer, Santiago del Estero. Especificación
funcional completa en
[`Supermercado_Cloe_Financiacion_Propia_Especificacion_Final.pdf`](../../../Supermercado_Cloe_Financiacion_Propia_Especificacion_Final.pdf)
(raíz del repo) — leerlo si hace falta precisar una regla de negocio puntual;
este skill resume lo que ya se auditó para no releerlo entero cada vez.

**No preguntar de nuevo lo que ya está decidido más abajo.** Si algo no está
cubierto acá, ahí sí preguntar al usuario.

## Estado del proyecto (por qué se está reescribiendo)

El código original fue generado con v0/Vercel (Next.js 16 + Supabase) y
quedó con una brecha grande respecto del PDF, más una desincronización interna
grave entre el código y las migraciones SQL versionadas. Detalle completo de la
auditoría al final de este archivo (## Auditoría original). En corto:

- Faltan módulos enteros: **Cobranza** (registrar pago), **Alertas de mora**, y
  el motor de **mora → bloqueo → rehabilitación** (el corazón del spec).
- El schema en `/scripts` (001 a 006) no coincide con lo que el código
  consulta: falta la tabla `guarantor_relations`, `credit_limits` tiene
  columnas distintas en el SQL vs en `lib/types.ts`, `customers.status` convive
  sin reconciliar con `customers.is_active`, `payments` no tiene `received_at`
  que el dashboard usa, y hay dos formas distintas de `audit_logs`.
- El motor de tasas (`lib/services/interest-rates.ts`) implementa un producto
  financiero distinto al pedido (tasas por mes 1-36 con interpolación) en vez
  de la tasa directa fija del spec (1 cuota 15%, 2 cuotas 25%, 3 cuotas 30%).
- Los permisos de cajero (`lib/permissions.ts`) son más restrictivos que el
  spec: bloquean `create`/`update` global, por lo que un cajero no podría ni
  registrar un pago aunque existiera la función.

## Decisiones de arquitectura ya tomadas con el usuario

No volver a plantear estas preguntas — están resueltas:

1. **No reescribir todo de cero.** Se reusa la UI (Tailwind + shadcn/Radix,
   paleta roja/blanca ya correcta en `app/globals.css`, componentes en
   `components/ui/`) y Supabase Auth (roles `cajero`/`supervisor`/`administrador`
   en `profiles`).
2. **Sí rehacer de cero la base de datos.** Una migración SQL consolidada
   nueva reemplaza el historial roto `001`-`006`. Confirmado con el usuario:
   **no hay datos reales de producción todavía**, así que no hace falta
   preservar filas existentes — se puede recrear tablas libremente.
3. **Pivot de frontend: de Next.js/Vercel (web) a app de escritorio con
   Electron**, reusando el máximo posible de los componentes React/Tailwind/
   shadcn ya construidos, consumiendo Supabase directamente (sin las API
   routes de Next.js como intermediario).
   - Consecuencia importante: las reglas de negocio críticas (tasa aplicada,
     disponible = aprobado − comprometido, bloqueo por mora, rehabilitación,
     máximo de garantes) **deben vivir en Postgres** (funciones + RLS +
     triggers), no solo en el cliente — un desktop no es un backend confiable,
     cualquiera podría leer la service key del binario o inspeccionar tráfico.
   - Esto además cumple el requisito del spec (sección 11): "las validaciones
     deben ejecutarse tanto en pantalla como en backend".
4. **Vercel/web queda para más adelante**, solo si se necesita una pantalla
   liviana de consulta para el cliente final (fuera del alcance original del
   spec, que es 100% interno — "no al cliente final"). No arrancar esto sin
   que el usuario lo pida explícitamente.
5. **Stack de escritorio elegido: Electron** (no Tauri, no .NET/WPF) —
   justamente para maximizar reuso de la UI React/Tailwind/shadcn existente.

## Plan de fases

Marcar cada fase como hecha en este mismo archivo a medida que se completa
(editar el checklist), para que la próxima sesión no repita trabajo.

- [ ] **Fase 0 — Higiene previa.** Falta `git init` (el repo no tiene control
      de versiones) y falta `.env.local` con las credenciales de Supabase
      (URL + service role key) — **pedidas al usuario, pendientes de recibir**.
      No commitear `.env.local` (ya está en `.gitignore`).
- [ ] **Fase 1 — Migración de base consolidada.** Una única migración SQL
      nueva (ej. `scripts/007_consolidated_schema.sql` o reemplazar todo
      `/scripts` por un solo archivo fuente de verdad) que reconcilie:
      `credit_limits` (approved_limit/committed_limit/available_credit/status/
      guarantors_required/guarantors_active_count/eligible_for_extension),
      tabla `guarantor_relations` (titular_customer_id/guarantor_customer_id/
      status) con tope de 2 garantes activos por titular reforzado en DB,
      `customers.status` como único campo de estado (eliminar la ambigüedad
      con `is_active`, incluir 'active'/'inactive'/'blocked'/'suspended'),
      `payments.received_at`, `audit_logs` con un solo shape
      (`table_name`/`record_id`, consistente con `lib/audit-logger.ts`), y
      agregar lo que falta para mora/bloqueo (días de atraso por cuota,
      trigger o función que bloquee titular + garantes cuando corresponda) y
      para parámetros (`parameters` ya existe — sembrar ahí tasas 15/25/30%,
      días de gracia, pago mínimo de rehabilitación, máximo de préstamos
      vigentes/garantizados, topes por perfil — spec sección 12).
- [ ] **Fase 2 — Motor de tasas.** Reescribir `lib/services/interest-rates.ts`
      (o su equivalente en Postgres) para tasa directa fija 1/2/3 cuotas
      (15%/25%/30%), parametrizable desde la tabla `parameters`, sin
      interpolación ni plazos > máximo configurable (default 3).
- [ ] **Fase 3 — Permisos.** Corregir `lib/permissions.ts` para que el cajero
      pueda simular préstamo y registrar pago (no solo lectura), preservando
      que confirmar préstamo / aprobar límites altos quede restringido a
      supervisor+ (spec sección 4).
- [ ] **Fase 4 — Módulos faltantes.** Construir Cobranza (registrar pago,
      aplicar a cuota/interés de mora, pantalla G del PDF), Alertas de mora
      (pantalla H), y el flujo de rehabilitación (pago mínimo parametrizable,
      desbloqueo de titular + garantes, auditado).
- [ ] **Fase 5 — Migración a Electron.** Envolver/adaptar la UI existente
      (probablemente convertir de Server Components de Next.js a un SPA React
      que consuma Supabase-js directo) en un shell Electron. Hacer esto
      *después* de que las fases 1-4 estén validadas contra la app Next.js
      actual, para no depurar lógica de negocio y migración de runtime al
      mismo tiempo.

## Cómo verificar qué falta (antes de asumir y repetir trabajo)

- **¿Existe ya `.env.local`?** Si existe, las credenciales de Supabase ya
  están — no volver a pedirlas.
- **¿Existe una migración consolidada?** `ls scripts/` — si aparece algo tipo
  `007_consolidated_schema.sql` (o el schema roto `001`-`006` fue reemplazado
  por un único archivo), la Fase 1 puede estar hecha; confirmar igual contra
  la base real (con las credenciales, correr
  `select table_name, column_name from information_schema.columns where table_schema='public' order by 1,2;`
  y comparar contra `lib/types.ts`) porque el archivo local no prueba que se
  haya aplicado.
- **¿El motor de tasas ya da 15/25/30%?** `grep -n "0.15\|0.25\|0.30" lib/services/interest-rates.ts`
  (o donde haya quedado tras la Fase 2).
- **¿Cajero puede crear?** Revisar `lib/permissions.ts` — si `cajero.create`
  sigue en `false`, la Fase 3 no está hecha.
- **¿Existen las rutas de cobranza/alertas?** `ls app/\(dashboard\)/cobranza app/\(dashboard\)/alertas`
  — si no existen, Fase 4 pendiente.
- **¿Hay carpeta de Electron?** Buscar `electron/` o `package.json` con
  dependencia `electron` — si no está, Fase 5 no arrancó.

## Próximo paso concreto (al momento de escribir este skill)

Esperando que el usuario cree `C:\Proyectos\super-cloe\.env.local` con
`NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (no pegar esas
credenciales en el chat). Una vez confirmado que el archivo existe:
1. Inicializar git (`git init` + commit inicial) si todavía no está — no hay
   red de seguridad de versionado en este repo.
2. Inspeccionar el schema real de Supabase (no confiar en `/scripts`, ya
   demostraron estar desactualizados) antes de escribir la migración
   consolidada de la Fase 1.

## Auditoría original (spec vs código, referencia detallada)

Hallazgos verificados línea por línea, para no tener que re-auditar desde
cero si hace falta el detalle exacto de un archivo:

- **Cobranza/Alertas inexistentes**: sin rutas `/cobranza` ni `/alertas`, sin
  ítem de menú en `components/layout/app-shell.tsx`, cero inserts a la tabla
  `payments` en todo el repo (`grep -r "from('payments').insert"` no matchea
  nada), sin botón "Registrar pago" en `app/(dashboard)/prestamos/[id]/page.tsx`.
- **Bloqueo por mora no implementado**: `customers.status` incluye
  `'blocked'`/`'defaulted'` (agregado en `scripts/004-update-customers-table.sql`)
  y se lee en `app/(dashboard)/clientes/page.tsx` para contar bloqueados, pero
  nada en el repo escribe ese valor — no hay cron, trigger ni endpoint que
  calcule días de atraso y bloquee. `docs/ESTADOS_SISTEMA.md` lo describe como
  intención de diseño, no como algo implementado.
- **Schema desincronizado**:
  - `credit_limits`: script 001 crea `max_amount`/`available_amount`; todo el
    código (`lib/credit-service.ts`, `lib/services/loan-validator.ts`,
    `lib/types.ts`) usa `approved_limit`/`committed_limit`/`available_credit`/
    `status`/`guarantors_required`/`guarantors_active_count`/
    `eligible_for_extension` — columnas que no existen en ningún script SQL
    del repo.
  - `guarantor_relations` (titular_customer_id/guarantor_customer_id/status):
    usada en `lib/services/loan-validator.ts:92`, `lib/credit-service.ts:175`,
    `app/api/guarantors/route.ts` — no está creada en ningún script SQL. Solo
    existe la tabla vieja `guarantors` (texto libre, sin FK a `customers`).
  - `customers.status` (texto, incluye blocked/defaulted) convive sin
    reconciliar con `customers.is_active` (boolean) — ambos se leen en
    distintos archivos.
  - `payments.received_at`: usado en `app/(dashboard)/dashboard/page.tsx`
    para "Cobranzas Hoy/Mes"; la tabla solo tiene `created_at`.
  - `audit_logs`: script 001 define `entity_type`/`entity_id`; script 004
    define `table_name`/`record_id`; `lib/audit-logger.ts` y `lib/types.ts`
    usan la segunda forma.
  - Falta el script `002` en la secuencia (`001` → `003`) — indicio de
    parches manuales por fuera del control de versiones.
- **Motor de tasas** (`lib/services/interest-rates.ts:22`): tasas por mes
  1/2/3/6/12/24/36 → 2.5%/4.5%/6.5%/9%/12%/14%/15%, con interpolación lineal
  para plazos intermedios; `loan-validator.ts:86` acepta 1 a 60 meses. El
  spec pide tasa directa fija solo para 1/2/3 cuotas (15%/25%/30%), sin
  interpolación, parametrizable, máximo de cuotas configurable (default 3).
  Este desvío está incluso documentado como si fuera el requisito correcto en
  `LOANS_TESTING.md`.
- **Garantes — modelo mixto**: `app/api/guarantors/route.ts` sí modela
  correctamente "garante = otro cliente activo del súper" (coincide con el
  spec), pero `loans.guarantor_id` es una FK única y opcional — la estructura
  no puede representar "1 o 2 garantes obligatorios por préstamo" (spec 8.2).
  No hay tope de "máximo de préstamos garantizados por garante" en ningún
  lado.
- **Permisos** (`lib/permissions.ts:23`): cajero tiene `create: false` y
  `update: false` globales — no podría registrar pago ni simular con create
  aunque existiera la función. Supervisor tiene `update`/`approve` amplios sin
  restricción específica sobre parámetros estructurales (aunque la RLS de
  `parameters` en script 001 sí restringe UPDATE a administrador).
- **Sin pantalla de Parámetros**: la tabla `parameters` existe y
  `interest-rates.ts` la consulta como fuente de verdad antes de caer a
  defaults, pero no hay ninguna UI para que un administrador la edite. De los
  8 parámetros de la sección 12 del spec, solo la tasa tiene soporte parcial.
- **Dashboard no es la pantalla pedida**: el spec pide una "búsqueda rápida
  por CUIT/CUIL" como primera vista del cajero (Pantalla B) con resumen
  instantáneo. `app/(dashboard)/dashboard/page.tsx` es un dashboard de KPIs
  genéricos; existe `app/api/clientes/search/route.ts` pero se usa para el
  autocomplete del simulador de préstamos, no como esa pantalla.
- **Lo que sí está bien**: paleta de colores en `app/globals.css` coincide casi
  exactamente con los valores sugeridos del PDF (#B71C1C, #D32F2F, #FFEBEE,
  etc.); layout backoffice (sidebar + topbar) sigue el criterio pedido;
  `createAuditLog()` en `lib/audit-logger.ts` funciona y se usa en créditos y
  garantes.
