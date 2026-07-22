import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { forecastCreditUsage } from "@tansohq/credit-forecast-core";
import type { ForecastInput } from "@tansohq/credit-forecast-schema";
import { describe, expect, it } from "vitest";

import {
  TansoMappingError,
  mapTansoSnapshotToForecastInput,
  type TansoForecastAssumptions,
  type TansoForecastSnapshot,
} from "./index.js";

interface GoldenFixture {
  readonly fileName: string;
  readonly input: ForecastInput;
  readonly expected?: Readonly<Record<string, unknown>>;
}

const fixturesDirectory = fileURLToPath(
  new URL("../../../../fixtures/golden-scenarios/", import.meta.url),
);

const fixtures = readdirSync(fixturesDirectory)
  .filter((fileName) => fileName.endsWith(".json"))
  .sort()
  .map((fileName) => ({
    fileName,
    ...JSON.parse(readFileSync(`${fixturesDirectory}${fileName}`, "utf8")),
  }) as GoldenFixture);

const validFixtures = fixtures.filter((fixture) => fixture.expected !== undefined);

const mapUnknown = mapTansoSnapshotToForecastInput as unknown as (
  snapshot: unknown,
  assumptions: unknown,
) => ForecastInput;

const splitInput = (
  input: ForecastInput,
): readonly [TansoForecastSnapshot, TansoForecastAssumptions] => {
  const low = input.scenarios.find((scenario) => scenario.key === "low");
  const base = input.scenarios.find((scenario) => scenario.key === "base");
  const high = input.scenarios.find((scenario) => scenario.key === "high");
  if (low === undefined || base === undefined || high === undefined) {
    throw new Error("Golden fixture scenarios are incomplete");
  }

  return [
    {
      sourceSchemaVersion: "1.0",
      asOf: input.asOf,
      currentBalance: input.balance.current,
      dailyUsage: input.dailyUsage,
    },
    {
      schemaVersion: input.schemaVersion,
      methodologyVersion: input.methodologyVersion,
      period: input.period,
      lookbackDays: input.lookbackDays,
      scheduledBalanceDeltas: input.balance.schedule,
      scenarioMultipliers: {
        low: low.burnMultiplier,
        base: base.burnMultiplier,
        high: high.burnMultiplier,
      },
    },
  ];
};

const mappingError = (snapshot: unknown, assumptions: unknown): TansoMappingError => {
  try {
    mapUnknown(snapshot, assumptions);
    throw new Error("Expected mapTansoSnapshotToForecastInput to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(TansoMappingError);
    return error as TansoMappingError;
  }
};

const deepFreeze = <Value>(value: Value): Value => {
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach((child) => deepFreeze(child));
    Object.freeze(value);
  }
  return value;
};

describe("Tanso snapshot adapter", () => {
  it("requires source and forecast versions plus an explicit schedule at compile time", () => {
    const [snapshot, assumptions] = splitInput(validFixtures[0]!.input);
    const { sourceSchemaVersion: _sourceVersion, ...snapshotWithoutVersion } = snapshot;
    const {
      schemaVersion: _schemaVersion,
      methodologyVersion: _methodologyVersion,
      ...assumptionsWithoutVersions
    } = assumptions;
    const { scheduledBalanceDeltas: _schedule, ...assumptionsWithoutSchedule } = assumptions;

    if (false) {
      // @ts-expect-error sourceSchemaVersion is required
      mapTansoSnapshotToForecastInput(snapshotWithoutVersion, assumptions);
      // @ts-expect-error schemaVersion and methodologyVersion are required
      mapTansoSnapshotToForecastInput(snapshot, assumptionsWithoutVersions);
      // @ts-expect-error scheduledBalanceDeltas is required, including when empty
      mapTansoSnapshotToForecastInput(snapshot, assumptionsWithoutSchedule);
    }

    expect(snapshot.sourceSchemaVersion).toBe("1.0");
  });

  it("discovers every valid golden fixture", () => {
    expect(fixtures).toHaveLength(12);
    expect(validFixtures).toHaveLength(11);
  });

  validFixtures.forEach((fixture) => {
    it(`maps ${fixture.fileName} exactly and preserves core results`, () => {
      const [snapshot, assumptions] = splitInput(fixture.input);
      const mapped = mapTansoSnapshotToForecastInput(snapshot, assumptions);

      expect(mapped).toEqual(fixture.input);
      expect(forecastCreditUsage(mapped)).toEqual(forecastCreditUsage(fixture.input));
    });
  });

  it.each(["scheduled-top-up.json", "scheduled-expiration.json"])(
    "maps every explicit delta from %s",
    (fileName) => {
      const fixture = validFixtures.find((entry) => entry.fileName === fileName);
      expect(fixture).toBeDefined();
      const [snapshot, assumptions] = splitInput((fixture as GoldenFixture).input);

      expect(mapTansoSnapshotToForecastInput(snapshot, assumptions).balance.schedule)
        .toEqual((fixture as GoldenFixture).input.balance.schedule);
    },
  );

  it("preserves the neutral incomplete-history code at the source path", () => {
    const fixture = fixtures.find(
      (entry) => entry.fileName === "invalid-incomplete-history.json",
    );
    expect(fixture).toBeDefined();
    const [snapshot, assumptions] = splitInput((fixture as GoldenFixture).input);
    const error = mappingError(snapshot, assumptions);

    expect(error.issues).toContainEqual({
      code: "INCOMPLETE_DAILY_HISTORY",
      path: "snapshot.dailyUsage",
      message:
        "dailyUsage must contain exactly one bucket for every date in [period.startDate, asOf); missing 2026-03-03",
    });
  });

  it("requires an explicit schedule, including when it is empty", () => {
    const [snapshot, assumptions] = splitInput(validFixtures[0]!.input);
    const { scheduledBalanceDeltas: _schedule, ...withoutSchedule } = assumptions;
    const error = mappingError(snapshot, withoutSchedule);

    expect(error.issues).toContainEqual({
      code: "REQUIRED_FIELD",
      path: "assumptions.scheduledBalanceDeltas",
      message: "Required",
    });
  });

  it.each([
    {
      name: "source schema version",
      change: { sourceSchemaVersion: "2.0" },
      code: "UNSUPPORTED_SOURCE_SCHEMA_VERSION",
      path: "snapshot.sourceSchemaVersion",
    },
    {
      name: "as-of date",
      change: { asOf: "2026-02-30" },
      code: "INVALID_DATE",
      path: "snapshot.asOf",
    },
    {
      name: "current balance decimal",
      change: { currentBalance: "01" },
      code: "INVALID_DECIMAL",
      path: "snapshot.currentBalance",
    },
  ])("rejects invalid $name", ({ change, code, path }) => {
    const [snapshot, assumptions] = splitInput(validFixtures[0]!.input);
    const error = mappingError({ ...snapshot, ...change }, assumptions);

    expect(error.issues[0]).toMatchObject({ code, path });
  });

  it("preserves the neutral base-multiplier code", () => {
    const [snapshot, assumptions] = splitInput(validFixtures[0]!.input);
    const invalid = {
      ...assumptions,
      scenarioMultipliers: { ...assumptions.scenarioMultipliers, base: "1.1" },
    };
    const error = mappingError(snapshot, invalid);

    expect(error.issues).toContainEqual({
      code: "INVALID_BASE_MULTIPLIER",
      path: "assumptions.scenarioMultipliers.base",
      message: 'base burnMultiplier must equal "1"',
    });
  });

  it("preserves the neutral scenario-ordering code", () => {
    const [snapshot, assumptions] = splitInput(validFixtures[0]!.input);
    const invalid = {
      ...assumptions,
      scenarioMultipliers: { low: "2", base: "1", high: "1.5" },
    };
    const error = mappingError(snapshot, invalid);

    expect(error.issues).toContainEqual({
      code: "INVALID_SCENARIO_MULTIPLIERS",
      path: "assumptions.scenarioMultipliers",
      message: "scenario burnMultipliers must satisfy low < base < high",
    });
  });

  it("does not mutate frozen inputs and returns deterministic clones", () => {
    const [rawSnapshot, rawAssumptions] = splitInput(validFixtures[0]!.input);
    const snapshot = deepFreeze(rawSnapshot);
    const assumptions = deepFreeze(rawAssumptions);
    const first = mapTansoSnapshotToForecastInput(snapshot, assumptions);
    const second = mapTansoSnapshotToForecastInput(snapshot, assumptions);

    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(first.dailyUsage).not.toBe(snapshot.dailyUsage);
    expect(first.balance.schedule).not.toBe(assumptions.scheduledBalanceDeltas);
  });

  it("emits only neutral forecast fields", () => {
    const [snapshot, assumptions] = splitInput(validFixtures[0]!.input);
    const mapped = mapTansoSnapshotToForecastInput(snapshot, assumptions);

    expect(Object.keys(mapped).sort()).toEqual([
      "asOf",
      "balance",
      "dailyUsage",
      "lookbackDays",
      "methodologyVersion",
      "period",
      "scenarios",
      "schemaVersion",
    ]);
    expect(JSON.stringify(mapped)).not.toMatch(
      /modelVersion|tansoId|credentials|extensions/iu,
    );
  });

  it("serializes mapping failures without hiding issues", () => {
    const [snapshot, assumptions] = splitInput(validFixtures[0]!.input);
    const error = mappingError({ ...snapshot, currentBalance: "01" }, assumptions);

    expect(error.code).toBe("TANSO_MAPPING_FAILED");
    expect(error.toJSON()).toEqual({
      code: "TANSO_MAPPING_FAILED",
      issues: error.issues,
    });
  });

  it("declares only the neutral schema and Zod as runtime dependencies", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { readonly dependencies?: Readonly<Record<string, string>> };

    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual([
      "@tansohq/credit-forecast-schema",
      "zod",
    ]);
  });
});
