import { Injectable } from '@nestjs/common';

/**
 * Resuelve el ambiente (demo/prod), la URL base y el token de MiFact desde las
 * VARIABLES DE ENTORNO del servidor. El token nunca sale de aquí hacia el frontend.
 *
 * Candado de producción: mientras MIFACT_AMBIENTE no sea exactamente "prod", el
 * sistema apunta a DEMO aunque exista el token de producción.
 */
@Injectable()
export class MifactConfigService {
  get ambiente(): 'demo' | 'prod' {
    return (process.env.MIFACT_AMBIENTE || 'demo').trim().toLowerCase() === 'prod' ? 'prod' : 'demo';
  }
  get esProd(): boolean {
    return this.ambiente === 'prod';
  }
  get baseUrl(): string {
    const url = this.esProd ? process.env.MIFACT_BASE_URL_PROD : process.env.MIFACT_BASE_URL_DEMO;
    return (url || (this.esProd ? '' : 'https://demo.mifact.net.pe/api/invoiceService.svc/')).replace(/\/?$/, '/');
  }
  get token(): string {
    return (this.esProd ? process.env.MIFACT_TOKEN_MGRSI : process.env.MIFACT_TOKEN_DEMO) || '';
  }
  /** true si hay URL base y token para el ambiente actual (listo para llamar a MiFact). */
  get integracionConfigurada(): boolean {
    return !!this.baseUrl && !!this.token;
  }
}
