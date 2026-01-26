import { createClient } from "@/lib/supabase/server";
import { Building2 } from "lucide-react";
import { getUserWorkspaceId } from "@/lib/supabase/users";

export async function WorkspaceName() {
  try {
    const supabase = await createClient();
    
    // Obtener información del workspace
    const workspaceId = await getUserWorkspaceId(supabase);
    
    if (!workspaceId) {
      return null;
    }

    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single();

    if (!workspace?.name) {
      return null;
    }

    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border border-border rounded-lg shadow-sm">
        <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-semibold text-foreground truncate max-w-[300px]">
          {workspace.name}
        </span>
      </div>
    );
  } catch (error) {
    console.error("Error obteniendo nombre del workspace:", error);
    return null;
  }
}

