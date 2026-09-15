-- Código de motivo de la nota de crédito/débito (catálogo 09/10 SUNAT)
ALTER TABLE "facturas" ADD COLUMN "codTipNc" TEXT NOT NULL DEFAULT '';
