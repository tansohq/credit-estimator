import {
  CsvImportError,
  parseForecastInputCsv,
  type CsvBundle,
} from "@tanso-hq/credit-forecast-csv";
import { parseForecastInput } from "@tanso-hq/credit-forecast-json";
import type { ForecastInput } from "@tanso-hq/credit-forecast-schema";

export async function readForecastInputJson(file: File): Promise<ForecastInput> {
  return parseForecastInput(await file.text());
}

export async function readForecastInputCsv(files: readonly File[]): Promise<ForecastInput> {
  const entries = await Promise.all(
    files.map(async (file) => [file.name, await file.text()] as const),
  );
  const names = new Set<string>();
  for (const [name] of entries) {
    if (names.has(name)) {
      throw new CsvImportError("CSV bundle contains duplicate filenames", [
        {
          code: "INVALID_CSV",
          path: name,
          message: `Select only one file named ${name}`,
        },
      ]);
    }
    names.add(name);
  }
  return parseForecastInputCsv(Object.fromEntries(entries));
}

export function downloadTextFile(filename: string, contents: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export interface PreparedCsvFile {
  readonly filename: string;
  readonly contents: string;
}

export function prepareCsvFiles(bundle: CsvBundle): readonly PreparedCsvFile[] {
  return Object.keys(bundle).sort().map((filename) => {
    const contents = bundle[filename];
    if (contents === undefined) {
      throw new Error(`CSV export is missing ${filename}`);
    }
    return { filename, contents };
  });
}
