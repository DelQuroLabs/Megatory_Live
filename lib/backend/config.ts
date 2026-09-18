/** Public web configuration. Never put credentials or private tokens here. */
export const BACKEND_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL || 'https://megatory-live.delqurolabs.app/api'
).replace(/\/$/, '');

export function backendUrl(path: string): string {
  return `${BACKEND_BASE_URL}/${path.replace(/^\//, '')}`;
}
