import {
  ForecastInputSchema,
  ForecastResultSchema,
  type ForecastInput,
  type ForecastResult,
  type ForecastWarning,
  type ScenarioForecast,
  type TraceValue,
} from "@tanso-hq/credit-forecast-schema";

export type CsvBundle = Readonly<Record<string, string>>;

export interface CsvImportIssue {
  readonly code: "INVALID_CSV" | "MISSING_FILE" | "MISSING_VALUE" | "INVALID_FORECAST";
  readonly path: string;
  readonly message: string;
}

export class CsvImportError extends Error {
  readonly issues: readonly CsvImportIssue[];

  constructor(message: string, issues: readonly CsvImportIssue[]) {
    super(message);
    this.name = "CsvImportError";
    this.issues = issues;
  }
}

function encodeCell(value: string): string {
  return /[",\r\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function encodeTable(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  return `${[headers, ...rows].map((row) => row.map(encodeCell).join(",")).join("\r\n")}\r\n`;
}

function parseTable(source: string, file: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell.endsWith("\r") ? cell.slice(0, -1) : cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (quoted) {
    throw new CsvImportError(`CSV file ${file} has an unterminated quoted field`, [
      { code: "INVALID_CSV", path: file, message: "Unterminated quoted field" },
    ]);
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.endsWith("\r") ? cell.slice(0, -1) : cell);
    rows.push(row);
  }
  return rows.filter((entry) => !(entry.length === 1 && entry[0] === ""));
}

function requireFile(bundle: CsvBundle, name: string): string {
  const source = bundle[name];
  if (source === undefined) {
    throw new CsvImportError(`CSV bundle is missing ${name}`, [
      { code: "MISSING_FILE", path: name, message: `Required file ${name} is missing` },
    ]);
  }
  return source;
}

function records(bundle: CsvBundle, file: string, headers: readonly string[]): Record<string, string>[] {
  const rows = parseTable(requireFile(bundle, file), file);
  const actualHeaders = rows.shift();
  if (actualHeaders === undefined || actualHeaders.join("\u0000") !== headers.join("\u0000")) {
    throw new CsvImportError(`CSV file ${file} has invalid headers`, [
      { code: "INVALID_CSV", path: file, message: `Expected headers: ${headers.join(",")}` },
    ]);
  }
  return rows.map((row, rowIndex) => {
    if (row.length !== headers.length) {
      throw new CsvImportError(`CSV file ${file} has an invalid row`, [
        { code: "INVALID_CSV", path: `${file}:${rowIndex + 2}`, message: "Column count does not match header" },
      ]);
    }
    return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
  });
}

function keyValues(bundle: CsvBundle, file: string): Map<string, string> {
  return new Map(records(bundle, file, ["key", "value"]).map((row) => [row.key ?? "", row.value ?? ""]));
}

function requiredValue(values: ReadonlyMap<string, string>, file: string, key: string): string {
  const value = values.get(key);
  if (value === undefined || value === "") {
    throw new CsvImportError(`CSV file ${file} is missing ${key}`, [
      { code: "MISSING_VALUE", path: `${file}:${key}`, message: `Required value ${key} is missing` },
    ]);
  }
  return value;
}

function parseJsonCell(value: string, path: string): TraceValue {
  try {
    return JSON.parse(value) as TraceValue;
  } catch {
    throw new CsvImportError(`CSV value ${path} contains invalid JSON`, [
      { code: "INVALID_CSV", path, message: "Invalid JSON cell" },
    ]);
  }
}

function stableJson(value: TraceValue): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function parseExtensions(value: string): ForecastInput["extensions"] {
  if (value === "") {
    return undefined;
  }
  return parseJsonCell(value, "manifest.csv:extensions") as ForecastInput["extensions"];
}

function validateInput(value: unknown): ForecastInput {
  const parsed = ForecastInputSchema.safeParse(value);
  if (!parsed.success) {
    throw new CsvImportError("CSV bundle does not contain a valid ForecastInput", parsed.error.issues.map((issue) => ({
      code: "INVALID_FORECAST",
      path: issue.path.join("."),
      message: issue.message,
    })));
  }
  return parsed.data;
}

function validateResult(value: unknown): ForecastResult {
  const parsed = ForecastResultSchema.safeParse(value);
  if (!parsed.success) {
    throw new CsvImportError("CSV bundle does not contain a valid ForecastResult", parsed.error.issues.map((issue) => ({
      code: "INVALID_FORECAST",
      path: issue.path.join("."),
      message: issue.message,
    })));
  }
  return parsed.data;
}

export function exportForecastInputCsv(input: ForecastInput): CsvBundle {
  const value = ForecastInputSchema.parse(input);
  const manifestRows = [
    ["schemaVersion", value.schemaVersion],
    ["methodologyVersion", value.methodologyVersion],
    ["asOf", value.asOf],
    ["period.startDate", value.period.startDate],
    ["period.endDate", value.period.endDate],
    ["period.allocation", value.period.allocation],
    ["period.lowBalanceThreshold", value.period.lowBalanceThreshold],
    ["lookbackDays", String(value.lookbackDays)],
    ["balance.current", value.balance.current],
    ["extensions", value.extensions === undefined ? "" : stableJson(value.extensions)],
  ];

  return {
    "manifest.csv": encodeTable(["key", "value"], manifestRows),
    "daily-usage.csv": encodeTable(
      ["date", "creditsUsed"],
      value.dailyUsage.map((row) => [row.date, row.creditsUsed]),
    ),
    "balance-schedule.csv": encodeTable(
      ["date", "creditDelta", "reason"],
      value.balance.schedule.map((row) => [row.date, row.creditDelta, row.reason ?? ""]),
    ),
    "scenarios.csv": encodeTable(
      ["key", "burnMultiplier"],
      value.scenarios.map((row) => [row.key, row.burnMultiplier]),
    ),
  };
}

export function parseForecastInputCsv(bundle: CsvBundle): ForecastInput {
  const manifest = keyValues(bundle, "manifest.csv");
  const extensions = parseExtensions(manifest.get("extensions") ?? "");
  const schedule = records(bundle, "balance-schedule.csv", ["date", "creditDelta", "reason"])
    .map((row) => row.reason === ""
      ? { date: row.date ?? "", creditDelta: row.creditDelta ?? "" }
      : { date: row.date ?? "", creditDelta: row.creditDelta ?? "", reason: row.reason ?? "" });
  const value = {
    schemaVersion: requiredValue(manifest, "manifest.csv", "schemaVersion"),
    methodologyVersion: requiredValue(manifest, "manifest.csv", "methodologyVersion"),
    asOf: requiredValue(manifest, "manifest.csv", "asOf"),
    period: {
      startDate: requiredValue(manifest, "manifest.csv", "period.startDate"),
      endDate: requiredValue(manifest, "manifest.csv", "period.endDate"),
      allocation: requiredValue(manifest, "manifest.csv", "period.allocation"),
      lowBalanceThreshold: requiredValue(manifest, "manifest.csv", "period.lowBalanceThreshold"),
    },
    lookbackDays: Number(requiredValue(manifest, "manifest.csv", "lookbackDays")),
    dailyUsage: records(bundle, "daily-usage.csv", ["date", "creditsUsed"])
      .map((row) => ({ date: row.date ?? "", creditsUsed: row.creditsUsed ?? "" })),
    balance: {
      current: requiredValue(manifest, "manifest.csv", "balance.current"),
      schedule,
    },
    scenarios: records(bundle, "scenarios.csv", ["key", "burnMultiplier"])
      .map((row) => ({ key: row.key ?? "", burnMultiplier: row.burnMultiplier ?? "" })),
    ...(extensions === undefined ? {} : { extensions }),
  };
  return validateInput(value);
}

function warningRow(warning: ForecastWarning): string[] {
  return warning.code === "LOW_BALANCE_PROJECTED"
    ? [warning.code, warning.scenarioKey, warning.endingBalance, warning.threshold, "", ""]
    : [warning.code, warning.scenarioKey, "", "", warning.depletionDate, warning.shortfall];
}

export function exportForecastResultCsv(result: ForecastResult): CsvBundle {
  const value = ForecastResultSchema.parse(result);
  return {
    "result.csv": encodeTable(["key", "value"], [
      ["schemaVersion", value.schemaVersion],
      ["methodologyVersion", value.methodologyVersion],
      ["asOf", value.asOf],
      ["daysRemaining", String(value.daysRemaining)],
      ["creditsUsedToDate", value.creditsUsedToDate],
      ["baselineDailyBurn", value.baselineDailyBurn],
    ]),
    "observed-points.csv": encodeTable(
      ["date", "creditsUsed", "cumulativeCreditsUsed"],
      value.observedPoints.map((point) => [point.date, point.creditsUsed, point.cumulativeCreditsUsed]),
    ),
    "scenario-results.csv": encodeTable(
      ["key", "dailyBurn", "projectedCreditsUsed", "projectedPeriodConsumption", "utilization", "endingBalance", "shortfall", "depletionDate", "status"],
      value.scenarios.map((scenario) => [
        scenario.key,
        scenario.dailyBurn,
        scenario.projectedCreditsUsed,
        scenario.projectedPeriodConsumption,
        scenario.utilization,
        scenario.endingBalance,
        scenario.shortfall,
        scenario.depletionDate ?? "",
        scenario.status,
      ]),
    ),
    "projected-points.csv": encodeTable(
      ["scenarioKey", "date", "startBalance", "balanceDelta", "creditsUsed", "endingBalance"],
      value.scenarios.flatMap((scenario) => scenario.points.map((point) => [
        scenario.key,
        point.date,
        point.startBalance,
        point.balanceDelta,
        point.creditsUsed,
        point.endingBalance,
      ])),
    ),
    "warnings.csv": encodeTable(
      ["code", "scenarioKey", "endingBalance", "threshold", "depletionDate", "shortfall"],
      value.warnings.map(warningRow),
    ),
    "trace-sources.csv": encodeTable(
      ["path", "valueJson"],
      value.calculationTrace.sourceInputs.map((source) => [source.path, stableJson(source.value)]),
    ),
    "trace-steps.csv": encodeTable(
      ["key", "formula", "operandsJson", "resultJson"],
      value.calculationTrace.steps.map((step) => [
        step.key,
        step.formula,
        stableJson(step.operands),
        stableJson(step.result),
      ]),
    ),
  };
}

function parseWarning(row: Record<string, string>): ForecastWarning {
  if (row.code === "LOW_BALANCE_PROJECTED") {
    return {
      code: row.code,
      scenarioKey: row.scenarioKey as ForecastWarning["scenarioKey"],
      endingBalance: row.endingBalance ?? "",
      threshold: row.threshold ?? "",
    };
  }
  if (row.code !== "DEPLETION_PROJECTED") {
    throw new CsvImportError("CSV bundle contains an unknown warning code", [
      { code: "INVALID_FORECAST", path: "warnings.csv:code", message: `Unknown warning code ${row.code ?? ""}` },
    ]);
  }
  return {
    code: row.code,
    scenarioKey: row.scenarioKey as ForecastWarning["scenarioKey"],
    depletionDate: row.depletionDate ?? "",
    shortfall: row.shortfall ?? "",
  };
}

export function parseForecastResultCsv(bundle: CsvBundle): ForecastResult {
  const summary = keyValues(bundle, "result.csv");
  const pointRows = records(bundle, "projected-points.csv", ["scenarioKey", "date", "startBalance", "balanceDelta", "creditsUsed", "endingBalance"]);
  const scenarios = records(bundle, "scenario-results.csv", ["key", "dailyBurn", "projectedCreditsUsed", "projectedPeriodConsumption", "utilization", "endingBalance", "shortfall", "depletionDate", "status"])
    .map((row): ScenarioForecast => ({
      key: row.key as ScenarioForecast["key"],
      dailyBurn: row.dailyBurn ?? "",
      projectedCreditsUsed: row.projectedCreditsUsed ?? "",
      projectedPeriodConsumption: row.projectedPeriodConsumption ?? "",
      utilization: row.utilization ?? "",
      endingBalance: row.endingBalance ?? "",
      shortfall: row.shortfall ?? "",
      depletionDate: row.depletionDate === "" ? null : row.depletionDate ?? null,
      status: row.status as ScenarioForecast["status"],
      points: pointRows
        .filter((point) => point.scenarioKey === row.key)
        .map((point) => ({
          date: point.date ?? "",
          startBalance: point.startBalance ?? "",
          balanceDelta: point.balanceDelta ?? "",
          creditsUsed: point.creditsUsed ?? "",
          endingBalance: point.endingBalance ?? "",
        })),
    }));

  return validateResult({
    schemaVersion: requiredValue(summary, "result.csv", "schemaVersion"),
    methodologyVersion: requiredValue(summary, "result.csv", "methodologyVersion"),
    asOf: requiredValue(summary, "result.csv", "asOf"),
    daysRemaining: Number(requiredValue(summary, "result.csv", "daysRemaining")),
    creditsUsedToDate: requiredValue(summary, "result.csv", "creditsUsedToDate"),
    baselineDailyBurn: requiredValue(summary, "result.csv", "baselineDailyBurn"),
    observedPoints: records(bundle, "observed-points.csv", ["date", "creditsUsed", "cumulativeCreditsUsed"])
      .map((row) => ({
        date: row.date ?? "",
        creditsUsed: row.creditsUsed ?? "",
        cumulativeCreditsUsed: row.cumulativeCreditsUsed ?? "",
      })),
    scenarios,
    warnings: records(bundle, "warnings.csv", ["code", "scenarioKey", "endingBalance", "threshold", "depletionDate", "shortfall"])
      .map(parseWarning),
    calculationTrace: {
      sourceInputs: records(bundle, "trace-sources.csv", ["path", "valueJson"])
        .map((row) => ({ path: row.path ?? "", value: parseJsonCell(row.valueJson ?? "", "trace-sources.csv:valueJson") })),
      steps: records(bundle, "trace-steps.csv", ["key", "formula", "operandsJson", "resultJson"])
        .map((row) => ({
          key: row.key ?? "",
          formula: row.formula ?? "",
          operands: parseJsonCell(row.operandsJson ?? "", "trace-steps.csv:operandsJson") as Readonly<Record<string, TraceValue>>,
          result: parseJsonCell(row.resultJson ?? "", "trace-steps.csv:resultJson"),
        })),
    },
  });
}
