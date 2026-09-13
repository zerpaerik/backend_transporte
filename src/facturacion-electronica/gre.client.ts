import { Injectable, Logger, BadGatewayException, GatewayTimeoutException, ServiceUnavailableException } from '@nestjs/common';
import { MifactConfigService } from './mifact-config.service';

/**
 * Cliente HTTP hacia el servicio de Guía de Remisión de MiFact (GuiaRemision.svc).
 * Igual que MifactClient pero contra la URL de guías (que MiFact entrega aparte).
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

  private async post(metodo: string, payload: Record<string, any>, timeoutMs = 30000): Promise<any> {
    if (!this.cfg.greBaseUrl) {
      throw new ServiceUnavailableException(`GRE: falta la URL del servicio de guías (MIFACT_GRE_BASE_URL) para el ambiente "${this.cfg.ambiente}".`);
    }
    if (!this.cfg.token) {
      throw new ServiceUnavailableException(`GRE: falta el token para el ambiente "${this.cfg.ambiente}".`);
    }

    const url = this.cfg.greBaseUrl + metodo;
    const cuerpo = JSON.stringify({ TOKEN: this.cfg.token, ...payload });

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
      return texto ? JSON.parse(texto) : {};
    } catch {
      throw new BadGatewayException(`GRE ${metodo}: respuesta no-JSON — ${texto.slice(0, 300)}`);
    }
  }

  /** Emitir la guía del transportista. */
  sendGuia(payload: Record<string, any>) {
    return this.post('SendGuia', payload);
  }
  getEstatusGuia(payload: Record<string, any>) {
    return this.post('GetEstatusGuia', payload);
  }
  getGuia(payload: Record<string, any>) {
    return this.post('GetGuia', payload);
  }
  lowGuia(payload: Record<string, any>) {
    return this.post('LowGuia', payload);
  }
  sendMailGuia(payload: Record<string, any>) {
    return this.post('SendMailGuia', payload);
  }
}
