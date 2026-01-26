/**
 * Configuración de breadcrumbs para rutas protegidas
 */

export interface BreadcrumbItem {
  label: string;
  href: string;
}

/**
 * Mapeo de rutas a labels legibles
 */
const routeLabels: Record<string, string> = {
  '/protected': 'Inicio',
  '/protected/contratos': 'Contratos',
  '/protected/contratos/nuevo': 'Nuevo contrato',
  '/protected/carpetas': 'Carpetas',
  '/protected/configuracion': 'Configuración',
  '/protected/configuracion/usuarios': 'Usuarios',
  '/protected/configuracion/perfiles': 'Perfiles',
  '/protected/configuracion/recordatorios': 'Recordatorios',
  '/protected/configuracion/facturacion': 'Facturación',
  '/protected/configuracion/auditoria': 'Auditoría',
  '/protected/configuracion/invitaciones': 'Invitaciones',
  '/protected/configuracion/flujos': 'Flujos',
  '/protected/configuracion/estado': 'Estado',
  '/protected/configuracion-cuenta': 'Cuenta',
  '/protected/perfil': 'Perfil',
};

/**
 * Rutas que requieren breadcrumbs (excluyendo rutas de nivel raíz)
 */
const routesRequiringBreadcrumbs = new Set([
  '/protected/contratos',
  '/protected/contratos/nuevo',
  '/protected/carpetas',
  '/protected/configuracion',
  '/protected/configuracion/usuarios',
  '/protected/configuracion/perfiles',
  '/protected/configuracion/recordatorios',
  '/protected/configuracion/facturacion',
  '/protected/configuracion/auditoria',
  '/protected/configuracion/invitaciones',
  '/protected/configuracion/flujos',
  '/protected/configuracion/estado',
  '/protected/configuracion-cuenta',
  '/protected/perfil',
]);

/**
 * Determina si se debe mostrar breadcrumbs para una ruta
 */
export function shouldShowBreadcrumb(pathname: string): boolean {
  // No mostrar en la ruta raíz
  if (pathname === '/protected') {
    return false;
  }

  // Mostrar si está en la lista de rutas que requieren breadcrumbs
  if (routesRequiringBreadcrumbs.has(pathname)) {
    return true;
  }

  // Mostrar si la ruta tiene más de 2 segmentos (ej: /protected/contratos/nuevo)
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 2) {
    return true;
  }

  // Mostrar si es una ruta dinámica (contiene IDs)
  if (pathname.match(/\/protected\/contratos\/[^\/]+/)) {
    return true;
  }

  return false;
}

/**
 * Obtiene el label para una ruta
 */
export function getRouteLabel(pathname: string, dynamicData?: Record<string, string>): string {
  // Si hay datos dinámicos para esta ruta, usarlos
  if (dynamicData?.title) {
    return dynamicData.title;
  }

  // Buscar en el mapeo estático
  if (routeLabels[pathname]) {
    return routeLabels[pathname];
  }

  // Para rutas dinámicas, extraer el último segmento
  const segments = pathname.split('/').filter(Boolean);
  const lastSegment = segments[segments.length - 1];

  // Mapear segmentos comunes
  const segmentLabels: Record<string, string> = {
    'editar': 'Editar',
    'nuevo': 'Nuevo',
    'usuarios': 'Usuarios',
    'perfiles': 'Perfiles',
    'recordatorios': 'Recordatorios',
    'facturacion': 'Facturación',
    'auditoria': 'Auditoría',
    'invitaciones': 'Invitaciones',
    'flujos': 'Flujos',
    'estado': 'Estado',
    'cuenta': 'Cuenta',
    'perfil': 'Perfil',
  };

  return segmentLabels[lastSegment] || lastSegment;
}

/**
 * Genera breadcrumbs para una ruta
 */
export function generateBreadcrumbs(
  pathname: string,
  dynamicData?: Record<string, string>
): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = [];

  // Siempre agregar "Inicio" como primer elemento
  breadcrumbs.push({
    label: 'Inicio',
    href: '/protected',
  });

  // Si es la ruta raíz, retornar solo "Inicio"
  if (pathname === '/protected') {
    return breadcrumbs;
  }

  const segments = pathname.split('/').filter(Boolean);
  let currentPath = '/protected';

  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];
    const prevSegment = segments[i - 1];

    // Para rutas dinámicas de contratos (ej: /protected/contratos/[id])
    if (prevSegment === 'contratos' && segment !== 'nuevo' && segment !== 'editar') {
      // Agregar "Contratos" si no está ya agregado
      if (!breadcrumbs.some(b => b.href === '/protected/contratos')) {
        breadcrumbs.push({
          label: 'Contratos',
          href: '/protected/contratos',
        });
      }

      // Agregar el contrato (con datos dinámicos si están disponibles)
      const contractPath = `/protected/contratos/${segment}`;
      breadcrumbs.push({
        label: dynamicData?.title || 'Contrato',
        href: contractPath,
      });

      // Si hay un segmento "editar" después, agregarlo
      if (i + 1 < segments.length && segments[i + 1] === 'editar') {
        breadcrumbs.push({
          label: 'Editar',
          href: `${contractPath}/editar`,
        });
        i++; // Saltar el segmento "editar"
      }
      continue;
    }

    // Para "nuevo" después de contratos
    if (prevSegment === 'contratos' && segment === 'nuevo') {
      if (!breadcrumbs.some(b => b.href === '/protected/contratos')) {
        breadcrumbs.push({
          label: 'Contratos',
          href: '/protected/contratos',
        });
      }
      breadcrumbs.push({
        label: 'Nuevo contrato',
        href: '/protected/contratos/nuevo',
      });
      continue;
    }

    // Para otras rutas, construir el path y usar el mapeo estático
    currentPath += `/${segment}`;
    const label = getRouteLabel(currentPath, i === segments.length - 1 ? dynamicData : undefined);
    breadcrumbs.push({
      label,
      href: currentPath,
    });
  }

  return breadcrumbs;
}

