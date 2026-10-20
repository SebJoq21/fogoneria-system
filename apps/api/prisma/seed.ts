import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client.js';

/** Contraseña única de los usuarios demo (ver README de la API). */
const DEMO_PASSWORD_HASH = bcrypt.hashSync('Fogoneria123!', 12);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL no está definida');
}

const adapter = new PrismaPg(connectionString, { schema: 'fogoneria' });
const prisma = new PrismaClient({ adapter });

const now = new Date();
const day = (offset: number) =>
  new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + offset));
const dateOnly = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const atLocal = (hours: number, minutes = 0) =>
  new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes,
    0,
    0,
  );
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);
const minutesAgo = (minutes: number) =>
  new Date(now.getTime() - minutes * 60_000);
const timeOnly = (hours: number, minutes = 0) =>
  new Date(Date.UTC(1970, 0, 1, hours, minutes, 0, 0));

const EMPRESA = '11111111-1111-1111-1111-111111111111';
const MIRAFLORES = '22222222-2222-2222-2222-222222222222';
const SURCO = '33333333-3333-3333-3333-333333333333';
const SAN_ISIDRO = '44444444-4444-4444-4444-444444444444';
const SUPERADMIN = '55555555-5555-5555-5555-555555555555';
const ADMIN = '55555555-5555-5555-5555-555555555556';
const GERENTE = '55555555-5555-5555-5555-555555555557';
const COCINERO = '55555555-5555-5555-5555-555555555558';
const MESERO = '55555555-5555-5555-5555-555555555559';
const CAJERO = '55555555-5555-5555-5555-555555555560';

const CEVICHE = '88888888-8888-8888-8888-888888888881';
const TEQUENOS = '88888888-8888-8888-8888-888888888882';
const LOMO = '88888888-8888-8888-8888-888888888883';
const AJI = '88888888-8888-8888-8888-888888888884';
const PISCO = '88888888-8888-8888-8888-888888888885';
const CHICHA = '88888888-8888-8888-8888-888888888886';

const CARTA = '99999999-9999-9999-9999-999999999991';
const DELIVERY = '99999999-9999-9999-9999-999999999992';
const EVENTOS = '99999999-9999-9999-9999-999999999993';

const GRUPO_TAMANO = '77777777-7777-7777-7777-777777777771';
const GRUPO_EXTRAS = '77777777-7777-7777-7777-777777777772';
const GRUPO_COCCION = '77777777-7777-7777-7777-777777777773';

const PROVEEDOR_AGRO = 'dddddddd-dddd-dddd-dddd-dddddddddd01';
const PROVEEDOR_FRUTAS = 'dddddddd-dddd-dddd-dddd-dddddddddd02';

const INSUMO_LOMO = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1';
const INSUMO_AJI = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2';
const INSUMO_PISCO = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3';
const INSUMO_PAPA = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4';
const INSUMO_LIMON = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee5';
const INSUMO_MAIZ = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee6';

const CLIENTE_VALERIA = 'ffffffff-ffff-ffff-ffff-fffffffffff1';
const CLIENTE_DIEGO = 'ffffffff-ffff-ffff-ffff-fffffffffff2';
const CLIENTE_CAMILA = 'ffffffff-ffff-ffff-ffff-fffffffffff3';
const CLIENTE_JORGE = 'ffffffff-ffff-ffff-ffff-fffffffffff4';
const CLIENTE_LUCIA = 'ffffffff-ffff-ffff-ffff-fffffffffff5';

const ROL_MOZO = '10101010-1010-1010-1010-101010101010';
const ROL_COCINERO = '20202020-2020-2020-2020-202020202020';
const ROL_BARMAN = '30303030-3030-3030-3030-303030303030';
const ROL_CAJERO = '40404040-4040-4040-4040-404040404040';
const ROL_ANFITRION = '50505050-5050-5050-5050-505050505050';

const EMP_1 = '11111111-2222-3333-4444-555555555551';
const EMP_2 = '11111111-2222-3333-4444-555555555552';
const EMP_3 = '11111111-2222-3333-4444-555555555553';
const EMP_4 = '11111111-2222-3333-4444-555555555554';
const EMP_5 = '11111111-2222-3333-4444-555555555555';
const EMP_6 = '11111111-2222-3333-4444-555555555556';

const MESA_3 = '20000000-0000-0000-0000-000000000003';
const MESA_7 = '20000000-0000-0000-0000-000000000007';
const MESA_8 = '20000000-0000-0000-0000-000000000008';

const ORDEN_1042 = '40000000-0000-0000-0000-000000001042';
const ORDEN_1041 = '40000000-0000-0000-0000-000000001041';
const ORDEN_1040 = '40000000-0000-0000-0000-000000001040';
const ORDEN_1039 = '40000000-0000-0000-0000-000000001039';

const TURNO_CAJA = '50000000-0000-0000-0000-000000000001';
const POZO = '90000000-0000-0000-0000-000000000001';

async function main() {
  await prisma.empresas.createMany({
    data: [
      {
        id: EMPRESA,
        nombre_legal: 'Mi Restaurante S.A.C.',
        nombre_comercial: 'Fogoneria Demo',
        ruc: '20123456786',
        limite_sucursales: 3,
        modulos_habilitados: [
          'pedidos',
          'carta',
          'inventario',
          'caja',
          'asistencia',
          'roles',
        ],
        estado: 'ACTIVE',
        plan_actual: 'PROFESIONAL',
        mrr_monto: 99,
        trial_inicio: daysAgo(20),
        trial_fin: daysAgo(6),
      },
    ],
    skipDuplicates: true,
  });

  await prisma.sucursales.createMany({
    data: [
      {
        id: MIRAFLORES,
        empresa_id: EMPRESA,
        nombre: 'Miraflores · Matriz',
        nombre_corto: 'Miraflores',
        direccion: 'Av. José Pardo 456, Miraflores',
        telefono: '+51 987 654 321',
        aforo: 80,
        es_matriz: true,
        estado: 'ABIERTA',
      },
      {
        id: SURCO,
        empresa_id: EMPRESA,
        nombre: 'Surco',
        nombre_corto: 'Surco',
        direccion: 'Av. Encalada 1420, Surco',
        telefono: '+51 955 231 884',
        aforo: 60,
        es_matriz: false,
        estado: 'ABIERTA',
      },
      {
        id: SAN_ISIDRO,
        empresa_id: EMPRESA,
        nombre: 'San Isidro',
        nombre_corto: 'San Isidro',
        direccion: 'Av. Camino Real 390, San Isidro',
        telefono: '+51 901 447 220',
        aforo: 50,
        es_matriz: false,
        estado: 'CERRADA',
      },
    ],
    skipDuplicates: true,
  });

  await prisma.usuarios.createMany({
    data: [
      {
        id: SUPERADMIN,
        nombre: 'Equipo Fogonería',
        email: 'super@fogoneria.com',
        password_hash: DEMO_PASSWORD_HASH,
        rol: 'SUPERADMIN',
        estado: 'ACTIVO',
      },
      {
        id: ADMIN,
        empresa_id: EMPRESA,
        nombre: 'Martín Quispe',
        email: 'admin@mirestaurante.com',
        password_hash: DEMO_PASSWORD_HASH,
        rol: 'ADMIN_GLOBAL',
        estado: 'ACTIVO',
      },
      {
        id: GERENTE,
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        nombre: 'Rosa Quispe',
        email: 'sucursal@mirestaurante.com',
        password_hash: DEMO_PASSWORD_HASH,
        rol: 'GERENTE_SUCURSAL',
        estado: 'ACTIVO',
      },
      {
        id: COCINERO,
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        nombre: 'Luis Huamán',
        email: 'cocina@mirestaurante.com',
        password_hash: DEMO_PASSWORD_HASH,
        rol: 'COCINERO',
        estado: 'ACTIVO',
      },
      {
        id: MESERO,
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        nombre: 'Ana Beltrán',
        email: 'mesero@mirestaurante.com',
        password_hash: DEMO_PASSWORD_HASH,
        rol: 'MESERO',
        estado: 'ACTIVO',
      },
      {
        id: CAJERO,
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        nombre: 'Pedro León',
        email: 'caja@mirestaurante.com',
        password_hash: DEMO_PASSWORD_HASH,
        rol: 'CAJERO',
        estado: 'ACTIVO',
      },
    ],
    skipDuplicates: true,
  });

  await prisma.leads_cotizaciones.createMany({
    data: [
      {
        id: '80000000-0000-0000-0000-000000000001',
        nombre: 'Carlos',
        apellido: 'Mendoza',
        telefono: '+51 999 111 222',
        email: 'carlos@elmuelle.pe',
        negocio: 'Cevichería El Muelle',
        rango_sucursales: 'DOS_A_TRES',
        estado: 'PROPUESTA',
        notas:
          'Solicita cotización: 2 locales, módulos pedidos + caja + inventario',
      },
    ],
    skipDuplicates: true,
  });

  await prisma.categorias.createMany({
    data: [
      {
        id: '66666666-6666-6666-6666-666666666661',
        empresa_id: EMPRESA,
        nombre: 'Entradas',
        posicion: 1,
        activa: true,
      },
      {
        id: '66666666-6666-6666-6666-666666666662',
        empresa_id: EMPRESA,
        nombre: 'Fondos',
        posicion: 2,
        activa: true,
      },
      {
        id: '66666666-6666-6666-6666-666666666663',
        empresa_id: EMPRESA,
        nombre: 'Bebidas',
        posicion: 3,
        activa: true,
      },
      {
        id: '66666666-6666-6666-6666-666666666664',
        empresa_id: EMPRESA,
        nombre: 'Postres',
        posicion: 4,
        activa: true,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.grupos_modificadores.createMany({
    data: [
      {
        id: GRUPO_TAMANO,
        empresa_id: EMPRESA,
        nombre: 'Tamaño',
        obligatorio: true,
        permite_multiple: false,
        activo: true,
      },
      {
        id: GRUPO_EXTRAS,
        empresa_id: EMPRESA,
        nombre: 'Extras',
        obligatorio: false,
        permite_multiple: true,
        activo: true,
      },
      {
        id: GRUPO_COCCION,
        empresa_id: EMPRESA,
        nombre: 'Punto de cocción',
        obligatorio: true,
        permite_multiple: false,
        activo: true,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.opciones_modificadores.createMany({
    data: [
      {
        id: '77777777-7777-7777-7777-777777777781',
        grupo_id: GRUPO_TAMANO,
        nombre: 'Regular',
        precio_extra: 0,
      },
      {
        id: '77777777-7777-7777-7777-777777777782',
        grupo_id: GRUPO_TAMANO,
        nombre: 'Grande',
        precio_extra: 4,
      },
      {
        id: '77777777-7777-7777-7777-777777777783',
        grupo_id: GRUPO_EXTRAS,
        nombre: 'Queso extra',
        precio_extra: 2,
      },
      {
        id: '77777777-7777-7777-7777-777777777784',
        grupo_id: GRUPO_EXTRAS,
        nombre: 'Palta',
        precio_extra: 3,
      },
      {
        id: '77777777-7777-7777-7777-777777777785',
        grupo_id: GRUPO_COCCION,
        nombre: 'Al punto',
        precio_extra: 0,
      },
      {
        id: '77777777-7777-7777-7777-777777777786',
        grupo_id: GRUPO_COCCION,
        nombre: 'Bien cocido',
        precio_extra: 0,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.platos.createMany({
    data: [
      {
        id: CEVICHE,
        empresa_id: EMPRESA,
        categoria_id: '66666666-6666-6666-6666-666666666661',
        sku: 'PLA-001',
        nombre: 'Ceviche Clásico',
        descripcion: 'Pesca del día, limón sutil, ají limo, cebolla roja.',
        foto_url: 'https://images.unsplash.com/photo-1534482421-64566f976cfa',
        activo: true,
        costo_real: 8.5,
      },
      {
        id: TEQUENOS,
        empresa_id: EMPRESA,
        categoria_id: '66666666-6666-6666-6666-666666666661',
        sku: 'PLA-002',
        nombre: 'Tequeños de Lomo',
        descripcion: 'Masa crujiente rellena de lomo saltado, huancaína.',
        activo: true,
        costo_real: 4,
      },
      {
        id: LOMO,
        empresa_id: EMPRESA,
        categoria_id: '66666666-6666-6666-6666-666666666662',
        sku: 'PLA-003',
        nombre: 'Lomo Saltado',
        descripcion:
          'Lomo fino al wok, cebolla, tomate, ají amarillo, papas y arroz.',
        activo: true,
        costo_real: 12,
      },
      {
        id: AJI,
        empresa_id: EMPRESA,
        categoria_id: '66666666-6666-6666-6666-666666666662',
        sku: 'PLA-004',
        nombre: 'Ají de Gallina',
        descripcion:
          'Guiso cremoso de pollo, ají amarillo, pecanas y parmesano.',
        activo: true,
        costo_real: 9,
      },
      {
        id: PISCO,
        empresa_id: EMPRESA,
        categoria_id: '66666666-6666-6666-6666-666666666663',
        sku: 'PLA-005',
        nombre: 'Pisco Sour',
        descripcion: 'Pisco Quebranta, limón, jarabe de goma y Angostura.',
        activo: true,
        costo_real: 4.5,
      },
      {
        id: CHICHA,
        empresa_id: EMPRESA,
        categoria_id: '66666666-6666-6666-6666-666666666663',
        sku: 'PLA-006',
        nombre: 'Chicha Morada',
        descripcion: 'Maíz morado, piña, manzana, canela y clavo.',
        activo: true,
        costo_real: 1.2,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.platos_grupos_modificadores.createMany({
    data: [
      { plato_id: CEVICHE, grupo_id: GRUPO_EXTRAS },
      { plato_id: TEQUENOS, grupo_id: GRUPO_EXTRAS },
      { plato_id: LOMO, grupo_id: GRUPO_TAMANO },
      { plato_id: LOMO, grupo_id: GRUPO_COCCION },
      { plato_id: AJI, grupo_id: GRUPO_TAMANO },
      { plato_id: CHICHA, grupo_id: GRUPO_TAMANO },
    ],
    skipDuplicates: true,
  });

  await prisma.listas_precios.createMany({
    data: [
      {
        id: CARTA,
        empresa_id: EMPRESA,
        nombre: 'Carta',
        activa: true,
        vigencia_desde: dateOnly('2026-01-01'),
        vigencia_hasta: dateOnly('2026-12-31'),
      },
      {
        id: DELIVERY,
        empresa_id: EMPRESA,
        nombre: 'Delivery',
        activa: false,
        vigencia_desde: dateOnly('2026-01-01'),
        vigencia_hasta: dateOnly('2026-12-31'),
      },
      {
        id: EVENTOS,
        empresa_id: EMPRESA,
        nombre: 'Eventos',
        activa: false,
        vigencia_desde: dateOnly('2026-11-01'),
        vigencia_hasta: dateOnly('2026-12-31'),
      },
    ],
    skipDuplicates: true,
  });

  await prisma.precios_platos.createMany({
    data: [
      { lista_id: CARTA, plato_id: CEVICHE, precio: 15 },
      { lista_id: CARTA, plato_id: TEQUENOS, precio: 8 },
      { lista_id: CARTA, plato_id: LOMO, precio: 22 },
      { lista_id: CARTA, plato_id: AJI, precio: 18 },
      { lista_id: CARTA, plato_id: PISCO, precio: 10 },
      { lista_id: CARTA, plato_id: CHICHA, precio: 4 },
      { lista_id: DELIVERY, plato_id: CEVICHE, precio: 17 },
      { lista_id: DELIVERY, plato_id: TEQUENOS, precio: 10 },
      { lista_id: DELIVERY, plato_id: LOMO, precio: 24 },
      { lista_id: DELIVERY, plato_id: AJI, precio: 20 },
      { lista_id: DELIVERY, plato_id: PISCO, precio: 12 },
      { lista_id: DELIVERY, plato_id: CHICHA, precio: 6 },
      { lista_id: EVENTOS, plato_id: CEVICHE, precio: 14 },
      { lista_id: EVENTOS, plato_id: TEQUENOS, precio: 7 },
      { lista_id: EVENTOS, plato_id: LOMO, precio: 21 },
      { lista_id: EVENTOS, plato_id: AJI, precio: 17 },
      { lista_id: EVENTOS, plato_id: PISCO, precio: 9 },
      { lista_id: EVENTOS, plato_id: CHICHA, precio: 3 },
    ],
    skipDuplicates: true,
  });

  await prisma.combos.createMany({
    data: [
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        empresa_id: EMPRESA,
        nombre: 'Dúo Criollo',
        descripcion: 'Ceviche + Chicha para dos.',
        precio_fijo: 17,
        activo: true,
      },
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
        empresa_id: EMPRESA,
        nombre: 'Almuerzo Ejecutivo',
        descripcion: 'Fondo + bebida del día.',
        precio_fijo: 24,
        activo: true,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.combos_platos.createMany({
    data: [
      {
        combo_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        plato_id: CEVICHE,
        cantidad: 1,
      },
      {
        combo_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
        plato_id: CHICHA,
        cantidad: 1,
      },
      {
        combo_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
        plato_id: LOMO,
        cantidad: 1,
      },
      {
        combo_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
        plato_id: CHICHA,
        cantidad: 1,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.reglas_horarias_promos.createMany({
    data: [
      {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
        empresa_id: EMPRESA,
        nombre: 'Happy Hour Pisco',
        beneficio: '2x1 en barra',
        dias_semana: [1, 2, 3, 4, 5],
        hora_inicio: timeOnly(18),
        hora_fin: timeOnly(20),
        activa: true,
      },
      {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
        empresa_id: EMPRESA,
        nombre: 'Almuerzo Ejecutivo',
        beneficio: '$5.00 off',
        dias_semana: [1, 2, 3, 4, 5],
        hora_inicio: timeOnly(12),
        hora_fin: timeOnly(15),
        activa: true,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.cupones.createMany({
    data: [
      {
        id: 'cccccccc-cccc-cccc-cccc-cccccccccc01',
        empresa_id: EMPRESA,
        codigo: 'BURGER10',
        tipo_descuento: 'PORCENTAJE',
        valor: 10,
        limite_usos: 100,
        usos_actuales: 45,
        vencimiento: dateOnly('2026-11-30'),
        activo: true,
      },
      {
        id: 'cccccccc-cccc-cccc-cccc-cccccccccc02',
        empresa_id: EMPRESA,
        codigo: 'PISCO5',
        tipo_descuento: 'MONTO',
        valor: 5,
        limite_usos: 50,
        usos_actuales: 12,
        vencimiento: dateOnly('2026-12-15'),
        activo: true,
      },
      {
        id: 'cccccccc-cccc-cccc-cccc-cccccccccc03',
        empresa_id: EMPRESA,
        codigo: 'FIEL20',
        tipo_descuento: 'PORCENTAJE',
        valor: 20,
        limite_usos: 80,
        usos_actuales: 78,
        vencimiento: dateOnly('2026-10-31'),
        activo: true,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.proveedores.createMany({
    data: [
      {
        id: PROVEEDOR_AGRO,
        empresa_id: EMPRESA,
        nombre: 'AgroAndina',
        ruc: '20111222333',
        telefono: '+51 955 000 111',
        rubro: 'Insumos',
      },
      {
        id: PROVEEDOR_FRUTAS,
        empresa_id: EMPRESA,
        nombre: 'Frutas Lima',
        ruc: '20144555666',
        telefono: '+51 955 000 222',
        rubro: 'Frutas',
      },
    ],
    skipDuplicates: true,
  });

  await prisma.insumos.createMany({
    data: [
      {
        id: INSUMO_LOMO,
        empresa_id: EMPRESA,
        proveedor_id: PROVEEDOR_AGRO,
        nombre: 'Lomo fino',
        categoria: 'Carnes',
        unidad: 'kg',
        costo_promedio: 28.5,
      },
      {
        id: INSUMO_AJI,
        empresa_id: EMPRESA,
        proveedor_id: PROVEEDOR_AGRO,
        nombre: 'Ají amarillo',
        categoria: 'Vegetales',
        unidad: 'kg',
        costo_promedio: 6,
      },
      {
        id: INSUMO_PISCO,
        empresa_id: EMPRESA,
        nombre: 'Pisco Quebranta',
        categoria: 'Bar',
        unidad: 'litros',
        costo_promedio: 45,
      },
      {
        id: INSUMO_PAPA,
        empresa_id: EMPRESA,
        proveedor_id: PROVEEDOR_AGRO,
        nombre: 'Papa amarilla',
        categoria: 'Vegetales',
        unidad: 'kg',
        costo_promedio: 3.2,
      },
      {
        id: INSUMO_LIMON,
        empresa_id: EMPRESA,
        proveedor_id: PROVEEDOR_FRUTAS,
        nombre: 'Limón sutil',
        categoria: 'Frutas',
        unidad: 'kg',
        costo_promedio: 4.8,
      },
      {
        id: INSUMO_MAIZ,
        empresa_id: EMPRESA,
        proveedor_id: PROVEEDOR_FRUTAS,
        nombre: 'Maíz morado',
        categoria: 'Granos',
        unidad: 'kg',
        costo_promedio: 5.5,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.stocks_sucursal.createMany({
    data: [
      {
        sucursal_id: MIRAFLORES,
        insumo_id: INSUMO_LOMO,
        empresa_id: EMPRESA,
        cantidad: 12,
        stock_minimo: 5,
      },
      {
        sucursal_id: MIRAFLORES,
        insumo_id: INSUMO_AJI,
        empresa_id: EMPRESA,
        cantidad: 1.5,
        stock_minimo: 3,
      },
      {
        sucursal_id: MIRAFLORES,
        insumo_id: INSUMO_PISCO,
        empresa_id: EMPRESA,
        cantidad: 0,
        stock_minimo: 2,
      },
      {
        sucursal_id: MIRAFLORES,
        insumo_id: INSUMO_PAPA,
        empresa_id: EMPRESA,
        cantidad: 20,
        stock_minimo: 8,
      },
      {
        sucursal_id: MIRAFLORES,
        insumo_id: INSUMO_LIMON,
        empresa_id: EMPRESA,
        cantidad: 2,
        stock_minimo: 4,
      },
      {
        sucursal_id: MIRAFLORES,
        insumo_id: INSUMO_MAIZ,
        empresa_id: EMPRESA,
        cantidad: 6,
        stock_minimo: 2,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.escandallos_recetas.createMany({
    data: [
      {
        plato_id: LOMO,
        insumo_id: INSUMO_LOMO,
        cantidad_por_plato: 0.5,
        unidad: 'kg',
      },
      {
        plato_id: LOMO,
        insumo_id: INSUMO_PAPA,
        cantidad_por_plato: 0.4,
        unidad: 'kg',
      },
      {
        plato_id: LOMO,
        insumo_id: INSUMO_AJI,
        cantidad_por_plato: 0.05,
        unidad: 'kg',
      },
      {
        plato_id: CEVICHE,
        insumo_id: INSUMO_LIMON,
        cantidad_por_plato: 0.2,
        unidad: 'kg',
      },
      {
        plato_id: CHICHA,
        insumo_id: INSUMO_MAIZ,
        cantidad_por_plato: 0.15,
        unidad: 'kg',
      },
      {
        plato_id: PISCO,
        insumo_id: INSUMO_PISCO,
        cantidad_por_plato: 0.15,
        unidad: 'litros',
      },
    ],
    skipDuplicates: true,
  });

  await prisma.config_lealtad.createMany({
    data: [
      {
        empresa_id: EMPRESA,
        puntos_por_moneda: 1,
        caducidad_meses: 12,
        umbral_frecuente: 5,
        umbral_vip: 20,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.clientes.createMany({
    data: [
      {
        id: CLIENTE_VALERIA,
        empresa_id: EMPRESA,
        nombre: 'Valeria Ríos',
        telefono: '+51 987 112 203',
        segmento: 'VIP',
        visitas: 32,
        puntos: 1240,
        ultima_visita: day(0),
      },
      {
        id: CLIENTE_DIEGO,
        empresa_id: EMPRESA,
        nombre: 'Diego Torres',
        telefono: '+51 955 804 117',
        segmento: 'FRECUENTE',
        visitas: 21,
        puntos: 860,
        ultima_visita: day(-1),
      },
      {
        id: CLIENTE_CAMILA,
        empresa_id: EMPRESA,
        nombre: 'Camila Duarte',
        telefono: '+51 901 445 882',
        segmento: 'FRECUENTE',
        visitas: 9,
        puntos: 410,
        ultima_visita: day(-3),
      },
      {
        id: CLIENTE_JORGE,
        empresa_id: EMPRESA,
        nombre: 'Jorge Paredes',
        telefono: '+51 988 230 541',
        segmento: 'NUEVO',
        visitas: 2,
        puntos: 120,
        ultima_visita: day(-7),
      },
      {
        id: CLIENTE_LUCIA,
        empresa_id: EMPRESA,
        nombre: 'Lucía Prado',
        telefono: '+51 976 551 309',
        segmento: 'VIP',
        visitas: 48,
        puntos: 2310,
        ultima_visita: day(0),
      },
    ],
    skipDuplicates: true,
  });

  await prisma.roles_empresa.createMany({
    data: [
      {
        id: ROL_MOZO,
        empresa_id: EMPRESA,
        nombre: 'Mozo',
        descripcion: 'Atención en mesa, comandas y servicio.',
        activo: true,
      },
      {
        id: ROL_COCINERO,
        empresa_id: EMPRESA,
        nombre: 'Cocinero',
        descripcion: 'Preparación de platos y KDS.',
        activo: true,
      },
      {
        id: ROL_BARMAN,
        empresa_id: EMPRESA,
        nombre: 'Barman',
        descripcion: 'Bebidas, coctelería y barra.',
        activo: true,
      },
      {
        id: ROL_CAJERO,
        empresa_id: EMPRESA,
        nombre: 'Cajero',
        descripcion: 'Cobros, caja y cierre de turno.',
        activo: true,
      },
      {
        id: ROL_ANFITRION,
        empresa_id: EMPRESA,
        nombre: 'Anfitrión',
        descripcion: 'Reservas y mapa de mesas.',
        activo: true,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.empleados.createMany({
    data: [
      {
        id: EMP_1,
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        usuario_id: GERENTE,
        nombre: 'Rosa Quispe',
        rol_id: ROL_MOZO,
        en_turno: true,
        fecha_ingreso: dateOnly('2024-03-01'),
        activo: true,
      },
      {
        id: EMP_2,
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        usuario_id: COCINERO,
        nombre: 'Luis Huamán',
        rol_id: ROL_COCINERO,
        en_turno: true,
        fecha_ingreso: dateOnly('2023-06-15'),
        activo: true,
      },
      {
        id: EMP_3,
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        usuario_id: MESERO,
        nombre: 'Ana Beltrán',
        rol_id: ROL_BARMAN,
        en_turno: true,
        fecha_ingreso: dateOnly('2024-01-10'),
        activo: true,
      },
      {
        id: EMP_4,
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        usuario_id: CAJERO,
        nombre: 'Pedro León',
        rol_id: ROL_CAJERO,
        en_turno: false,
        fecha_ingreso: dateOnly('2023-11-20'),
        activo: true,
      },
      {
        id: EMP_5,
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        nombre: 'María Flores',
        rol_id: ROL_MOZO,
        en_turno: false,
        fecha_ingreso: dateOnly('2025-02-01'),
        activo: true,
      },
      {
        id: EMP_6,
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        nombre: 'Carlos Vega',
        rol_id: ROL_COCINERO,
        en_turno: true,
        fecha_ingreso: dateOnly('2024-08-05'),
        activo: true,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.mesas.createMany({
    data: [
      {
        id: '20000000-0000-0000-0000-000000000001',
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        numero: 'Mesa 1',
        capacidad: 2,
        zona: 'Terraza',
        forma: 'REDONDA',
        estado: 'LIBRE',
      },
      {
        id: '20000000-0000-0000-0000-000000000002',
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        numero: 'Mesa 2',
        capacidad: 2,
        zona: 'Terraza',
        forma: 'REDONDA',
        estado: 'OCUPADA',
      },
      {
        id: MESA_3,
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        numero: 'Mesa 3',
        capacidad: 4,
        zona: 'Salón',
        forma: 'RECTANGULAR',
        estado: 'RESERVADA',
      },
      {
        id: '20000000-0000-0000-0000-000000000004',
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        numero: 'Mesa 4',
        capacidad: 4,
        zona: 'Salón',
        forma: 'RECTANGULAR',
        estado: 'LIBRE',
      },
      {
        id: '20000000-0000-0000-0000-000000000005',
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        numero: 'Mesa 5',
        capacidad: 6,
        zona: 'Salón',
        forma: 'RECTANGULAR',
        estado: 'OCUPADA',
      },
      {
        id: '20000000-0000-0000-0000-000000000006',
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        numero: 'Mesa 6',
        capacidad: 2,
        zona: 'Barra',
        forma: 'REDONDA',
        estado: 'LIBRE',
      },
      {
        id: MESA_7,
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        numero: 'Mesa 7',
        capacidad: 4,
        zona: 'Barra',
        forma: 'RECTANGULAR',
        estado: 'OCUPADA',
      },
      {
        id: MESA_8,
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        numero: 'Mesa 8',
        capacidad: 8,
        zona: 'Salón',
        forma: 'RECTANGULAR',
        estado: 'RESERVADA',
      },
    ],
    skipDuplicates: true,
  });

  await prisma.reservas.createMany({
    data: [
      {
        id: '30000000-0000-0000-0000-000000000201',
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        mesa_id: MESA_3,
        codigo: 'RS-201',
        cliente_nombre: 'Camila Duarte',
        telefono: '+51 987 442 019',
        nro_comensales: 4,
        fecha_hora: atLocal(20),
        estado: 'CONFIRMADA',
        canal: 'Teléfono',
        notas: 'Mesa cerca a la ventana, una silla de bebé.',
        creada_por: GERENTE,
      },
      {
        id: '30000000-0000-0000-0000-000000000202',
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        mesa_id: MESA_8,
        codigo: 'RS-202',
        cliente_nombre: 'Jorge Paredes',
        telefono: '+51 955 128 774',
        nro_comensales: 8,
        fecha_hora: atLocal(21, 30),
        estado: 'POR_CONFIRMAR',
        canal: 'Web',
        notas: 'Cumpleaños, llevarán torta.',
        creada_por: GERENTE,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.ordenes.createMany({
    data: [
      {
        id: ORDEN_1042,
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        numero_orden: '#PD-1042',
        cliente_id: CLIENTE_VALERIA,
        mesero_id: MESERO,
        origen: 'WEB',
        estado: 'POR_CONFIRMAR',
        subtotal: 52,
        descuento_cupon: 0,
        total: 52,
        lista_precio_id: CARTA,
        ingreso_at: minutesAgo(6),
      },
      {
        id: ORDEN_1041,
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        numero_orden: '#PD-1041',
        mesa_id: MESA_7,
        mesero_id: MESERO,
        origen: 'MESA',
        estado: 'EN_COCINA',
        subtotal: 35,
        descuento_cupon: 0,
        total: 35,
        lista_precio_id: CARTA,
        ingreso_at: minutesAgo(13),
      },
      {
        id: ORDEN_1040,
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        numero_orden: '#PD-1040',
        cliente_id: CLIENTE_DIEGO,
        mesero_id: MESERO,
        origen: 'WEB',
        estado: 'LISTO',
        subtotal: 18,
        descuento_cupon: 0,
        total: 18,
        lista_precio_id: CARTA,
        ingreso_at: minutesAgo(20),
      },
      {
        id: ORDEN_1039,
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        numero_orden: '#PD-1039',
        mesa_id: MESA_3,
        mesero_id: MESERO,
        origen: 'MESA',
        estado: 'ENTREGADO',
        subtotal: 20,
        descuento_cupon: 0,
        total: 20,
        lista_precio_id: CARTA,
        ingreso_at: minutesAgo(33),
      },
    ],
    skipDuplicates: true,
  });

  await prisma.detalles_orden.createMany({
    data: [
      {
        id: 'd0000000-0000-0000-0000-000000000001',
        orden_id: ORDEN_1042,
        tipo: 'PLATO',
        plato_id: LOMO,
        cantidad: 2,
        precio_unitario: 22,
        subtotal: 44,
      },
      {
        id: 'd0000000-0000-0000-0000-000000000002',
        orden_id: ORDEN_1042,
        tipo: 'PLATO',
        plato_id: CHICHA,
        cantidad: 2,
        precio_unitario: 4,
        subtotal: 8,
      },
      {
        id: 'd0000000-0000-0000-0000-000000000003',
        orden_id: ORDEN_1041,
        tipo: 'PLATO',
        plato_id: CEVICHE,
        cantidad: 1,
        precio_unitario: 15,
        subtotal: 15,
      },
      {
        id: 'd0000000-0000-0000-0000-000000000004',
        orden_id: ORDEN_1041,
        tipo: 'PLATO',
        plato_id: PISCO,
        cantidad: 2,
        precio_unitario: 10,
        subtotal: 20,
      },
      {
        id: 'd0000000-0000-0000-0000-000000000005',
        orden_id: ORDEN_1040,
        tipo: 'PLATO',
        plato_id: AJI,
        cantidad: 1,
        precio_unitario: 18,
        subtotal: 18,
      },
      {
        id: 'd0000000-0000-0000-0000-000000000006',
        orden_id: ORDEN_1039,
        tipo: 'PLATO',
        plato_id: TEQUENOS,
        cantidad: 2,
        precio_unitario: 8,
        subtotal: 16,
      },
      {
        id: 'd0000000-0000-0000-0000-000000000007',
        orden_id: ORDEN_1039,
        tipo: 'PLATO',
        plato_id: CHICHA,
        cantidad: 1,
        precio_unitario: 4,
        subtotal: 4,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.movimientos_inventario.createMany({
    data: [
      {
        id: 'e0000000-0000-0000-0000-000000000001',
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        insumo_id: INSUMO_LOMO,
        tipo: 'SALIDA',
        cantidad: -1.5,
        stock_resultante: 10.5,
        motivo: 'Venta · comandas #PD-1042',
        orden_id: ORDEN_1042,
        actor_id: COCINERO,
      },
      {
        id: 'e0000000-0000-0000-0000-000000000002',
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        insumo_id: INSUMO_PAPA,
        tipo: 'ENTRADA',
        cantidad: 20,
        stock_resultante: 20,
        motivo: 'Recepción OC-031 · AgroAndina',
        actor_id: GERENTE,
      },
      {
        id: 'e0000000-0000-0000-0000-000000000003',
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        insumo_id: INSUMO_AJI,
        tipo: 'MERMA',
        cantidad: -0.5,
        stock_resultante: 1.5,
        motivo: 'Merma de cocina',
        actor_id: COCINERO,
      },
      {
        id: 'e0000000-0000-0000-0000-000000000004',
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        insumo_id: INSUMO_PISCO,
        tipo: 'SALIDA',
        cantidad: -2,
        stock_resultante: 0,
        motivo: 'Venta · barra',
        actor_id: MESERO,
      },
      {
        id: 'e0000000-0000-0000-0000-000000000005',
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        insumo_id: INSUMO_LIMON,
        tipo: 'ENTRADA',
        cantidad: 5,
        stock_resultante: 2,
        motivo: 'Recepción OC-030 · Frutas Lima',
        actor_id: GERENTE,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.turnos_caja.createMany({
    data: [
      {
        id: TURNO_CAJA,
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        cajero_id: CAJERO,
        apertura_at: atLocal(9),
        fondo_apertura: 200,
        ingresos_total: 287,
        egresos_total: 12,
        saldo: 475,
        estado: 'ABIERTO',
      },
    ],
    skipDuplicates: true,
  });

  await prisma.movimientos_caja.createMany({
    data: [
      {
        id: 'f0000000-0000-0000-0000-000000000001',
        empresa_id: EMPRESA,
        turno_id: TURNO_CAJA,
        tipo: 'INGRESO',
        concepto: 'Fondo de apertura',
        monto: 200,
        metodo: 'EFECTIVO',
        actor_id: CAJERO,
      },
      {
        id: 'f0000000-0000-0000-0000-000000000002',
        empresa_id: EMPRESA,
        turno_id: TURNO_CAJA,
        tipo: 'INGRESO',
        concepto: 'Venta web #PD-1042',
        monto: 52,
        metodo: 'TARJETA',
        orden_id: ORDEN_1042,
        actor_id: CAJERO,
      },
      {
        id: 'f0000000-0000-0000-0000-000000000003',
        empresa_id: EMPRESA,
        turno_id: TURNO_CAJA,
        tipo: 'INGRESO',
        concepto: 'Venta mesa 7',
        monto: 35,
        metodo: 'YAPE',
        orden_id: ORDEN_1041,
        actor_id: CAJERO,
      },
      {
        id: 'f0000000-0000-0000-0000-000000000004',
        empresa_id: EMPRESA,
        turno_id: TURNO_CAJA,
        tipo: 'EGRESO',
        concepto: 'Compra hielo',
        monto: 12,
        metodo: 'EFECTIVO',
        actor_id: CAJERO,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.gastos.createMany({
    data: [
      {
        id: '70000000-0000-0000-0000-000000000001',
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        concepto: 'Compra insumos AgroAndina',
        monto: 120,
        categoria: 'INSUMOS',
        estado_pago: 'PAGADO',
        pagado_en_caja: true,
        turno_id: TURNO_CAJA,
        proveedor_id: PROVEEDOR_AGRO,
        registrado_por: GERENTE,
      },
      {
        id: '70000000-0000-0000-0000-000000000002',
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        concepto: 'Recibo Luz del Sur',
        monto: 85.5,
        categoria: 'SERVICIOS',
        estado_pago: 'PENDIENTE',
        pagado_en_caja: false,
        registrado_por: GERENTE,
      },
      {
        id: '70000000-0000-0000-0000-000000000003',
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        concepto: 'Planilla semanal personal',
        monto: 950,
        categoria: 'PERSONAL',
        estado_pago: 'PENDIENTE',
        pagado_en_caja: false,
        registrado_por: GERENTE,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.comprobantes.createMany({
    data: [
      {
        id: '60000000-0000-0000-0000-000000001042',
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        tipo: 'BOLETA',
        serie_numero: 'B001-1042',
        orden_id: ORDEN_1042,
        cliente_ref: 'Valeria Ríos',
        total: 52,
        estado: 'PAGADA',
        emitido_por: CAJERO,
      },
      {
        id: '60000000-0000-0000-0000-000000001041',
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        tipo: 'BOLETA',
        serie_numero: 'B001-1041',
        orden_id: ORDEN_1041,
        cliente_ref: 'Mesa 7',
        total: 35,
        estado: 'PAGADA',
        emitido_por: CAJERO,
      },
      {
        id: '60000000-0000-0000-0000-000000001040',
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        tipo: 'BOLETA',
        serie_numero: 'B001-1040',
        orden_id: ORDEN_1040,
        cliente_ref: 'Diego Torres',
        total: 18,
        estado: 'ANULADA',
        emitido_por: CAJERO,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.movimientos_puntos.createMany({
    data: [
      {
        id: 'a0000000-0000-0000-0000-000000000001',
        cliente_id: CLIENTE_VALERIA,
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        tipo: 'GANANCIA',
        puntos: 52,
        orden_id: ORDEN_1042,
        motivo: 'Pago exitoso #PD-1042: 1pto x $1',
      },
      {
        id: 'a0000000-0000-0000-0000-000000000002',
        cliente_id: CLIENTE_DIEGO,
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        tipo: 'GANANCIA',
        puntos: 18,
        orden_id: ORDEN_1040,
        motivo: 'Pago exitoso #PD-1040',
      },
    ],
    skipDuplicates: true,
  });

  await prisma.turnos_plan.createMany({
    data: [
      {
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        empleado_id: EMP_1,
        fecha: day(0),
        bloque: 'MANANA',
      },
      {
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        empleado_id: EMP_2,
        fecha: day(0),
        bloque: 'TARDE',
      },
      {
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        empleado_id: EMP_3,
        fecha: day(0),
        bloque: 'TARDE',
      },
    ],
    skipDuplicates: true,
  });

  await prisma.asistencias.createMany({
    data: [
      {
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        empleado_id: EMP_1,
        fecha: day(0),
        hora_entrada: atLocal(8),
        estado: 'PRESENTE',
        fuente: 'PIN',
      },
      {
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        empleado_id: EMP_2,
        fecha: day(0),
        hora_entrada: atLocal(8, 7),
        estado: 'TARDANZA',
        fuente: 'PIN',
      },
      {
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        empleado_id: EMP_3,
        fecha: day(0),
        hora_entrada: atLocal(7, 58),
        estado: 'PRESENTE',
        fuente: 'PIN',
      },
    ],
    skipDuplicates: true,
  });

  await prisma.pozos_propinas.createMany({
    data: [
      {
        id: POZO,
        empresa_id: EMPRESA,
        sucursal_id: MIRAFLORES,
        fecha: day(0),
        total: 86.5,
        nro_beneficiarios: 3,
        estado: 'CALCULADO',
      },
    ],
    skipDuplicates: true,
  });

  await prisma.repartos_propinas.createMany({
    data: [
      { pozo_id: POZO, empleado_id: EMP_1, monto: 28.83, presente: true },
      { pozo_id: POZO, empleado_id: EMP_2, monto: 28.83, presente: true },
      { pozo_id: POZO, empleado_id: EMP_3, monto: 28.84, presente: true },
    ],
    skipDuplicates: true,
  });

  const counts = {
    empresas: await prisma.empresas.count(),
    sucursales: await prisma.sucursales.count(),
    usuarios: await prisma.usuarios.count(),
    platos: await prisma.platos.count(),
    ordenes: await prisma.ordenes.count(),
    detalles_orden: await prisma.detalles_orden.count(),
    movimientos_inventario: await prisma.movimientos_inventario.count(),
    movimientos_caja: await prisma.movimientos_caja.count(),
    comprobantes: await prisma.comprobantes.count(),
  };
  console.log('Seed demo completado:', counts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
