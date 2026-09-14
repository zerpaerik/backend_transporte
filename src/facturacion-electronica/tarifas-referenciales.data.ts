// Valores referenciales del transporte de bienes por vía terrestre.
// Fuente: DS 022-2025-MTC (Anexos I y II), publicado en El Peruano el 30-dic-2025.
// Usados para calcular el VALOR REFERENCIAL de la detracción (SPOT) del transporte de carga:
// la detracción es 4% sobre el MAYOR entre el importe de la operación y este valor referencial.
//
// Anexo I  (local / operativos en puerto): tarifa por VIAJE (contenedores) o por TONELADA (carga/graneles).
// Anexo II (nacional / km virtual):        tarifa por TONELADA (S/ x TM) según ruta y destino desde Lima.
//
// NOTA: la tabla nacional se extrajo y verificó (biyección) contra el texto del DS. Aun así, antes de
// producción conviene que el área contable coteje una muestra contra el diario oficial.

export const TARIFAS_VIGENCIA = 'DS 022-2025-MTC (El Peruano, 30-dic-2025)';

export interface ZonaLocal {
  zona: string;
  contenedorLleno: number;   // S/ x viaje
  contenedorVacio: number;   // S/ x viaje
  cargaGeneral: number;      // S/ x tonelada (carga general y líquidos)
  granelAlimentos: number;   // S/ x tonelada (alimentos, cisternas y otros)
  granelMinerales: number;   // S/ x tonelada (minerales y fertilizantes)
}
export interface PuertoLocal { puerto: string; zonas: ZonaLocal[]; }
export interface DestinoNacional { destino: string; sxTM: number; }
export interface RutaNacional { ruta: string; destinos: DestinoNacional[]; }

export const ANEXO_I_LOCAL: PuertoLocal[] = [
  {
    puerto: "Puerto del Callao",
    zonas: [
      { zona: "Zona I (0-7 Km)", contenedorLleno: 568.98, contenedorVacio: 168.80, cargaGeneral: 17.53, granelAlimentos: 11.24, granelMinerales: 14.98 },
      { zona: "Zona I (7-15 Km)", contenedorLleno: 736.62, contenedorVacio: 262.35, cargaGeneral: 24.42, granelAlimentos: 15.65, granelMinerales: 24.42 },
      { zona: "Zona II (15-30 Km)", contenedorLleno: 808.92, contenedorVacio: 808.92, cargaGeneral: 25.49, granelAlimentos: 21.41, granelMinerales: 25.49 },
      { zona: "Zona III (30-65 Km)", contenedorLleno: 1062.33, contenedorVacio: 1062.33, cargaGeneral: 31.36, granelAlimentos: 31.36, granelMinerales: 31.36 },
    ],
  },
  {
    puerto: "Puerto de Conchán y Refinería Conchán",
    zonas: [
      { zona: "Zona I (0-15 Km)", contenedorLleno: 736.62, contenedorVacio: 262.35, cargaGeneral: 24.42, granelAlimentos: 15.65, granelMinerales: 24.42 },
      { zona: "Zona II (15-30 Km)", contenedorLleno: 808.92, contenedorVacio: 808.92, cargaGeneral: 25.49, granelAlimentos: 25.49, granelMinerales: 25.49 },
      { zona: "Zona III (30-65 Km)", contenedorLleno: 1062.33, contenedorVacio: 1062.33, cargaGeneral: 31.36, granelAlimentos: 31.36, granelMinerales: 31.36 },
    ],
  },
  {
    puerto: "Puerto Chancay",
    zonas: [
      { zona: "Zona I (0-7 Km)", contenedorLleno: 568.98, contenedorVacio: 168.80, cargaGeneral: 17.53, granelAlimentos: 11.24, granelMinerales: 14.98 },
      { zona: "Zona I (7-15 Km)", contenedorLleno: 736.62, contenedorVacio: 262.35, cargaGeneral: 24.42, granelAlimentos: 15.65, granelMinerales: 24.42 },
    ],
  },
  {
    puerto: "Puerto de Chimbote",
    zonas: [
      { zona: "Zona I (0-7 Km)", contenedorLleno: 568.98, contenedorVacio: 168.80, cargaGeneral: 17.53, granelAlimentos: 11.24, granelMinerales: 14.98 },
      { zona: "Zona I (7-15 Km)", contenedorLleno: 736.62, contenedorVacio: 262.35, cargaGeneral: 24.42, granelAlimentos: 15.65, granelMinerales: 24.42 },
      { zona: "Zona II (15-30 Km)", contenedorLleno: 808.92, contenedorVacio: 808.92, cargaGeneral: 25.49, granelAlimentos: 21.41, granelMinerales: 25.49 },
    ],
  },
  {
    puerto: "Puerto de San Martín (Pisco)",
    zonas: [
      { zona: "Zona II (15-30 Km)", contenedorLleno: 664.11, contenedorVacio: 664.11, cargaGeneral: 25.49, granelAlimentos: 25.49, granelMinerales: 25.49 },
      { zona: "Zona III (30-45 Km)", contenedorLleno: 1062.33, contenedorVacio: 1062.33, cargaGeneral: 31.36, granelAlimentos: 31.36, granelMinerales: 31.36 },
    ],
  },
  {
    puerto: "Puerto Matarani",
    zonas: [
      { zona: "Zona I (0-7 Km)", contenedorLleno: 568.98, contenedorVacio: 168.80, cargaGeneral: 17.53, granelAlimentos: 11.24, granelMinerales: 14.98 },
      { zona: "Zona I (7-15 Km)", contenedorLleno: 736.62, contenedorVacio: 262.35, cargaGeneral: 24.42, granelAlimentos: 15.65, granelMinerales: 24.42 },
    ],
  },
  {
    puerto: "Puerto de Ilo",
    zonas: [
      { zona: "Zona I (0-7 Km)", contenedorLleno: 568.98, contenedorVacio: 168.80, cargaGeneral: 17.53, granelAlimentos: 11.24, granelMinerales: 14.98 },
      { zona: "Zona I (7-15 Km)", contenedorLleno: 736.62, contenedorVacio: 262.35, cargaGeneral: 24.42, granelAlimentos: 15.65, granelMinerales: 24.42 },
    ],
  },
  {
    puerto: "Puerto de Paita",
    zonas: [
      { zona: "Zona I (0-15 Km)", contenedorLleno: 568.98, contenedorVacio: 168.80, cargaGeneral: 17.53, granelAlimentos: 11.24, granelMinerales: 14.98 },
      { zona: "Zona I (0-15 Km) — Tierra Colorada, El Tablazo, Zona Industrial", contenedorLleno: 736.62, contenedorVacio: 262.35, cargaGeneral: 24.42, granelAlimentos: 15.65, granelMinerales: 24.42 },
    ],
  },
  {
    puerto: "Puerto de Salaverry",
    zonas: [
      { zona: "Zona I (0-7 Km)", contenedorLleno: 568.98, contenedorVacio: 168.80, cargaGeneral: 17.53, granelAlimentos: 11.24, granelMinerales: 14.98 },
      { zona: "Zona I (7-15 Km)", contenedorLleno: 736.62, contenedorVacio: 262.35, cargaGeneral: 24.42, granelAlimentos: 15.65, granelMinerales: 24.42 },
    ],
  },
];

export const ANEXO_II_NACIONAL: RutaNacional[] = [
  {
    ruta: "Lima - Aguas Verdes",
    destinos: [
      { destino: "Ovalo de Chancay", sxTM: 69.14 },
      { destino: "Huaral", sxTM: 70.70 },
      { destino: "Huacho", sxTM: 80.45 },
      { destino: "Supe Pueblo", sxTM: 87.06 },
      { destino: "Supe Puerto", sxTM: 87.53 },
      { destino: "Barranca", sxTM: 88.45 },
      { destino: "Pativilca", sxTM: 89.69 },
      { destino: "Dvo. Paramonga", sxTM: 90.22 },
      { destino: "Paramonga", sxTM: 91.38 },
      { destino: "Dvo. Huaraz R14", sxTM: 90.58 },
      { destino: "Huarmey", sxTM: 105.23 },
      { destino: "Casma", sxTM: 119.21 },
      { destino: "Chimbote", sxTM: 128.91 },
      { destino: "Pte. Santa", sxTM: 131.25 },
      { destino: "Virú", sxTM: 144.39 },
      { destino: "Dvo. Pto. Salaverry", sxTM: 154.94 },
      { destino: "Trujillo", sxTM: 157.48 },
      { destino: "Chicama", sxTM: 166.72 },
      { destino: "Chocope", sxTM: 169.67 },
      { destino: "Paiján", sxTM: 172.78 },
      { destino: "San Pedro de Lloc", sxTM: 184.81 },
      { destino: "Pacasmayo", sxTM: 187.54 },
      { destino: "Dvo. Cajamarca Ruta 08", sxTM: 191.71 },
      { destino: "Cajamarca", sxTM: 247.31 },
      { destino: "Chepén", sxTM: 195.61 },
      { destino: "Dvo. Puerto Eten", sxTM: 212.50 },
      { destino: "Reque", sxTM: 212.92 },
      { destino: "Chiclayo", sxTM: 215.85 },
      { destino: "Lambayeque", sxTM: 219.21 },
      { destino: "Dvo. Bayovar (Ruta 04)", sxTM: 248.51 },
      { destino: "Piura", sxTM: 275.07 },
      { destino: "Tambogrande (acceso por IIRSA)", sxTM: 290.24 },
      { destino: "Paita", sxTM: 291.63 },
      { destino: "Sullana", sxTM: 285.68 },
      { destino: "Dvo. Talara", sxTM: 306.31 },
      { destino: "Tambogrande (acceso por Sullana)", sxTM: 297.86 },
      { destino: "El Partidor", sxTM: 304.47 },
      { destino: "Las Lomas (acceso)", sxTM: 307.17 },
      { destino: "Suyo", sxTM: 317.73 },
      { destino: "La Tina", sxTM: 322.37 },
      { destino: "Talara", sxTM: 308.85 },
      { destino: "Dvo. Lobitos", sxTM: 308.61 },
      { destino: "Los Órganos", sxTM: 322.64 },
      { destino: "Máncora", sxTM: 326.33 },
      { destino: "Cancas", sxTM: 334.01 },
      { destino: "Zorritos", sxTM: 346.92 },
      { destino: "Tumbes", sxTM: 354.99 },
      { destino: "Zarumilla", sxTM: 361.28 },
      { destino: "Aguas Verdes", sxTM: 362.45 },
    ],
  },
  {
    ruta: "Lima - Nazca - Abancay - Cusco - Puerto Maldonado",
    destinos: [
      { destino: "Dvo. Puquio (Ruta 26)", sxTM: 131.79 },
      { destino: "Puquio", sxTM: 248.79 },
      { destino: "Challhuanca", sxTM: 322.64 },
      { destino: "Abancay", sxTM: 364.33 },
      { destino: "Curahuasi", sxTM: 393.09 },
      { destino: "Cuzco", sxTM: 442.69 },
      { destino: "Quincemil", sxTM: 652.55 },
      { destino: "Inambari", sxTM: 686.11 },
      { destino: "Pto. Maldonado", sxTM: 799.01 },
      { destino: "Alerta", sxTM: 868.88 },
      { destino: "Iberia", sxTM: 906.56 },
      { destino: "Iñapari", sxTM: 947.26 },
      { destino: "Río Acre (Frontera Perú Brasil)", sxTM: 947.26 },
    ],
  },
  {
    ruta: "Lima - Tacna - La Concordia",
    destinos: [
      { destino: "Cañete", sxTM: 79.81 },
      { destino: "Chincha Alta", sxTM: 89.09 },
      { destino: "San Clemente", sxTM: 94.27 },
      { destino: "Dvo. Pisco (Ruta 24)", sxTM: 95.05 },
      { destino: "Pisco", sxTM: 101.70 },
      { destino: "Ica", sxTM: 107.28 },
      { destino: "Palpa", sxTM: 123.20 },
      { destino: "Nazca", sxTM: 131.54 },
      { destino: "Ocoña", sxTM: 219.57 },
      { destino: "Camaná", sxTM: 237.14 },
      { destino: "Repartición (Ruta 30A)", sxTM: 282.21 },
      { destino: "Arequipa", sxTM: 296.45 },
      { destino: "Dvo. a Mollendo Matarani (Ruta 30)", sxTM: 287.25 },
      { destino: "Pto. Matarani", sxTM: 303.61 },
      { destino: "Moquegua", sxTM: 341.88 },
      { destino: "Ilo", sxTM: 368.97 },
      { destino: "Tacna", sxTM: 386.92 },
      { destino: "La Concordia", sxTM: 397.08 },
    ],
  },
  {
    ruta: "Lima - La Oroya - Tarma - La Merced",
    destinos: [
      { destino: "Matucana", sxTM: 69.37 },
      { destino: "San Mateo", sxTM: 73.88 },
      { destino: "Morococha", sxTM: 84.77 },
      { destino: "La Oroya", sxTM: 93.04 },
      { destino: "Tarma", sxTM: 106.54 },
      { destino: "San Ramón", sxTM: 118.72 },
      { destino: "La Merced", sxTM: 120.52 },
      { destino: "Pte. Chanchamayo Emp. R05S", sxTM: 122.62 },
    ],
  },
  {
    ruta: "Lima - La Oroya - Huancayo - Ayacucho - Abancay - Cuzco - Puno - Desaguadero",
    destinos: [
      { destino: "La Oroya", sxTM: 93.04 },
      { destino: "Concepción", sxTM: 118.14 },
      { destino: "San Jerónimo", sxTM: 119.48 },
      { destino: "Tambo", sxTM: 122.55 },
      { destino: "Huancayo", sxTM: 123.20 },
      { destino: "Izcuchaca", sxTM: 139.80 },
      { destino: "Huanta", sxTM: 227.54 },
      { destino: "Ayacucho", sxTM: 246.77 },
      { destino: "Andahuaylas", sxTM: 452.98 },
      { destino: "Abancay", sxTM: 556.68 },
      { destino: "Curahuasi", sxTM: 585.45 },
      { destino: "Cuzco", sxTM: 632.48 },
      { destino: "Urcos", sxTM: 650.69 },
      { destino: "Sicuani (Dvo. Ruta 28 Tintaya)", sxTM: 687.38 },
      { destino: "Juliaca", sxTM: 768.92 },
      { destino: "Puno", sxTM: 803.85 },
      { destino: "Desaguadero", sxTM: 920.36 },
      { destino: "Límite internacional Perú-Bolivia", sxTM: 920.55 },
    ],
  },
  {
    ruta: "Lima - La Oroya - Cerro de Pasco - Huánuco - Tingo María - Pucallpa",
    destinos: [
      { destino: "La Oroya", sxTM: 93.04 },
      { destino: "Junín", sxTM: 106.56 },
      { destino: "Carhuamayo", sxTM: 113.81 },
      { destino: "Chasquitambo", sxTM: 115.95 },
      { destino: "Cerro de Pasco", sxTM: 124.11 },
      { destino: "Ambo", sxTM: 146.26 },
      { destino: "Huánuco", sxTM: 154.37 },
      { destino: "Tingo María", sxTM: 192.80 },
      { destino: "San Alejandro", sxTM: 254.73 },
      { destino: "Pucallpa", sxTM: 294.29 },
    ],
  },
  {
    ruta: "Lima - Pativilca - Conococha - Huaraz - Cabana",
    destinos: [
      { destino: "Conococha", sxTM: 115.69 },
      { destino: "Catac", sxTM: 136.26 },
      { destino: "Recuay", sxTM: 139.50 },
      { destino: "Huaraz", sxTM: 149.60 },
      { destino: "Carhuaz", sxTM: 162.27 },
      { destino: "Yungay", sxTM: 170.54 },
      { destino: "Caraz", sxTM: 175.01 },
      { destino: "Huallanca", sxTM: 197.68 },
      { destino: "Yungaypampa", sxTM: 202.68 },
      { destino: "Corongo", sxTM: 266.34 },
      { destino: "Cabana", sxTM: 336.87 },
    ],
  },
  {
    ruta: "Lima - Pacasmayo - Cajamarca - Chachapoyas - Tarapoto - Yurimaguas",
    destinos: [
      { destino: "Cajamarca", sxTM: 247.31 },
      { destino: "Yanacocha", sxTM: 286.89 },
      { destino: "Celendín", sxTM: 333.48 },
      { destino: "Leymebamba", sxTM: 431.16 },
      { destino: "Chachapoyas", sxTM: 485.09 },
      { destino: "Rodriguez de Mendoza", sxTM: 523.12 },
      { destino: "Soritor", sxTM: 561.40 },
      { destino: "Moyobamba", sxTM: 569.69 },
      { destino: "Tarapoto", sxTM: 601.05 },
      { destino: "Yurimaguas", sxTM: 659.29 },
    ],
  },
  {
    ruta: "Lima - Pisco - Huaytará - Ayacucho - Abancay - Cusco",
    destinos: [
      { destino: "Huaytará", sxTM: 115.18 },
      { destino: "Ayacucho", sxTM: 183.53 },
      { destino: "Andahuaylas", sxTM: 389.74 },
      { destino: "Abancay", sxTM: 493.44 },
      { destino: "Curahuasi", sxTM: 522.21 },
      { destino: "Izcuchaca", sxTM: 558.89 },
      { destino: "Cuzco", sxTM: 569.24 },
    ],
  },
  {
    ruta: "Lima - Lambayeque - Olmos - Chamaya - El Reposo - Santa María de Nieva + Rioja - Tarapoto - Yurimaguas",
    destinos: [
      { destino: "Lambayeque", sxTM: 219.21 },
      { destino: "El Tambo", sxTM: 318.98 },
      { destino: "Pucará", sxTM: 333.03 },
      { destino: "Chamaya", sxTM: 351.12 },
      { destino: "El Reposo", sxTM: 358.38 },
      { destino: "El Valor", sxTM: 359.36 },
      { destino: "El Milagro", sxTM: 365.38 },
      { destino: "Mesones Muro", sxTM: 435.29 },
      { destino: "Santa María de Nieva", sxTM: 485.73 },
      { destino: "Bagua Grande", sxTM: 492.65 },
      { destino: "Pedro Ruíz Gallo", sxTM: 510.89 },
      { destino: "Rioja", sxTM: 560.20 },
      { destino: "Tarapoto", sxTM: 597.97 },
      { destino: "Yurimaguas", sxTM: 656.44 },
    ],
  },
  {
    ruta: "Lima - Arequipa - Juliaca - Puno",
    destinos: [
      { destino: "Arequipa", sxTM: 296.45 },
      { destino: "Dvo. Imata", sxTM: 347.33 },
      { destino: "Santa Lucía", sxTM: 382.94 },
      { destino: "Emp. RO3S Juliaca", sxTM: 407.51 },
      { destino: "Juliaca", sxTM: 407.87 },
      { destino: "Puno", sxTM: 442.79 },
    ],
  },
];
