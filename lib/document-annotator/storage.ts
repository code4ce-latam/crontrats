/**
 * Obtiene una signed URL para descargar un archivo desde Supabase Storage
 * Usa la API route existente para mantener consistencia con el sistema de permisos
 * @param storagePath - Ruta del archivo en storage (ej: "contracts/{workspace_id}/{contract_id}/main/v{n}/{filename}")
 * @returns URL firmada válida por 1 hora
 */
export async function getSignedUrl(storagePath: string): Promise<string> {
  const response = await fetch(`/api/contracts/file/signed-url?storage_path=${encodeURIComponent(storagePath)}`);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Error desconocido" }));
    throw new Error(`Error obteniendo signed URL: ${errorData.error || response.statusText}`);
  }

  const data = await response.json();
  return data.download_url;
}

/**
 * Descarga un archivo desde Supabase Storage como ArrayBuffer
 * @param storagePath - Ruta del archivo en storage
 * @returns ArrayBuffer con el contenido del archivo
 */
export async function downloadFileAsArrayBuffer(storagePath: string): Promise<ArrayBuffer> {
  const signedUrl = await getSignedUrl(storagePath);
  
  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error(`Error descargando archivo: ${response.statusText}`);
  }

  return await response.arrayBuffer();
}

/**
 * Descarga un archivo desde Supabase Storage como Blob
 * @param storagePath - Ruta del archivo en storage
 * @returns Blob con el contenido del archivo
 */
export async function downloadFileAsBlob(storagePath: string): Promise<Blob> {
  const signedUrl = await getSignedUrl(storagePath);
  
  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error(`Error descargando archivo: ${response.statusText}`);
  }

  return await response.blob();
}

