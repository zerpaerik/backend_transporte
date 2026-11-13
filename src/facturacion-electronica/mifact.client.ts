import { Injectable, Logger, BadGatewayException, GatewayTimeoutException, ServiceUnavailableException } from '@nestjs/common';
import { MifactConfigService, type CredencialMifact } from './mifact-config.service';

/**
 * Cliente HTTP hacia el API JSON de MiFact (servicio invoiceService.svc).
 *
 * - El token va DENTRO del cuerpo JSON (campo "TOKEN"), no en un header.
 * - Cada empresa (RUC) tiene su propio token y su propia URL de producción: cada método recibe
 *   el emisor y ambos se resuelven con MifactConfigService (demo/prod).
 * - Errores de red / timeout se traducen a excepciones claras para la UI.
 *
 * Este cliente solo ENVÍA lo que se le pasa. El armado del payload (mapper) y las
 * reglas de negocio (detracción, correlativos, idempotencia) viven fuera.
 */
@Injectable()
export class MifactClient {
  private readonly log = new Logger('MifactClient');

  constructor(private readonly cfg: MifactConfigService) {}

  get ambiente(): 'demo' | 'prod' {
    return this.cfg.ambiente;
  }

  // URL y token del ambiente actual para esta empresa.
  private destino(emisor: CredencialMifact) {
    const baseUrl = this.cfg.baseUrlDe(emisor);
    if (!baseUrl) {
      throw new ServiceUnavailableException(
        this.cfg.esProd
          ? `MiFact: falta la URL del servicio del RUC ${emisor.ruc || '(sin RUC)'}. Cárgala en Datos del emisor.`
          : 'MiFact: falta la URL demo (MIFACT_BASE_URL_DEMO) en el servidor.',
      );
    }
    const { token } = this.cfg.tokenDe(emisor);
    if (!token) {
      throw new ServiceUnavailableException(
        this.cfg.esProd
          ? `MiFact: falta el token de producción del RUC ${emisor.ruc || '(sin RUC)'}. Cárgalo en Datos del emisor.`
          : 'MiFact: falta el token demo (MIFACT_TOKEN_DEMO) en el servidor.',
      );
    }
    return { baseUrl, token };
  }

  private async post(metodo: string, payload: Record<string, any>, destino: { baseUrl: string; token: string }, timeoutMs = 30000): Promise<any> {
    const url = destino.baseUrl + metodo;
    const cuerpo = JSON.stringify({ TOKEN: destino.token, ...payload });

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: any;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: cuerpo,
        signal: ctrl.signal,
      });
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        throw new GatewayTimeoutException(`MiFact no respondió a tiempo (${metodo}).`);
      }
      throw new BadGatewayException(`No se pudo contactar a MiFact (${metodo}): ${e?.message || 'error de red'}`);
    } finally {
      clearTimeout(timer);
    }

    const texto: string = await res.text();
    if (!res.ok) {
      this.log.warn(`MiFact ${metodo} → HTTP ${res.status}`);
      throw new BadGatewayException(`MiFact ${metodo}: HTTP ${res.status} — ${texto.slice(0, 300)}`);
    }
    try {
      return repararTextos(texto ? JSON.parse(texto) : {});
    } catch {
      throw new BadGatewayException(`MiFact ${metodo}: respuesta no-JSON — ${texto.slice(0, 300)}`);
    }
  }

  /** Emitir un comprobante (factura/boleta/NC/ND). */
  sendInvoice(emisor: CredencialMifact, payload: Record<string, any>) {
    return this.post('SendInvoice', payload, this.destino(emisor), 60000); // SUNAT puede demorar: más margen antes de cortar
  }
  /** Consultar el estado (MiFact + SUNAT) de un comprobante ya enviado. */
  getEstatusInvoice(emisor: CredencialMifact, payload: Record<string, any>) {
    return this.post('GetEstatusInvoice', payload, this.destino(emisor));
  }
  /** Obtener PDF / XML / CDR de un comprobante. */
  getInvoice(emisor: CredencialMifact, payload: Record<string, any>) {
    return this.post('GetInvoice', payload, this.destino(emisor));
  }
  /** Anular / dar de baja un comprobante. */
  lowInvoice(emisor: CredencialMifact, payload: Record<string, any>) {
    return this.post('LowInvoice', payload, this.destino(emisor));
  }
  /** Reenviar el comprobante por correo. */
  sendMailInvoice(emisor: CredencialMifact, payload: Record<string, any>) {
    return this.post('SendMailInvoice', payload, this.destino(emisor));
  }

  /**
   * Comprueba si un token de PRODUCCIÓN corresponde a un RUC, sin emitir nada: consulta en la URL
   * de producción de la empresa un comprobante que no existe (FZ99-99999999). Es solo lectura, así
   * que se puede usar aunque el sistema esté en demo. Respuestas de MiFact:
   *   · token correcto      → "El documento consultado no existe"
   *   · token de otro RUC   → "TOKEN INCORRECTO PARA <RUC>"
   *   · token mal copiado   → "Invalid length for a Base-64 ..."
   */
  async probarToken(token: string, ruc: string, urlProd: string): Promise<{ ok: boolean | null; mensaje: string }> {
    const baseUrl = this.cfg.conBarra(urlProd);
    if (!baseUrl) throw new ServiceUnavailableException(`MiFact: falta la URL de producción del RUC ${ruc}. Cárgala en Datos del emisor.`);
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    const r = await this.post(
      'GetEstatusInvoice',
      { NUM_NIF_EMIS: ruc, COD_TIP_CPE: '01', NUM_SERIE_CPE: 'FZ99', NUM_CORRE_CPE: '99999999', FEC_EMIS: hoy },
      { baseUrl, token },
    );
    const err = String(r?.errors || '');
    if (r?.estado_documento || /no existe/i.test(err)) return { ok: true, mensaje: 'El token corresponde a este RUC.' };
    // Token mal copiado: MiFact no lo puede descifrar ("Base-64", "data to decrypt", "padding", "Bad Data").
    if (/token|base-64|decrypt|padding|bad data/i.test(err)) return { ok: false, mensaje: `MiFact rechazó el token para el RUC ${ruc}: ${err.replace(/^Error\s*:\s*/i, '')}` };
    return { ok: null, mensaje: err ? `Respuesta no reconocida de MiFact: ${err}` : 'MiFact no devolvió un resultado reconocible.' };
  }
}

// Algunos mensajes (los que vienen de SUNAT) llegan con los acentos dañados: UTF-8 leído como
// Latin-1 ("autenticaciÃ³n"). Se reparan solo los textos con ese patrón y sin otros caracteres.
function repararTextos<T>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof v !== 'string' || v.length > 5000 || !/[ÃÂ][\u0080-\u00BF]/.test(v) || /[^\u0000-\u00FF]/.test(v)) continue;
    const r = Buffer.from(v, 'latin1').toString('utf8');
    if (!r.includes('\uFFFD')) (obj as Record<string, unknown>)[k] = r;
  }
  return obj;
}
