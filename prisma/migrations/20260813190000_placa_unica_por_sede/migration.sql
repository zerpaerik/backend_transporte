-- La placa deja de ser única a nivel global y pasa a ser única por sede,
-- para poder registrar el mismo vehículo en distintas sedes.
DROP INDEX IF EXISTS "vehiculos_placa_key";
CREATE UNIQUE INDEX "vehiculos_sedeId_placa_key" ON "vehiculos"("sedeId", "placa");
