import { Injectable, Logger, BadGatewayException, GatewayTimeoutException, ServiceUnavailableException } from '@nestjs/common';
import { MifactConfigService } from './mifact-config.service';

/**
 * Cliente HTTP hacia el API JSON de MiFact (servicio invoiceService.svc).
 *
 * - El token va DENTRO del cuerpo JSON (campo "TOKEN"), no en un header.
 * - La URL base y el token se resuelven por ambiente (demo/prod) desde variables
 *   de entorno vía MifactConfigService; este cliente nunca los hardcodea.
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

  private async post(metodo: string, payload: Record<string, any>, timeoutMs = 30000): Promise<any> {
    if (!this.cfg.baseUrl) {
      throw new ServiceUnavailableException(`MiFact: falta la URL base para el ambiente "${this.cfg.ambiente}".`);
    }
    if (!this.cfg.token) {
      throw new ServiceUnavailableException(`MiFact: falta el token para el ambiente "${this.cfg.ambiente}".`);
    }

    const url = this.cfg.baseUrl + metodo;
    const cuerpo = JSON.stringify({ TOKEN: this.cfg.token, ...payload });

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
      return texto ? JSON.parse(texto) : {};
    } catch {
      throw new BadGatewayException(`MiFact ${metodo}: respuesta no-JSON — ${texto.slice(0, 300)}`);
    }
  }

  /** Emitir un comprobante (factura/boleta/NC/ND). */
  sendInvoice(payload: Record<string, any>) {
    return this.post('SendInvoice', payload);
  }
  /** Consultar el estado (MiFact + SUNAT) de un comprobante ya enviado. */
  getEstatusInvoice(payload: Record<string, any>) {
    return this.post('GetEstatusInvoice', payload);
  }
  /** Obtener PDF / XML / CDR de un comprobante. */
  getInvoice(payload: Record<string, any>) {
    return this.post('GetInvoice', payload);
  }
  /** Anular / dar de baja un comprobante. */
  lowInvoice(payload: Record<string, any>) {
    return this.post('LowInvoice', payload);
  }
  /** Reenviar el comprobante por correo. */
  sendMailInvoice(payload: Record<string, any>) {
    return this.post('SendMailInvoice', payload);
  }
}
