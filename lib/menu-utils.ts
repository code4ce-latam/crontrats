import { mapMenuRoutesRecursive } from "./menu-route-map";
import { type UserRole } from "./supabase/menu";
import menuConfigData from "@/data/menu-config.json";

/**
 * Tipo para un item del menú (sin icono, solo la key)
 * El icono se resuelve en el cliente
 */
export interface MenuItem {
  key: string;
  label: string;
  path: string;
  visibleRoles: UserRole[];
  children?: MenuItem[];
}

/**
 * Tipo para la configuración del menú
 */
export type MenuConfig = MenuItem[];

/**
 * Carga la configuración del menú desde el archivo JSON
 * @returns La configuración del menú
 */
export function loadMenuConfig(): MenuConfig {
  try {
    // El JSON ya está importado, solo necesitamos mapear las rutas y agregar iconos
    const config = menuConfigData as MenuConfig;
    return config.map((item) => mapMenuRoutesRecursive(item));
  } catch (error) {
    console.error("[MenuUtils] Error cargando configuración del menú:", error);
    return [];
  }
}

/**
 * Filtra un item del menú según el rol del usuario
 * @param item - El item del menú a filtrar
 * @param userRole - El rol del usuario
 * @returns true si el item debe ser visible, false en caso contrario
 */
function shouldShowMenuItem(item: MenuItem, userRole: UserRole | null): boolean {
  if (!userRole) {
    return false;
  }
  return item.visibleRoles.includes(userRole);
}

/**
 * Filtra recursivamente el menú según el rol del usuario
 * @param menuConfig - La configuración del menú
 * @param userRole - El rol del usuario
 * @returns La configuración del menú filtrada
 */
export function filterMenuByRole(
  menuConfig: MenuConfig,
  userRole: UserRole | null
): MenuConfig {
  if (!userRole) {
    return [];
  }

  return menuConfig
    .filter((item) => shouldShowMenuItem(item, userRole))
    .map((item) => {
      const filteredItem: MenuItem = {
        ...item,
      };

      // Si tiene hijos, filtrarlos también
      if (item.children && item.children.length > 0) {
        const filteredChildren = item.children.filter((child) =>
          shouldShowMenuItem(child, userRole)
        );

        // Solo incluir el item padre si tiene al menos un hijo visible
        if (filteredChildren.length > 0) {
          filteredItem.children = filteredChildren;
        } else {
          // Si no tiene hijos visibles, no incluir el item padre
          return null;
        }
      }

      return filteredItem;
    })
    .filter((item): item is MenuItem => item !== null);
}

/**
 * Los iconos se resuelven en el cliente, no en el servidor
 * Esta función ya no es necesaria pero se mantiene por compatibilidad
 */
export function mapMenuIcons(menuConfig: MenuConfig): MenuConfig {
  // Los iconos se resuelven en el cliente usando la key
  return menuConfig;
}

/**
 * Obtiene el menú completo procesado (cargado, filtrado por rol, con iconos y rutas mapeadas)
 * @param userRole - El rol del usuario
 * @returns El menú procesado y listo para renderizar
 */
export function getProcessedMenu(userRole: UserRole | null): MenuConfig {
  const config = loadMenuConfig();
  const filtered = filterMenuByRole(config, userRole);
  return mapMenuIcons(filtered);
}

