import { Module, Injectable, Controller, Get, Post, Patch, Delete, Body, BadRequestException } from '@nestjs/common';
import { IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles, CurrentUser, JwtUser } from '../common/decorators';
import { MifactConfigService, URL_MIFACT_FORMATO } from './mifact-config.service';
import { MifactClient } from './mifact.client';
import { CorrelativosService } from './correlativos.service';
import { MifactMapper } from './mifact.mapper';
import { GreClient } from './gre.client';
import { GreMapper } from './gre.mapper';
import { ValorReferencialService } from './valor-referencial.service';

class UpdateEmisorDto {
  @IsString() @IsOptional() ruc?: string;
  @IsString() @IsOptional() razonSocial?: string;
  @IsString() @IsOptional() nombreComercial?: string;
  @IsString() @IsOptional() ubigeo?: string;
  @IsString() @IsOptional() direccionFiscal?: string;
  @IsString() @IsOptional() codAnexo?: string;
  @IsString() @IsOptional() serieFactura?: string;
  @IsString() @IsOptional() serieBoleta?: string;
  @IsString() @IsOptional() serieNotaCredito?: string;
  @IsString() @IsOptional() serieNotaDebito?: string;
  @IsString() @IsOptional() serieGuiaTransportista?: string;
  @IsString() @IsOptional() registroMtc?: string;
  @IsString() @IsOptional() puntoVenta?: string;
  @IsString() @IsOptional() ctaDetraccion?: string;
  @IsNumber() @Min(0) @IsOptional() porcDetraccion?: number;
  @IsString() @IsOptional() codDetraccion?: string;
  @IsNumber() @Min(0) @IsOptional() umbralDetraccion?: number;
  @IsString() @IsOptional() formatoImpresion?: string;
  @IsString() @IsOptional() correoEnvio?: string;
  @IsBoolean() @IsOptional() activo?: boolean;
}

// El token va aparte de los datos del emisor: solo se cambia a propósito y nunca vuelve al navegador.
// Los tokens de MiFact son base64 (letras, números, + / =).
const TOKEN_FORMATO = /^[A-Za-z0-9+/=]{8,200}$/;
class TokenDto {
  @IsString() @IsNotEmpty() @Matches(TOKEN_FORMATO, { message: 'El token no tiene el formato de MiFact (letras, números, + / =, sin espacios).' }) token: string;
}
// URL de producción del servicio de facturación de MiFact de la empresa (MiFact asigna una por RUC).
class UrlDto {
  @IsString() @IsNotEmpty() @Matches(URL_MIFACT_FORMATO, { message: 'La URL debe ser la del servicio de MiFact, p. ej. https://mifact.net.pe/mifactapi48/invoiceService.svc/' }) url: string;
}
class ProbarTokenDto {
  // Si viene, se prueba ESTE token contra todas las empresas (para saber de cuál es).
  // Si no, se prueba el token actual de la sede contra su RUC.
  @IsString() @IsOptional() @Matches(TOKEN_FORMATO, { message: 'El token no tiene el formato de MiFact (letras, números, + / =, sin espacios).' }) token?: string;
}

class SetCorrelativoDto {
  @IsIn(['01', '03', '07', '08', '31']) tipoDoc: string; // 01 factura · 03 boleta · 07 NC · 08 ND · 31 GRE transportista
  @IsNumber() @Min(1) desde: number; // próximo número a usar
}

const TIPOS_CPE = [
  { tipoDoc: '01', etiqueta: 'Factura' },
  { tipoDoc: '03', etiqueta: 'Boleta' },
  { tipoDoc: '07', etiqueta: 'Nota de crédito' },
  { tipoDoc: '08', etiqueta: 'Nota de débito' },
  { tipoDoc: '31', etiqueta: 'GRE transportista' },
];

@Injectable()
class EmisorService {
  constructor(private prisma: PrismaService, private mifact: MifactConfigService, private correlativos: CorrelativosService, private client: MifactClient) {}

  private ambienteInfo(config: any) {
    return { ambiente: this.mifact.ambiente, esProd: this.mifact.esProd, integracionConfigurada: this.mifact.integracionConfiguradaPara(config) };
  }

  // Estado del token de PRODUCCIÓN de la empresa, sin revelarlo (solo los últimos 4 caracteres).
  // origen: 'emisor' = cargado en Datos del emisor · 'servidor' = variable de entorno · '' = falta.
  private tokenInfo(config: any) {
    const { token, origen } = this.mifact.tokenProdDe(config);
    return { cargado: !!token, origen, final: token ? token.slice(-4) : '' };
  }

  // URL de PRODUCCIÓN del servicio de la empresa (no es secreta) y de dónde sale.
  private servicioInfo(config: any) {
    return this.mifact.urlProdDe(config);
  }

  // Fila del emisor de la sede, completa (con token y URL). Solo para uso interno.
  private async filaDe(sedeId: string) {
    await this.get(sedeId); // la crea si no existe
    return (await this.prisma.emisorConfig.findUnique({ where: { sedeId } }))!;
  }

  private seriePorTipo(config: any, tipoDoc: string): string {
    if (tipoDoc === '03') return config.serieBoleta || 'BN01';
    if (tipoDoc === '07') return config.serieNotaCredito || config.serieFactura || 'FN01';
    if (tipoDoc === '08') return config.serieNotaDebito || config.serieFactura || 'FD01';
    if (tipoDoc === '31') return config.serieGuiaTransportista || 'V001';
    return config.serieFactura || 'FN01';
  }

  // Próximo correlativo de cada tipo de comprobante (para mostrar y editar en el portal).
  private async correlativosDe(sedeId: string, config: any) {
    return Promise.all(
      TIPOS_CPE.map(async (t) => ({ ...t, serie: this.seriePorTipo(config, t.tipoDoc), siguiente: await this.correlativos.peek(sedeId, t.tipoDoc, this.seriePorTipo(config, t.tipoDoc)) })),
    );
  }

  // Devuelve la config del emisor de la sede; si no existe, la crea con los datos
  // que ya conocemos de la sede (RUC y razón social).
  async get(sedeId: string) {
    let config = await this.prisma.emisorConfig.findUnique({ where: { sedeId } });
    if (!config) {
      const sede = await this.prisma.sede.findUnique({ where: { id: sedeId }, select: { ruc: true, nombre: true } });
      config = await this.prisma.emisorConfig.create({
        data: { sedeId, ruc: sede?.ruc ?? '', razonSocial: sede?.nombre ?? '' },
      });
    }
    const correlativos = await this.correlativosDe(sedeId, config);
    // El token es secreto: se quita de la configuración que va al navegador. La URL va aparte
    // (en "servicio"): se cambia solo desde su propio campo, que la valida.
    const { mifactToken: _secreto, mifactUrlProd: _url, ...publico } = config;
    void _secreto;
    void _url;
    return { config: publico, correlativos, token: this.tokenInfo(config), servicio: this.servicioInfo(config), ...this.ambienteInfo(config) };
  }

  private rucDe(config: any) {
    const ruc = String(config?.ruc || '').trim();
    if (!/^\d{11}$/.test(ruc)) throw new BadRequestException('Primero guarda el RUC de la empresa (11 dígitos) en Datos del emisor.');
    return ruc;
  }

  // Guarda el token de producción de la empresa. Antes se verifica con MiFact que corresponda a su
  // RUC: un token de otra empresa se rechaza aquí y no al momento de emitir.
  async setToken(sedeId: string, token: string) {
    const config = await this.filaDe(sedeId);
    const ruc = this.rucDe(config);
    const limpio = token.trim();
    const { url } = this.mifact.urlProdDe(config);
    const prueba = await this.client.probarToken(limpio, ruc, url).catch((e: any) => ({ ok: null as boolean | null, mensaje: `No se pudo verificar con MiFact: ${e?.message || 'error de red'}` }));
    if (prueba.ok === false) {
      // ¿De qué empresa es? Ayuda a ubicarlo en la sede correcta.
      const candidatas: { ok: boolean | null; ruc: string; nombre: string }[] = await this.identificar(limpio).catch(() => []);
      const otra = candidatas.find((r) => r.ok && r.ruc !== ruc);
      throw new BadRequestException(
        `Este token no corresponde al RUC ${ruc}.` +
          (otra
            ? ` Es el token de ${otra.nombre} (RUC ${otra.ruc}): cárgalo en esa empresa.`
            : ` ${prueba.mensaje}. Se probó en ${url}: revisa que sea la URL del servicio que MiFact te dio para este RUC (cada empresa puede tener la suya).`),
      );
    }
    await this.prisma.emisorConfig.update({ where: { sedeId }, data: { mifactToken: limpio } });
    return { ...(await this.get(sedeId)), verificacion: prueba };
  }

  // Guarda la URL de producción del servicio de la empresa. Antes se comprueba que responda como
  // MiFact (una URL mal escrita se frena aquí y no al emitir) y, si hay token, que lo acepte.
  async setUrl(sedeId: string, url: string) {
    const config = await this.filaDe(sedeId);
    const ruc = this.rucDe(config);
    const limpia = this.mifact.conBarra(url);
    const { token } = this.mifact.tokenProdDe(config);
    // Sin token se prueba con uno de relleno: MiFact responde "token incorrecto" en JSON, y con eso
    // basta para saber que la URL es la de su servicio.
    let prueba: { ok: boolean | null; mensaje: string };
    try {
      prueba = await this.client.probarToken(token || 'AAAAAAAAAAAAAAAAAAAAAA==', ruc, limpia);
    } catch (e: any) {
      throw new BadRequestException(`La URL no responde como el servicio de MiFact (${e?.message || 'error de red'}). Revísala y vuelve a intentar.`);
    }
    await this.prisma.emisorConfig.update({ where: { sedeId }, data: { mifactUrlProd: limpia } });
    const verificacion = token
      ? prueba.ok === false
        ? { ok: false, mensaje: `URL guardada, pero el token actual de la empresa no sirve en ella: ${prueba.mensaje}. Carga el token que MiFact te dio para esta URL.` }
        : prueba
      : { ok: null, mensaje: 'URL guardada. Ahora carga el token de esta empresa.' };
    return { ...(await this.get(sedeId)), verificacion };
  }

  async quitarUrl(sedeId: string) {
    await this.get(sedeId);
    await this.prisma.emisorConfig.update({ where: { sedeId }, data: { mifactUrlProd: '' } });
    return this.get(sedeId);
  }

  async quitarToken(sedeId: string) {
    await this.get(sedeId);
    await this.prisma.emisorConfig.update({ where: { sedeId }, data: { mifactToken: '' } });
    return this.get(sedeId);
  }

  // Prueba un token contra el RUC de cada empresa del sistema (para saber de cuál es).
  private async identificar(token: string) {
    const [sedes, emisores] = await Promise.all([
      this.prisma.sede.findMany({ where: { activa: true }, orderBy: { orden: 'asc' }, select: { id: true, nombre: true, ruc: true } }),
      this.prisma.emisorConfig.findMany({ select: { sedeId: true, ruc: true, razonSocial: true, mifactUrlProd: true } }),
    ]);
    const empresas = sedes
      .map((s) => {
        const e = emisores.find((x) => x.sedeId === s.id);
        return { sedeId: s.id, nombre: e?.razonSocial || s.nombre, ruc: (e?.ruc || s.ruc || '').trim(), url: this.mifact.urlProdDe(e).url };
      })
      .filter((x) => /^\d{11}$/.test(x.ruc));
    // Cada empresa se prueba en SU URL de producción.
    return Promise.all(
      empresas.map(async ({ url, ...x }) => ({
        ...x,
        ...(await this.client.probarToken(token, x.ruc, url).catch((e: any) => ({ ok: null as boolean | null, mensaje: `No se pudo consultar a MiFact: ${e?.message || 'error de red'}` }))),
      })),
    );
  }

  // Sin token: prueba el de la sede contra su RUC. Con token: dice a qué empresa pertenece.
  async probarToken(sedeId: string, token?: string) {
    if (token?.trim()) return { resultados: await this.identificar(token.trim()) };
    const config = await this.filaDe(sedeId);
    const ruc = this.rucDe(config);
    const actual = this.mifact.tokenProdDe(config);
    if (!actual.token) throw new BadRequestException(`La empresa (RUC ${ruc}) no tiene token de producción cargado.`);
    const r = await this.client.probarToken(actual.token, ruc, this.mifact.urlProdDe(config).url);
    return { resultados: [{ sedeId, nombre: config.razonSocial, ruc, ...r }] };
  }

  async update(sedeId: string, dto: UpdateEmisorDto) {
    const { config } = await this.get(sedeId); // garantiza que exista la fila
    // Candado: no se puede guardar en esta empresa el RUC de OTRA empresa del sistema (pasaba al
    // cambiar de empresa con la pantalla abierta: se pisaban los datos del emisor de la otra).
    const rucNuevo = dto.ruc?.trim();
    if (rucNuevo) {
      const otra = await this.prisma.sede.findFirst({ where: { ruc: rucNuevo, id: { not: sedeId } }, select: { nombre: true } });
      if (otra) {
        throw new BadRequestException(`El RUC ${rucNuevo} es de ${otra.nombre}, no de la empresa en sesión. Cambia a esa empresa (arriba) y vuelve a abrir Datos del emisor.`);
      }
    }
    // El token y la URL pertenecen a un RUC: si cambia el RUC, dejan de servir y se borran.
    const cambiaRuc = dto.ruc !== undefined && dto.ruc.trim() !== String(config.ruc || '').trim();
    await this.prisma.emisorConfig.update({ where: { sedeId }, data: { ...dto, ...(cambiaRuc ? { mifactToken: '', mifactUrlProd: '' } : {}) } });
    return this.get(sedeId);
  }

  // Fija desde qué número arranca una serie/tipo. Solo se puede AVANZAR (no bajar),
  // para nunca repetir un correlativo ya emitido.
  async setCorrelativo(sedeId: string, tipoDoc: string, desde: number) {
    const config = await this.prisma.emisorConfig.findUnique({ where: { sedeId } });
    if (!config) throw new BadRequestException('Configura primero los datos del emisor.');
    const serie = this.seriePorTipo(config, tipoDoc);
    const actual = Number(await this.correlativos.peek(sedeId, tipoDoc, serie));
    // En producción el correlativo solo puede avanzar (no repetir números ya emitidos).
    // En demo se permite bajarlo para poder resetear la numeración de las pruebas.
    if (desde < actual && this.mifact.esProd) {
      throw new BadRequestException(`No se puede fijar en ${desde}: la serie ${serie} ya va por ${actual}. En producción el correlativo solo puede avanzar.`);
    }
    await this.correlativos.fijarInicio(sedeId, tipoDoc, serie, desde);
    return this.get(sedeId);
  }
}

@Roles('Administrador')
@Controller('emisor')
class EmisorController {
  constructor(private readonly service: EmisorService) {}
  @Get() get(@CurrentUser() u: JwtUser) { return this.service.get(u.sedeId); }
  @Patch() update(@CurrentUser() u: JwtUser, @Body() dto: UpdateEmisorDto) { return this.service.update(u.sedeId, dto); }
  @Patch('correlativo') setCorrelativo(@CurrentUser() u: JwtUser, @Body() dto: SetCorrelativoDto) { return this.service.setCorrelativo(u.sedeId, dto.tipoDoc, dto.desde); }
  // Token de producción de MiFact de la empresa en sesión.
  @Patch('token') setToken(@CurrentUser() u: JwtUser, @Body() dto: TokenDto) { return this.service.setToken(u.sedeId, dto.token); }
  @Delete('token') quitarToken(@CurrentUser() u: JwtUser) { return this.service.quitarToken(u.sedeId); }
  // URL de producción del servicio de MiFact de la empresa en sesión (vacía = la del servidor).
  @Patch('url') setUrl(@CurrentUser() u: JwtUser, @Body() dto: UrlDto) { return this.service.setUrl(u.sedeId, dto.url); }
  @Delete('url') quitarUrl(@CurrentUser() u: JwtUser) { return this.service.quitarUrl(u.sedeId); }
  @Post('token/probar') probarToken(@CurrentUser() u: JwtUser, @Body() dto: ProbarTokenDto) { return this.service.probarToken(u.sedeId, dto.token); }
}

// --- Valor referencial de la detracción (tablas del DS 022-2025-MTC) ---
class ValorRefDto {
  @IsIn(['local', 'nacional']) ambito: string;
  @IsNumber() @Min(0) @IsOptional() pesoTM?: number; // toneladas transportadas
  // nacional
  @IsString() @IsOptional() ruta?: string;
  @IsString() @IsOptional() destino?: string;
  // local (puerto)
  @IsString() @IsOptional() puerto?: string;
  @IsString() @IsOptional() zona?: string;
  @IsString() @IsOptional() tipoCarga?: string;
}

@Controller('facturacion/tarifas')
class TarifasController {
  constructor(private readonly vr: ValorReferencialService) {}
  @Get('meta') meta() { return this.vr.meta(); }
  @Post('valor-referencial') calcular(@Body() dto: ValorRefDto) { return this.vr.calcular(dto as any); }
}

@Module({
  controllers: [EmisorController, TarifasController],
  providers: [EmisorService, MifactConfigService, MifactClient, CorrelativosService, MifactMapper, GreClient, GreMapper, ValorReferencialService],
  exports: [MifactConfigService, MifactClient, CorrelativosService, MifactMapper, GreClient, GreMapper, ValorReferencialService],
})
export class FacturacionElectronicaModule {}
