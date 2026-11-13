import { Injectable } from '@nestjs/common';

/** Lo mínimo del emisor para saber a qué URL y con qué token hablar con MiFact. */
export interface CredencialMifact {
  ruc?: string | null;
  mifactToken?: string | null;
  mifactUrlProd?: string | null;
}

export type OrigenToken = 'emisor' | 'servidor' | 'demo' | '';
export type OrigenUrl = 'emisor' | 'servidor' | '';

// La variable histórica MIFACT_TOKEN_MGRSI es el token de MGR Servicios Integrados (la primera
// empresa que emitió). Solo se usa para ese RUC: así otra empresa nunca emite con un token ajeno.
const RUC_TOKEN_HISTORICO = '20616110340';

// El token viaja en el cuerpo de cada llamada: solo se acepta una URL https de MiFact, para que el
// token de una empresa nunca se mande a otro servidor. MiFact asigna una ruta por empresa
// (p. ej. /mifactapi48/), por eso la URL puede cambiar de un RUC a otro.
export const URL_MIFACT_FORMATO = /^https:\/\/([a-z0-9-]+\.)*mifact\.net\.pe\/[A-Za-z0-9_\-/.]*invoiceService\.svc\/?$/i;
const SERVICIO_FACTURAS = /invoiceService\.svc\/?$/i;

/**
 * Resuelve el ambiente (demo/prod), la URL y el token de MiFact de cada empresa. El token nunca
 * sale de aquí hacia el frontend.
 *
 * Cada empresa (RUC) tiene su propio token de producción. Se toma, en este orden:
 *   1. el cargado en "Datos del emisor" de la sede (EmisorConfig.mifactToken);
 *   2. la variable de entorno MIFACT_TOKEN_<RUC> (p. ej. MIFACT_TOKEN_20614975831);
 *   3. para MGR Servicios Integrados, la variable histórica MIFACT_TOKEN_MGRSI.
 * La URL de producción también es por empresa: la de "Datos del emisor" (EmisorConfig.mifactUrlProd)
 * o, si está vacía, la del servidor (MIFACT_BASE_URL_PROD).
 *
 * Candado de producción: mientras MIFACT_AMBIENTE no sea exactamente "prod", el sistema apunta
 * a DEMO con el token demo, aunque las empresas tengan su token y URL de producción cargados.
 */
@Injectable()
export class MifactConfigService {
  get ambiente(): 'demo' | 'prod' {
    return (process.env.MIFACT_AMBIENTE || 'demo').trim().toLowerCase() === 'prod' ? 'prod' : 'demo';
  }
  get esProd(): boolean {
    return this.ambiente === 'prod';
  }
  conBarra(url?: string | null): string {
    const u = (url || '').trim();
    return u ? u.replace(/\/?$/, '/') : '';
  }

  /** URL de PRODUCCIÓN del servicio de facturación de una empresa y de dónde salió. */
  urlProdDe(e?: CredencialMifact | null): { url: string; origen: OrigenUrl } {
    const propia = this.conBarra(e?.mifactUrlProd);
    if (propia) return { url: propia, origen: 'emisor' };
    const servidor = this.conBarra(process.env.MIFACT_BASE_URL_PROD);
    return servidor ? { url: servidor, origen: 'servidor' } : { url: '', origen: '' };
  }

  /** URL del servicio de facturación en el ambiente actual para esta empresa. */
  baseUrlDe(e?: CredencialMifact | null): string {
    return this.esProd ? this.urlProdDe(e).url : this.conBarra(process.env.MIFACT_BASE_URL_DEMO);
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

  /** true si hay URL y token para esta empresa en el ambiente actual (lista para emitir). */
  integracionConfiguradaPara(e?: CredencialMifact | null): boolean {
    return !!this.baseUrlDe(e) && !!this.tokenDe(e).token;
  }

  /**
   * URL del servicio de Guía de Remisión (GuiaRemision.svc). En demo y para las empresas sin URL
   * propia sale de las variables de entorno (MIFACT_GRE_BASE_URL_DEMO / _PROD). Si la empresa
   * tiene su URL de producción, la de guías es la misma ruta con GuiaRemision.svc.
   */
  greBaseUrlDe(e?: CredencialMifact | null): string {
    if (!this.esProd) return this.conBarra(process.env.MIFACT_GRE_BASE_URL_DEMO);
    const propia = this.conBarra(e?.mifactUrlProd);
    if (propia && SERVICIO_FACTURAS.test(propia)) return propia.replace(SERVICIO_FACTURAS, 'GuiaRemision.svc/');
    return this.conBarra(process.env.MIFACT_GRE_BASE_URL_PROD);
  }
  greConfiguradaPara(e?: CredencialMifact | null): boolean {
    return !!this.greBaseUrlDe(e) && !!this.tokenDe(e).token;
  }
}
