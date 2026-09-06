# Historial F5/F6/F8 y transición 018

Estos 18 archivos conservan exactamente el SQL aprobado hasta `c89ed9c0220cfbb088b55138279e4ba14eb54e29`, normalizado a LF para verificar SHA-256. `manifest.json` identifica cada fuente. No editar, reordenar ni ejecutar este directorio sobre una instalación nueva.

Supabase CLI solo aplica automáticamente `supabase/migrations/`. Allí se encuentra la instalación inicial 019, generada desde estas fuentes con las omisiones explícitas de `scripts/baseline-model.mjs`: creación/comentario de la FK compuesta en 014 y retirada/backfill/bloqueo de esa FK en 018, innecesarios sobre una base vacía. Los cuerpos de autorización, grants, RLS, integridad y RPC se conservan.

Una base que ya tenga F8/17 debe aplicar **018 desde este archivo histórico**, comprobar equivalencia con 019 y recién después reconciliar el registro mediante `migration repair`. No ejecutar 019 directamente sobre ella: su guard lo rechaza. El procedimiento y la prueba de adopción están en [INITIAL_BASELINE.md](../../docs/checkpoints/INITIAL_BASELINE.md).

Las futuras migraciones se añaden después de 019 en el directorio activo. Este archivo histórico y la baseline quedan congelados; `npm run db:baseline:check` comprueba su correspondencia reproducible.
