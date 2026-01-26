# SPRINT 2.1 — Anotaciones sobre PDF (Correcciones) + Guardado en Supabase

## Resumen Ejecutivo

Implementar sistema de anotaciones sobre PDFs para contratos, permitiendo a usuarios con permisos EDIT/OWNER crear correcciones como anotaciones (highlights, texto, comentarios) sobre documentos PDF. Las anotaciones se guardan como borradores (DRAFT) y pueden publicarse (PUBLISHED). Usuarios READ solo pueden ver anotaciones publicadas.

## A) SUPABASE — Migración de Base de Datos

### A.1 Crear ENUM `annotation_status`
**Archivo:** `supabase/migrations/20260128000000_create_annotations_tables.sql`

```sql
CREATE TYPE annotation_status AS ENUM ('DRAFT', 'PUBLISHED');
```

### A.2 Crear tabla `contract_file_annotations`
**Archivo:** `supabase/migrations/20260128000000_create_annotations_tables.sql`

```sql
CREATE TABLE IF NOT EXISTS public.contract_file_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  file_version_id uuid NOT NULL REFERENCES public.contract_file_versions(id) ON DELETE CASCADE,
  status annotation_status NOT NULL DEFAULT 'DRAFT',
  annotations_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Índices para performance
CREATE INDEX idx_contract_file_annotations_file_version_id ON public.contract_file_annotations (file_version_id);
CREATE INDEX idx_contract_file_annotations_contract_id ON public.contract_file_annotations (contract_id);
CREATE INDEX idx_contract_file_annotations_status ON public.contract_file_annotations (file_version_id, status);
CREATE INDEX idx_contract_file_annotations_created_by ON public.contract_file_annotations (file_version_id, created_by_user_id, status);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_contract_file_annotations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_contract_file_annotations_updated_at
  BEFORE UPDATE ON public.contract_file_annotations
  FOR EACH ROW
  EXECUTE FUNCTION update_contract_file_annotations_updated_at();
```

**Notas:**
- `annotations_json` almacena el array completo de anotaciones en formato JSON
- No hay constraint único para DRAFT (se maneja en API)
- Múltiples PUBLISHED permitidos (MVP)

## B) RLS — Políticas de Seguridad

### B.1 Habilitar RLS
**Archivo:** `supabase/migrations/20260128000001_create_annotations_rls_policies.sql`

```sql
ALTER TABLE public.contract_file_annotations ENABLE ROW LEVEL SECURITY;
```

### B.2 Política SELECT
Permitir si el usuario tiene acceso READ/EDIT/OWNER a la carpeta del contrato.

```sql
CREATE POLICY "Users can view annotations if they can view contract"
  ON public.contract_file_annotations FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.contract_file_versions cfv
      INNER JOIN public.contracts c ON c.id = cfv.contract_id
      INNER JOIN public.folders f ON f.id = c.folder_id
      INNER JOIN public.folder_permissions fp ON fp.folder_id = f.id
      INNER JOIN public.workspace_members wm ON wm.id = fp.member_id
      WHERE cfv.id = contract_file_annotations.file_version_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access IN ('READ', 'EDIT', 'OWNER')
    )
  );
```

### B.3 Política INSERT
Permitir si `created_by_user_id = auth.uid()` y usuario tiene EDIT/OWNER.

```sql
CREATE POLICY "Users can create annotations if they can edit contract"
  ON public.contract_file_annotations FOR INSERT
  WITH CHECK (
    created_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.contract_file_versions cfv
      INNER JOIN public.contracts c ON c.id = cfv.contract_id
      INNER JOIN public.folders f ON f.id = c.folder_id
      INNER JOIN public.folder_permissions fp ON fp.folder_id = f.id
      INNER JOIN public.workspace_members wm ON wm.id = fp.member_id
      WHERE cfv.id = contract_file_annotations.file_version_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access IN ('EDIT', 'OWNER')
        AND contract_file_annotations.workspace_id = wm.workspace_id
    )
  );
```

### B.4 Política UPDATE
Permitir si usuario tiene EDIT/OWNER. Si es DRAFT, solo el creador puede editar.

```sql
CREATE POLICY "Users can update annotations if they can edit contract"
  ON public.contract_file_annotations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.contract_file_versions cfv
      INNER JOIN public.contracts c ON c.id = cfv.contract_id
      INNER JOIN public.folders f ON f.id = c.folder_id
      INNER JOIN public.folder_permissions fp ON fp.folder_id = f.id
      INNER JOIN public.workspace_members wm ON wm.id = fp.member_id
      WHERE cfv.id = contract_file_annotations.file_version_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access IN ('EDIT', 'OWNER')
        AND contract_file_annotations.workspace_id = wm.workspace_id
        AND (
          contract_file_annotations.status = 'PUBLISHED'
          OR contract_file_annotations.created_by_user_id = auth.uid()
        )
    )
  );
```

### B.5 Política DELETE
Permitir si usuario tiene EDIT/OWNER. Solo borrar drafts del propio usuario (o si es OWNER).

```sql
CREATE POLICY "Users can delete annotations if they can edit contract"
  ON public.contract_file_annotations FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.contract_file_versions cfv
      INNER JOIN public.contracts c ON c.id = cfv.contract_id
      INNER JOIN public.folders f ON f.id = c.folder_id
      INNER JOIN public.folder_permissions fp ON fp.folder_id = f.id
      INNER JOIN public.workspace_members wm ON wm.id = fp.member_id
      WHERE cfv.id = contract_file_annotations.file_version_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'ACTIVE'
        AND fp.access IN ('EDIT', 'OWNER')
        AND contract_file_annotations.workspace_id = wm.workspace_id
        AND (
          contract_file_annotations.status = 'DRAFT'
          AND contract_file_annotations.created_by_user_id = auth.uid()
        )
    )
  );
```

## C) API ROUTES — Endpoints

### C.1 GET /api/contracts/annotations/list
**Archivo:** `app/api/contracts/annotations/list/route.ts`

**Query params:**
- `file_version_id` (requerido)

**Respuesta:**
```typescript
{
  success: boolean;
  draft: {
    id: string;
    annotations_json: Annotation[];
    created_at: string;
    updated_at: string;
  } | null;
  published: {
    id: string;
    annotations_json: Annotation[];
    created_at: string;
    updated_at: string;
    created_by: {
      user_id: string;
      display_name: string;
      avatar_url: string | null;
    };
  }[] | null;
}
```

**Lógica:**
1. Validar acceso READ al contrato relacionado a `file_version_id`
2. Obtener draft del usuario actual (si existe)
3. Obtener todas las anotaciones PUBLISHED ordenadas por `created_at DESC`
4. Enriquecer PUBLISHED con información de `created_by` desde `profiles`
5. Retornar ambos

### C.2 POST /api/contracts/annotations/save-draft
**Archivo:** `app/api/contracts/annotations/save-draft/route.ts`

**Body:**
```typescript
{
  file_version_id: string;
  annotations_json: Annotation[];
}
```

**Lógica:**
1. Validar permiso EDIT/OWNER sobre el contrato relacionado a `file_version_id`
2. Obtener `contract_id` y `workspace_id` desde `contract_file_versions` (JOIN con `contracts`)
3. Buscar draft existente para `(file_version_id, created_by_user_id)`
4. Si existe: UPDATE `annotations_json` y `updated_at`
5. Si no existe: INSERT nuevo registro DRAFT
6. Registrar actividad: `ANNOTATION_DRAFT_SAVED`
7. Retornar éxito

**Validaciones:**
- `annotations_json` debe ser un array válido
- Validar formato de anotaciones (tipos, rect, etc.)

### C.3 POST /api/contracts/annotations/publish
**Archivo:** `app/api/contracts/annotations/publish/route.ts`

**Body:**
```typescript
{
  file_version_id: string;
  annotations_json: Annotation[]; // o usar source_draft_id
  source_draft_id?: string; // opcional: publicar desde draft existente
}
```

**Lógica:**
1. Validar permiso EDIT/OWNER
2. Obtener `contract_id` y `workspace_id` desde `contract_file_versions`
3. Si `source_draft_id`:
   - Obtener draft y validar que pertenece al usuario actual
   - Usar `annotations_json` del draft
4. INSERT nuevo registro con `status='PUBLISHED'`
5. (Opcional) Marcar draft como "merged" o dejarlo
6. Registrar actividad: `ANNOTATION_PUBLISHED`
7. Retornar éxito

### C.4 POST /api/contracts/annotations/delete
**Archivo:** `app/api/contracts/annotations/delete/route.ts`

**Body:**
```typescript
{
  annotation_id: string;
}
```

**Lógica:**
1. Obtener anotación y validar permiso EDIT/OWNER
2. Validar que es DRAFT del usuario actual (o usuario es OWNER)
3. DELETE registro
4. Registrar actividad: `ANNOTATION_DELETED`
5. Retornar éxito

### C.5 Helper: Obtener contract_id y workspace_id desde file_version_id
**Archivo:** `lib/supabase/annotations.ts` (nuevo)

```typescript
export async function getFileVersionContext(
  supabase: SupabaseClient,
  fileVersionId: string
): Promise<{
  contract_id: string;
  workspace_id: string;
  folder_id: string;
} | null> {
  const { data, error } = await supabase
    .from('contract_file_versions')
    .select(`
      contract_id,
      contracts!inner (
        id,
        workspace_id,
        folder_id
      )
    `)
    .eq('id', fileVersionId)
    .single();

  if (error || !data) return null;

  return {
    contract_id: data.contract_id,
    workspace_id: data.contracts.workspace_id,
    folder_id: data.contracts.folder_id,
  };
}
```

## D) UI — Integración en Detalle de Contrato

### D.1 Modificar `components/contracts/contract-details.tsx`
**Cambios:**
1. Agregar botones "Abrir" y "Anotar" en cada versión de archivo (línea ~336)
2. Agregar indicadores de estado de anotaciones:
   - "Correcciones publicadas: sí/no"
   - "Mi borrador: guardado/no"
3. Pasar `access` y `contract` al componente de versión

**Ubicación:** Línea ~314-344 (donde se renderizan las versiones)

**Nuevos botones:**
```tsx
<div className="flex items-center gap-2">
  <Button
    variant="ghost"
    size="sm"
    onClick={() => handleOpenViewer(version.id, 'view')}
  >
    <Eye className="h-4 w-4 mr-2" />
    Abrir
  </Button>
  {(access === 'EDIT' || access === 'OWNER') && (
    <Button
      variant="outline"
      size="sm"
      onClick={() => handleOpenViewer(version.id, 'annotate')}
    >
      <PenTool className="h-4 w-4 mr-2" />
      Anotar
    </Button>
  )}
  <Button
    variant="ghost"
    size="sm"
    onClick={() => handleDownloadVersion(version)}
  >
    <Download className="h-4 w-4" />
  </Button>
</div>
```

### D.2 Estado de anotaciones
Agregar función para cargar estado de anotaciones por versión:

```typescript
const [annotationsStatus, setAnnotationsStatus] = useState<Record<string, {
  hasPublished: boolean;
  hasDraft: boolean;
}>>({});

const loadAnnotationsStatus = async (fileVersionId: string) => {
  try {
    const response = await fetch(`/api/contracts/annotations/list?file_version_id=${fileVersionId}`);
    if (response.ok) {
      const data = await response.json();
      setAnnotationsStatus(prev => ({
        ...prev,
        [fileVersionId]: {
          hasPublished: data.published && data.published.length > 0,
          hasDraft: data.draft !== null,
        },
      }));
    }
  } catch (error) {
    console.error("[ContractDetails] Error cargando estado de anotaciones:", error);
  }
};
```

## E) PDF REVIEWER — Componentes

### E.1 Componente principal: `components/pdf-review/pdf-reviewer.tsx`
**Responsabilidades:**
- Renderizar PDF usando `react-pdf` o `pdfjs-dist`
- Manejar overlay de anotaciones
- Coordinar modo Ver/Anotar
- Gestionar estado de anotaciones (draft, published)
- Manejar guardado y publicación

**Props:**
```typescript
interface PdfReviewerProps {
  fileVersionId: string;
  storagePath: string;
  mode: 'view' | 'annotate';
  access: 'READ' | 'EDIT' | 'OWNER';
  onClose: () => void;
}
```

**Estado:**
```typescript
const [pdfDocument, setPdfDocument] = useState<any>(null);
const [pages, setPages] = useState<any[]>([]);
const [currentPage, setCurrentPage] = useState(1);
const [draftAnnotations, setDraftAnnotations] = useState<Annotation[]>([]);
const [publishedAnnotations, setPublishedAnnotations] = useState<Annotation[]>([]);
const [showPublished, setShowPublished] = useState(true);
const [selectedTool, setSelectedTool] = useState<'select' | 'highlight' | 'text' | 'comment'>('select');
const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
const [isSaving, setIsSaving] = useState(false);
```

**Dependencias:**
- `react-pdf` o `pdfjs-dist` para renderizar PDF
- `@react-pdf-viewer/core` (opcional, más completo)

### E.2 Toolbar: `components/pdf-review/annotation-toolbar.tsx`
**Herramientas:**
- Select/Pointer (cursor normal)
- Highlight (click+drag para crear rectángulo)
- Text (click para crear cuadro de texto)
- Comment (click para crear pin de comentario)
- Delete (seleccionar anotación y borrar)

**Botones de acción:**
- Guardar borrador
- Publicar correcciones
- Cerrar (con confirmación si hay cambios)

### E.3 Sidebar: `components/pdf-review/annotation-sidebar.tsx`
**Funcionalidades:**
- Lista de anotaciones agrupadas por página
- Click en item → scroll a página y resaltar anotación
- Editar texto de anotación (solo si es draft actual)
- Toggle "Mostrar publicadas"
- Indicador de estado (draft guardado, publicado)

### E.4 Overlay: `components/pdf-review/annotation-overlay.tsx`
**Responsabilidades:**
- Renderizar anotaciones sobre el PDF
- Manejar interacciones (click, drag, resize)
- Convertir coordenadas normalizadas a píxeles
- Resaltar anotación seleccionada

**Coordenadas:**
- Todas las anotaciones usan coordenadas normalizadas (0..1)
- Al renderizar, convertir a píxeles usando bounding box de la página

### E.5 Tipos: `lib/annotations/types.ts`
```typescript
export type AnnotationType = 'HIGHLIGHT' | 'TEXT' | 'COMMENT';

export interface AnnotationRect {
  x: number; // 0..1
  y: number; // 0..1
  w: number; // 0..1
  h: number; // 0..1
}

export interface Annotation {
  id: string; // nanoid o uuid
  page: number; // 1-indexed
  type: AnnotationType;
  rect: AnnotationRect;
  text?: string; // para TEXT y COMMENT
  color?: string; // hex color
  opacity?: number; // 0..1
  createdAt: string; // ISO
  createdByUserId: string;
}
```

### E.6 Utilidades: `lib/annotations/normalize.ts`
```typescript
/**
 * Convierte coordenadas normalizadas (0..1) a píxeles
 */
export function normalizedToPixels(
  rect: AnnotationRect,
  pageWidth: number,
  pageHeight: number
): { x: number; y: number; width: number; height: number };

/**
 * Convierte píxeles a coordenadas normalizadas (0..1)
 */
export function pixelsToNormalized(
  x: number,
  y: number,
  width: number,
  height: number,
  pageWidth: number,
  pageHeight: number
): AnnotationRect;
```

## F) Actualizar Actividades

### F.1 Agregar tipos de actividad
**Archivo:** `lib/supabase/activities.ts`

```typescript
export type ActivityType = 
  | 'CREATE' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'VIEW' 
  | 'LOGIN' 
  | 'LOGOUT'
  | 'UPLOAD'
  | 'DOWNLOAD'
  | 'SHARE'
  | 'COMMENT'
  | 'CONTRACT_CREATED'
  | 'CONTRACT_UPDATED'
  | 'CONTRACT_STATUS_CHANGED'
  | 'CONTRACT_MAIN_VERSION_UPLOADED'
  | 'CONTRACT_ATTACHMENT_UPLOADED'
  | 'ANNOTATION_DRAFT_SAVED'
  | 'ANNOTATION_PUBLISHED'
  | 'ANNOTATION_DELETED';

export type EntityType = 
  | 'contract' 
  | 'folder' 
  | 'user' 
  | 'workspace' 
  | 'profile'
  | 'document'
  | 'avatar'
  | 'workspace_member'
  | 'workspace_invite'
  | 'contract_profile'
  | 'contract_profile_field'
  | 'contract_file_version';
```

## G) Modal/Dialog para PDF Reviewer

### G.1 Crear modal full-screen
**Archivo:** `components/pdf-review/pdf-review-modal.tsx`

Usar `Dialog` de Radix UI con `fullScreen` o crear modal personalizado.

**Estructura:**
```tsx
<Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent className="max-w-full w-full h-full m-0 p-0">
    <div className="flex h-full">
      <div className="flex-1">
        <PdfReviewer {...props} />
      </div>
      <div className="w-80 border-l">
        <AnnotationSidebar {...props} />
      </div>
    </div>
  </DialogContent>
</Dialog>
```

## H) Instalación de Dependencias

### H.1 Paquetes necesarios
```bash
npm install react-pdf pdfjs-dist
# o
npm install @react-pdf-viewer/core @react-pdf-viewer/default-layout
```

**Nota:** `react-pdf` requiere configuración de webpack para `pdfjs-dist`. Ver documentación.

## I) Flujo de Usuario

### I.1 Modo READ
1. Usuario abre "Abrir" → PDF se muestra en modo solo lectura
2. Anotaciones publicadas se muestran automáticamente
3. No puede crear/editar anotaciones
4. Puede navegar páginas y ver anotaciones

### I.2 Modo EDIT/OWNER - Anotar
1. Usuario abre "Anotar" → PDF se muestra en modo edición
2. Toolbar muestra herramientas (Highlight, Text, Comment, Delete)
3. Usuario crea anotaciones
4. Cambios se guardan en estado local (`draftAnnotations`)
5. Botón "Guardar borrador" → llama a `/api/contracts/annotations/save-draft`
6. Botón "Publicar" → llama a `/api/contracts/annotations/publish`
7. Al salir, si hay cambios no guardados → confirmación

### I.3 Confirmación al salir
```typescript
const handleClose = () => {
  if (hasUnsavedChanges) {
    if (confirm("Tienes cambios sin guardar. ¿Guardar borrador o salir?")) {
      handleSaveDraft().then(() => onClose());
    } else {
      onClose();
    }
  } else {
    onClose();
  }
};
```

## J) Criterios de Aceptación

1. ✅ Un EDITOR con permisos en folder puede:
   - Crear highlights/text/comments
   - Guardar draft
   - Recargar página y ver su draft de vuelta
   - Publicar y que aparezca como "publicado"

2. ✅ Un READER:
   - Puede ver PDF + anotaciones publicadas
   - NO puede crear/guardar/publicar

3. ✅ Todo registra activity:
   - `ANNOTATION_DRAFT_SAVED`
   - `ANNOTATION_PUBLISHED`
   - `ANNOTATION_DELETED`

4. ✅ RLS funciona correctamente:
   - READ solo ve publicadas
   - EDIT/OWNER puede crear/editar/publicar
   - Solo el creador puede editar su DRAFT

5. ✅ Coordenadas normalizadas funcionan correctamente:
   - Anotaciones se guardan en formato 0..1
   - Se renderizan correctamente en diferentes tamaños de viewport

## K) Archivos a Crear/Modificar

### Nuevos archivos:
1. `supabase/migrations/20260128000000_create_annotations_tables.sql`
2. `supabase/migrations/20260128000001_create_annotations_rls_policies.sql`
3. `app/api/contracts/annotations/list/route.ts`
4. `app/api/contracts/annotations/save-draft/route.ts`
5. `app/api/contracts/annotations/publish/route.ts`
6. `app/api/contracts/annotations/delete/route.ts`
7. `lib/supabase/annotations.ts`
8. `lib/annotations/types.ts`
9. `lib/annotations/normalize.ts`
10. `components/pdf-review/pdf-reviewer.tsx`
11. `components/pdf-review/annotation-toolbar.tsx`
12. `components/pdf-review/annotation-sidebar.tsx`
13. `components/pdf-review/annotation-overlay.tsx`
14. `components/pdf-review/pdf-review-modal.tsx`

### Archivos a modificar:
1. `lib/supabase/activities.ts` - Agregar tipos de actividad
2. `components/contracts/contract-details.tsx` - Agregar botones y estado
3. `package.json` - Agregar dependencias de PDF

## L) Consideraciones Técnicas

### L.1 Renderizado de PDF
- Usar `react-pdf` con `pdfjs-dist` worker
- Configurar webpack para worker (si es necesario)
- Manejar errores de carga de PDF

### L.2 Performance
- Lazy load de páginas del PDF
- Virtualización de anotaciones en sidebar
- Debounce en guardado automático (opcional)

### L.3 Validación
- Validar formato de `annotations_json` en API
- Validar coordenadas normalizadas (0..1)
- Validar tipos de anotación

### L.4 Seguridad
- Nunca confiar en `workspace_id` del cliente
- Siempre obtener desde `file_version_id` → `contract` → `workspace_id`
- Validar permisos en cada operación

## M) Orden de Implementación Recomendado

1. **Migraciones de BD** (A + B)
2. **API Routes** (C)
3. **Tipos y utilidades** (E.5 + E.6)
4. **Componente PDF Reviewer básico** (E.1)
5. **Overlay de anotaciones** (E.4)
6. **Toolbar** (E.2)
7. **Sidebar** (E.3)
8. **Integración en Contract Details** (D)
9. **Modal/Dialog** (G)
10. **Actualizar actividades** (F)
11. **Testing y refinamiento**

## N) Notas Adicionales

- **NO hacer:** Flatten/generar nuevo PDF con anotaciones incrustadas
- **NO hacer:** OCR / parsing Word
- **NO hacer:** Colaboración en tiempo real (para MVP)
- **Sí hacer:** Guardar borradores automáticamente (opcional, después de MVP)
- **Sí hacer:** Exportar anotaciones como JSON (opcional, después de MVP)

