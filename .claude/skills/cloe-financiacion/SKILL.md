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

- [x] **Fase 0 — Higiene previa.** `git init` hecho, commit inicial creado
      (156 archivos). `.env.local` creado con `NEXT_PUBLIC_SUPABASE_URL`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` —
      proyecto Supabase ref `kttplwfjyizsfwhxmztc`, conexión verificada
      (200 OK contra `customers`). `.env.local` confirmado fuera de git.
- [x] **Fase 1 — Migración de base consolidada.** `scripts/007_consolidated_schema.sql`,
      aplicada contra la base real (ver "Cómo se aplicó" abajo). `credit_limits`
      reconciliada (approved_limit/committed_limit/available_credit generada/
      status/guarantors_required/guarantors_active_count/eligible_for_extension),
      `guarantor_relations` formalizada con tope de 2 garantes activos por
      titular y máximo de titulares por garante reforzados con trigger
      (`enforce_guarantor_limits`), `customers.status` como único campo de
      estado (`is_active` eliminado, enum `active/inactive/blocked/suspended`),
      tabla vieja `guarantors` (texto libre) borrada, `loans.guarantor_id`
      reemplazado por tabla `loan_guarantors` (1 o 2 garantes por préstamo),
      `payments.received_at` + `applied_penalty`, `audit_logs` con
      `table_name`/`record_id`. Parámetros de Cloe sembrados (tasas 15/25/30%,
      `mora_grace_period_days`, `mora_daily_penalty_rate_pct`,
      `rehabilitation_mode`, máximos de garantes/préstamos, topes de límite
      sugeridos). Motor de mora/bloqueo/rehabilitación como funciones Postgres
      `SECURITY DEFINER`: `create_loan` (creación atómica con validaciones
      críticas server-side), `refresh_mora_and_blocks`, `register_payment`,
      `rehabilitate_customer`. RLS reescrita por tabla acorde a los roles.
      **Probado end-to-end contra la base real** (crear préstamo → forzar
      mora → verificar bloqueo titular+garante → pagar → rehabilitar →
      verificar desbloqueo) — limpiado después, sin dejar datos de prueba.
- [x] **Fase 2 — Motor de tasas.** `lib/services/interest-rates.ts` reescrito:
      tasa directa fija leída de `parameters` (`interest_rate_1_installment`
      /`_2_installments`/`_3_installments`), sin interpolación. `max_installments`
      parametrizable. La fuente de verdad real es la función `create_loan` en
      la DB (recalcula todo server-side); el service de Next.js es preview
      para la UI antes de confirmar.
- [x] **Fase 3 — Permisos.** `lib/permissions.ts`: cajero ahora tiene
      `create`/`update: true` (alta de cliente/garantes, registrar pago),
      sigue con `approve: false`. Confirmar préstamo (RLS + check explícito
      en `/api/prestamos`) y aprobar/rechazar límites (`canApprove` en
      `/api/credit-limits`) quedan restringidos a supervisor+.
- [x] **Fase 4 — Módulos faltantes.** Cobranza (`/cobranza`,
      `app/api/cobranza/route.ts` → `register_payment`/`rehabilitate_customer`)
      y Alertas de mora (`/alertas`, `app/api/alertas/route.ts` →
      `refresh_mora_and_blocks` + listado con filtro bloqueados). Menú lateral
      (`app-shell.tsx`) actualizado a la navegación del spec (Inicio/Clientes/
      Créditos/Garantes/Préstamos/Cobranza/Alertas). Botón "Registrar pago" en
      el detalle de préstamo. Barrido de código: reemplazado todo uso de
      `customers.is_active` / columnas viejas de `credit_limits` /
      `loans.guarantor_id` que hubiera quedado colgado en `app/` y `lib/`.
      **Pendiente, no bloqueante:** pantalla de administración de Parámetros
      (sección 12 del spec) — hoy solo se editan por SQL/dashboard de Supabase,
      no hay UI. "Topes por perfil" (monto máximo que cajero/supervisor puede
      simular/aprobar) no se implementó — el resto de los topes del spec 12 sí.
- [~] **Fase 5 — Migración a Electron.** Carpeta nueva `desktop/` (Vite +
      React + react-router + Electron + electron-builder), **no** dentro de
      `app/` de Next.js — son dos proyectos npm separados con su propio
      `package.json`. Ya portados y verificados (`tsc -b` sin errores,
      `npm run build` de Vite genera `dist/` correctamente):
      login, dashboard, clientes (list/detail/nuevo/editar/form),
      garantes (list/nuevo), créditos (list/detail/nuevo/acciones
      aprobar-rechazar), préstamos (list/detail/simulación con creación vía
      RPC `create_loan`), cobranza, alertas. Todas las llamadas a
      `/api/*` de Next.js se reemplazaron por `supabase-js` directo
      (`.from()...` o `.rpc(...)`) — no hay capa de API intermedia, tal como
      exige la decisión de arquitectura #3.
      - `desktop/src/lib/supabase.ts`: cliente browser con sesión en
        localStorage (sin cookies, sin middleware -- el guard de rutas es
        `desktop/src/components/layout/protected-route.tsx`).
      - `desktop/electron/main.cjs` + `preload.cjs`: shell Electron mínimo,
        cargan `dist/index.html` en producción o el dev server de Vite
        (`ELECTRON_START_URL`) en desarrollo. `HashRouter` (no
        `BrowserRouter`) porque Electron sirve desde `file://`.
      - `desktop/.env` tiene `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
        (gitignored) -- mismas credenciales que `.env.local` de la raíz.
      - Se podaron de `components/ui/` los componentes no usados que no
        compilaban sin instalar sus dependencias (calendar, carousel, chart,
        toast/toaster/use-toast viejo, form, input-otp, resizable, sidebar) --
        si hace falta alguno más adelante, copiarlo de nuevo desde
        `components/ui/` en la raíz e instalar su dependencia.
      - **BLOQUEADO, no por código: no se pudo descargar el binario de
        Electron en esta sesión.** Ver sección "Bloqueo de red" más abajo.
        Todo lo demás (scaffold, código, type-check, build de Vite) está
        listo — falta únicamente correr `npm install` dentro de `desktop/`
        desde una red sin la inspección SSL que describe esa sección para
        que se complete la descarga del binario, y después
        `npm run electron:dev` ya funciona (incluso en esta red, una vez
        cacheado el binario localmente).

## Bloqueo de red: descarga del binario de Electron (2026-08-26)

`npm install` dentro de `desktop/` instala todas las dependencias JS sin
problema (usan `registry.npmjs.org`, que esta red permite), pero el
postinstall de `electron` descarga un binario nativo desde
`objects.githubusercontent.com`, y ahí falla con
`unable to verify the first certificate`. Diagnóstico confirmado con
`openssl s_client`: hay un **firewall Fortinet haciendo inspección SSL**
(`issuer=... O=Fortinet ... CN=FGT80FTK21045050`) en esta red/máquina, y su
CA no está instalada en ningún almacén de certificados de Windows
(`Cert:\*\Root`, revisado con PowerShell) — ni siquiera Windows lo
confía, y encima genera un certificado autofirmado *distinto e
inconsistente* por conexión (capturé uno para
`objects.githubusercontent.com` con CN `*.github.io`, que probé
manualmente con `curl --cacert` y funcionó una vez, pero `npm install`
vuelve a fallar porque cada intento nuevo negocia un certificado distinto
que no coincide). No es un problema de código ni de configuración del
proyecto — es la política de red de esta máquina/red específica.

**Cómo destrabarlo (para la próxima sesión o para el usuario):**
1. Más simple: correr `npm install` dentro de `desktop/` desde otra red sin
   esa inspección SSL (wifi de casa, datos móviles). Es un paso único --
   una vez que el binario de Electron queda cacheado en
   `desktop/node_modules/electron`, `npm run electron:dev` funciona
   después incluso en esta red (solo necesita salir a Supabase, no a
   GitHub).
2. Si hay que hacerlo en esta red sí o sí: pedirle a IT que permita
   `objects.githubusercontent.com` y `github.com` sin inspección SSL (o que
   instale la CA del Fortinet en el almacén de certificados de Windows para
   que Node la herede vía `--use-system-ca`).
3. Si nada de eso es posible: bajar el zip de Electron manualmes desde un
   navegador (que sí suele tener la CA correcta instalada) y colocarlo donde
   `@electron/get` lo busca en caché
   (`%LOCALAPPDATA%\electron\Cache`), o usar `ELECTRON_MIRROR` apuntando a
   un mirror ya confiable en esta red.
No perder tiempo re-intentando `npm install electron` en esta misma red sin
resolver el certificado primero — ya se probó varias veces con distintas
variantes (`--use-system-ca`, `NODE_EXTRA_CA_CERTS` con el cert capturado)
y el resultado es el mismo.

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

## Bugs encontrados probando con usuarios reales por rol (y arreglados)

Después de aplicar la Fase 1, se probó con JWT reales (no `service_role`,
que bypassea RLS y no sirve para validar esto) de los 3 perfiles seed
(`cajero@cloe.com`, `supervisor@cloe.com`, `admin@cloe.com` -- password
reseteada a `TestCloe2026!` para poder probar, son cuentas de test/seed sin
datos reales). Se encontraron y corrigieron dos bugs reales, no hipotéticos:

1. **`create_loan` y `rehabilitate_customer` no validaban el rol del que
   llama** -- solo lo hacía el route handler de Next.js. Un cajero podía
   invocar el RPC directo contra Supabase (sin pasar por la app) y confirmar
   un préstamo o rehabilitar una cuenta, algo reservado a supervisor+. Esto
   es crítico para el plan de app de escritorio (decisión de arquitectura
   #3): Electron va a hablar directo con Supabase, sin la capa de Next.js
   como filtro. Fix en `scripts/008_secure_rpc_functions.sql`: las funciones
   ahora usan `auth.uid()` (identidad real de la sesión) en vez de un
   parámetro `p_user_id` que el cliente podía falsificar, y `create_loan`/
   `rehabilitate_customer` chequean el rol contra `profiles` antes de hacer
   nada. Verificado: cajero bloqueado (400), supervisor puede.
2. **Recursión infinita en RLS**: toda policy que hacía
   `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN (...))`
   disparaba la propia RLS de `profiles` al evaluar la subconsulta -> error
   500 "infinite recursion detected in policy for relation profiles".
   Afectaba TODAS las policies de supervisor/admin (`loans`, `credit_limits`,
   `loan_guarantors`, `parameters`, `audit_logs`) y las de `profiles` mismas
   -- es decir, un supervisor real no podía confirmar un préstamo antes de
   este fix. Corregido en `scripts/009_fix_rls_recursion.sql` con el patrón
   estándar: función `current_user_role()` `SECURITY DEFINER` que lee el rol
   sin re-disparar RLS, usada en vez de la subconsulta inline. Verificado con
   los 3 roles: cajero bloqueado (403) al intentar INSERT directo en `loans`
   o UPDATE en `credit_limits`, supervisor puede confirmar préstamo real de
   punta a punta.

**Importante para la próxima sesión**: `scripts/007_consolidated_schema.sql`
tal como está (sin 008 y 009 aplicados encima) **tiene estos dos bugs**. Si
en algún momento se recrea la base desde cero, hay que aplicar los tres
archivos en orden (007 → 008 → 009), no solo 007.

## Próximo paso concreto (actualizado 2026-08-26, fases 0-4 completas)

Fases 0-4 del plan ya están hechas y verificadas contra la base real (ver
checklist arriba). Lo que sigue, en orden de prioridad:

1. **Probar la app corriendo de verdad** (`npm run dev` o `pnpm dev` — el
   repo usa `pnpm-lock.yaml` pero pnpm no está instalado en esta máquina, se
   usó `npm install` puntualmente para poder correr `tsc --noEmit`; no se
   corrió el dev server todavía). Flujo a validar manualmente: alta de
   cliente → alta de garante → crear límite → aprobarlo (supervisor) →
   simular/confirmar préstamo → forzar mora → ver alertas → registrar pago →
   rehabilitar.
2. **Pantalla de Parámetros** (admin, spec sección 12) — hoy no existe, los
   parámetros solo se tocan por SQL/dashboard de Supabase.
3. Recién después de validar 1-4 en la app Next.js: **Fase 5, migración a
   Electron** (no arrancar antes, ver decisión de arquitectura #3 arriba).

### Cómo se aplicó la migración (para la próxima vez que haga falta)

La REST API de PostgREST no permite DDL. Se usó una conexión directa a
Postgres vía el **connection pooler** de Supabase (la conexión directa
`db.<ref>.supabase.co` es IPv6-only y esta red no tiene salida IPv6):

```
SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@aws-<n>-<region>.pooler.supabase.com:5432/postgres
```

en `.env.local` (nunca commiteado). La `supabase db query -f archivo.sql` de
la CLI **no sirve** para scripts con múltiples sentencias/funciones `$$...$$`
(error "cannot insert multiple commands into a prepared statement"). Se
resolvió con un script Node chico usando el driver `pg` (protocolo simple,
sí soporta multi-statement) — ver
`C:\Users\...\scratchpad\run_migration.js` de esa sesión como referencia, o
recrear: `new Client({connectionString}).query(fs.readFileSync(archivo, 'utf8'))`.
`supabase db push` no sirvió porque la base ya tenía una historia de
migraciones previa (`supabase_migrations.schema_migrations`) sin los
archivos locales correspondientes.

## Auditoría de la base real (Supabase, verificada 2026-08-26)

Inspeccionada vía el endpoint OpenAPI de PostgREST (`GET /rest/v1/` con la
`service_role` key) + conteos/samples por tabla. Conclusión: **la base real
no coincide ni con `/scripts` ni con `lib/types.ts`** — es una tercera
variante. Solo hay datos de prueba (marzo 2026, 3 clientes) — confirmado que
no hay nada real que preservar, se puede recrear el schema libremente.

- **Tablas existentes**: `alerts`, `audit_logs`, `credit_limits`,
  `customers`, `guarantor_relations`, `guarantors`, `installments`, `loans`,
  `parameters`, `payments`, `profiles`.
- **`guarantor_relations` YA EXISTE** en la base (creada a mano, fuera de los
  scripts) con `titular_customer_id`/`guarantor_customer_id`/`status`/
  `observations` — 1 fila de prueba. La auditoría de código original asumía
  que faltaba crearla; no es así, solo falta que el script consolidado la
  documente.
- **`credit_limits` real ≠ scripts ≠ código** (tercera variante): columnas
  reales son `credit_limit`, `available_credit`, `last_evaluation_date`,
  `next_evaluation_date`, `evaluation_notes`, `approved_by` — no tiene
  `approved_limit`/`committed_limit`/`status`/`guarantors_required`/
  `guarantors_active_count`/`eligible_for_extension` que
  `lib/credit-service.ts` y `lib/types.ts` esperan. El código actual
  probablemente falla contra esta base (columnas inexistentes).
- **`alerts` ya existe como tabla** (0 filas): `alert_type` enum
  (overdue/limit_exceeded/document_expired/system), `priority` enum
  (low/medium/high/critical), `title`/`message`/`reference_id`/
  `reference_type`/`is_read`/`read_at`/`read_by`/`assigned_to`. La
  infraestructura de datos está lista; falta el motor que la puebla y la UI
  (`app/(dashboard)/alertas` no existe).
- **`guarantors` (tabla vieja de texto libre)** existe pero está vacía (0
  filas) — confirmado que es resabio sin uso real; la relación de garantes
  vive en `guarantor_relations`. `loans.guarantor_id` sigue siendo FK única
  y opcional a esta tabla vieja (no a `guarantor_relations`).
- **`parameters`** tiene 8 filas sembradas del scaffold genérico original
  (`default_interest_rate=2.5`, `max_loan_term_months=12`,
  `overdue_penalty_rate=0.5`, `grace_period_days=3`,
  `min_loan_amount`/`max_loan_amount`, `max_failed_logins`,
  `session_timeout_minutes`) — ninguna es específica de Cloe (faltan tasas
  15/25/30% por 1/2/3 cuotas, pago mínimo de rehabilitación, máximo de
  garantes por titular/por garante).
- **`customers.status`** (varchar libre, no enum) y **`customers.is_active`**
  (boolean) conviven — los 3 registros de prueba tienen ambos en
  `'active'`/`true`, no hay evidencia todavía de qué valores usa `status`
  para bloqueado/mora.
- **Enums reales confirmados**: `user_role`
  (cajero/supervisor/administrador), `account_status`
  (active/blocked/pending_password_change), `payment_method`
  (cash/debit/transfer/discount), `audit_action`
  (create/update/delete/login/logout/approve/reject), `loan_status`
  (pending/approved/rejected/active/completed/defaulted/cancelled),
  `installment_status` (pending/paid/partial/overdue/cancelled).
- **Conteos** (todo dato de prueba, nada de producción):
  customers=3, guarantors=0, guarantor_relations=1, credit_limits=3,
  loans=0, installments=0, payments=0, alerts=0, audit_logs=0,
  parameters=8, profiles=5.
- **Proyecto Supabase**: ref `kttplwfjyizsfwhxmztc`
  (`https://kttplwfjyizsfwhxmztc.supabase.co`), credenciales en
  `.env.local` (gitignored, confirmado fuera del commit inicial).

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
