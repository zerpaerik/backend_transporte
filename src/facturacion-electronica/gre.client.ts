import { Injectable, Logger, BadGatewayException, GatewayTimeoutException, ServiceUnavailableException } from '@nestjs/common';
import { MifactConfigService, type CredencialMifact } from './mifact-config.service';

/**
 * Cliente HTTP hacia el servicio de Guía de Remisión de MiFact (GuiaRemision.svc).
 * Igual que MifactClient pero contra la URL de guías (que MiFact entrega aparte). Usa el mismo
 * token de la empresa (RUC) que emite: cada método recibe el emisor.
 * SUNAT no tiene ambiente demo de GRE: se valida el armado del JSON y se cierra en
 * producción con cuidado.
 */
@Injectable()
export class GreClient {
  private readonly log = new Logger('GreClient');

  constructor(private readonly cfg: MifactConfigService) {}

  get ambiente(): 'demo' | 'prod' {
    return this.cfg.ambiente;
  }

  private async post(metodo: string, emisor: CredencialMifact, payload: Record<string, any>, timeoutMs = 30000): Promise<any> {
    const baseUrl = this.cfg.greBaseUrlDe(emisor);
    if (!baseUrl) {
      throw new ServiceUnavailableException(`GRE: falta la URL del servicio de guías del RUC ${emisor.ruc || '(sin RUC)'} para el ambiente "${this.cfg.ambiente}".`);
    }
    const { token } = this.cfg.tokenDe(emisor);
    if (!token) {
      throw new ServiceUnavailableException(
        this.cfg.esProd
          ? `GRE: falta el token de producción del RUC ${emisor.ruc || '(sin RUC)'}. Cárgalo en Datos del emisor.`
          : 'GRE: falta el token demo (MIFACT_TOKEN_DEMO) en el servidor.',
      );
    }

    const url = baseUrl + metodo;
    const cuerpo = JSON.stringify({ TOKEN: token, ...payload });

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res: any;
    try {
      res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo, signal: ctrl.signal });
    } catch (e: any) {
      if (e?.name === 'AbortError') throw new GatewayTimeoutException(`GRE: MiFact no respondió a tiempo (${metodo}).`);
      throw new BadGatewayException(`GRE: no se pudo contactar a MiFact (${metodo}): ${e?.message || 'error de red'}`);
    } finally {
      clearTimeout(timer);
    }

    const texto: string = await res.text();
    if (!res.ok) {
      this.log.warn(`GRE ${metodo} → HTTP ${res.status}`);
      throw new BadGatewayException(`GRE ${metodo}: HTTP ${res.status} — ${texto.slice(0, 300)}`);
    }
    try {
      return repararTextos(texto ? JSON.parse(texto) : {});
    } catch {
      throw new BadGatewayException(`GRE ${metodo}: respuesta no-JSON — ${texto.slice(0, 300)}`);
    }
  }

  /** Emitir la guía del transportista. */
  sendGuia(emisor: CredencialMifact, payload: Record<string, any>) {
    return this.post('SendGuia', emisor, payload, 60000); // SUNAT puede demorar: más margen antes de cortar
  }
  getEstatusGuia(emisor: CredencialMifact, payload: Record<string, any>) {
    return this.post('GetEstatusGuia', emisor, payload);
  }
  getGuia(emisor: CredencialMifact, payload: Record<string, any>) {
    return this.post('GetGuia', emisor, payload);
  }
  lowGuia(emisor: CredencialMifact, payload: Record<string, any>) {
    return this.post('LowGuia', emisor, payload);
  }
  sendMailGuia(emisor: CredencialMifact, payload: Record<string, any>) {
    return this.post('SendMailGuia', emisor, payload);
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
