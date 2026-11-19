/**
 * API pública de autenticación.
 *
 * `realtime` y `app.module` importan este `index.js`; el resto de módulos no
 * necesita conocer los DTO ni la estrategia JWT. El login sigue siendo la única
 * vía que emite el access token y el ticket efímero de WebSocket (AYCDS-14).
 */
export { AuthModule } from './auth.module.js';
export { AuthService } from './auth.service.js';
