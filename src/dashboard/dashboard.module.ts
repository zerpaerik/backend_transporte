import { Module, Injectable, Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, JwtUser } from '../common/decorators';

// Fecha de referencia del demo (coincide con la del frontend) para que las
// alertas de vencimiento/devolución sean estables y consistentes en ambos lados.
const dias = (fecha: Date) => Math.round((new Date(fecha).getTime() - Date.now()) / 86_400_000);
const estadoDoc = (fecha: Date) => {
  const d = dias(fecha);
  if (d < 0) return 'Vencido';
  if (d <= 30) return 'Por vencer';
  return 'Vigente';
};
const iso = (fecha: Date) => new Date(fecha).toISOString().slice(0, 10);

function countBy<T>(items: T[], key: (t: T) => string, labels: string[]) {
  return labels.map((label) => ({ label, value: items.filter((i) => key(i) === label).length }));
}

@Injectable()
class DashboardService {
  constructor(private prisma: PrismaService) {}

  async resumen(sedeId: string) {
    const [vehiculos, viajes, facturas, ordenes, empleados, conductores] = await Promise.all([
      this.prisma.vehiculo.findMany({ where: { sedeId } }),
      this.prisma.viaje.findMany({ where: { sedeId } }),
      this.prisma.factura.findMany({ where: { sedeId } }),
      this.prisma.ordenTrabajo.findMany({ where: { sedeId } }),
      this.prisma.empleado.findMany({ where: { sedeId } }),
      this.prisma.conductor.findMany({ where: { sedeId }, include: { documentos: true } }),
    ]);

    const operativos = vehiculos.filter((v) => v.estado === 'Operativo').length;
    const ventasFacturadas = facturas.filter((f) => f.estadoSunat !== 'Anulada').reduce((s, f) => s + f.monto + f.igv, 0);
    // Por cobrar: facturas y boletas no pagadas, menos lo acreditado con notas de crédito aceptadas
    // (las NC/ND no se cobran; una NC de anulación o por el total deja la factura en cero).
    const clave = (tipo: string, serie: string, corr: string) => `${tipo}|${serie.trim().toUpperCase()}|${parseInt(corr, 10) || corr.trim()}`;
    const credito = new Map<string, { monto: number; anula: boolean }>();
    for (const n of facturas) {
      if (n.tipo !== 'N. Crédito' || !['102', '103'].includes(n.estadoDocumento) || !n.docRefSerie || !n.docRefCorrelativo) continue;
      const k = clave(n.docRefTipo || '01', n.docRefSerie, n.docRefCorrelativo);
      const c = credito.get(k) ?? { monto: 0, anula: false };
      credito.set(k, { monto: c.monto + (n.total || n.monto + n.igv), anula: c.anula || ['01', '02', '06'].includes(n.codTipNc) });
    }
    const porCobrar = facturas
      .filter((f) => f.tipo !== 'N. Crédito' && f.tipo !== 'N. Débito' && (f.estadoSunat === 'Emitida' || f.estadoSunat === 'Aceptada') && !f.pagada)
      .reduce((s, f) => {
        const total = f.total || f.monto + f.igv;
        const nc = f.correlativo ? credito.get(clave(f.tipoDocCodigo || (f.tipo === 'Boleta' ? '03' : '01'), f.serie, f.correlativo)) : undefined;
        return s + (nc?.anula ? 0 : Math.max(0, total - (nc?.monto ?? 0)));
      }, 0);
    const gastoMantenimiento = ordenes.reduce((s, o) => s + o.costo, 0);
    const planillaNeta = empleados.reduce((s, e) => s + e.sueldoBase + e.bonos - e.descuentos, 0);

    const documentosAlerta = conductores
      .flatMap((c) => c.documentos.map((d) => ({
        conductor: c.nombre, tipo: d.tipo, vencimiento: iso(d.vencimiento),
        estado: estadoDoc(d.vencimiento), dias: dias(d.vencimiento),
      })))
      .filter((d) => d.estado !== 'Vigente')
      .sort((a, b) => a.dias - b.dias);

    const devoluciones = viajes
      .filter((v) => v.estado !== 'Culminado' && v.estado !== 'Devuelto' && v.estado !== 'Cancelado' && v.fechaLimite)
      .map((v) => ({
        contenedor: v.contenedor, cliente: v.cliente, placaTracto: v.placaTracto,
        devolucion: v.devolucion, fechaLimite: iso(v.fechaLimite as Date), dias: dias(v.fechaLimite as Date),
      }))
      .sort((a, b) => a.dias - b.dias);

    const ventasPorClienteMap = facturas
      .filter((f) => f.estadoSunat !== 'Anulada')
      .reduce<Record<string, number>>((acc, f) => ((acc[f.cliente] = (acc[f.cliente] ?? 0) + f.monto + f.igv), acc), {});
    const ventasPorCliente = Object.entries(ventasPorClienteMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([label, value]) => ({ label, value }));

    return {
      kpis: {
        vehiculos: vehiculos.length,
        operativos,
        conductores: conductores.length,
        empleados: empleados.length,
        viajesTotal: viajes.length,
        viajesEnCurso: viajes.filter((v) => v.estado === 'En curso').length,
        documentosAlerta: documentosAlerta.length,
        ventasFacturadas,
        porCobrar,
        gastoMantenimiento,
        planillaNeta,
      },
      mantenimientoPorTipo: countByCosto(ordenes),
      facturasPorEstado: countBy(facturas, (f) => f.estadoSunat, ['Emitida', 'Aceptada', 'Pagada', 'Anulada']),
      viajesPorEstado: countBy(viajes, (v) => v.estado, ['Programado', 'En curso', 'Culminado', 'Devuelto', 'Cancelado']),
      ventasPorCliente,
      documentosAlerta,
      devoluciones,
    };
  }
}

function countByCosto(ordenes: { tipo: string; costo: number }[]) {
  return ['Preventivo', 'Correctivo', 'Predictivo'].map((label) => ({
    label,
    value: ordenes.filter((o) => o.tipo === label).reduce((s, o) => s + o.costo, 0),
  }));
}

@Controller('dashboard')
class DashboardController {
  constructor(private readonly service: DashboardService) {}
  @Get('resumen') resumen(@CurrentUser() u: JwtUser) { return this.service.resumen(u.sedeId); }
}

@Module({ controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
