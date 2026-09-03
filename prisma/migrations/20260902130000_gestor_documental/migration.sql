-- Carpetas anidadas (gestor documental)
CREATE TABLE "carpetas" (
    "id" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "carpetas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "carpetas_sedeId_idx" ON "carpetas"("sedeId");
CREATE INDEX "carpetas_parentId_idx" ON "carpetas"("parentId");
ALTER TABLE "carpetas" ADD CONSTRAINT "carpetas_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "carpetas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Archivos dentro de las carpetas
CREATE TABLE "archivos" (
    "id" TEXT NOT NULL,
    "sedeId" TEXT NOT NULL,
    "carpetaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "mime" TEXT NOT NULL DEFAULT 'application/octet-stream',
    "size" INTEGER NOT NULL DEFAULT 0,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "archivos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "archivos_sedeId_idx" ON "archivos"("sedeId");
CREATE INDEX "archivos_carpetaId_idx" ON "archivos"("carpetaId");
ALTER TABLE "archivos" ADD CONSTRAINT "archivos_carpetaId_fkey" FOREIGN KEY ("carpetaId") REFERENCES "carpetas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
