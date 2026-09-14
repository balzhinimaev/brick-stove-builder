/** Conditional design calculation using the application's unchanged heat-loss function. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const directory = resolve(root, "docs/classic-construction");
const basis = JSON.parse(readFileSync(resolve(directory, "house-input.json"), "utf8"));
const assumptions = basis.selectedAssumptions;
const building = assumptions.building;
const confirmed = basis.confirmed;
const round = (n) => Math.round(n * 1e6) / 1e6;
const heightM = building.ceilingHeightMm / 1000;
const planAreaM2 = building.planWidthM * building.planLengthM;
assert.equal(planAreaM2, confirmed.houseAreaM2, "Assumed plan must retain the user's heated area");
const grossWallAreaM2 = 2 * (building.planWidthM + building.planLengthM) * heightM;
const areas = {
  walls: grossWallAreaM2 - building.windowAreaM2 - building.externalDoorAreaM2,
  ceiling: building.exposedCeilingAreaM2,
  floor: building.exposedFloorAreaM2,
  windows: building.windowAreaM2,
  door: building.externalDoorAreaM2
};
assert(Object.values(areas).every((n) => Number.isFinite(n) && n > 0));
const deltaK = confirmed.indoorTemperatureC - confirmed.outdoorTemperatureC;
const server = await createServer({
  root,
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, watch: null, preTransformRequests: false },
  appType: "custom"
});

try {
  const { calculateHeatLoss, CALCULATOR_EXAMPLE } = await server.ssrLoadModule("/src/domain/stoveCalculator.ts");
  const results = assumptions.thermalScenarios.map((scenario) => {
    const parts = Object.entries(areas).map(([element, areaM2]) => {
      const uWm2K = scenario.uWm2K[element];
      assert(Number.isFinite(uWm2K) && uWm2K > 0);
      return { element, areaM2, uWm2K, conductanceWK: round(areaM2 * uWm2K) };
    });
    const transmissionWK = round(parts.reduce((sum, p) => sum + p.conductanceWK, 0) + scenario.thermalBridgesWK);
    const heatInput = {
      ...CALCULATOR_EXAMPLE,
      areaM2: confirmed.houseAreaM2,
      ceilingHeightMm: building.ceilingHeightMm,
      indoorC: confirmed.indoorTemperatureC,
      outdoorC: confirmed.outdoorTemperatureC,
      transmissionWK,
      airChangesPerHour: scenario.airChangesPerHour
    };
    // Unrelated example installation fields satisfy validation; no recipe is assessed or generated.
    const load = calculateHeatLoss(heatInput);
    assert(load, "Scenario must pass the existing calculator input validation");
    const airWK = assumptions.thermalMethod.airHeatCapacityWhM3K * scenario.airChangesPerHour * planAreaM2 * heightM;
    assert(Math.abs(load.totalKw * 1000 - (transmissionWK + airWK) * deltaK) < 1e-6);
    assert.equal(load.deltaK, deltaK);
    return {
      id: scenario.id,
      envelopeParts: parts,
      thermalBridgesWK: scenario.thermalBridgesWK,
      transmissionWK,
      airChangesPerHour: scenario.airChangesPerHour,
      ventilationWK: round(airWK),
      transmissionKw: round(load.transmissionKw),
      ventilationKw: round(load.ventilationKw),
      totalKw: round(load.totalKw),
      energyKwhPer24hAtConstantDesignConditions: round(load.totalKw * 24)
    };
  });
  assert(results.every((r, i) => i === 0 || r.totalKw > results[i - 1].totalKw));
  const reference = results.find((r) => r.id === assumptions.selectedThermalScenario);
  assert(reference);
  const output = {
    status: "Scenario heat-load calculation, not site verification or stove output rating",
    model: "Steady state: Q = (sum(U*A) + H_bridges + 0.33*n*V)*deltaT/1000 kW",
    input: "house-input.json",
    confirmedTemperaturesC: { inside: confirmed.indoorTemperatureC, outside: confirmed.outdoorTemperatureC },
    deltaK,
    assumedVolumeM3: planAreaM2 * heightM,
    assumedGrossWallAreaM2: grossWallAreaM2,
    exposedAreasM2: areas,
    scenarios: results,
    selectedScenario: reference.id,
    selectedScenarioMeanDemandKw: reference.totalKw,
    selectedScenarioGuidance:
      "About 7 kW mean heat delivery at the stated constant conditions, NOT 7 kW peak while burning. No new stove capacity has been established.",
    sensitivity: {
      extraAirChangeRatePerHour: 0.5,
      extraLoadKw: round((assumptions.thermalMethod.airHeatCapacityWhM3K * 0.5 * planAreaM2 * heightM * deltaK) / 1000),
      additionalTransmissionWK: 10,
      extraTransmissionLoadKw: round((10 * deltaK) / 1000)
    },
    chosenCeilingScenario: {
      heightMm: building.ceilingHeightMm,
      requiredTopGapMm: assumptions.installation.selectedCeilingClearanceMm,
      maximumBodyTopAboveFloorMm: building.ceilingHeightMm - assumptions.installation.selectedCeilingClearanceMm,
      condition: assumptions.installation.ceilingClearanceCondition,
      constructionFitApproved: false
    },
    limitations: [
      "Scenario labels are not certified building classes or inferred actual constructions.",
      "No finite range of hypothetical scenarios bounds an unmeasured house's heat loss.",
      "Whole-house mean balance does not establish room temperatures or peaks between periodic firings.",
      "No stove efficiency, wood consumption, safe fuel charge or firing schedule calculated.",
      "No structural foundation, chimney or stove design is released by this calculation."
    ]
  };
  writeFileSync(resolve(directory, "thermal-scenarios.json"), `${JSON.stringify(output, null, 2)}\n`);
  console.log(
    JSON.stringify({ scenarios: results.map(({ id, totalKw }) => ({ id, totalKw })), selected: reference.id })
  );
} finally {
  await server.close();
}
