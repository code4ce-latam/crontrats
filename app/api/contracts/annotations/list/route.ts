import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";
import { getFileVersionContext } from "@/lib/supabase/annotations";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const file_version_id = searchParams.get('file_version_id');

    if (!file_version_id) {
      return NextResponse.json(
        { error: "file_version_id es requerido" },
        { status: 400 }
      );
    }

    // Obtener contexto (contract_id, workspace_id, folder_id)
    const context = await getFileVersionContext(supabase, file_version_id);
    if (!context) {
      return NextResponse.json(
        { error: "Versión de archivo no encontrada" },
        { status: 404 }
      );
    }

    // Verificar acceso READ (RLS ya filtra, pero validamos explícitamente)
    const { data: contract } = await supabase
      .from('contracts')
      .select('id')
      .eq('id', context.contract_id)
      .single();

    if (!contract) {
      return NextResponse.json(
        { error: "Contrato no encontrado" },
        { status: 404 }
      );
    }

    // Obtener mis anotaciones (del usuario actual)
    const { data: myAnnotations } = await supabase
      .from('contract_file_annotations')
      .select('id, annotations_json, created_at, updated_at')
      .eq('file_version_id', file_version_id)
      .eq('created_by_user_id', user.id)
      .maybeSingle();

    // Obtener anotaciones de otros usuarios
    const { data: othersAnnotations, error: othersError } = await supabase
      .from('contract_file_annotations')
      .select(`
        id,
        annotations_json,
        created_at,
        updated_at,
        created_by_user_id
      `)
      .eq('file_version_id', file_version_id)
      .neq('created_by_user_id', user.id)
      .order('updated_at', { ascending: false });

    if (othersError) {
      console.error("[Annotations/List] Error obteniendo anotaciones de otros:", othersError);
      return NextResponse.json(
        { error: othersError.message },
        { status: 500 }
      );
    }

    // Obtener información de usuarios (para my y others)
    const allUserIds = new Set<string>();
    if (myAnnotations) {
      allUserIds.add(user.id);
    }
    (othersAnnotations || []).forEach(ann => {
      allUserIds.add(ann.created_by_user_id);
    });

    let usersMap = new Map();
    if (allUserIds.size > 0) {
      const { data: users } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', Array.from(allUserIds));

      if (users) {
        usersMap = new Map(users.map(u => [u.user_id, u]));
      }
    }

    // Enriquecer my con información del usuario
    const my = myAnnotations ? {
      id: myAnnotations.id,
      annotations_json: myAnnotations.annotations_json,
      created_at: myAnnotations.created_at,
      updated_at: myAnnotations.updated_at,
      created_by: usersMap.get(user.id) || {
        user_id: user.id,
        display_name: 'Tú',
        avatar_url: null,
      },
    } : null;

    // Enriquecer others con información de usuarios
    const others = (othersAnnotations || []).map(ann => ({
      id: ann.id,
      annotations_json: ann.annotations_json,
      created_at: ann.created_at,
      updated_at: ann.updated_at,
      created_by: usersMap.get(ann.created_by_user_id) || {
        user_id: ann.created_by_user_id,
        display_name: 'Usuario desconocido',
        avatar_url: null,
      },
    }));

    // Obtener lista de autores para filtro
    const authors = Array.from(allUserIds).map(userId => {
      const userInfo = usersMap.get(userId);
      return {
        user_id: userId,
        display_name: userInfo?.display_name || 'Usuario desconocido',
        avatar_url: userInfo?.avatar_url || null,
      };
    });

    // Calcular last_updated_at
    const allUpdatedAts = [
      my?.updated_at,
      ...others.map(o => o.updated_at),
    ].filter(Boolean) as string[];
    
    const last_updated_at = allUpdatedAts.length > 0
      ? new Date(Math.max(...allUpdatedAts.map(d => new Date(d).getTime()))).toISOString()
      : null;

    return NextResponse.json({
      success: true,
      my,
      others,
      authors,
      last_updated_at,
    });
  } catch (error: any) {
    console.error("[Annotations/List] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al listar anotaciones" },
      { status: 500 }
    );
  }
}

