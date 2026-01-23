/**
 * Mapeo de rutas del JSON del menú a las rutas actuales del sistema
 */
const routeMap: Record<string, string> = {
  // Items principales
  "/dashboard": "/protected",
  "/contracts": "/protected/contratos",
  "/folders": "/protected/folders",
  "/settings": "/protected/configuracion",
  
  // Items de configuración
  "/settings/users": "/protected/configuracion/usuarios",
  "/settings/contract-profiles": "/protected/configuracion/perfiles",
  "/settings/reminders": "/protected/configuracion/recordatorios",
  "/settings/billing": "/protected/configuracion/facturacion",
  "/settings/audit-logs": "/protected/configuracion/auditoria",
  "/settings/invitations": "/protected/configuracion/invitaciones",
  "/settings/workflows": "/protected/configuracion/flujos",
  "/settings/contract-status": "/protected/configuracion/estado",
  "/settings/account": "/protected/configuracion/cuenta",
};

/**
 * Mapea una ruta del JSON a la ruta actual del sistema
 * @param path - La ruta del JSON
 * @returns La ruta mapeada o la ruta original si no hay mapeo
 */
export function mapMenuRoute(path: string): string {
  return routeMap[path] || path;
}

/**
 * Mapea recursivamente todas las rutas de un item del menú y sus hijos
 */
export function mapMenuRoutesRecursive<T extends { path: string; children?: T[] }>(item: T): T {
  const mappedItem = {
    ...item,
    path: mapMenuRoute(item.path),
  } as T;

  if (item.children && Array.isArray(item.children)) {
    (mappedItem as any).children = item.children.map((child) =>
      mapMenuRoutesRecursive(child)
    );
  }

  return mappedItem;
}

