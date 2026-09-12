# Facturación electrónica (MiFact) — Preguntas al cliente

Registro de lo confirmado y lo que falta confirmar para ejecutar la integración.
Complemento de [FACTURACION_MIFACT.md](FACTURACION_MIFACT.md).

---

## Confirmado por el cliente

- ✅ **Emite una sola sede:** MGR Servicios Integrados (RUC `20616110340`). Las otras empresas no emiten por este sistema.
- ✅ **IGV 18% + detracción 4%** en el transporte de carga (código de servicio `027`, leyenda `2006`, umbral S/ 700).
- ✅ Se requiere la **Guía de Remisión electrónica del transportista (GRE)**.

---

## Por confirmar

**1. Series de comprobantes**
- ¿Qué series usará el sistema (integración)? Ej.: `FN01` facturas, `BN01` boletas.
- ¿Emiten también desde el **portal de MiFact** (a mano)? ¿Con qué series? — Las del sistema deben ser **distintas** a las del portal para que SUNAT no las rechace.
- ¿Desde qué correlativo debe arrancar cada serie? (para no pisar numeración ya usada)

**2. Datos del emisor (MGR Servicios Integrados)**
- Razón social exacta
- Nombre comercial (si tienen)
- Dirección fiscal completa
- Ubigeo (código de 6 dígitos del distrito, ej. Lima = 150101)

**3. Detracción**
- N° de **cuenta de detracción** del **Banco de la Nación**.

**4. Tipos de comprobante**
- ¿Emiten **boletas** además de facturas?
- ¿Manejan **notas de crédito** (anulaciones/devoluciones)? ¿Con qué frecuencia?

**5. Accesos MiFact**
- **Token de producción** del RUC (el que se compartió por chat hay que **rotarlo** por seguridad).
- Usuario y clave del **portal MiFact** (`sistema.mifact.net`) para cotejar los comprobantes de prueba.
- ¿Tienen acceso al **ambiente demo** de MiFact, o usamos el demo público para las pruebas?

**6. Operación**
- El transporte, ¿siempre es **1 solo servicio (flete) por factura**, o a veces varias líneas?
- ¿Facturan siempre en **soles**, o también en dólares? (si es en dólares, definir el tipo de cambio a usar)
