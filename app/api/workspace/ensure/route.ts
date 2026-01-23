import { createClient } from "@/lib/supabase/server";
import { ensureUserWorkspace } from "@/lib/supabase/workspace";
import { NextResponse, type NextRequest } from "next/server";

/**
 * API route para asegurar que el usuario tenga un workspace.
 * Se llama desde el cliente cuando se detecta que el usuario no tiene workspace.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Verificar si el usuario ya tiene un workspace
    const { data: existingMembership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE')
      .limit(1)
      .maybeSingle();

    if (existingMembership) {
      return NextResponse.json({
        success: true,
        workspace_id: existingMembership.workspace_id,
        message: "El usuario ya tiene un workspace",
      });
    }

    // Crear el workspace usando la función atómica
    const workspaceId = await ensureUserWorkspace(supabase, user.id, user.email);

    if (!workspaceId) {
      return NextResponse.json(
        { error: "No se pudo crear el workspace" },
        { status: 500 }
      );
    }

    // Crear carpeta "Home" automáticamente si no existe
    try {
      // Verificar si ya existe una carpeta raíz "Home" para este workspace
      const { data: existingHomeFolder } = await supabase
        .from('folders')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('parent_id', null)
        .eq('name', 'Home')
        .maybeSingle();

      if (!existingHomeFolder) {
        // Obtener el workspace_members.id del usuario actual (OWNER)
        const { data: membership } = await supabase
          .from('workspace_members')
          .select('id')
          .eq('user_id', user.id)
          .eq('workspace_id', workspaceId)
          .eq('status', 'ACTIVE')
          .single();

        if (!membership) {
          console.error("[Workspace/Ensure] No se pudo obtener la membresía para crear Home");
        } else {
          // Crear carpeta "Home"
          const { data: homeFolder, error: folderError } = await supabase
            .from('folders')
            .insert({
              workspace_id: workspaceId,
              parent_id: null,
              name: 'Home',
              created_by_user_id: user.id,
            })
            .select()
            .single();

          if (folderError) {
            console.error("[Workspace/Ensure] Error creando carpeta Home:", folderError);
          } else if (homeFolder) {
            // Crear permiso OWNER para el usuario actual
            const { error: permError } = await supabase
              .from('folder_permissions')
              .insert({
                workspace_id: workspaceId,
                folder_id: homeFolder.id,
                member_id: membership.id,
                access: 'OWNER',
                created_by_user_id: user.id,
              });

            if (permError) {
              console.error("[Workspace/Ensure] Error creando permiso OWNER para Home:", permError);
            } else {
              console.log("[Workspace/Ensure] Carpeta Home creada exitosamente");
            }
          }
        }
      }
    } catch (homeError) {
      // No fallar la creación del workspace si falla la creación de Home
      console.error("[Workspace/Ensure] Error al crear carpeta Home:", homeError);
    }

    return NextResponse.json({
      success: true,
      workspace_id: workspaceId,
      message: "Workspace creado exitosamente",
    });
  } catch (error: any) {
    console.error("[API/Workspace/Ensure] Error:", error);
    return NextResponse.json(
      { error: error.message || "Error al asegurar el workspace" },
      { status: 500 }
    );
  }
}

