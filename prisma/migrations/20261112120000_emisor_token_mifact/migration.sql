-- Token de producción de MiFact por empresa emisora (cada RUC tiene el suyo).
ALTER TABLE "emisor_config" ADD COLUMN IF NOT EXISTS "mifactToken" TEXT NOT NULL DEFAULT '';
