/* ════════════════════════════════════════════════════════
   USERS - Definicion Unificada de Usuarios y Roles
   ════════════════════════════════════════════════════════ */

export const USERS = {
  'gerencia': {
    pass: 'frutos2026',
    name: 'Gerencia General',
    role: 'admin',
    roleLabel: 'Administrador',
    initials: 'GG'
  },
  'produccion': {
    pass: 'prod2026',
    name: 'Jefe Produccion',
    role: 'produccion',
    roleLabel: 'Area de Produccion',
    initials: 'PR'
  },
  'calidad': {
    pass: 'cal2026',
    name: 'Jefe Calidad',
    role: 'calidad',
    roleLabel: 'Area de Calidad',
    initials: 'CA'
  },
  'rodrigo': {
    pass: 'ftp2026',
    name: 'Rodrigo Garcia',
    role: 'admin',
    roleLabel: 'Systems Analyst & Developer',
    initials: 'RG'
  }
};

// Roles disponibles
export const ROLES = {
  admin: {
    label: 'Administrador',
    description: 'Acceso completo a todos los modulos',
    color: 'verde'
  },
  produccion: {
    label: 'Produccion',
    description: 'Acceso a modulos de produccion y almacen',
    color: 'naranja'
  },
  calidad: {
    label: 'Calidad',
    description: 'Acceso a modulos de calidad y almacen',
    color: 'azul'
  }
};
