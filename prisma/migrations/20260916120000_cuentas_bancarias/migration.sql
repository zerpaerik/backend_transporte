-- Cuentas bancarias por sede (para que salgan en los comprobantes y el cliente pague).
CREATE TABLE "cuentas_bancarias" (
    "id" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "banco" TEXT NOT NULL DEFAULT '',
    "moneda" TEXT NOT NULL DEFAULT 'Soles',
    "numero" TEXT NOT NULL DEFAULT '',
    "cci" TEXT NOT NULL DEFAULT '',
    "tipo" TEXT NOT NULL DEFAULT 'Corriente',
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cuentas_bancarias_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cuentas_bancarias_sedeId_idx" ON "cuentas_bancarias"("sedeId");

-- Semilla: cuentas BCP de MGR Servicios Integrados (si la sede existe).
INSERT INTO "cuentas_bancarias" ("id", "sedeId", "banco", "moneda", "numero", "cci", "tipo", "orden", "updatedAt")
SELECT gen_random_uuid(), s."id", 'Banco de Crédito del Perú', 'Soles', '1917384797006', '00219100738479700655', 'Corriente', 0, CURRENT_TIMESTAMP
FROM "sedes" s WHERE s."codigo" = 'mgrsi';

INSERT INTO "cuentas_bancarias" ("id", "sedeId", "banco", "moneda", "numero", "cci", "tipo", "orden", "updatedAt")
SELECT gen_random_uuid(), s."id", 'Banco de Crédito del Perú', 'Dólares', '1918023038196', '00219100802303819656', 'Corriente', 1, CURRENT_TIMESTAMP
FROM "sedes" s WHERE s."codigo" = 'mgrsi';

-- Cuenta de detracción de MGR Servicios Integrados (solo si aún está vacía; no pisa lo cargado).
UPDATE "emisor_config" ec SET "ctaDetraccion" = '00091153130'
FROM "sedes" s
WHERE ec."sedeId" = s."id" AND s."codigo" = 'mgrsi' AND (ec."ctaDetraccion" IS NULL OR ec."ctaDetraccion" = '');
