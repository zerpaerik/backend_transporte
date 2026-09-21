-- Umbral de detracción para transporte de carga = S/ 400 (antes 700, que es el general)
ALTER TABLE "emisor_config" ALTER COLUMN "umbralDetraccion" SET DEFAULT 400;
UPDATE "emisor_config" SET "umbralDetraccion" = 400 WHERE "umbralDetraccion" = 700;
