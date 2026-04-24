import { randomUUID } from 'node:crypto';

export function createTransactionRef(): string {
  const year = new Date().getFullYear();
  const suffix = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
  return `TXN${year}${suffix}`;
}