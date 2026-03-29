export type ParsedCsv<Row extends Record<string, unknown> = Record<string, unknown>> = {
  rows: Row[];
  columns: string[];
};

export const parseCsv = async (): Promise<ParsedCsv> => {
  throw new Error("parseCsv is not wired in this codebase yet");
};
