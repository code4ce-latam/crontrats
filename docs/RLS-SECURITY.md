# Row Level Security (RLS) y Políticas de Seguridad

## Introducción

Este documento describe las políticas de seguridad que deben implementarse en Supabase para garantizar que el acceso a los datos siga el principio de "zero trust": **si no hay policy, no hay acceso**.

## Configuración Base

### Habilitar RLS

RLS debe estar habilitado en **todas las tablas** que contengan datos sensibles o que sean accesibles desde la aplicación.

```sql
-- Ejemplo: Habilitar RLS en una tabla
ALTER TABLE nombre_tabla ENABLE ROW LEVEL SECURITY;
```

## Políticas Recomendadas

### 1. Tabla de Usuarios/Perfiles

Si tienes una tabla de perfiles de usuario:

```sql
-- Policy: Los usuarios solo pueden ver su propio perfil
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Los usuarios solo pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Los usuarios pueden insertar su propio perfil al registrarse
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

**Casos borde a considerar:**
- ¿Qué pasa si un usuario intenta acceder a un perfil que no existe?
- ¿Necesitas que los administradores puedan ver todos los perfiles?
- ¿Qué pasa con usuarios anónimos?

### 2. Tabla de Datos Protegidos

Para cualquier tabla con datos que solo el usuario autenticado debe ver:

```sql
-- Policy: Solo usuarios autenticados pueden ver sus propios datos
CREATE POLICY "Authenticated users can view own data"
  ON mi_tabla
  FOR SELECT
  USING (
    auth.role() = 'authenticated' 
    AND auth.uid() = user_id
  );

-- Policy: Solo usuarios autenticados pueden insertar sus propios datos
CREATE POLICY "Authenticated users can insert own data"
  ON mi_tabla
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' 
    AND auth.uid() = user_id
  );

-- Policy: Solo usuarios autenticados pueden actualizar sus propios datos
CREATE POLICY "Authenticated users can update own data"
  ON mi_tabla
  FOR UPDATE
  USING (
    auth.role() = 'authenticated' 
    AND auth.uid() = user_id
  )
  WITH CHECK (
    auth.role() = 'authenticated' 
    AND auth.uid() = user_id
  );

-- Policy: Solo usuarios autenticados pueden eliminar sus propios datos
CREATE POLICY "Authenticated users can delete own data"
  ON mi_tabla
  FOR DELETE
  USING (
    auth.role() = 'authenticated' 
    AND auth.uid() = user_id
  );
```

**Casos borde a considerar:**
- ¿Necesitas soft delete en lugar de DELETE real?
- ¿Qué pasa si un usuario intenta actualizar datos que no le pertenecen?
- ¿Necesitas validar que el user_id no se pueda cambiar en UPDATE?

### 3. Tabla Pública (Solo Lectura)

Para datos que todos pueden leer pero solo autenticados pueden escribir:

```sql
-- Policy: Cualquiera puede leer
CREATE POLICY "Public read access"
  ON tabla_publica
  FOR SELECT
  USING (true);

-- Policy: Solo autenticados pueden insertar
CREATE POLICY "Authenticated users can insert"
  ON tabla_publica
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
```

## Service Role Key - Seguridad Crítica

⚠️ **NUNCA expongas la Service Role Key en el frontend**

La Service Role Key debe usarse **únicamente** en:
- Server Actions de Next.js
- Route Handlers de Next.js
- Funciones server-side exclusivamente

### Ejemplo Correcto (Server Action)

```typescript
// app/actions/admin.ts
'use server'

import { createClient } from '@supabase/supabase-js'

export async function adminAction() {
  // ✅ Correcto: Service role key solo en server-side
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // ⚠️ Variable de entorno, NO pública
  )
  
  // Operaciones administrativas...
}
```

### Ejemplo Incorrecto

```typescript
// ❌ NUNCA hagas esto en un Client Component
'use client'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ❌ PELIGRO: Se expone al cliente
)
```

## Verificación de Políticas

### Checklist de Seguridad

- [ ] RLS habilitado en todas las tablas con datos sensibles
- [ ] Políticas definidas para SELECT, INSERT, UPDATE, DELETE según necesidad
- [ ] Service Role Key solo en código server-side
- [ ] Variables de entorno con Service Role Key marcadas como secretas
- [ ] Políticas probadas con diferentes roles de usuario
- [ ] Casos borde documentados y manejados

### Testing de Políticas

```sql
-- Verificar políticas existentes
SELECT * FROM pg_policies WHERE tablename = 'nombre_tabla';

-- Probar como usuario específico
SET ROLE authenticated;
SET request.jwt.claim.sub = 'user-uuid-here';
SELECT * FROM nombre_tabla;
```

## Recursos Adicionales

- [Documentación oficial de RLS en Supabase](https://supabase.com/docs/guides/auth/row-level-security)
- [Mejores prácticas de seguridad](https://supabase.com/docs/guides/auth/row-level-security#best-practices)
- [Ejemplos de políticas comunes](https://supabase.com/docs/guides/auth/row-level-security#common-patterns)

## Notas Importantes

1. **Zero Trust**: Por defecto, sin políticas, nadie tiene acceso. Esto es correcto.
2. **Principio de menor privilegio**: Solo otorga los permisos mínimos necesarios.
3. **Auditoría**: Considera agregar logging para operaciones sensibles.
4. **Testing**: Siempre prueba tus políticas con diferentes usuarios y roles.

