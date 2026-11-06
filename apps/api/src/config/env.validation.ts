const DEV_DATABASE_URL =
  'postgresql://fogoneria_app:fogoneria_app@localhost:5433/fogoneria_db?schema=fogoneria';

/**
 * Valida variables de entorno al arranque.
 * En desarrollo/test tolera valores por defecto para poder levantar sin base de datos;
 * en producción exige secretos fuertes.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const isProduction = config.NODE_ENV === 'production';
  const next = { ...config };

  if (!next.DATABASE_URL) {
    if (isProduction) throw new Error('DATABASE_URL es obligatoria en producción');
    next.DATABASE_URL = DEV_DATABASE_URL;
  }

  const jwtSecret = String(next.JWT_SECRET ?? '');
  if (!jwtSecret) {
    if (isProduction) throw new Error('JWT_SECRET es obligatoria en producción');
    next.JWT_SECRET = 'dev-only-jwt-secret-change-me';
    next.JWT_SECRET_IS_DEV_DEFAULT = 'true';
  } else if (isProduction && jwtSecret.length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción');
  }

  next.JWT_EXPIRES_IN = String(next.JWT_EXPIRES_IN ?? '8h');
  next.PORT = Number(next.PORT ?? 3001);
  next.CORS_ORIGIN = String(next.CORS_ORIGIN ?? 'http://localhost:3000');
  next.DATABASE_SCHEMA = String(next.DATABASE_SCHEMA ?? 'fogoneria');
  // Tamaño de cada pool de Prisma (negocio y plataforma). AYCDS-22 mostró que
  // 10 no era el cuello de botella (la base estaba ociosa), así que se deja el
  // valor histórico y se expone para escalar sin recompilar.
  next.DATABASE_POOL_MAX = positiveInt(next.DATABASE_POOL_MAX, 10);
  next.TRIAL_DAYS = positiveInt(next.TRIAL_DAYS, 14);
  next.ONBOARDING_RATE_LIMIT = positiveInt(next.ONBOARDING_RATE_LIMIT, 5);
  next.ONBOARDING_RATE_WINDOW_MS = positiveInt(next.ONBOARDING_RATE_WINDOW_MS, 600_000);

  return next;
}

/** Entero positivo; si falta o es inválido usa el valor por defecto. */
function positiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
