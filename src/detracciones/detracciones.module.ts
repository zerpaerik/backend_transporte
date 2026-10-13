import { Module, Injectable, NotFoundException, BadRequestException, Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { ArrayMinSize, IsArray, IsString, Matches } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser, JwtUser } from '../common/decorators';

class LoteDto {
  @Matches(/^\d{6}$/, { message: 'El número de lote son 6 dígitos: año + correlativo (p. ej. 202623).' }) numero: string;
  @IsArray() @ArrayMinSize(1, { message: 'Elige al menos una factura.' }) @IsString({ each: true }) facturaIds: string[];
}

// ── Archivo plano de pago masivo de detracciones (SUNAT) ──
// Nombre: D + RUC + lote (6) + .TXT. Líneas de ancho fijo separadas por salto de línea.
// Cabecera (68): "P" (deposita el proveedor) + RUC (11) + razón social (35) + lote (6) + importe total (15).
// Detalle (107): tipo doc. del adquirente "6" (RUC) + RUC (11) + nombre (35, en blanco con RUC) +
//   proforma (9 ceros) + código del bien/servicio (3) + cuenta de detracciones del proveedor (11) +
//   importe (15) + tipo de operación "01" (2) + periodo AAAAMM (6) + tipo de comprobante (2) +
//   serie (4) + número (8).
// Importes en soles sin decimales (SUNAT exige enteros) y escritos con 2 decimales implícitos.
const izq = (v: string, n: number) => v.slice(0, n).padEnd(n, ' ');
const ceros = (v: string | number, n: number) => String(v).padStart(n, '0').slice(-n);
const importe = (soles: number) => ceros(Math.round(soles) * 100, 15);
// Razón social en mayúsculas, sin tildes ni signos (como en el archivo de ejemplo de la empresa).
const razon = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9& ]/g, '').replace(/\s+/g, ' ').trim();
// La fecha del comprobante es una fecha pura (se guarda a medianoche UTC): se lee tal cual, sin zona horaria.
const periodo = (d: Date) => d.toISOString().slice(0, 7).replace('-', '');

@Injectable()
class DetraccionesService {
  constructor(private prisma: PrismaService) {}

  list(sedeId: string) {
    return this.prisma.detraccionLote.findMany({ where: { sedeId }, orderBy: { numero: 'desc' }, select: { id: true, numero: true, total: true, cantidad: true, facturas: true, createdAt: true } });
  }

  // Sugerencia: el siguiente correlativo del año en curso (el usuario puede cambiarlo).
  async siguiente(sedeId: string) {
    const anio = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }).slice(0, 4);
    const ultimo = await this.prisma.detraccionLote.findFirst({ where: { sedeId, numero: { startsWith: anio } }, orderBy: { numero: 'desc' } });
    const n = ultimo ? Number(ultimo.numero.slice(4)) + 1 : 1;
    return { numero: anio + ceros(n, 2) };
  }

  async generar(sedeId: string, dto: LoteDto) {
    const [emisor, sede] = await Promise.all([
      this.prisma.emisorConfig.findUnique({ where: { sedeId } }),
      this.prisma.sede.findUnique({ where: { id: sedeId } }),
    ]);
    const ruc = emisor?.ruc || sede?.ruc || '';
    const cuenta = (emisor?.ctaDetraccion || '').replace(/\D/g, '');
    if (!/^\d{11}$/.test(ruc)) throw new BadRequestException('Falta el RUC del emisor (Datos del emisor).');
    if (!cuenta || cuenta.length > 11) throw new BadRequestException('Falta la cuenta de detracciones del Banco de la Nación en Datos del emisor.');
    if (await this.prisma.detraccionLote.findUnique({ where: { sedeId_numero: { sedeId, numero: dto.numero } } })) {
      throw new BadRequestException(`El lote ${dto.numero} ya existe. Usa otro número.`);
    }

    const facturas = await this.prisma.factura.findMany({ where: { sedeId, id: { in: dto.facturaIds } } });
    if (facturas.length !== dto.facturaIds.length) throw new NotFoundException('Alguna de las facturas elegidas no existe.');
    const errores: string[] = [];
    const lineas: string[] = [];
    let total = 0;
    for (const f of facturas.sort((a, b) => (a.serie + a.correlativo).localeCompare(b.serie + b.correlativo))) {
      const doc = `${f.serie}-${f.correlativo}`;
      if (!f.sujetoDetraccion || !(f.montoDetraccion > 0)) { errores.push(`${doc} no tiene detracción`); continue; }
      if (!['102', '103'].includes(f.estadoDocumento)) { errores.push(`${doc} no está aceptada por SUNAT`); continue; }
      if (f.detraccionNumero) { errores.push(`${doc} ya tiene la detracción depositada`); continue; }
      if (f.detraccionLote) { errores.push(`${doc} ya está en el lote ${f.detraccionLote}`); continue; }
      if (!/^\d{11}$/.test(f.ruc)) { errores.push(`${doc}: el cliente no tiene RUC de 11 dígitos`); continue; }
      if (!/^[A-Z0-9]{4}$/i.test(f.serie) || !/^\d{1,8}$/.test(f.correlativo)) { errores.push(`${doc}: serie o número no válidos`); continue; }
      let soles = f.montoDetraccion;
      if (f.moneda === 'USD') {
        if (!(f.tipoCambio > 0)) { errores.push(`${doc} está en dólares y no tiene tipo de cambio`); continue; }
        soles = f.montoDetraccion * f.tipoCambio;
      }
      soles = Math.round(soles);
      total += soles;
      lineas.push(
        '6' + f.ruc + izq('', 35) + ceros(0, 9) + ceros(f.codDetraccion || emisor?.codDetraccion || '027', 3) + ceros(cuenta, 11) +
        importe(soles) + '01' + periodo(f.fecha) + ceros(f.tipoDocCodigo || '01', 2) + f.serie.toUpperCase() + ceros(f.correlativo, 8),
      );
    }
    if (errores.length) throw new BadRequestException('No se puede generar el archivo: ' + errores.join(' · ') + '.');

    const cabecera = 'P' + ruc + izq(razon(emisor?.razonSocial || sede?.nombre || ''), 35) + dto.numero + importe(total);
    const contenido = [cabecera, ...lineas].join('\n') + '\n';
    const lote = await this.prisma.$transaction(async (tx) => {
      const l = await tx.detraccionLote.create({ data: { sedeId, numero: dto.numero, total, cantidad: lineas.length, facturas: facturas.map((f) => f.id), contenido } });
      await tx.factura.updateMany({ where: { sedeId, id: { in: dto.facturaIds } }, data: { detraccionLote: dto.numero } });
      return l;
    });
    return { id: lote.id, numero: lote.numero, total, cantidad: lineas.length, ...this.archivo(ruc, lote.numero, contenido) };
  }

  private archivo(ruc: string, numero: string, contenido: string) {
    return { nombre: `D${ruc}${numero}.TXT`, mime: 'text/plain', base64: Buffer.from(contenido, 'latin1').toString('base64') };
  }

  async descargar(sedeId: string, id: string) {
    const l = await this.prisma.detraccionLote.findFirst({ where: { id, sedeId } });
    if (!l) throw new NotFoundException('Lote no encontrado');
    return this.archivo(l.contenido.slice(1, 12), l.numero, l.contenido);
  }

  // Elimina un lote generado por error: sus facturas vuelven a quedar disponibles para otro archivo.
  async eliminar(sedeId: string, id: string) {
    const l = await this.prisma.detraccionLote.findFirst({ where: { id, sedeId } });
    if (!l) throw new NotFoundException('Lote no encontrado');
    await this.prisma.$transaction([
      this.prisma.factura.updateMany({ where: { sedeId, id: { in: l.facturas }, detraccionLote: l.numero }, data: { detraccionLote: '' } }),
      this.prisma.detraccionLote.delete({ where: { id } }),
    ]);
    return { ok: true };
  }
}

@Roles('Administrador', 'Operador', 'Contable')
@Controller('detracciones/lotes')
class DetraccionesController {
  constructor(private readonly service: DetraccionesService) {}
  @Get() list(@CurrentUser() u: JwtUser) { return this.service.list(u.sedeId); }
  @Get('siguiente') siguiente(@CurrentUser() u: JwtUser) { return this.service.siguiente(u.sedeId); }
  @Post() generar(@CurrentUser() u: JwtUser, @Body() dto: LoteDto) { return this.service.generar(u.sedeId, dto); }
  @Get(':id/archivo') descargar(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.descargar(u.sedeId, id); }
  @Delete(':id') eliminar(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.eliminar(u.sedeId, id); }
}

@Module({ controllers: [DetraccionesController], providers: [DetraccionesService] })
export class DetraccionesModule {}
