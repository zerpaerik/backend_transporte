-- Facturación electrónica (MiFact / SUNAT) — todo aditivo, sin reescribir tablas.

-- 1) Campos de comprobante electrónico en "facturas"
ALTER TABLE "facturas"
  ADD COLUMN "tipoDocCodigo" TEXT NOT NULL DEFAULT '01',
  ADD COLUMN "correlativo" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "moneda" TEXT NOT NULL DEFAULT 'PEN',
  ADD COLUMN "tipoCambio" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "gravado" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "exonerado" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "inafecto" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "sujetoDetraccion" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "porcDetraccion" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "montoDetraccion" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "codDetraccion" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "ctaDetraccion" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "estadoDocumento" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "sunatDescripcion" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "sunatResponsecode" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "hash" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "qr" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "ticket" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "emitidoEn" TIMESTAMP(3),
  ADD COLUMN "xml" TEXT,
  ADD COLUMN "cdr" TEXT,
  ADD COLUMN "docRefTipo" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "docRefSerie" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "docRefCorrelativo" TEXT NOT NULL DEFAULT '';

-- Índice único SOLO para comprobantes electrónicos ya numerados (correlativo distinto de '').
-- Es parcial para no colisionar con las facturas manuales existentes (correlativo vacío).
CREATE UNIQUE INDEX "facturas_emitidas_unicas"
  ON "facturas" ("sedeId", "tipoDocCodigo", "serie", "correlativo")
  WHERE "correlativo" <> '';

-- 2) Datos del emisor por sede (editable desde el portal; sin token/ambiente)
CREATE TABLE "emisor_config" (
    "id" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "ruc" TEXT NOT NULL DEFAULT '',
    "razonSocial" TEXT NOT NULL DEFAULT '',
    "nombreComercial" TEXT NOT NULL DEFAULT '',
    "ubigeo" TEXT NOT NULL DEFAULT '',
    "direccionFiscal" TEXT NOT NULL DEFAULT '',
    "codAnexo" TEXT NOT NULL DEFAULT '0000',
    "serieFactura" TEXT NOT NULL DEFAULT 'FN01',
    "serieBoleta" TEXT NOT NULL DEFAULT 'BN01',
    "serieNotaCredito" TEXT NOT NULL DEFAULT 'FN01',
    "puntoVenta" TEXT NOT NULL DEFAULT '',
    "ctaDetraccion" TEXT NOT NULL DEFAULT '',
    "porcDetraccion" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "codDetraccion" TEXT NOT NULL DEFAULT '027',
    "umbralDetraccion" DOUBLE PRECISION NOT NULL DEFAULT 700,
    "correoEnvio" TEXT NOT NULL DEFAULT '',
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "emisor_config_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "emisor_config_sedeId_key" ON "emisor_config"("sedeId");

-- 3) Correlativos por (sede, tipo, serie), controlados por el sistema
CREATE TABLE "correlativos" (
    "id" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "tipoDoc" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "siguiente" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "correlativos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "correlativos_sedeId_tipoDoc_serie_key" ON "correlativos"("sedeId", "tipoDoc", "serie");
