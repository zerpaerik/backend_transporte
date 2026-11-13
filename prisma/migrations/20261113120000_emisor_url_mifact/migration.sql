-- URL de producción de MiFact por empresa (vacía = la del servidor).
ALTER TABLE "emisor_config" ADD COLUMN IF NOT EXISTS "mifactUrlProd" TEXT NOT NULL DEFAULT '';
