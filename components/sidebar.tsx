import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/supabase/menu";
import { getProcessedMenu } from "@/lib/menu-utils";
import { SidebarContent } from "./sidebar-content";

export async function Sidebar() {
  const supabase = await createClient();
  const userRole = await getUserRole(supabase);
  const menuItems = getProcessedMenu(userRole);

  // Separar la sección de configuración del resto
  const settingsItem = menuItems.find((item) => item.key === "settings") || null;
  const mainItems = menuItems.filter((item) => item.key !== "settings");

  return <SidebarContent menuItems={mainItems} settingsItem={settingsItem} />;
}

