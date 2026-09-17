-- Serie propia para las notas de débito del emisor (referidas a factura).
ALTER TABLE "emisor_config" ADD COLUMN IF NOT EXISTS "serieNotaDebito" TEXT NOT NULL DEFAULT 'FD01';
