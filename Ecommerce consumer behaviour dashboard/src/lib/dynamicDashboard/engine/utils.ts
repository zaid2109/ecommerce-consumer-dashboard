export const nowIso = () => new Date().toISOString();

export const randomId = (prefix: string) => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}_${random}`;
};

export const toIdentifier = (value: string) => `"${value.replace(/"/g, '""')}"`;

export const toSqlString = (value: string) => `'${value.replace(/'/g, "''")}'`;

export const ratio = (num: number, den: number) => (den === 0 ? 0 : num / den);

export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
