const STORAGE_KEY = 'tt-admin-password';
const ADMIN_HEADER = 'x-admin-password';

export function setAdminPassword(password: string): void {
  sessionStorage.setItem(STORAGE_KEY, password);
}

export function getAdminPassword(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem(STORAGE_KEY) ?? '';
}

/** Headers to attach to mutating API calls so the server-side guard passes. */
export function adminHeaders(): Record<string, string> {
  return { [ADMIN_HEADER]: getAdminPassword() };
}

/** Verifies a candidate password against the server before storing it. */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  try {
    const res = await fetch('/investment-tech-tree/api/admin/check', {
      headers: { [ADMIN_HEADER]: password },
    });
    return res.ok;
  } catch {
    return false;
  }
}
