/**
 * API pública del módulo Comprobantes (boletas, facturas y tickets).
 *
 * Se emiten solo sobre una comanda `PAGADA`; el correlativo y el IGV los pone
 * el servidor. Otros módulos solo importan este punto de entrada.
 */
export { ReceiptsModule } from './receipts.module.js';
export { ReceiptsService, desgloseIgv, IGV_TASA } from './receipts.service.js';
