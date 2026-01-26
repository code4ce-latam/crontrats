# Informe del Proyecto: Sistema de Control de Contratos (SaaS)

## 📋 Descripción General

Aplicación SaaS multi-tenant para gestión de contratos con sistema de carpetas, perfiles de contrato, gestión de usuarios y auditoría. El sistema permite a organizaciones (workspaces) gestionar contratos de manera estructurada con control de acceso granular.

## 🛠️ Stack Tecnológico

### Frontend
- **Framework**: Next.js 15+ (App Router)
- **React**: 19.0.0
- **TypeScript**: 5+
- **Estilos**: Tailwind CSS 3.4+
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Iconos**: Lucide React
- **Temas**: next-themes (dark/light mode)

### Backend
- **Base de Datos**: Supabase (PostgreSQL)
- **Autenticación**: Supabase Auth (cookies-based SSR)
- **API**: Next.js API Routes
- **Seguridad**: Row Level Security (RLS) en todas las tablas

### Herramientas
- **Email**: Resend
- **Linting**: ESLint
- **Formateo**: Prettier + Tailwind Plugin

## 🏗️ Arquitectura

### Estructura de Directorios

```
app/
├── api/                    # API Routes (Next.js)
│   ├── folders/           # Gestión de carpetas
│   ├── contract-profiles/ # Perfiles de contrato
│   ├── invitations/       # Sistema de invitaciones
│   ├── users/            # Gestión de usuarios
│   └── workspace/        # Configuración de workspace
├── auth/                  # Páginas de autenticación
│   ├── login/
│   ├── sign-up/
│   ├── forgot-password/
│   └── invite/
└── protected/             # Páginas protegidas
    ├── carpetas/         # Administración de carpetas
    ├── configuracion/    # Configuración del sistema
    │   ├── usuarios/
    │   ├── invitaciones/
    │   ├── perfiles/
    │   └── auditoria/
    ├── configuracion-cuenta/ # Configuración del workspace
    └── perfil/           # Perfil del usuario

components/
├── folders/              # Componentes de carpetas
├── ui/                   # Componentes UI base (shadcn)
└── [otros componentes]

lib/
├── supabase/            # Helpers de Supabase
│   ├── server.ts       # Cliente servidor
│   ├── client.ts       # Cliente cliente
│   ├── admin.ts        # Cliente admin (service role)
│   ├── folders.ts      # Funciones de carpetas
│   ├── activities.ts   # Sistema de auditoría
│   └── ...
├── timezones.ts        # Utilidades de zonas horarias
└── utils.ts           # Utilidades generales

supabase/migrations/    # Migraciones SQL
```

## 🎯 Funcionalidades Principales

### 1. Sistema Multi-Tenant (Workspaces)
- Cada organización tiene su propio workspace
- Usuarios pueden pertenecer a un workspace
- Configuración por workspace (nombre, zona horaria)
- Solo el OWNER puede modificar configuración del workspace

### 2. Gestión de Usuarios y Roles
**Roles del Workspace:**
- **OWNER**: Control total, puede gestionar usuarios, carpetas, configuración
- **EDITOR**: Puede editar contenido, gestionar perfiles de contrato
- **READER**: Solo lectura

**Funcionalidades:**
- Invitaciones por email con tokens
- Gestión de roles de miembros
- Perfiles de usuario con avatar
- Actualización de información personal

### 3. Sistema de Carpetas (Folders)
**Características:**
- Estructura jerárquica con `parent_id`
- Path automático generado por trigger SQL (formato: `id` o `parent.path.id`)
- Permisos granulares por carpeta:
  - **OWNER**: Control total (crear, editar, eliminar, gestionar permisos)
  - **EDIT**: Puede editar contenido
  - **READ**: Solo lectura

**Funcionalidades:**
- Crear carpetas y subcarpetas
- Renombrar carpetas
- Eliminar carpetas (con validación de subcarpetas)
- Gestión de permisos por carpeta
- Visualización de árbol de carpetas
- Filtrado por permisos del usuario (RLS)
- Solo OWNER del workspace puede crear carpetas raíz
- Solo usuarios con permiso OWNER en una carpeta pueden gestionar sus permisos
- **Integración con Contratos**: En la vista de detalles de carpeta se muestran los contratos de esa carpeta

**Componentes:**
- `FolderTree`: Árbol de carpetas con expansión/colapso
- `FolderDetails`: Detalles de carpeta seleccionada (incluye lista de contratos)
- `FolderPermissionsDrawer`: Gestión de permisos
- `CreateFolderDialog`: Crear nueva carpeta
- `RenameFolderDialog`: Renombrar carpeta

### 4. Perfiles de Contrato (Contract Profiles)
- Maestro de perfiles de contrato por workspace
- Campos personalizables:
  - TEXT, NUMBER, DATE, MONEY, SELECT, CHECKBOX
- Ordenamiento de campos
- Solo OWNER y EDITOR pueden gestionar perfiles

### 6. Sistema de Auditoría (Activities)
- Registro de todas las acciones importantes
- Tipos de actividades: CREATE, UPDATE, DELETE, LOGIN, LOGOUT, etc.
- Panel lateral con historial de actividades
- Página de auditoría completa
- Solo OWNER puede ver auditoría completa

### 7. Sistema de Invitaciones
- Invitaciones por email con tokens únicos
- Estados: PENDING, ACCEPTED, EXPIRED, REVOKED
- Roles asignables: EDITOR, READER
- Expiración automática
- Solo OWNER puede invitar

### 8. Configuración de Workspace
- Nombre del workspace (solo OWNER)
- Zona horaria (solo OWNER)
- Lista completa de zonas horarias IANA
- Agrupación por región
- Mapeo de nombres comunes (ej: "Quito" para America/Guayaquil)

## 🗄️ Base de Datos

### Tablas Principales

#### `workspaces`
- `id`, `name`, `timezone`, `created_at`
- Cada organización tiene un workspace

#### `workspace_members`
- `id`, `workspace_id`, `user_id`, `role` (OWNER/EDITOR/READER), `status` (ACTIVE/INACTIVE)
- Relación usuarios-workspace

#### `folders`
- `id`, `workspace_id`, `parent_id`, `name`, `path`, `sort_order`, `created_at`, `created_by_user_id`
- Estructura jerárquica con path automático

#### `folder_permissions`
- `id`, `workspace_id`, `folder_id`, `member_id`, `access` (OWNER/EDIT/READ)
- Permisos granulares por carpeta

#### `contract_profiles`
- `id`, `workspace_id`, `name`, `description`, `is_active`, `created_at`, `created_by_user_id`
- Maestro de perfiles

#### `contract_profile_fields`
- `id`, `workspace_id`, `profile_id`, `key`, `label`, `type`, `is_required`, `options`, `sort_order`
- Campos de cada perfil

#### `workspace_invites`
- `id`, `workspace_id`, `email`, `role`, `status`, `token`, `invited_by_user_id`, `expires_at`
- Sistema de invitaciones

#### `activities`
- `id`, `workspace_id`, `user_id`, `type`, `description`, `entity_type`, `entity_id`, `created_at`
- Registro de auditoría

### Seguridad (RLS)
- **Todas las tablas tienen RLS habilitado**
- Políticas basadas en:
  - Pertenencia al workspace
  - Rol del usuario
  - Permisos específicos en carpetas
- Principio "zero trust": sin policy, no hay acceso

## 🔐 Sistema de Permisos

### Niveles de Permiso

1. **Workspace Level** (workspace_members.role):
   - OWNER: Control total del workspace
   - EDITOR: Puede editar contenido
   - READER: Solo lectura

2. **Folder Level** (folder_permissions.access):
   - OWNER: Control total de la carpeta
   - EDIT: Puede editar contenido
   - READ: Solo lectura

### Reglas de Negocio

**Carpetas:**
- Solo OWNER del workspace puede crear carpetas raíz
- Solo usuarios con permiso OWNER en una carpeta pueden:
  - Crear subcarpetas
  - Renombrar la carpeta
  - Eliminar la carpeta
  - Gestionar permisos
- Los permisos se pueden propagar a subcarpetas
- Una carpeta siempre debe tener al menos 1 OWNER
- No se puede quitar al último OWNER

**Perfiles de Contrato:**
- OWNER y EDITOR pueden crear/editar/eliminar
- READER solo puede ver

**Usuarios:**
- Solo OWNER puede gestionar usuarios e invitaciones
- Solo OWNER puede ver auditoría completa

## 🎨 Componentes Principales

### Layout y Navegación
- `Sidebar`: Menú lateral con navegación
- `SidebarContent`: Contenido del menú basado en `menu-config.json`
- `UserAvatarMenu`: Menú de usuario con opciones
- `WorkspaceName`: Nombre del workspace en header
- `ActivitiesPanel`: Panel lateral de actividades

### Carpetas
- `FoldersView`: Vista principal de carpetas
- `FolderTree`: Árbol de carpetas
- `FolderDetails`: Detalles de carpeta
- `FolderPermissionsDrawer`: Gestión de permisos
- `CreateFolderDialog`: Crear carpeta
- `RenameFolderDialog`: Renombrar carpeta

### Configuración
- `WorkspaceSettingsContent`: Configuración del workspace
- `UsersList`: Lista de usuarios
- `InvitationsList`: Lista de invitaciones
- `ContractProfilesList`: Lista de perfiles
- `AuditActivitiesList`: Lista de auditoría

## 📝 Estado Actual del Desarrollo

### ✅ Completado

1. **Autenticación y Autorización**
   - Login/Sign-up
   - Recuperación de contraseña
   - Invitaciones por email
   - Sistema de roles y permisos

2. **Gestión de Workspace**
   - Creación automática de workspace
   - Configuración de nombre y zona horaria
   - Gestión de miembros

3. **Sistema de Carpetas**
   - Estructura jerárquica completa
   - Permisos granulares
   - UI completa con árbol, detalles, permisos
   - Validaciones de seguridad

4. **Perfiles de Contrato**
   - CRUD completo
   - Campos personalizables
   - Ordenamiento

5. **Auditoría**
   - Registro de actividades
   - Panel lateral
   - Página completa

6. **UI/UX**
   - Diseño responsive
   - Dark/Light mode
   - Componentes accesibles (Radix UI)
   - Optimizaciones de rendimiento

    ### 🚧 Pendiente / En Desarrollo

    1. **Workflows de Aprobación**
       - Sistema de aprobaciones para contratos (Sprint 3)

2. **Recordatorios**
   - Sistema de recordatorios (mencionado en menú)

3. **Flujos de Trabajo**
   - Workflows (mencionado en menú)

4. **Facturación**
   - Sistema de facturación (mencionado en menú)

5. **Estados de Contrato**
   - Gestión de estados (mencionado en menú)

## 🔧 Configuración y Variables de Entorno

### Requeridas
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
```

## 📚 Archivos de Configuración Importantes

- `data/menu-config.json`: Configuración del menú lateral
- `lib/menu-icon-map.ts`: Mapeo de iconos del menú
- `lib/menu-route-map.ts`: Mapeo de rutas del menú
- `components.json`: Configuración de shadcn/ui
- `supabase/migrations/`: Migraciones de base de datos

## 🎯 Convenciones y Estándares

### Código
- TypeScript estricto
- Componentes funcionales con hooks
- Server Components por defecto, Client Components cuando necesario
- Separación de lógica: `lib/` para helpers, `components/` para UI

### Base de Datos
- UUIDs como IDs primarios
- `created_at` timestamptz en todas las tablas
- Soft deletes donde aplica (status fields)
- Triggers para lógica automática (ej: path de carpetas)

### Seguridad
- RLS en todas las tablas
- Validación en API routes
- Service Role Key solo en servidor
- Validación de permisos en múltiples capas

## 🚀 Próximos Pasos Sugeridos

1. Implementar CRUD completo de contratos
2. Sistema de recordatorios
3. Workflows/Flujos de trabajo
4. Sistema de facturación
5. Mejoras de rendimiento (caching, optimizaciones)
6. Tests (unitarios, integración)
7. Documentación de API
8. Internacionalización (i18n)

## 📖 Notas Importantes

- El sistema usa **cookies para autenticación** (SSR-friendly)
- Todas las queries respetan RLS automáticamente
- El sistema está diseñado para ser multi-tenant desde el inicio
- La zona horaria del workspace afecta las notificaciones
- Los permisos de carpetas son independientes de los roles del workspace

## 🔍 Detalles Técnicos Relevantes

### Sistema de Carpetas - Implementación

**Path Generation:**
- Trigger SQL `generate_folder_path()` genera automáticamente el path
- Formato: `id` para raíz, `parent.path.id` para subcarpetas
- Permite navegación eficiente sin recursión

**Permisos:**
- Los permisos se almacenan en `folder_permissions`
- Cada permiso está vinculado a un `member_id` (no `user_id` directamente)
- Los permisos se pueden propagar a subcarpetas al actualizar
- RLS filtra automáticamente las carpetas según permisos del usuario

**Validaciones:**
- No se puede eliminar una carpeta con subcarpetas
- Siempre debe haber al menos 1 OWNER por carpeta
- No se puede quitar al último OWNER
- Solo OWNER del workspace puede crear carpetas raíz

### Zonas Horarias

**Implementación:**
- Lista completa de zonas horarias IANA usando `Intl.supportedValuesOf('timeZone')`
- Lista estándar prioritaria con ~70 zonas horarias comunes
- Mapeo de nombres comunes (ej: "Quito" para `America/Guayaquil`)
- Agrupación por región en el selector
- Offset calculado dinámicamente considerando DST

**Uso:**
- Almacenado en `workspaces.timezone`
- Solo OWNER puede modificar
- Afecta las notificaciones y timestamps

### Sistema de Actividades

**Tipos de Actividades:**
- CREATE, UPDATE, DELETE
- LOGIN, LOGOUT
- Otros eventos importantes del sistema

**Implementación:**
- Función helper `createActivity()` en `lib/supabase/activities.ts`
- Registro automático en operaciones críticas
- Panel lateral con últimas actividades
- Página completa de auditoría con filtros

### Menú Dinámico

**Configuración:**
- `data/menu-config.json` define la estructura del menú
- `lib/menu-icon-map.ts` mapea keys a iconos
- `lib/menu-route-map.ts` mapea rutas del JSON a rutas reales
- Filtrado por roles (`visibleRoles`)

**Componentes:**
- `Sidebar` renderiza el menú basado en la configuración
- Soporta items anidados (children)
- Iconos dinámicos según la key del item

