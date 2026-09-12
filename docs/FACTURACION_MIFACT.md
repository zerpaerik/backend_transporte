# Integración MiFact — Facturación electrónica SUNAT

**Handoff técnico** · Especificación de desarrollo y guía de pruebas para conectar el sistema de transporte con la facturación electrónica de SUNAT vía **MiFact** (API REST/JSON).

- **Stack:** NestJS · Prisma · PostgreSQL · Next.js
- **Proveedor:** MiFact (integración JSON) — repo oficial: `github.com/mifact/apijson`
- **Alcance:** se factura electrónicamente **solo desde una sede** → **MGR Servicios Integrados** (RUC `20616110340`). Las otras empresas no emiten por este sistema.
- **Particularidades del negocio (confirmadas por el cliente):** IGV **18%** + **detracción 4%** (transporte de carga) · se requiere **Guía de Remisión electrónica del transportista (GRE)**.
- **Estado:** por iniciar (Fase 1 en demo)

---

## Resumen y objetivo

El sistema ya registra **viajes/despachos** y **facturas** de forma manual (serie, tipo, cliente, monto, IGV, estado). El objetivo es **emitir esos comprobantes electrónicamente a SUNAT** a través de MiFact: enviar factura/boleta/nota de crédito, consultar su estado, descargar PDF/XML/CDR, reenviar por correo y anular — más la **Guía de Remisión del transportista** — desde el módulo de Facturación, para la **sede MGR Servicios Integrados**.

**Principio rector:** construir y validar **100% en el ambiente DEMO** (homologación) antes de tocar producción, porque **producción envía comprobantes reales a SUNAT**.

> **Alcance de emisión:** por ahora **una sola empresa emite** (MGR Servicios Integrados, RUC `20616110340`). El modelo se deja preparado por RUC emisor por si se suman más adelante, pero no es parte de este desarrollo.

---

## 1 · Seguridad de credenciales (primero)

> ⚠️ **El token de producción se compartió por chat. Debe rotarse con soporte MiFact y tratarse como secreto. Nunca va en el código ni en un commit.**

- El token del RUC emisor y la URL base viven en **variables de entorno** de Railway o en una tabla de config cifrada — nunca en el repositorio.
- Convención sugerida: `MIFACT_BASE_URL` y `MIFACT_TOKEN_MGRSI` (o resolverlo desde la tabla `EmisorConfig`).
- En desarrollo se usa exclusivamente el **token DEMO público** del repositorio (ver §8). El token real solo se configura en producción.
- El repositorio del cliente exige commits **sin marcas de IA**; el push lo hace el equipo.

---

## 2 · Cómo funciona el API de MiFact

REST/JSON sobre un servicio WCF (`.svc`). Se envía JSON plano; MiFact arma el UBL 2.1, lo firma y lo manda a SUNAT.

### Autenticación
El **token va dentro del cuerpo JSON** (campo `"TOKEN"`), **no** en un header. Es por RUC emisor. `POST`, `Content-Type: application/json`.

### Endpoints y métodos (invoiceService.svc)

| Acción | Método |
|---|---|
| Emitir documento | `SendInvoice` |
| Consultar estado (mifact + SUNAT) | `GetEstatusInvoice` |
| Obtener PDF / XML / CDR | `GetInvoice` |
| Anular / dar de baja | `LowInvoice` |
| Reenviar por correo | `SendMailInvoice` |

- **DEMO:** `https://demo.mifact.net.pe/api/invoiceService.svc/`
- **PROD:** `https://mifact.net.pe/mifactapi48/invoiceService.svc/`

> **Guía de Remisión electrónica del transportista (requerida).** Usa otro servicio: `GuiaRemision.svc/` con `SendGuia · GetEstatusGuia · GetGuia · LowGuia · SendMailGuia`. La URL de producción de GRE la entrega MiFact aparte. Ver Fase 4.

### Códigos de estado (`estado_documento`)

| Código | Significado |
|---|---|
| 101 | en proceso |
| 102 | aceptado |
| 103 | aceptado con observación |
| 104 | rechazado |
| 105 | anulado |
| 108 | solicitud de baja |

### Respuesta del servicio (campos principales)
`errors`, `estado_documento`, `tipo_cpe`, `serie_cpe`, `correlativo_cpe`, `sunat_description`, `sunat_note`, `sunat_responsecode`, `codigo_hash`, `cadena_para_codigo_qr`, `pdf_bytes`, `xml_enviado`, `cdr_sunat`, `ticket_sunat`.

> **Regla crítica de SERIES.** Cada modalidad de emisión debe usar **series distintas**. Si además emiten desde el portal MiFact (p. ej. `FM01/BM01`), el sistema integrado debe usar **otras** (p. ej. `FN01/BN01`). Mezclar la misma serie entre modalidades genera cruce y **rechazo** de comprobantes.

---

## 3 · Arquitectura propuesta

### Backend · NestJS — módulo `facturacion-electronica`
- **MifactClient** — servicio HTTP (POST JSON) a los 5 métodos, con timeout y manejo de errores/red.
- **Mapper** `Factura → SendInvoice` (caso transporte: 1 ítem "flete" afecto IGV).
- **Correlativos** — el sistema controla el número por (sede, tipo, serie), con transacción y unicidad.
- Endpoints internos: `POST /facturas/:id/emitir`, `/estado`, `/pdf`, `/anular`, `/correo`.

### Frontend · Next.js — módulo Facturación
- Botón **Emitir a SUNAT** y chip de estado (Aceptado / Observado / Rechazado / Anulado).
- **Descargar** PDF / XML / CDR y ver **QR / hash**.
- **Reenviar** (rechazado, tras corregir) · **Anular** · **enviar por correo**.
- Aviso visible de ambiente **DEMO vs PRODUCCIÓN**.

---

## 4 · Modelo de datos (migraciones aditivas)

### Nueva tabla `EmisorConfig` (por sede / RUC)

| Campo | Ejemplo / nota |
|---|---|
| `sedeId` | relación 1–1 con la empresa |
| `ruc` | `20616110340` (MGR Servicios Integrados) |
| `razonSocial` · `nombreComercial` | datos del emisor para el XML |
| `ubigeo` (COD_UBI_EMIS) · `direccionFiscal` | p. ej. 150101 + dirección fiscal |
| `serieFactura` · `serieBoleta` | modalidad integrada, p. ej. `FN01` / `BN01` |
| `puntoVenta` (COD_PTO_VENTA) | identificador del punto/usuario |
| `ctaDetraccion` | N° de cuenta del **Banco de la Nación** para la detracción |
| `ambiente` · `urlBase` · `token` | `demo\|prod` · URL base · token del RUC (secreto) |

> Aunque hoy emite una sola empresa, la tabla se deja por `sedeId` para no rehacerla si más adelante se suman más RUC.

### Extender `Factura`
- **Documento:** `tipoDocCodigo` (01/03/07/08), `serie`, `correlativo`, `moneda`, `fechaEmision`.
- **Montos:** `gravado`, `exonerado`, `inafecto`, `igv`, `total`.
- **Detracción:** `sujetoDetraccion` (bool), `porcDetraccion` (4.00), `montoDetraccion`, `codBienServDetraccion` (027 transporte de carga), `medioPagoDetraccion`.
- **SUNAT:** `estadoDocumento` (101–108), `sunatDescripcion`, `sunatResponsecode`, `hash`, `qr`, `ticket`.
- **Archivos:** `xml`, `cdr`, `pdf` (guardar CDR + hash siempre; PDF on-demand vía `GetInvoice`).
- **Índice único** `(sedeId, tipoDocCodigo, serie, correlativo)` para no duplicar.

---

## 5 · Mapeo de campos (caso transporte)

Una factura de transporte es normalmente **1 ítem**: "Servicio de transporte de carga", afecto a IGV 18%.

| Campo MiFact | Origen en el sistema | Nota |
|---|---|---|
| `TOKEN` | EmisorConfig.token | secreto, por RUC |
| `NUM_NIF_EMIS` | EmisorConfig.ruc | emisor |
| `COD_UBI_EMIS` · `TXT_DMCL_FISC_EMIS` | EmisorConfig | ubigeo + dirección fiscal |
| `COD_TIP_NIF_RECP` | 6 (RUC) / 1 (DNI) | según receptor |
| `NUM_NIF_RECP` · `NOM_RZN_SOC_RECP` | cliente **a facturar** | `clienteFactura \|\| cliente` del viaje → catálogo |
| `COD_TIP_CPE` | tipo | 01 factura · 03 boleta · 07 NC · 08 ND |
| `NUM_SERIE_CPE` · `NUM_CORRE_CPE` | serie + correlativo | `FN01` + correlativo del sistema |
| `COD_MND` | PEN | si otra moneda, enviar `TIP_CAMBIO` |
| `MNT_TOT_GRAVADO` | tarifa del viaje | base afecta |
| `MNT_TOT_TRIB_IGV` | tarifa × 18% | IGV |
| `MNT_TOT` | gravado + IGV | total |
| `items[].COD_TIP_AFECT_IGV_ITEM` | 10 | gravado – operación onerosa |
| `items[].COD_UNID_ITEM` | ZZ | servicios |
| **Detracción** — código bien/servicio | `027` | transporte de carga por vía terrestre |
| **Detracción** — porcentaje | `4.00` | fijo para transporte de carga |
| **Detracción** — monto | gravado+IGV × 4% | redondeado |
| **Detracción** — medio de pago / cuenta | Banco de la Nación | de EmisorConfig |
| `ENVIAR_A_SUNAT` · `RETORNA_*` | flags | enviar directo y pedir XML/CDR/PDF |

> **Detracción (SPOT) — importante.** El transporte de carga por vía terrestre está sujeto a **detracción del 4%** cuando la operación supera **S/ 700**. En el XML esto se refleja con: la **leyenda `2006` "Operación sujeta a detracción"**, el **código de bien/servicio `027`**, el **porcentaje 4%**, el **monto** y la **cuenta del Banco de la Nación**. Los nombres exactos de los tags de detracción en el JSON de MiFact se deben tomar del ejemplo `factura ... detraccion` del repo y del Excel `DocumentacionFV_BV_NC_ND_Json.xlsx`. Si el importe no supera el umbral, se emite sin detracción.

### Ejemplo de payload — factura de flete afecta IGV (demo)

`POST · SendInvoice` — tarifa 1000 → IGV 180 → total 1180:

```json
{
  "TOKEN": "<TOKEN_DEMO>",
  "NUM_NIF_EMIS": "20100100100",
  "NOM_RZN_SOC_EMIS": "MGR SERVICIOS INTEGRADOS S.A.C.",
  "COD_UBI_EMIS": "150101",
  "TXT_DMCL_FISC_EMIS": "Av. ... Lima",
  "COD_TIP_NIF_RECP": "6",
  "NUM_NIF_RECP": "20601847834",
  "NOM_RZN_SOC_RECP": "CLIENTE A FACTURAR SAC",
  "FEC_EMIS": "2026-09-12",
  "COD_TIP_CPE": "01",
  "NUM_SERIE_CPE": "FN01",
  "NUM_CORRE_CPE": "00000001",
  "COD_MND": "PEN",
  "MNT_TOT_GRAVADO": "1000.00",
  "MNT_TOT_TRIB_IGV": "180.00",
  "MNT_TOT": "1180.00",
  "ENVIAR_A_SUNAT": "true",
  "RETORNA_XML_CDR": "true",
  "RETORNA_PDF": "true",
  "COD_FORM_IMPR": "001",
  "TXT_VERS_UBL": "2.1",
  "COD_TIP_OPE_SUNAT": "0101",
  "items": [{
    "COD_ITEM": "FLETE",
    "COD_UNID_ITEM": "ZZ",
    "CANT_UNID_ITEM": "1",
    "VAL_UNIT_ITEM": "1000",
    "PRC_VTA_UNIT_ITEM": "1180",
    "VAL_VTA_ITEM": "1000",
    "MNT_PV_ITEM": "1180",
    "COD_TIP_PRC_VTA": "01",
    "COD_TIP_AFECT_IGV_ITEM": "10",
    "COD_TRIB_IGV_ITEM": "1000",
    "POR_IGV_ITEM": "18",
    "MNT_IGV_ITEM": "180",
    "TXT_DESC_ITEM": "Servicio de transporte de carga — OP-0000"
  }]
}
```

> Los ejemplos oficiales para cada escenario (exonerado, detracción, NC, exportación, etc.) están en el repo: `integracionConJson_FV_BV_NC_ND/Ejemplos Archivos JSON UBL 2_1/` junto al Excel `DocumentacionFV_BV_NC_ND_Json.xlsx` (significado y restricciones de cada tag).

---

## 6 · Reglas de negocio

- **Receptor:** la factura se emite a `clienteFactura || cliente` del viaje (ya existe el campo "cliente a facturar"). De ahí se jala RUC / razón social / dirección del catálogo.
- **Correlativo:** lo controla el sistema por (sede, tipo, serie), incremental, en transacción. Nunca reutilizar un correlativo aceptado.
- **Idempotencia:** un comprobante ya **aceptado (102)** no se reenvía. Si hay timeout/red, marcar "pendiente" y reconciliar con `GetEstatusInvoice`.
- **Rechazo (104):** mostrar `sunat_description`, permitir corregir y reemitir.
- **IGV:** 18%, afectación `10`, tributo `1000`. Servicio de transporte = gravado onerosa.
- **Detracción:** 4% (código `027`) automática cuando el total supera **S/ 700**. El sistema calcula el monto, arma la leyenda `2006` y agrega la cuenta del Banco de la Nación. Por debajo del umbral, sin detracción.
- **GRE del transportista:** por cada viaje facturado (o cuando corresponda), el sistema debe poder emitir la **Guía de Remisión electrónica** con placa, conductor, origen/destino y datos de la carga (ver Fase 4).
- **Anulación:** `LowInvoice` con motivo. La factura pasa a **anulado (105)** / solicitud de baja (108).

---

## 7 · Fases del desarrollo

Se avanza a la siguiente fase solo con la anterior verificada en demo.

- **Fase 0 — Seguridad y config (~0.5 día):** rotar token, env vars, tabla `EmisorConfig` y semilla de MGR Servicios Integrados en demo.
- **Fase 1 — Emisión básica en DEMO (núcleo):** `MifactClient` + mapper + correlativos + `SendInvoice`. Emitir factura afecta IGV (transporte) **con detracción 4%**, factura sin detracción (bajo umbral) y nota de crédito, contra demo.
- **Fase 2 — Ciclo completo (operable):** estado/reconciliación (`GetEstatusInvoice`), PDF/XML/CDR + QR (`GetInvoice`), anular (`LowInvoice`), correo (`SendMailInvoice`), y UI en el módulo Facturación.
- **Fase 3 — Pase a PRODUCCIÓN:** cambiar URL + token reales de MGR Servicios Integrados, series definitivas, emitir 1 factura real (con detracción) y cotejar en el portal. Es la única empresa que emite.
- **Fase 4 — GRE del transportista (requerida):** integrar `SendGuia` con los viajes (placa, conductor, origen/destino, carga). Validación real solo en producción — SUNAT no tiene demo de GRE, así que se prueba lo máximo posible en armado/JSON y se cierra contra producción con cuidado.

---

## 8 · Documentación de pruebas (ambiente DEMO)

Todo el desarrollo se prueba aquí. No tocar producción hasta la Fase 3.

**Credenciales de prueba (públicas, del repositorio):**
- **Token demo:** `gN8zNRBV+/FVxTLwdaZx0w==`
- **RUC de prueba:** `20100100100`
- **Base demo:** `https://demo.mifact.net.pe/api/invoiceService.svc/`

Probar primero con **Postman / Insomnia** o `curl` y recién después conectar desde el backend.

### 1 · Emitir (SendInvoice)
```bash
curl -X POST "https://demo.mifact.net.pe/api/invoiceService.svc/SendInvoice" \
  -H "Content-Type: application/json" \
  -d @factura_demo.json
# Esperado: estado_documento "102" (aceptado) + codigo_hash + cadena_para_codigo_qr
```

### 2 · Consultar estado (GetEstatusInvoice)
```bash
curl -X POST "https://demo.mifact.net.pe/api/invoiceService.svc/GetEstatusInvoice" \
  -H "Content-Type: application/json" \
  -d '{ "TOKEN":"gN8zNRBV+/FVxTLwdaZx0w==", "NUM_NIF_EMIS":"20100100100",
        "COD_TIP_CPE":"01", "NUM_SERIE_CPE":"FN01", "NUM_CORRE_CPE":"00000001",
        "FEC_EMIS":"2026-09-12" }'
```

### 3 · PDF / XML / CDR (GetInvoice)
```bash
curl -X POST "https://demo.mifact.net.pe/api/invoiceService.svc/GetInvoice" \
  -H "Content-Type: application/json" \
  -d '{ "TOKEN":"gN8zNRBV+/FVxTLwdaZx0w==", "NUM_NIF_EMIS":"20100100100",
        "COD_TIP_CPE":"01", "NUM_SERIE_CPE":"FN01", "NUM_CORRE_CPE":"00000001",
        "FEC_EMIS":"2026-09-12", "RETORNA_PDF":"true", "COD_FORM_IMPR":"001" }'
# pdf_bytes viene en base64 → guardarlo/renderizarlo
```

### 4 · Anular (LowInvoice)
```bash
curl -X POST "https://demo.mifact.net.pe/api/invoiceService.svc/LowInvoice" \
  -H "Content-Type: application/json" \
  -d '{ "TOKEN":"gN8zNRBV+/FVxTLwdaZx0w==", "COD_TIP_NIF_EMIS":"6", "NUM_NIF_EMIS":"20100100100",
        "COD_TIP_CPE":"01", "NUM_SERIE_CPE":"FN01", "NUM_CORRE_CPE":"00000001",
        "FEC_EMIS":"2026-09-12", "TXT_DESC_MTVO":"ANULACION POR ERROR", "COD_PTO_VENTA":"qa" }'
```

### Matriz de casos de prueba

| # | Caso | Cómo | Resultado esperado |
|---|---|---|---|
| T1 | Factura afecta IGV **con detracción 4%** | SendInvoice, flete > S/ 700, leyenda 2006 + cta B. Nación | 102 + hash + QR + PDF, detracción visible |
| T1b | Factura afecta IGV **sin detracción** | flete ≤ S/ 700 | 102, sin bloque de detracción |
| T2 | Factura exonerada | ejemplo `factura_exonerada` | 102, IGV 0 |
| T3 | Boleta | `COD_TIP_CPE 03`, serie `BN01` | 102 |
| T4 | Nota de crédito | ejemplo `nota de credito` referida a T1 | 102 |
| T5 | Consultar estado | GetEstatusInvoice de T1 | `estado_documento` correcto |
| T6 | Descargar PDF/XML/CDR | GetInvoice de T1 | bytes válidos |
| T7 | Anulación | LowInvoice de T1 | 105/108 |
| T8 | Correlativo duplicado | reenviar T1 misma serie/número | error controlado, no duplica |
| T9 | Rechazo | RUC receptor inválido | 104 + mensaje claro en UI |
| T10 | Timeout / red | cortar red al emitir | queda "pendiente" y reconcilia con T5 |
| T11 | GRE del transportista | `SendGuia` con placa/conductor/origen/destino | guía aceptada (validar en armado; cierre en prod) |

### Cotejar en el portal
Cada envío debe verse reflejado en el portal de MiFact — `sistema.mifact.net` (usuario/clave llegan por correo). Confirmar que serie/correlativo/monto/estado coinciden con lo que envió el sistema.

**Checklist de homologación (demo):**
- [ ] T1–T10 pasan en demo con los resultados esperados
- [ ] Los montos calculados (gravado/IGV/total) cuadran con el redondeo de SUNAT
- [ ] PDF/XML/CDR se guardan y se pueden descargar desde la UI
- [ ] El QR y el hash se muestran y son válidos
- [ ] Cada comprobante de demo aparece y coteja en el portal MiFact

---

## 9 · Checklist para pasar a PRODUCCIÓN

> ⚠️ **Producción envía real a SUNAT.** No ejecutar hasta que toda la §8 esté verde. Emite **una sola empresa**: MGR Servicios Integrados (RUC `20616110340`).

- [ ] Token de producción **rotado** y cargado como variable de entorno (no en repo)
- [ ] `urlBase` cambiada a `https://mifact.net.pe/mifactapi48/invoiceService.svc/`
- [ ] Series definitivas de la modalidad integrada (p. ej. `FN01/BN01`), distintas a las del portal
- [ ] Datos del emisor correctos: RUC, razón social, **ubigeo** y dirección fiscal
- [ ] **Cuenta de detracción** (Banco de la Nación) cargada y correcta
- [ ] Emitir **1 factura real con detracción** y verificarla en el portal + correo al cliente
- [ ] Emitir **1 GRE de transportista real** y verificarla en el portal
- [ ] Confirmar que el correlativo arranca donde corresponde (no pisar numeración previa)

---

## 10 · Criterios de aceptación (Definition of Done)

- Desde el módulo Facturación (sede MGR Servicios Integrados) se puede **emitir**, **consultar estado**, **descargar PDF/XML/CDR**, **anular** y **reenviar por correo**.
- Las facturas de transporte aplican **detracción 4%** cuando corresponde (leyenda 2006 + cuenta B. Nación).
- Se emite la **Guía de Remisión del transportista** desde los viajes.
- El receptor se resuelve por `clienteFactura || cliente` y jala datos del catálogo.
- Correlativos sin duplicados; reintentos idempotentes; rechazos con mensaje claro y reemisión.
- Toda la matriz T1–T11 pasa en demo; 1 factura con detracción + 1 GRE aceptadas en producción y cotejadas en el portal.
- Tokens fuera del repositorio; commits sin marcas de IA; migraciones aplicadas.

---

## 11 · Pendientes por confirmar con el cliente

**Confirmado por el cliente:**
- ✅ Emite **una sola sede**: MGR Servicios Integrados (RUC `20616110340`).
- ✅ IGV **18%** + **detracción 4%** (transporte de carga, código `027`).
- ✅ Se requiere la **Guía de Remisión electrónica del transportista**.

**Aún por confirmar:**

| Dato | Para qué | Estado |
|---|---|---|
| Series de la modalidad integrada (¿`FN01/BN01`?) y si emiten también desde el portal MiFact | evitar cruce de series | pendiente |
| Ubigeo + dirección fiscal + nombre comercial de MGR Servicios Integrados | datos del emisor en el XML | pendiente |
| N° de **cuenta de detracción** (Banco de la Nación) | armar el bloque de detracción | pendiente |
| ¿Emiten **boletas** además de facturas? | alcance de comprobantes | pendiente |
| Usuario/clave del **portal MiFact** para cotejar | pruebas | pendiente |
| Guardar PDF/XML/CDR en BD u on-demand | almacenamiento | sugerido: CDR+hash siempre, PDF on-demand |

---

**Referencias** · Repo MiFact: `github.com/mifact/apijson` · Excel de campos: `DocumentacionFV_BV_NC_ND_Json.xlsx` · Portal: `sistema.mifact.net` · Documento de handoff v2 (incorpora: sede única, detracción 4%, GRE requerida)
