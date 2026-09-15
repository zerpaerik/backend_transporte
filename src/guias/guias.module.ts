import { Module, Injectable, NotFoundException, BadRequestException, Controller, Get, Post, Param, Body } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, JwtUser } from '../common/decorators';
import { FacturacionElectronicaModule } from '../facturacion-electronica/facturacion-electronica.module';
import { GreClient } from '../facturacion-electronica/gre.client';
import { GreMapper, type GreInput } from '../facturacion-electronica/gre.mapper';
import { MifactConfigService } from '../facturacion-electronica/mifact-config.service';
import { CorrelativosService } from '../facturacion-electronica/correlativos.service';

class GreItemDto {
  @IsString() descripcion: string;
  @IsNumber() @Min(0) @IsOptional() cantidad?: number;
  @IsNumber() @Min(0) @IsOptional() peso?: number;
  @IsString() @IsOptional() unidad?: string;
}
class GuiaInputDto {
  @IsDateString() @IsOptional() fechaTraslado?: string;
  @IsString() @IsOptional() partidaDir?: string;
  @IsString() @IsOptional() partidaUbigeo?: string;
  @IsString() @IsOptional() llegadaDir?: string;
  @IsString() @IsOptional() llegadaUbigeo?: string;
  // Remitente (por defecto el cliente del viaje, pero editable)
  @IsString() @IsOptional() remitenteRuc?: string;
  @IsString() @IsOptional() remitenteRazon?: string;
  @IsString() @IsOptional() destinatarioRuc?: string;
  @IsString() @IsOptional() destinatarioRazon?: string;
  // Conductor y vehículos (precargados del viaje, editables para corregir DNI/licencia/TUC)
  @IsString() @IsOptional() conductorNombre?: string;
  @IsString() @IsOptional() conductorDni?: string;
  @IsString() @IsOptional() conductorLicencia?: string;
  @IsString() @IsOptional() placaTracto?: string;
  @IsString() @IsOptional() tucTracto?: string;
  @IsString() @IsOptional() placaCarreta?: string;
  @IsString() @IsOptional() tucCarreta?: string;
  @IsNumber() @Min(0) @IsOptional() pesoBruto?: number;
  @IsString() @IsOptional() unidad?: string;
  @IsString() @IsOptional() docRefTipo?: string;
  @IsString() @IsOptional() docRefNumero?: string;
  @IsIn(['remitente', 'tercero', 'subcontratado']) @IsOptional() pagadorFlete?: string;
  @IsString() @IsOptional() terceroRuc?: string;
  @IsString() @IsOptional() terceroRazon?: string;
  @IsString() @IsOptional() observaciones?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => GreItemDto) @IsOptional() items?: GreItemDto[];
}
class AnularGuiaDto { @IsString() @IsOptional() motivo?: string; }

const TIPO_GUR = '31'; // guía de remisión del transportista

@Injectable()
class GuiasService {
  constructor(
    private prisma: PrismaService,
    private gre: GreClient,
    private mapper: GreMapper,
    private cfg: MifactConfigService,
    private correlativos: CorrelativosService,
  ) {}

  private fechaISO(d: any): string { return new Date(d).toISOString().slice(0, 10); }

  private async ctx(sedeId: string, viajeId: string) {
    const viaje = await this.prisma.viaje.findFirst({ where: { id: viajeId, sedeId } });
    if (!viaje) throw new NotFoundException('Viaje no encontrado');
    const emisor = await this.prisma.emisorConfig.findUnique({ where: { sedeId } });
    if (!emisor) throw new BadRequestException('Configura primero los datos del emisor.');
    const [conductor, tracto, carreta] = await Promise.all([
      viaje.conductor ? this.prisma.conductor.findFirst({ where: { sedeId, nombre: viaje.conductor } }) : null,
      viaje.placaTracto ? this.prisma.vehiculo.findFirst({ where: { sedeId, placa: viaje.placaTracto } }) : null,
      viaje.carreta ? this.prisma.vehiculo.findFirst({ where: { sedeId, placa: viaje.carreta } }) : null,
    ]);
    return { viaje, emisor, conductor, tracto, carreta };
  }

  private emisorMap(e: any) {
    return { registroMtc: e.registroMtc, ruc: e.ruc, razonSocial: e.razonSocial, nombreComercial: e.nombreComercial, ubigeo: e.ubigeo, direccionFiscal: e.direccionFiscal, puntoVenta: e.puntoVenta };
  }

  private armarInput(c: any, dto: GuiaInputDto, serie: string, correlativo: string): GreInput {
    const { viaje, conductor, tracto, carreta } = c;
    const hoy = new Date().toISOString().slice(0, 10);
    // Cada campo: lo que envía el formulario (dto) manda; si no vino, se usa el dato del viaje/BD.
    const pick = (v: any, def: any) => (v !== undefined && v !== null && String(v).trim() !== '' ? v : def);
    return {
      serie, correlativo,
      fechaEmision: hoy,
      fechaTraslado: dto.fechaTraslado || (viaje.fechaViaje ? this.fechaISO(viaje.fechaViaje) : hoy),
      partidaDir: pick(dto.partidaDir, viaje.origen || ''),
      partidaUbigeo: dto.partidaUbigeo || '',
      llegadaDir: pick(dto.llegadaDir, viaje.destino || ''),
      llegadaUbigeo: dto.llegadaUbigeo || '',
      remitente: { ruc: pick(dto.remitenteRuc, viaje.clienteRuc || ''), razonSocial: pick(dto.remitenteRazon, viaje.cliente || '') },
      destinatario: dto.destinatarioRuc || dto.destinatarioRazon ? { ruc: dto.destinatarioRuc, razonSocial: dto.destinatarioRazon } : undefined,
      conductor: {
        nombre: pick(dto.conductorNombre, viaje.conductor || conductor?.nombre || ''),
        dni: pick(dto.conductorDni, conductor?.dni || ''),
        licencia: pick(dto.conductorLicencia, conductor?.licencia || ''),
      },
      placaTracto: pick(dto.placaTracto, viaje.placaTracto || ''),
      tucTracto: pick(dto.tucTracto, tracto?.constanciaTuc || ''),
      placaCarreta: pick(dto.placaCarreta, viaje.carreta || ''),
      tucCarreta: pick(dto.tucCarreta, carreta?.constanciaTuc || ''),
      pesoBruto: dto.pesoBruto,
      unidad: dto.unidad || 'KGM',
      items: (dto.items || []).map((i) => ({ descripcion: i.descripcion, cantidad: i.cantidad, peso: i.peso, unidad: i.unidad })),
      docRefTipo: dto.docRefTipo || '09',
      docRefNumero: dto.docRefNumero || viaje.factura || '',
      pagadorFlete: (dto.pagadorFlete as any) || 'remitente',
      tercero: dto.terceroRuc || dto.terceroRazon ? { ruc: dto.terceroRuc, razonSocial: dto.terceroRazon } : undefined,
      observaciones: dto.observaciones,
    };
  }

  // Datos precargados del viaje para el formulario de GRE (todo editable en la UI).
  async datos(sedeId: string, viajeId: string) {
    const c = await this.ctx(sedeId, viajeId);
    const { viaje, conductor, tracto, carreta, emisor } = c;
    const serie = emisor.serieGuiaTransportista || 'V001';
    const hoy = new Date().toISOString().slice(0, 10);
    return {
      viajeId,
      codigo: (viaje as any).codigo || '',
      ambiente: this.cfg.ambiente,
      esProd: this.cfg.esProd,
      greConfigurada: this.cfg.greConfigurada,
      serie,
      correlativo: await this.correlativos.peek(sedeId, TIPO_GUR, serie),
      fechaTraslado: viaje.fechaViaje ? this.fechaISO(viaje.fechaViaje) : hoy,
      partidaDir: viaje.origen || '',
      llegadaDir: viaje.destino || '',
      remitenteRuc: (viaje as any).clienteRuc || '',
      remitenteRazon: viaje.cliente || '',
      conductorNombre: viaje.conductor || conductor?.nombre || '',
      conductorDni: conductor?.dni || '',
      conductorLicencia: conductor?.licencia || '',
      placaTracto: viaje.placaTracto || '',
      tucTracto: tracto?.constanciaTuc || '',
      placaCarreta: viaje.carreta || '',
      tucCarreta: carreta?.constanciaTuc || '',
      docRefNumero: (viaje as any).factura || '',
    };
  }

  // Arma el JSON SIN enviar nada (para revisar por viaje). Usa el próximo correlativo (peek).
  async preview(sedeId: string, viajeId: string, dto: GuiaInputDto) {
    const c = await this.ctx(sedeId, viajeId);
    const serie = c.emisor.serieGuiaTransportista || 'V001';
    const correlativo = await this.correlativos.peek(sedeId, TIPO_GUR, serie);
    const payload = this.mapper.sendGuia(this.armarInput(c, dto, serie, correlativo), this.emisorMap(c.emisor));
    return { ambiente: this.cfg.ambiente, greConfigurada: this.cfg.greConfigurada, payload };
  }

  private toData(sedeId: string, viajeId: string, input: GreInput) {
    const dest = input.destinatario || input.remitente;
    return {
      sedeId, viajeId, serie: input.serie, correlativo: input.correlativo, tipoGur: TIPO_GUR,
      fechaEmision: new Date(input.fechaEmision), fechaTraslado: new Date(input.fechaTraslado),
      partidaDir: input.partidaDir, partidaUbigeo: input.partidaUbigeo, llegadaDir: input.llegadaDir, llegadaUbigeo: input.llegadaUbigeo,
      remitenteRuc: input.remitente.ruc || '', remitenteRazon: input.remitente.razonSocial || '',
      destinatarioRuc: dest.ruc || '', destinatarioRazon: dest.razonSocial || '',
      conductorNombre: input.conductor.nombre, conductorDni: input.conductor.dni || '', conductorLicencia: input.conductor.licencia || '',
      placaTracto: input.placaTracto, tucTracto: input.tucTracto || '', placaCarreta: input.placaCarreta || '', tucCarreta: input.tucCarreta || '',
      pesoBruto: Number(input.pesoBruto || 0), unidad: input.unidad || 'KGM',
      docRefTipo: input.docRefTipo || '09', docRefNumero: input.docRefNumero || '',
      pagadorFlete: input.pagadorFlete || 'remitente', terceroRuc: input.tercero?.ruc || '', terceroRazon: input.tercero?.razonSocial || '',
      trasladoTotal: input.trasladoTotal !== false, observaciones: input.observaciones || '',
      itemsJson: JSON.stringify(input.items || []),
    };
  }

  // Revisa las causas comunes de rechazo de SUNAT ANTES de reservar número y enviar.
  private preflightGre(input: GreInput) {
    const e: string[] = [];
    const t = (v: any) => String(v ?? '').trim();
    const ubigeoOk = (v: string) => /^\d{6}$/.test(v);
    // Vehículo
    if (!t(input.placaTracto)) e.push('falta la placa del tracto');
    if (!t(input.tucTracto)) e.push('falta la TUC / constancia de inscripción del tracto (obligatoria para SUNAT)');
    // Conductor
    if (!t(input.conductor.nombre)) e.push('falta el nombre del conductor');
    if (t(input.conductor.dni).length !== 8) e.push('el DNI del conductor debe tener 8 dígitos');
    if (!t(input.conductor.licencia)) e.push('falta la licencia del conductor');
    // Ruta
    if (!ubigeoOk(t(input.partidaUbigeo))) e.push('el ubigeo de partida debe tener 6 dígitos');
    if (!ubigeoOk(t(input.llegadaUbigeo))) e.push('el ubigeo de llegada debe tener 6 dígitos');
    // Remitente
    if (t(input.remitente.ruc).length !== 11) e.push('el RUC del remitente debe tener 11 dígitos');
    // Documento de referencia (GRR/factura): formato SERIE-CORRELATIVO
    const ref = t(input.docRefNumero);
    if (!ref) e.push('falta el N° del documento de referencia (guía del remitente o factura)');
    else if (!/^[A-Za-z0-9]{1,4}-\d{1,8}$/.test(ref)) e.push(`el N° del documento de referencia "${ref}" no cumple el formato SUNAT (debe ser SERIE-CORRELATIVO, p. ej. T001-00001234)`);
    if (e.length) throw new BadRequestException('No se puede emitir la guía: ' + e.join(' · ') + '.');
  }

  async emitir(sedeId: string, viajeId: string, dto: GuiaInputDto) {
    const c = await this.ctx(sedeId, viajeId);
    if (!c.emisor.activo) throw new BadRequestException('La emisión electrónica no está habilitada para esta sede.');
    if (!this.cfg.greConfigurada) throw new BadRequestException(`Falta la URL de GRE de MiFact (MIFACT_GRE_BASE_URL) para el ambiente "${this.cfg.ambiente}".`);
    const serie = c.emisor.serieGuiaTransportista || 'V001';
    // Validar ANTES de reservar el correlativo (para no gastar numeración en un rechazo).
    this.preflightGre(this.armarInput(c, dto, serie, '00000000'));

    // Reservar y enviar. Si MiFact responde que el número YA EXISTE (por intentos previos
    // que llegaron a su BD), se avanza automáticamente al siguiente correlativo y se reintenta.
    const esDuplicado = (r: any) => /ya existe|already exists|existe en la bd/i.test(String(r?.errors || r?.sunat_description || ''));
    let input!: GreInput;
    let resp: any;
    const MAX_INTENTOS = 10;
    for (let i = 0; i < MAX_INTENTOS; i++) {
      const correlativo = await this.correlativos.reservar(sedeId, TIPO_GUR, serie);
      input = this.armarInput(c, dto, serie, correlativo);
      resp = await this.gre.sendGuia(this.mapper.sendGuia(input, this.emisorMap(c.emisor)));
      if (!esDuplicado(resp)) break;
    }
    const guia = await this.prisma.guiaTransportista.create({ data: this.toData(sedeId, viajeId, input) });
    const estadoDoc = String(resp.estado_documento || '');
    await this.prisma.guiaTransportista.update({
      where: { id: guia.id },
      data: {
        estadoDocumento: estadoDoc, sunatDescripcion: resp.sunat_description || resp.errors || '',
        hash: resp.codigo_hash || '', cdr: resp.cdr_sunat || null, xml: resp.xml_enviado || null, emitidoEn: new Date(),
      },
    });
    const actualizada = await this.prisma.guiaTransportista.findUnique({ where: { id: guia.id } });
    return { guia: actualizada, respuesta: { estado_documento: estadoDoc, errors: resp.errors || '', sunat_description: resp.sunat_description || '' } };
  }

  async listar(sedeId: string, viajeId: string) {
    return this.prisma.guiaTransportista.findMany({ where: { sedeId, viajeId }, orderBy: { createdAt: 'desc' } });
  }

  // Todas las guías de la sede (para la pantalla de gestión de GRE).
  async listarTodas(sedeId: string) {
    return this.prisma.guiaTransportista.findMany({ where: { sedeId }, orderBy: { createdAt: 'desc' } });
  }

  private async cargar(sedeId: string, id: string) {
    const g = await this.prisma.guiaTransportista.findFirst({ where: { id, sedeId } });
    if (!g) throw new NotFoundException('Guía no encontrada');
    return g;
  }
  private clave(g: any) { return { serie: g.serie, correlativo: g.correlativo, fechaEmision: this.fechaISO(g.fechaEmision) }; }
  private async emisorDe(sedeId: string) {
    const e = await this.prisma.emisorConfig.findUnique({ where: { sedeId } });
    if (!e) throw new BadRequestException('Configura primero los datos del emisor.');
    return this.emisorMap(e);
  }

  async estado(sedeId: string, id: string) {
    const g = await this.cargar(sedeId, id);
    if (!g.correlativo) throw new BadRequestException('La guía aún no fue emitida.');
    const resp = await this.gre.getEstatusGuia(this.mapper.getEstatus(this.clave(g), await this.emisorDe(sedeId)));
    await this.prisma.guiaTransportista.update({ where: { id }, data: { estadoDocumento: String(resp.estado_documento || g.estadoDocumento || ''), sunatDescripcion: resp.sunat_description || g.sunatDescripcion } });
    return this.cargar(sedeId, id);
  }
  async pdf(sedeId: string, id: string) {
    const g = await this.cargar(sedeId, id);
    if (!g.correlativo) throw new BadRequestException('La guía aún no fue emitida.');
    const resp = await this.gre.getGuia(this.mapper.getGuia(this.clave(g), await this.emisorDe(sedeId), { pdf: true }));
    if (!resp.pdf_bytes) throw new BadRequestException('MiFact no devolvió el PDF de la guía.');
    return { nombre: `${g.serie}-${g.correlativo}.pdf`, mime: 'application/pdf', base64: resp.pdf_bytes };
  }
  async anular(sedeId: string, id: string, motivo: string) {
    const g = await this.cargar(sedeId, id);
    if (!g.correlativo) throw new BadRequestException('La guía aún no fue emitida.');
    const resp = await this.gre.lowGuia(this.mapper.lowGuia(this.clave(g), await this.emisorDe(sedeId), motivo || 'ERROR EN EMISION'));
    await this.prisma.guiaTransportista.update({ where: { id }, data: { estadoDocumento: String(resp.estado_documento || '105'), sunatDescripcion: resp.sunat_description || 'Baja registrada en el portal de MiFact (la anulación ante SUNAT es por Clave SOL).' } });
    return this.cargar(sedeId, id);
  }
}

@Controller('gre')
class GuiasController {
  constructor(private readonly service: GuiasService) {}
  @Get() listarTodas(@CurrentUser() u: JwtUser) { return this.service.listarTodas(u.sedeId); }
  @Get('viaje/:viajeId') listar(@CurrentUser() u: JwtUser, @Param('viajeId') viajeId: string) { return this.service.listar(u.sedeId, viajeId); }
  @Get('viaje/:viajeId/datos') datos(@CurrentUser() u: JwtUser, @Param('viajeId') viajeId: string) { return this.service.datos(u.sedeId, viajeId); }
  @Post('viaje/:viajeId/preview') preview(@CurrentUser() u: JwtUser, @Param('viajeId') viajeId: string, @Body() dto: GuiaInputDto) { return this.service.preview(u.sedeId, viajeId, dto); }
  @Post('viaje/:viajeId/emitir') emitir(@CurrentUser() u: JwtUser, @Param('viajeId') viajeId: string, @Body() dto: GuiaInputDto) { return this.service.emitir(u.sedeId, viajeId, dto); }
  @Post(':id/estado') estado(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.estado(u.sedeId, id); }
  @Get(':id/pdf') pdf(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.service.pdf(u.sedeId, id); }
  @Post(':id/anular') anular(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: AnularGuiaDto) { return this.service.anular(u.sedeId, id, dto.motivo || ''); }
}

@Module({ imports: [FacturacionElectronicaModule], controllers: [GuiasController], providers: [GuiasService] })
export class GuiasModule {}
