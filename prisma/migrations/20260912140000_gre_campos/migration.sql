-- Campos base para la Guía de Remisión electrónica del transportista (GRE) — aditivo.
ALTER TABLE "conductores" ADD COLUMN "dni" TEXT NOT NULL DEFAULT '';
ALTER TABLE "vehiculos" ADD COLUMN "constanciaTuc" TEXT NOT NULL DEFAULT '';
ALTER TABLE "emisor_config" ADD COLUMN "serieGuiaTransportista" TEXT NOT NULL DEFAULT 'V001';
ALTER TABLE "emisor_config" ADD COLUMN "registroMtc" TEXT NOT NULL DEFAULT '';
