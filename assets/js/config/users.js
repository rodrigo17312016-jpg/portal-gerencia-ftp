/* ════════════════════════════════════════════════════════
   USERS - Metadata UI-only (display info)
   ════════════════════════════════════════════════════════
   IMPORTANTE (post Fase 9):
   - Este archivo YA NO contiene credenciales. Solo metadata
     UI (name, role, roleLabel, initials).
   - La autenticacion REAL se hace contra Supabase Auth.
   - El role canonico viene del JWT en auth.users.app_metadata.
   - Este diccionario se usa para mostrar avatar/nombre en UI
     cuando el JWT solo trae el email.
   ════════════════════════════════════════════════════════ */

export const USERS = {
  'gerencia': {
    name: 'Gerencia General',
    role: 'admin',
    roleLabel: 'Administrador',
    initials: 'GG'
  },
  'produccion': {
    name: 'Jefe Produccion',
    role: 'produccion',
    roleLabel: 'Area de Produccion',
    initials: 'PR'
  },
  'calidad': {
    name: 'Jefe Calidad',
    role: 'calidad',
    roleLabel: 'Area de Calidad',
    initials: 'CA'
  },
  'mantenimiento': {
    name: 'Jefe Mantenimiento',
    role: 'mantenimiento',
    roleLabel: 'Area de Mantenimiento',
    initials: 'MT'
  },
  'rodrigo': {
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
  },
  mantenimiento: {
    label: 'Mantenimiento',
    description: 'Acceso a modulos de mantenimiento industrial',
    color: 'amber'
  }
};
