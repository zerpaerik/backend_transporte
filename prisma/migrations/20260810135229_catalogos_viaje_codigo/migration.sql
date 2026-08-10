-- AlterTable
ALTER TABLE "viajes" ADD COLUMN     "clienteRuc" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "codigo" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "comisionChofer" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ubicacion" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "fechaLimite" DROP NOT NULL;

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ruc" TEXT NOT NULL DEFAULT '',
    "sedeId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puertos" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "puertos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comisiones" (
    "id" TEXT NOT NULL,
    "destino" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sedeId" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comisiones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clientes_sedeId_idx" ON "clientes"("sedeId");

-- CreateIndex
CREATE INDEX "puertos_sedeId_idx" ON "puertos"("sedeId");

-- CreateIndex
CREATE INDEX "comisiones_sedeId_idx" ON "comisiones"("sedeId");
