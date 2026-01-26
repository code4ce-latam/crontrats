/**
 * Lista de zonas horarias comunes con formato IANA
 * Incluye las principales zonas horarias de América, Europa y Asia
 */

export interface TimezoneOption {
  value: string; // IANA timezone identifier
  label: string; // Nombre legible con offset
  offset: number; // Offset en horas desde UTC (puede variar por DST)
  region: string; // Región geográfica
}

/**
 * Obtiene el offset UTC actual de una zona horaria
 * Nota: El offset puede variar según DST (Daylight Saving Time)
 */
export function getTimezoneOffset(timezone: string): number {
  try {
    const now = new Date();
    // Usar Intl.DateTimeFormat para obtener el offset de manera más precisa
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset',
    });
    
    // Obtener el offset en minutos
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find(part => part.type === 'timeZoneName');
    
    if (offsetPart) {
      // Formato: "GMT-5" o "GMT+3" -> extraer el número
      const match = offsetPart.value.match(/GMT([+-])(\d+)(?::(\d+))?/);
      if (match) {
        const sign = match[1] === '+' ? 1 : -1;
        const hours = parseInt(match[2], 10);
        const minutes = match[3] ? parseInt(match[3], 10) : 0;
        return sign * (hours + minutes / 60);
      }
    }
    
    // Fallback: calcular manualmente
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const offsetMs = tzDate.getTime() - utcDate.getTime();
    return Math.round(offsetMs / (1000 * 60 * 60)); // Convertir a horas
  } catch (error) {
    console.error(`[Timezones] Error obteniendo offset para ${timezone}:`, error);
    return 0; // Default a UTC
  }
}

/**
 * Formatea el offset como string (GMT+X o GMT-X)
 * Soporta offsets con minutos (ej: GMT+5:30)
 */
export function formatOffset(offset: number): string {
  if (offset === 0) {
    return 'GMT+0';
  }
  
  const sign = offset >= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const hours = Math.floor(absOffset);
  const minutes = Math.round((absOffset - hours) * 60);
  
  if (minutes === 0) {
    return `GMT${sign}${hours}`;
  } else {
    return `GMT${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
  }
}

/**
 * Mapeo de zonas horarias IANA a nombres de ciudades más comunes y reconocibles
 * Esto ayuda a que los usuarios encuentren fácilmente ciudades como Quito, Lima, etc.
 */
const TIMEZONE_CITY_MAP: Record<string, string> = {
  // América
  'America/Guayaquil': 'Quito', // Ecuador usa Guayaquil pero Quito es más conocido
  'America/Lima': 'Lima',
  'America/Bogota': 'Bogotá',
  'America/Santiago': 'Santiago',
  'America/Buenos_Aires': 'Buenos Aires',
  'America/Sao_Paulo': 'São Paulo',
  'America/Mexico_City': 'Ciudad de México',
  'America/New_York': 'Nueva York',
  'America/Chicago': 'Chicago',
  'America/Denver': 'Denver',
  'America/Los_Angeles': 'Los Ángeles',
  'America/Toronto': 'Toronto',
  'America/Vancouver': 'Vancouver',
  'America/Caracas': 'Caracas',
  'America/La_Paz': 'La Paz',
  'America/Montevideo': 'Montevideo',
  'America/Asuncion': 'Asunción',
  'America/Havana': 'La Habana',
  'America/Santo_Domingo': 'Santo Domingo',
  'America/Guatemala': 'Guatemala',
  'America/Managua': 'Managua',
  'America/San_Jose': 'San José',
  'America/Panama': 'Panamá',
  'America/Tegucigalpa': 'Tegucigalpa',
  'America/El_Salvador': 'San Salvador',
  
  // Europa
  'Europe/London': 'Londres',
  'Europe/Paris': 'París',
  'Europe/Madrid': 'Madrid',
  'Europe/Rome': 'Roma',
  'Europe/Berlin': 'Berlín',
  'Europe/Amsterdam': 'Ámsterdam',
  'Europe/Brussels': 'Bruselas',
  'Europe/Vienna': 'Viena',
  'Europe/Zurich': 'Zúrich',
  'Europe/Stockholm': 'Estocolmo',
  'Europe/Oslo': 'Oslo',
  'Europe/Copenhagen': 'Copenhague',
  'Europe/Helsinki': 'Helsinki',
  'Europe/Warsaw': 'Varsovia',
  'Europe/Prague': 'Praga',
  'Europe/Budapest': 'Budapest',
  'Europe/Athens': 'Atenas',
  'Europe/Lisbon': 'Lisboa',
  'Europe/Dublin': 'Dublín',
  'Europe/Moscow': 'Moscú',
  
  // Asia
  'Asia/Tokyo': 'Tokio',
  'Asia/Shanghai': 'Shanghái',
  'Asia/Hong_Kong': 'Hong Kong',
  'Asia/Singapore': 'Singapur',
  'Asia/Seoul': 'Seúl',
  'Asia/Bangkok': 'Bangkok',
  'Asia/Jakarta': 'Yakarta',
  'Asia/Manila': 'Manila',
  'Asia/Kolkata': 'Kolkata',
  'Asia/Dubai': 'Dubái',
  'Asia/Riyadh': 'Riad',
  'Asia/Tel_Aviv': 'Tel Aviv',
  'Asia/Beirut': 'Beirut',
  
  // Oceanía
  'Australia/Sydney': 'Sídney',
  'Australia/Melbourne': 'Melbourne',
  'Pacific/Auckland': 'Auckland',
  
  // África
  'Africa/Cairo': 'El Cairo',
  'Africa/Johannesburg': 'Johannesburgo',
  'Africa/Lagos': 'Lagos',
  'Africa/Nairobi': 'Nairobi',
};

/**
 * Obtiene un nombre legible para una zona horaria IANA
 * Usa el mapeo de ciudades comunes si está disponible, sino genera el nombre desde el IANA
 */
function getTimezoneDisplayName(timezone: string): string {
  // Si hay un mapeo directo, usarlo
  if (TIMEZONE_CITY_MAP[timezone]) {
    return TIMEZONE_CITY_MAP[timezone];
  }
  
  try {
    // Extraer el nombre de la ciudad/región de la zona horaria
    const parts = timezone.split('/');
    if (parts.length > 1) {
      // Reemplazar guiones bajos con espacios y capitalizar
      const city = parts[parts.length - 1]
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      return city;
    }
    return timezone;
  } catch (error) {
    return timezone;
  }
}

/**
 * Genera todas las zonas horarias IANA disponibles con sus offsets actuales
 * Nota: Esta función debe ejecutarse en el cliente (navegador) ya que usa APIs del navegador
 */
function generateAllTimezones(): TimezoneOption[] {
  // Verificar si estamos en el cliente y si Intl.supportedValuesOf está disponible
  if (typeof window === 'undefined' || typeof Intl === 'undefined' || !Intl.supportedValuesOf) {
    // En el servidor o navegadores antiguos, retornar lista estándar
    return getStandardTimezones();
  }

  try {
    // Obtener todas las zonas horarias IANA soportadas
    const supportedTimezones = Intl.supportedValuesOf('timeZone');
    
    // Obtener lista estándar de zonas horarias comunes
    const standardTimezones = getStandardTimezones();
    const standardValues = new Set(standardTimezones.map(tz => tz.value));
    
    // Combinar: primero las estándar (prioritarias), luego las demás disponibles
    const allTimezones = [
      ...standardTimezones.map(tz => tz.value), // Estándar primero
      ...supportedTimezones.filter(tz => !standardValues.has(tz)) // Resto después
    ];
    
    // Crear mapa de zonas estándar para obtener región y datos rápidamente
    const standardMap = new Map(standardTimezones.map(tz => [tz.value, tz]));
    
    // Generar opciones con offset calculado
    const timezoneOptions: TimezoneOption[] = allTimezones
      .map(tz => {
        try {
          // Si es estándar, usar datos de la lista estándar (pero recalcular offset por DST)
          const standardTz = standardMap.get(tz);
          const offset = getTimezoneOffset(tz);
          const displayName = getTimezoneDisplayName(tz);
          const offsetStr = formatOffset(offset);
          
          // Determinar región: usar la de estándar si está disponible, sino calcular
          let region = standardTz?.region || 'Otros';
          
          // Si no es estándar, calcular región basada en el prefijo
          if (!standardTz) {
            // Casos especiales: zonas Pacific/ que son parte de América
            const pacificAmericaZones = ['Pacific/Galapagos', 'Pacific/Easter'];
            if (pacificAmericaZones.includes(tz)) {
              region = 'América';
            } else if (tz.startsWith('America/')) {
              region = 'América';
            } else if (tz.startsWith('Europe/')) {
              region = 'Europa';
            } else if (tz.startsWith('Asia/')) {
              region = 'Asia';
            } else if (tz.startsWith('Africa/')) {
              region = 'África';
            } else if (tz.startsWith('Australia/') || tz.startsWith('Pacific/')) {
              region = 'Oceanía';
            } else if (tz.startsWith('Atlantic/')) {
              region = 'Atlántico';
            } else if (tz.startsWith('Indian/')) {
              region = 'Océano Índico';
            } else if (tz === 'UTC' || tz.startsWith('Etc/')) {
              region = 'Universal';
            }
          }
          
          return {
            value: tz,
            label: `${displayName} (${offsetStr})`,
            offset,
            region,
          };
        } catch (error) {
          // Si hay error procesando una zona horaria, incluirla de todas formas con valores por defecto
          console.warn(`[Timezones] Error procesando zona horaria ${tz}:`, error);
          return {
            value: tz,
            label: `${tz} (GMT+0)`,
            offset: 0,
            region: 'Otros',
          };
        }
      })
      .filter(Boolean); // Filtrar cualquier valor null/undefined
    
    // Ordenar: primero UTC, luego estándar, luego resto por región y offset
    timezoneOptions.sort((a, b) => {
      // UTC siempre primero
      if (a.value === 'UTC') return -1;
      if (b.value === 'UTC') return 1;
      
      // Luego priorizar estándar sobre no estándar
      const aIsStandard = standardValues.has(a.value);
      const bIsStandard = standardValues.has(b.value);
      if (aIsStandard && !bIsStandard) return -1;
      if (!aIsStandard && bIsStandard) return 1;
      
      // Si ambas son estándar o ambas no, mantener orden original (estándar primero)
      if (aIsStandard && bIsStandard) {
        // Dentro de estándar, mantener el orden de la lista estándar
        const aIndex = standardTimezones.findIndex(tz => tz.value === a.value);
        const bIndex = standardTimezones.findIndex(tz => tz.value === b.value);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      }
      
      // Luego por región
      if (a.region !== b.region) {
        return a.region.localeCompare(b.region);
      }
      
      // Dentro de la misma región, por offset (de negativo a positivo)
      if (a.offset !== b.offset) {
        return a.offset - b.offset;
      }
      
      // Finalmente por nombre
      return a.label.localeCompare(b.label);
    });
    
    return timezoneOptions;
  } catch (error) {
    console.error('[Timezones] Error generando zonas horarias:', error);
    // Fallback a lista básica si hay error
    return getBasicTimezones();
  }
}

/**
 * Lista estándar de zonas horarias más comunes y usadas
 * Prioriza ciudades importantes y zonas horarias estándar
 */
function getStandardTimezones(): TimezoneOption[] {
  const standardList: Array<{ value: string; region: string }> = [
    // Universal
    { value: 'UTC', region: 'Universal' },
    
    // América del Norte
    { value: 'America/New_York', region: 'América' },
    { value: 'America/Chicago', region: 'América' },
    { value: 'America/Denver', region: 'América' },
    { value: 'America/Los_Angeles', region: 'América' },
    { value: 'America/Toronto', region: 'América' },
    { value: 'America/Vancouver', region: 'América' },
    
    // América Central y México
    { value: 'America/Mexico_City', region: 'América' },
    { value: 'America/Guatemala', region: 'América' },
    { value: 'America/Costa_Rica', region: 'América' },
    { value: 'America/Panama', region: 'América' },
    { value: 'America/Havana', region: 'América' },
    { value: 'America/Santo_Domingo', region: 'América' },
    
    // América del Sur - Ciudades principales
    { value: 'America/Guayaquil', region: 'América' }, // Quito
    { value: 'America/Lima', region: 'América' },
    { value: 'America/Bogota', region: 'América' },
    { value: 'America/Santiago', region: 'América' },
    { value: 'America/Buenos_Aires', region: 'América' },
    { value: 'America/Sao_Paulo', region: 'América' },
    { value: 'America/Caracas', region: 'América' },
    { value: 'America/La_Paz', region: 'América' },
    { value: 'America/Montevideo', region: 'América' },
    { value: 'America/Asuncion', region: 'América' },
    { value: 'America/Manaus', region: 'América' },
    { value: 'America/Belem', region: 'América' },
    { value: 'America/Fortaleza', region: 'América' },
    { value: 'America/Recife', region: 'América' },
    { value: 'America/Cayenne', region: 'América' },
    
    // Islas del Pacífico (América)
    { value: 'Pacific/Galapagos', region: 'América' },
    { value: 'Pacific/Easter', region: 'América' },
    
    // Europa - Principales ciudades
    { value: 'Europe/London', region: 'Europa' },
    { value: 'Europe/Paris', region: 'Europa' },
    { value: 'Europe/Madrid', region: 'Europa' },
    { value: 'Europe/Rome', region: 'Europa' },
    { value: 'Europe/Berlin', region: 'Europa' },
    { value: 'Europe/Amsterdam', region: 'Europa' },
    { value: 'Europe/Brussels', region: 'Europa' },
    { value: 'Europe/Vienna', region: 'Europa' },
    { value: 'Europe/Zurich', region: 'Europa' },
    { value: 'Europe/Stockholm', region: 'Europa' },
    { value: 'Europe/Oslo', region: 'Europa' },
    { value: 'Europe/Copenhagen', region: 'Europa' },
    { value: 'Europe/Helsinki', region: 'Europa' },
    { value: 'Europe/Warsaw', region: 'Europa' },
    { value: 'Europe/Prague', region: 'Europa' },
    { value: 'Europe/Budapest', region: 'Europa' },
    { value: 'Europe/Athens', region: 'Europa' },
    { value: 'Europe/Lisbon', region: 'Europa' },
    { value: 'Europe/Dublin', region: 'Europa' },
    { value: 'Europe/Moscow', region: 'Europa' },
    
    // Asia - Principales ciudades
    { value: 'Asia/Tokyo', region: 'Asia' },
    { value: 'Asia/Shanghai', region: 'Asia' },
    { value: 'Asia/Hong_Kong', region: 'Asia' },
    { value: 'Asia/Singapore', region: 'Asia' },
    { value: 'Asia/Seoul', region: 'Asia' },
    { value: 'Asia/Bangkok', region: 'Asia' },
    { value: 'Asia/Jakarta', region: 'Asia' },
    { value: 'Asia/Manila', region: 'Asia' },
    { value: 'Asia/Kolkata', region: 'Asia' },
    { value: 'Asia/Dubai', region: 'Asia' },
    { value: 'Asia/Riyadh', region: 'Asia' },
    { value: 'Asia/Tel_Aviv', region: 'Asia' },
    { value: 'Asia/Beirut', region: 'Asia' },
    
    // Oceanía
    { value: 'Australia/Sydney', region: 'Oceanía' },
    { value: 'Australia/Melbourne', region: 'Oceanía' },
    { value: 'Pacific/Auckland', region: 'Oceanía' },
    
    // África - Principales ciudades
    { value: 'Africa/Cairo', region: 'África' },
    { value: 'Africa/Johannesburg', region: 'África' },
    { value: 'Africa/Lagos', region: 'África' },
    { value: 'Africa/Nairobi', region: 'África' },
    { value: 'Africa/Casablanca', region: 'África' },
  ];
  
  // Generar opciones con offset calculado
  return standardList.map(({ value, region }) => {
    const offset = getTimezoneOffset(value);
    const displayName = getTimezoneDisplayName(value);
    const offsetStr = formatOffset(offset);
    
    return {
      value,
      label: `${displayName} (${offsetStr})`,
      offset,
      region,
    };
  });
}

/**
 * Lista básica de zonas horarias como fallback (versión mínima)
 */
function getBasicTimezones(): TimezoneOption[] {
  return getStandardTimezones();
}

/**
 * Lista de todas las zonas horarias IANA disponibles
 * Se genera dinámicamente usando Intl.supportedValuesOf
 * Se genera de forma lazy para asegurar que funcione en el cliente
 */
let _timezonesCache: TimezoneOption[] | null = null;

export function getTimezones(): TimezoneOption[] {
  if (_timezonesCache === null) {
    _timezonesCache = generateAllTimezones();
  }
  return _timezonesCache;
}

/**
 * Exportar como constante para compatibilidad, pero usar función internamente
 * Esto asegura que se genere solo cuando se use (en el cliente)
 */
export const TIMEZONES: TimezoneOption[] = getTimezones();

/**
 * Obtiene una zona horaria por su valor IANA
 */
export function getTimezoneByValue(value: string): TimezoneOption | undefined {
  return TIMEZONES.find(tz => tz.value === value);
}

/**
 * Obtiene todas las zonas horarias agrupadas por región
 */
export function getTimezonesByRegion(): Record<string, TimezoneOption[]> {
  const grouped: Record<string, TimezoneOption[]> = {};
  
  TIMEZONES.forEach(tz => {
    if (!grouped[tz.region]) {
      grouped[tz.region] = [];
    }
    grouped[tz.region].push(tz);
  });
  
  return grouped;
}

/**
 * Valida si una zona horaria IANA es válida
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    // Intentar crear una fecha con la zona horaria
    const date = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });
    formatter.format(date);
    return true;
  } catch (error) {
    return false;
  }
}

