-- Formato de impresión del PDF en MiFact (COD_FORM_IMPR), configurable por emisor
ALTER TABLE "emisor_config"
  ADD COLUMN "formatoImpresion" TEXT NOT NULL DEFAULT '001';
