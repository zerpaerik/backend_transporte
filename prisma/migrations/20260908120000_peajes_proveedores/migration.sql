CREATE TABLE "peajes" (
    "id" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "ejes" INTEGER NOT NULL DEFAULT 0,
    "monto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sedeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "peajes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "peajes_sedeId_idx" ON "peajes"("sedeId");

CREATE TABLE "proveedores" (
    "id" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "ruc" TEXT NOT NULL DEFAULT '',
    "direccion" TEXT NOT NULL DEFAULT '',
    "contacto" TEXT NOT NULL DEFAULT '',
    "telefono" TEXT NOT NULL DEFAULT '',
    "sedeId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "proveedores_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "proveedores_sedeId_idx" ON "proveedores"("sedeId");
