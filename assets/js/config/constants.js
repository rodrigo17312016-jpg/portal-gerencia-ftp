/* ════════════════════════════════════════════════════════
   CONSTANTS - Constantes Globales del Sistema
   ════════════════════════════════════════════════════════ */

export const APP_NAME = 'Frutos Tropicales Peru Export S.A.C.';
export const APP_SHORT = 'FTP';
export const PORTAL_VERSION = '3.0';

// Timeout de sesion en milisegundos (15 minutos)
export const SESSION_TIMEOUT = 15 * 60 * 1000;

// Zona horaria Peru
export const TIMEZONE = 'America/Lima';

// Frutas disponibles
export const FRUTAS = {
  mango:    { emoji: '\uD83E\uDD6D', label: 'Mango',       color: '#f59e0b' },
  arandano: { emoji: '\uD83E\uDED0', label: 'Arandano',    color: '#6366f1' },
  granada:  { emoji: '\uD83C\uDF4E', label: 'Granada',     color: '#dc2626' },
  fresa:    { emoji: '\uD83C\uDF53', label: 'Fresa',        color: '#e11d48' },
  palta:    { emoji: '\uD83E\uDD51', label: 'Palta',        color: '#16a34a' },
  pina:     { emoji: '\uD83C\uDF4D', label: 'Pina',         color: '#eab308' }
};

// Areas de produccion
export const AREAS = {
  recepcion:     { label: 'Recepcion',      icon: '\uD83D\uDCE6', color: 'naranja' },
  acondicionado: { label: 'Acondicionado',  icon: '\u2702\uFE0F', color: 'cyan' },
  tuneles:       { label: 'Tuneles IQF',    icon: '\u2744\uFE0F', color: 'azul' },
  empaque:       { label: 'Empaque',        icon: '\uD83D\uDCE6', color: 'purple' },
  almacen:       { label: 'Almacen',        icon: '\uD83C\uDFED', color: 'amber' }
};

// Turnos
export const TURNOS = {
  DIA:   { label: 'Turno Dia',   icon: '\u2600\uFE0F' },
  NOCHE: { label: 'Turno Noche', icon: '\uD83C\uDF19' }
};

// Tablas Supabase
export const TABLES = {
  PRODUCCION:  'registro_produccion',
  PERSONAL:    'registro_personal',
  TUNELES:     'registro_tuneles',
  EMPAQUE:     'registro_empaque_congelado',
  COSTOS:      'config_costos',
  LABORES:     'labores_custom',
  TEMPERATURA: 'registros_temperatura'
};
