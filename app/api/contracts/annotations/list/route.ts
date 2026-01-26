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

    // Obtener draft del usuario actual
    const { data: draft } = await supabase
      .from('contract_file_annotations')
      .select('id, annotations_json, created_at, updated_at')
      .eq('file_version_id', file_version_id)
      .eq('created_by_user_id', user.id)
      .eq('status', 'DRAFT')
      .maybeSingle();

    // Obtener todas las anotaciones publicadas
    const { data: published, error: publishedError } = await supabase
      .from('contract_file_annotations')
      .select(`
        id,
        annotations_json,
        created_at,
        updated_at,
        created_by_user_id
      `)
      .eq('file_version_id', file_version_id)
      .eq('status', 'PUBLISHED')
      .order('created_at', { ascending: false });

    if (publishedError) {
      console.error("[Annotations/List] Error obteniendo publicadas:", publishedError);
      return NextResponse.json(
        { error: publishedError.message },
        { status: 500 }
      );
    }

    // Enriquecer publicadas con información del usuario creador
    const userIds = [...new Set((published || []).map(p => p.created_by_user_id))];
    let usersMap = new Map();
    
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('profiles')
        .select('user_id, display_name, avatar_url')
        .in('user_id', userIds);

      if (users) {
        usersMap = new Map(users.map(u => [u.user_id, u]));
      }
    }

    const publishedWithUsers = (published || []).map(p => ({
      id: p.id,
      annotations_json: p.annotations_json,
      created_at: p.created_at,
      updated_at: p.updated_at,
      created_by: usersMap.get(p.created_by_user_id) || {
        user_id: p.created_by_user_id,
        display_name: 'Usuario desconocido',
        avatar_url: null,
      },
    }));

    return NextResponse.json({
      success: true,
      draft: draft || null,
      published: publishedWithUsers,
    });
  } catch (error: any) {
    console.error("[Annotations/List] Error inesperado:", error);
    return NextResponse.json(
      { error: error.message || "Error al listar anotaciones" },
      { status: 500 }
    );
  }
}

