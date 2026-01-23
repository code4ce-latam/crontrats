import {
  LayoutDashboard,
  FileText,
  Folder,
  Settings,
  Users,
  FileCheck,
  Clock,
  CreditCard,
  FileSearch,
  UserPlus,
  Workflow,
  CircleDot,
  UserCog,
  Archive,
  type LucideIcon,
} from "lucide-react";

/**
 * Mapeo de keys del menú a componentes de iconos de lucide-react
 */
export const menuIconMap: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  contracts: FileText,
  folders: Folder,
  settings: Settings,
  users: Users,
  "contract-profiles": FileCheck,
  reminders: Clock,
  billing: CreditCard,
  "audit-logs": FileSearch,
  invitations: UserPlus,
  workflows: Workflow,
  "contract-status": CircleDot,
  "account-settings": UserCog,
  archive: Archive, // Por si acaso se necesita en el futuro
};

/**
 * Obtiene el icono para una key del menú
 * @param key - La key del item del menú
 * @returns El componente de icono o Settings por defecto
 */
export function getMenuIcon(key: string): LucideIcon {
  return menuIconMap[key] || Settings;
}

