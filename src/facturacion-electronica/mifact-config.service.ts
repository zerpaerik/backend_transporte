import { Injectable } from '@nestjs/common';

/** Lo mínimo del emisor para saber con qué token hablar con MiFact. */
export interface CredencialMifact {
  ruc?: string | null;
  mifactToken?: string | null;
}

export type OrigenToken = 'emisor' | 'servidor' | 'demo' | '';

// La variable histórica MIFACT_TOKEN_MGRSI es el token de MGR Servicios Integrados (la primera
// empresa que emitió). Solo se usa para ese RUC: así otra empresa nunca emite con un token ajeno.
const RUC_TOKEN_HISTORICO = '20616110340';

/**
 * Resuelve el ambiente (demo/prod), la URL base y el token de MiFact. El token nunca sale de
 * aquí hacia el frontend.
 *
 * Cada empresa (RUC) tiene su propio token de producción. Se toma, en este orden:
 *   1. el cargado en "Datos del emisor" de la sede (EmisorConfig.mifactToken);
 *   2. la variable de entorno MIFACT_TOKEN_<RUC> (p. ej. MIFACT_TOKEN_20614975831);
 *   3. para MGR Servicios Integrados, la variable histórica MIFACT_TOKEN_MGRSI.
 * La URL del servicio es la misma para todas las empresas.
 *
 * Candado de producción: mientras MIFACT_AMBIENTE no sea exactamente "prod", el sistema apunta
 * a DEMO con el token demo, aunque las empresas tengan su token de producción cargado.
 */
@Injectable()
export class MifactConfigService {
  get ambiente(): 'demo' | 'prod' {
    return (process.env.MIFACT_AMBIENTE || 'demo').trim().toLowerCase() === 'prod' ? 'prod' : 'demo';
  }
  get esProd(): boolean {
    return this.ambiente === 'prod';
  }
  private conBarra(url?: string): string {
    return (url || '').trim().replace(/\/?$/, url?.trim() ? '/' : '');
  }
  get baseUrl(): string {
    // URL base de facturación tomada de variables de entorno (sin default hardcodeado).
    return this.conBarra(this.esProd ? process.env.MIFACT_BASE_URL_PROD : process.env.MIFACT_BASE_URL_DEMO);
  }
  /** URL de producción (para probar un token de producción aunque el sistema esté en demo). */
  get baseUrlProd(): string {
    return this.conBarra(process.env.MIFACT_BASE_URL_PROD);
  }

  /** Token de PRODUCCIÓN de una empresa y de dónde salió. */
  tokenProdDe(e?: CredencialMifact | null): { token: string; origen: OrigenToken } {
    const propio = (e?.mifactToken || '').trim();
    if (propio) return { token: propio, origen: 'emisor' };
    const ruc = (e?.ruc || '').trim();
    const deEntorno = (ruc && process.env[`MIFACT_TOKEN_${ruc}`]) || (ruc === RUC_TOKEN_HISTORICO ? process.env.MIFACT_TOKEN_MGRSI : '') || '';
    return deEntorno.trim() ? { token: deEntorno.trim(), origen: 'servidor' } : { token: '', origen: '' };
  }

  /** Token con el que se llama a MiFact en el ambiente actual para esta empresa. */
  tokenDe(e?: CredencialMifact | null): { token: string; origen: OrigenToken } {
    if (!this.esProd) {
      const demo = (process.env.MIFACT_TOKEN_DEMO || '').trim();
      return demo ? { token: demo, origen: 'demo' } : { token: '', origen: '' };
    }
    return this.tokenProdDe(e);
  }

  /** true si hay URL base y token para esta empresa en el ambiente actual (lista para emitir). */
  integracionConfiguradaPara(e?: CredencialMifact | null): boolean {
    return !!this.baseUrl && !!this.tokenDe(e).token;
  }

  /**
   * URL del servicio de Guía de Remisión (GuiaRemision.svc), tomada de variables de
   * entorno (MIFACT_GRE_BASE_URL_DEMO / _PROD). No se hardcodea ninguna URL.
   */
  get greBaseUrl(): string {
    return this.conBarra(this.esProd ? process.env.MIFACT_GRE_BASE_URL_PROD : process.env.MIFACT_GRE_BASE_URL_DEMO);
  }
  greConfiguradaPara(e?: CredencialMifact | null): boolean {
    return !!this.greBaseUrl && !!this.tokenDe(e).token;
  }
}
