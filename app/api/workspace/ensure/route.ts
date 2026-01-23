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

