export interface HistoricalMigration {
  file: string;
  sha256: string;
  sql: string;
}
export const baselineVersion: string;
export const baselineName: string;
export const archive: URL;
export const manifest: {
  base: string;
  normalization: string;
  sources: Omit<HistoricalMigration, 'sql'>[];
};
export function hash(text: string | Uint8Array): string;
export function normalize(text: string): string;
export function historicalSources(): HistoricalMigration[];
export function generateBaseline(sources?: HistoricalMigration[]): string;
