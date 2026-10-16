const configuredBase = import.meta.env.BASE_URL || '/';

export const appBasePath = configuredBase === '/'
  ? ''
  : `/${configuredBase.replace(/^\/+|\/+$/g, '')}`;

export function appRelativePath(pathname = window.location.pathname) {
  if (!appBasePath) return pathname || '/';
  if (pathname === appBasePath || pathname === `${appBasePath}/`) return '/';
  if (pathname.startsWith(`${appBasePath}/`)) return pathname.slice(appBasePath.length) || '/';
  return pathname || '/';
}

export function appPath(path = '/') {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${appBasePath}${suffix}` || '/';
}

export function appAbsoluteUrl(path = '/') {
  return new URL(appPath(path), window.location.origin).toString();
}
