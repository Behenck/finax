export function getInitials(fullName: string): string {
  if (!fullName) return "";

  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }

  const first: string = parts[0][0];
  const second: string = parts[1][0];

  return (first + second).toUpperCase();
}
