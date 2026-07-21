import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const rootDir = "/Users/katlaszlo/Documents/tanso-oss-credit-estimator";
const outputDir = path.join(rootDir, "outputs/019f8133-61d2-7251-9b2e-910fb8ad51a7");
const previewDir = path.join(rootDir, ".codex-tmp/019f8133-61d2-7251-9b2e-910fb8ad51a7/previews");
const outputPath = path.join(outputDir, "tanso_oss_credit_estimator.xlsx");

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

const wb = Workbook.create();
const sheetNames = [
  "README",
  "Assumptions",
  "EVE Inputs",
  "Metric Weights",
  "Customer Drivers",
  "Scenarios",
  "Plan Design",
  "Calibration",
];
const sheets = Object.fromEntries(sheetNames.map((name) => [name, wb.worksheets.add(name)]));
const metricNames = [
  "agent.summarize",
  "agent.deep_research",
  "agent.classify",
  "agent.extract",
  "agent.draft_email",
  "agent.compare",
  "agent.monitor_alert",
  "agent.generate_report",
];

const COLORS = {
  navy: "#0F172A",
  teal: "#0F766E",
  tealLight: "#CCFBF1",
  blueLight: "#DBEAFE",
  gray: "#475569",
  grayLight: "#F1F5F9",
  border: "#CBD5E1",
  white: "#FFFFFF",
  inputFill: "#FFF9C4",
  inputBlue: "#0000FF",
  linkGreen: "#008000",
  passFill: "#DCFCE7",
  passText: "#166534",
  warnFill: "#FEF3C7",
  warnText: "#92400E",
  failFill: "#FEE2E2",
  failText: "#991B1B",
};

const FMT = {
  currency0: '$#,##0;[Red]($#,##0);-',
  currency2: '$#,##0.00;[Red]($#,##0.00);-',
  currency4: '$0.0000;[Red]($0.0000);-',
  percent1: '0.0%;[Red](0.0%);-',
  count0: '#,##0;[Red](#,##0);-',
  count1: '#,##0.0;[Red](#,##0.0);-',
  decimal2: '0.00;[Red](0.00);-',
};

function setTitle(sheet, range, title, subtitleRange, subtitle) {
  sheet.getRange(range).merge();
  sheet.getRange(range).values = [[title]];
  sheet.getRange(range).format = {
    fill: COLORS.navy,
    font: { bold: true, color: COLORS.white, size: 18 },
    verticalAlignment: "center",
  };
  sheet.getRange(range).format.rowHeight = 34;
  sheet.getRange(subtitleRange).merge();
  sheet.getRange(subtitleRange).values = [[subtitle]];
  sheet.getRange(subtitleRange).format = {
    fill: COLORS.grayLight,
    font: { color: COLORS.gray, italic: true, size: 10 },
    verticalAlignment: "center",
    wrapText: true,
  };
  sheet.getRange(subtitleRange).format.rowHeight = 30;
}

function setSection(sheet, range, text) {
  sheet.getRange(range).merge();
  sheet.getRange(range).values = [[text]];
  sheet.getRange(range).format = {
    fill: COLORS.teal,
    font: { bold: true, color: COLORS.white, size: 11 },
    verticalAlignment: "center",
  };
  sheet.getRange(range).format.rowHeight = 24;
}

function setHeader(sheet, range) {
  sheet.getRange(range).format = {
    fill: COLORS.navy,
    font: { bold: true, color: COLORS.white, size: 9 },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "inside", style: "thin", color: COLORS.border },
  };
  sheet.getRange(range).format.rowHeight = 34;
}

function setBody(sheet, range) {
  sheet.getRange(range).format = {
    font: { size: 9, color: "#000000" },
    verticalAlignment: "center",
    borders: { insideHorizontal: { style: "thin", color: COLORS.border } },
  };
}

function setInputs(sheet, range) {
  sheet.getRange(range).format.fill = COLORS.inputFill;
  sheet.getRange(range).format.font = { color: COLORS.inputBlue, size: 9 };
}

function setLinks(sheet, range) {
  sheet.getRange(range).format.font = { color: COLORS.linkGreen, size: 9 };
}

function setWidths(sheet, specs) {
  for (const [range, width] of specs) sheet.getRange(range).format.columnWidth = width;
}

function addStatusFormatting(range) {
  range.conditionalFormats.add("containsText", {
    text: "OK",
    format: { fill: COLORS.passFill, font: { color: COLORS.passText, bold: true } },
  });
  range.conditionalFormats.add("containsText", {
    text: "PASS",
    format: { fill: COLORS.passFill, font: { color: COLORS.passText, bold: true } },
  });
  range.conditionalFormats.add("containsText", {
    text: "CHECK",
    format: { fill: COLORS.failFill, font: { color: COLORS.failText, bold: true } },
  });
  range.conditionalFormats.add("containsText", {
    text: "INFEASIBLE",
    format: { fill: COLORS.failFill, font: { color: COLORS.failText, bold: true } },
  });
}

// README
{
  const s = sheets.README;
  setTitle(
    s,
    "A1:H1",
    "Tanso OSS Credit Estimator",
    "A2:H2",
    "Executable specification for action-level credit weights, demand scenarios, plan allocations, and production calibration."
  );
  setSection(s, "A4:B4", "Workbook Metadata");
  s.getRange("A5:B9").values = [
    ["Version", "1.0"],
    ["As of", new Date("2026-07-20T00:00:00")],
    ["Period basis", "Monthly operating model"],
    ["Model status", null],
    ["Scope", "8 agent actions | 3 customer segments"],
  ];
  s.getRange("B8").formulas = [['=IF(COUNTIF($F$30:$F$34,"<>OK")=0,"PASS","FAIL")']];
  s.getRange("B6").format.numberFormat = "yyyy-mm-dd";
  setBody(s, "A5:B9");
  s.getRange("A5:A9").format.font = { bold: true, color: COLORS.gray, size: 9 };
  addStatusFormatting(s.getRange("B8"));

  setSection(s, "D4:H4", "Key Base-Case Outputs");
  s.getRange("D5:H9").values = [
    ["Base monthly credits", null, null, "Credits / active seat", null],
    ["Base provider cost", null, null, "Realized price / credit", null],
    ["Base usage revenue", null, null, "Infeasible actions", null],
    ["Base gross margin", null, null, "Base monthly actions", null],
    ["Base credits / customer", null, null, "Target gross margin", null],
  ];
  s.getRange("E5").formulas = [["='Scenarios'!F7"]];
  s.getRange("E6").formulas = [["='Scenarios'!G7"]];
  s.getRange("E7").formulas = [["='Scenarios'!H7"]];
  s.getRange("E8").formulas = [["='Scenarios'!J7"]];
  s.getRange("E9").formulas = [["='Scenarios'!L7"]];
  s.getRange("H5").formulas = [["='Scenarios'!K7"]];
  s.getRange("H6").formulas = [["='Assumptions'!C6"]];
  s.getRange("H7").formulas = [['=COUNTIF(\'Metric Weights\'!$N$6:$N$13,"<>OK")']];
  s.getRange("H8").formulas = [["='Scenarios'!E7"]];
  s.getRange("H9").formulas = [["='Assumptions'!C7"]];
  setBody(s, "D5:H9");
  s.getRange("D5:D9").format.font = { bold: true, color: COLORS.gray, size: 9 };
  s.getRange("G5:G9").format.font = { bold: true, color: COLORS.gray, size: 9 };
  setLinks(s, "E5:E9");
  setLinks(s, "H5:H9");
  s.getRange("E5").format.numberFormat = FMT.count0;
  s.getRange("E6:E7").format.numberFormat = FMT.currency0;
  s.getRange("E8").format.numberFormat = FMT.percent1;
  s.getRange("E9").format.numberFormat = FMT.count0;
  s.getRange("H5").format.numberFormat = FMT.count1;
  s.getRange("H6").format.numberFormat = FMT.currency2;
  s.getRange("H7:H8").format.numberFormat = FMT.count0;
  s.getRange("H9").format.numberFormat = FMT.percent1;

  setSection(s, "A12:H12", "How to Use");
  s.getRange("A13:H17").merge(true);
  s.getRange("A13:A17").values = [
    ["1. Replace yellow / blue-font inputs in Assumptions, EVE Inputs, Metric Weights, and Customer Drivers."],
    ["2. Review action-level feasibility and recommended weights in Metric Weights."],
    ["3. Use Scenarios to evaluate low, base, and high monthly economics."],
    ["4. Review Plan Design for allocations, utilization, margin, and top-up pressure."],
    ["5. Paste actual production usage and cost into Calibration when available."],
  ];
  s.getRange("A13:H17").format = { wrapText: true, font: { size: 10 }, verticalAlignment: "center" };
  s.getRange("A13:H17").format.rowHeight = 23;

  setSection(s, "A19:H19", "Methodology and Calculation Map");
  s.getRange("A20:B26").values = [
    ["Unit cost", "'=(Input tokens/1,000,000 × input rate) + (output tokens/1,000,000 × output rate) + infra + other variable cost"],
    ["Risk reduction", "'=Loss amount × probability before − loss amount × probability after"],
    ["Value per action", "'=Annual adjusted customer value / expected annual actions"],
    ["Confidence-adjusted value", "'=Estimated value per action × evidence confidence"],
    ["Minimum cost credits", "'=CEILING(Unit cost / (price per credit × (1 − target gross margin)), credit increment)"],
    ["Recommended weight", "'=MAX(minimum cost credits, value-supported credits)"],
    ["Monthly volume", "'=Accounts × seats/account × active-seat % × actions/active seat/day × active days × adoption % × completion % × workload mix %"],
  ];
  s.getRange("A20:A26").format = { fill: COLORS.tealLight, font: { bold: true, color: COLORS.navy, size: 9 } };
  s.getRange("B20:H26").merge(true);
  s.getRange("B20:H26").format = { wrapText: true, font: { size: 9 }, verticalAlignment: "center" };
  s.getRange("A20:H26").format.rowHeight = 29;

  setSection(s, "A28:G28", "Model Checks");
  s.getRange("A29:G29").values = [["Check", "Actual", "Expected", "Difference", "Tolerance", "Status", "Where to Fix / Notes"]];
  setHeader(s, "A29:G29");
  s.getRange("A30:G34").values = [
    ["Base revenue tie", null, null, null, 0.01, null, "Scenarios / Assumptions"],
    ["No infeasible actions", null, 0, null, 0, null, "Metric Weights"],
    ["Plan price anchor tie", null, 0, null, 0.000001, null, "Plan Design / Assumptions"],
    ["Segment workload mix tie", null, 0, null, 0.000001, null, "Customer Drivers"],
    ["Base GM at or above target", null, null, null, 0, null, "Metric Weights / Assumptions"],
  ];
  s.getRange("B30").formulas = [["='Scenarios'!H7"]];
  s.getRange("C30").formulas = [["='Scenarios'!F7*'Assumptions'!C6"]];
  s.getRange("D30").formulas = [["=B30-C30"]];
  s.getRange("F30").formulas = [['=IF(ABS(D30)<=E30,"OK","CHECK")']];
  s.getRange("B31").formulas = [['=COUNTIF(\'Metric Weights\'!$N$6:$N$13,"<>OK")']];
  s.getRange("D31").formulas = [["=B31-C31"]];
  s.getRange("F31").formulas = [['=IF(ABS(D31)<=E31,"OK","CHECK")']];
  s.getRange("B32").formulas = [["=MAX(ABS('Plan Design'!G6-'Assumptions'!C6),ABS('Plan Design'!G7-'Assumptions'!C6),ABS('Plan Design'!G8-'Assumptions'!C6))"]];
  s.getRange("D32").formulas = [["=B32-C32"]];
  s.getRange("F32").formulas = [['=IF(ABS(D32)<=E32,"OK","CHECK")']];
  s.getRange("B33").formulas = [["=MAX(ABS('Customer Drivers'!X6-1),ABS('Customer Drivers'!X7-1),ABS('Customer Drivers'!X8-1))"]];
  s.getRange("D33").formulas = [["=B33-C33"]];
  s.getRange("F33").formulas = [['=IF(ABS(D33)<=E33,"OK","CHECK")']];
  s.getRange("B34").formulas = [["='Scenarios'!J7"]];
  s.getRange("C34").formulas = [["='Assumptions'!C7"]];
  s.getRange("D34").formulas = [["=B34-C34"]];
  s.getRange("F34").formulas = [['=IF(B34>=C34,"OK","CHECK")']];
  setBody(s, "A30:G34");
  setLinks(s, "B30:C34");
  s.getRange("D30:F34").format.font = { color: "#000000", size: 9 };
  s.getRange("B30:C30").format.numberFormat = FMT.currency2;
  s.getRange("D30:E30").format.numberFormat = FMT.currency4;
  s.getRange("B31:E31").format.numberFormat = FMT.count0;
  s.getRange("B32:E33").format.numberFormat = "0.000000";
  s.getRange("B34:E34").format.numberFormat = FMT.percent1;
  addStatusFormatting(s.getRange("F30:F34"));

  setSection(s, "A37:H37", "Definitions and Version Notes");
  s.getRange("A38:H41").merge(true);
  s.getRange("A38:A41").values = [
    ["Credit: internal billable unit. Realized price excludes the fixed platform fee for subscriptions."],
    ["Gross margin: (usage revenue − provider cost) / usage revenue unless explicitly labeled as plan gross margin."],
    ["Evidence confidence: 30% unsupported estimate, 60% customer research, 90% measured result."],
    ["v1.0 | 2026-07-20 | Initial illustrative operating model. Replace estimates with Tanso model-cost and event data."],
  ];
  s.getRange("A38:H41").format = { wrapText: true, font: { size: 9, color: COLORS.gray } };
  s.getRange("A38:H41").format.rowHeight = 24;
  setWidths(s, [["A:A", 27], ["B:B", 35], ["C:C", 14], ["D:D", 24], ["E:E", 16], ["F:F", 13], ["G:G", 25], ["H:H", 16]]);
  s.showGridLines = false;
  s.freezePanes.freezeRows(2);
}

// Assumptions
{
  const s = sheets.Assumptions;
  setTitle(s, "A1:K1", "Assumptions", "A2:K2", "Yellow cells with blue font are editable inputs. All scenario, plan, and weighting outputs link back here.");
  setSection(s, "A4:D4", "Credit Economics");
  s.getRange("A5:D5").values = [["Assumption", "Definition", "Value", "Units / Notes"]];
  setHeader(s, "A5:D5");
  s.getRange("A6:D13").values = [
    ["Realized price per credit", "Effective usage price paid by customer", 0.01, "$/credit"],
    ["Target gross margin", "Minimum target on usage revenue", 0.70, "%"],
    ["Target value capture", "Share of confidence-adjusted value targeted", 0.05, "%"],
    ["Maximum value capture", "Customer-value guardrail", 0.10, "%"],
    ["Credit rounding increment", "Whole-credit weighting increment", 1, "credits"],
    ["Allocation buffer", "Plan credits above base demand", 0.20, "%"],
    ["Top-up risk threshold", "Expected utilization that triggers medium risk", 0.85, "%"],
    ["Top-up price per credit", "Realized top-up usage price", 0.012, "$/credit"],
  ];
  setBody(s, "A6:D13");
  setInputs(s, "C6:C13");
  s.getRange("C6").format.numberFormat = FMT.currency2;
  s.getRange("C7:C9").format.numberFormat = FMT.percent1;
  s.getRange("C10").format.numberFormat = FMT.count0;
  s.getRange("C11:C12").format.numberFormat = FMT.percent1;
  s.getRange("C13").format.numberFormat = FMT.currency4;

  setSection(s, "A15:E15", "Scenario Multipliers");
  s.getRange("A16:E16").values = [["Scenario", "Volume Multiplier", "Token Multiplier", "Cost Multiplier", "Interpretation"]];
  setHeader(s, "A16:E16");
  s.getRange("A17:E19").values = [
    ["Low", 0.70, 0.80, 1.00, "Lower activity and shorter prompts"],
    ["Base", 1.00, 1.00, 1.00, "Current operating assumptions"],
    ["High", 1.40, 1.30, 1.10, "Higher activity, longer prompts, and cost pressure"],
  ];
  setBody(s, "A17:E19");
  setInputs(s, "B17:D19");
  s.getRange("B17:D19").format.numberFormat = FMT.percent1;

  setSection(s, "G4:I4", "Evidence Confidence Guide");
  s.getRange("G5:I5").values = [["Evidence Level", "Confidence", "Use"]];
  setHeader(s, "G5:I5");
  s.getRange("G6:I8").values = [
    ["Unsupported estimate", 0.30, "Early hypothesis"],
    ["Customer research", 0.60, "Interview / discovery evidence"],
    ["Measured result", 0.90, "Observed production outcome"],
  ];
  setBody(s, "G6:I8");
  setInputs(s, "H6:H8");
  s.getRange("H6:H8").format.numberFormat = FMT.percent1;

  setSection(s, "G11:K11", "Plan Policy Assumptions");
  s.getRange("G12:K12").values = [["Plan", "Target Segment", "Fixed Platform Fee", "Top-up Pack Credits", "Notes"]];
  setHeader(s, "G12:K12");
  s.getRange("G13:K15").values = [
    ["Starter", "Startup", 49, 1000, "Entry package"],
    ["Growth", "Mid-Market", 299, 10000, "Team package"],
    ["Scale", "Enterprise", 1999, 50000, "Enterprise package"],
  ];
  setBody(s, "G13:K15");
  setInputs(s, "I13:J15");
  s.getRange("I13:I15").format.numberFormat = FMT.currency0;
  s.getRange("J13:J15").format.numberFormat = FMT.count0;

  setSection(s, "G18:K18", "Model Conventions");
  s.getRange("G19:K22").merge(true);
  s.getRange("G19:G22").values = [
    ["Currency: USD | Counts: individual completed actions and credits"],
    ["Period basis: monthly; annual EVE estimates are divided by expected annual actions"],
    ["Base scenario: current-month run rate; Customer Drivers also calculates month-12 exit volume"],
    ["Breakage policy: unused credits are disclosed but never used to rescue poor unit economics"],
  ];
  s.getRange("G19:K22").format = { wrapText: true, font: { size: 9, color: COLORS.gray } };
  s.getRange("G19:K22").format.rowHeight = 27;

  setWidths(s, [["A:A", 29], ["B:B", 41], ["C:C", 16], ["D:D", 17], ["E:E", 34], ["F:F", 3], ["G:G", 24], ["H:H", 22], ["I:I", 20], ["J:J", 20], ["K:K", 26]]);
  s.showGridLines = false;
  s.freezePanes.freezeRows(5);
}

// EVE Inputs
{
  const s = sheets["EVE Inputs"];
  setTitle(s, "A1:Q1", "EVE Inputs", "A2:Q2", "Annual customer value is converted to a per-action value and discounted by evidence confidence. All amounts are illustrative assumptions in USD.");
  setSection(s, "A4:Q4", "Economic Value Evidence by Completed Action");
  s.getRange("A5:Q5").values = [[
    "Metric", "Revenue Enhancement ($/yr)", "Labor / Cost Savings ($/yr)", "Loss Amount ($)",
    "Probability Before", "Probability After", "Expected Loss Avoided ($/yr)", "Capital Benefit ($/yr)",
    "Option Value ($/yr)", "Unique Customer Costs ($/yr)", "Expected Shortfall ($/yr)",
    "Annual Adjusted Value ($/yr)", "Expected Annual Actions", "Estimated Value / Action",
    "Evidence Confidence", "Confidence-Adjusted Value / Action", "Evidence Basis / Notes"
  ]];
  setHeader(s, "A5:Q5");
  const rows = [
    ["agent.summarize", 10000, 30000, 0, 0, 0, null, 0, 2000, 2000, 0, null, 50000, null, 0.90, null, "Illustrative measured-result confidence; replace with customer outcome data."],
    ["agent.deep_research", 100000, 70000, 50000, 0.30, 0.10, null, 25000, 10000, 10000, 5000, null, 45000, null, 0.90, null, "Worked example: $200k annual value / 45k actions × 90% = $4.00/action."],
    ["agent.classify", 0, 25000, 10000, 0.10, 0.02, null, 0, 0, 800, 0, null, 80000, null, 0.60, null, "Illustrative customer-research estimate."],
    ["agent.extract", 15000, 60000, 30000, 0.08, 0.03, null, 5000, 0, 5000, 1500, null, 60000, null, 0.60, null, "Illustrative customer-research estimate."],
    ["agent.draft_email", 40000, 70000, 20000, 0.05, 0.02, null, 0, 5000, 10000, 5600, null, 50000, null, 0.60, null, "Illustrative customer-research estimate."],
    ["agent.compare", 30000, 90000, 100000, 0.08, 0.03, null, 10000, 5000, 10000, 5000, null, 50000, null, 0.60, null, "Illustrative customer-research estimate."],
    ["agent.monitor_alert", 20000, 40000, 500000, 0.04, 0.025, null, 0, 5000, 10000, 2500, null, 150000, null, 0.60, null, "Illustrative customer-research estimate."],
    ["agent.generate_report", 80000, 100000, 50000, 0.10, 0.04, null, 10000, 10000, 20000, 3000, null, 60000, null, 0.90, null, "Illustrative measured-result confidence; validate in production."],
  ];
  s.getRange("A6:Q13").values = rows;
  for (let r = 6; r <= 13; r++) {
    s.getRange(`G${r}`).formulas = [[`=D${r}*E${r}-D${r}*F${r}`]];
    s.getRange(`L${r}`).formulas = [[`=B${r}+C${r}+G${r}+H${r}+I${r}-J${r}-K${r}`]];
    s.getRange(`N${r}`).formulas = [[`=IF(M${r}=0,0,L${r}/M${r})`]];
    s.getRange(`P${r}`).formulas = [[`=N${r}*O${r}`]];
  }
  setBody(s, "A6:Q13");
  for (const range of ["B6:F13", "H6:K13", "M6:M13", "O6:O13"]) setInputs(s, range);
  s.getRange("B6:D13").format.numberFormat = FMT.currency0;
  s.getRange("E6:F13").format.numberFormat = FMT.percent1;
  s.getRange("G6:L13").format.numberFormat = FMT.currency0;
  s.getRange("M6:M13").format.numberFormat = FMT.count0;
  s.getRange("N6:N13").format.numberFormat = FMT.currency2;
  s.getRange("O6:O13").format.numberFormat = FMT.percent1;
  s.getRange("P6:P13").format.numberFormat = FMT.currency2;
  s.getRange("Q6:Q13").format.wrapText = true;
  s.getRange("Q6:Q13").format.rowHeight = 38;
  s.getRange("A15:Q16").merge(true);
  s.getRange("A15").values = [["EVE definition: customer value = revenue enhancement + labor/cost savings + expected loss avoided + capital benefit + option value − unique customer costs − expected shortfall."]];
  s.getRange("A16").values = [["Confidence guidance: 30% unsupported estimate, 60% customer research, 90% measured result. Update both the input and the evidence note as validation improves."]];
  s.getRange("A15:Q16").format = { fill: COLORS.grayLight, font: { italic: true, color: COLORS.gray, size: 9 }, wrapText: true };
  s.getRange("A15:Q16").format.rowHeight = 26;
  setWidths(s, [["A:A", 25], ["B:C", 19], ["D:D", 16], ["E:F", 16], ["G:L", 19], ["M:M", 18], ["N:N", 18], ["O:O", 16], ["P:P", 21], ["Q:Q", 42]]);
  s.showGridLines = false;
  s.freezePanes.freezeRows(5);
  s.freezePanes.freezeColumns(1);
}

// Metric Weights
{
  const s = sheets["Metric Weights"];
  setTitle(s, "A1:P1", "Metric Weights", "A2:P2", "Cost floor, customer-value support, and guardrails determine the recommended credits per completed action.");
  setSection(s, "A4:P4", "Action Economics and Recommended Credit Weights");
  s.getRange("A5:P5").values = [[
    "Metric", "Input Tokens", "Output Tokens", "Input Rate / M", "Output Rate / M", "Infra Cost", "Other Variable Cost",
    "Unit Cost", "Confidence-Adjusted Value", "Minimum Cost Credits", "Value-Supported Credits", "Maximum Value Credits",
    "Recommended Credit Weight", "Feasibility", "Revenue / Action", "Gross Margin / Action"
  ]];
  setHeader(s, "A5:P5");
  const rows = [
    ["agent.summarize", 4000, 500, 0.50, 2.00, 0.0010, 0],
    ["agent.deep_research", 20000, 4000, 0.50, 2.00, 0.0020, 0],
    ["agent.classify", 800, 100, 0.50, 2.00, 0.0005, 0],
    ["agent.extract", 2500, 400, 0.50, 2.00, 0.0010, 0.0005],
    ["agent.draft_email", 3500, 650, 0.50, 2.00, 0.0010, 0.0005],
    ["agent.compare", 7000, 900, 0.50, 2.00, 0.0015, 0.0005],
    ["agent.monitor_alert", 1200, 120, 0.50, 2.00, 0.0008, 0.0003],
    ["agent.generate_report", 10000, 2000, 0.50, 2.00, 0.0020, 0.0010],
  ];
  s.getRange("A6:G13").values = rows;
  for (let r = 6; r <= 13; r++) {
    s.getRange(`H${r}`).formulas = [[`=(B${r}/1000000*D${r})+(C${r}/1000000*E${r})+F${r}+G${r}`]];
    s.getRange(`I${r}`).formulas = [[`=INDEX('EVE Inputs'!$P$6:$P$13,MATCH(A${r},'EVE Inputs'!$A$6:$A$13,0))`]];
    s.getRange(`J${r}`).formulas = [[`=CEILING(H${r}/('Assumptions'!$C$6*(1-'Assumptions'!$C$7)),'Assumptions'!$C$10)`]];
    s.getRange(`K${r}`).formulas = [[`=ROUND(I${r}*'Assumptions'!$C$8/'Assumptions'!$C$6,0)`]];
    s.getRange(`L${r}`).formulas = [[`=FLOOR(I${r}*'Assumptions'!$C$9/'Assumptions'!$C$6,'Assumptions'!$C$10)`]];
    s.getRange(`M${r}`).formulas = [[`=MAX(J${r},K${r})`]];
    s.getRange(`N${r}`).formulas = [[`=IF(J${r}>L${r},"ECONOMICALLY INFEASIBLE","OK")`]];
    s.getRange(`O${r}`).formulas = [[`=M${r}*'Assumptions'!$C$6`]];
    s.getRange(`P${r}`).formulas = [[`=IF(O${r}=0,0,(O${r}-H${r})/O${r})`]];
  }
  setBody(s, "A6:P13");
  setInputs(s, "B6:G13");
  setLinks(s, "I6:L13");
  setLinks(s, "O6:O13");
  s.getRange("B6:C13").format.numberFormat = FMT.count0;
  s.getRange("D6:G13").format.numberFormat = FMT.currency4;
  s.getRange("H6:I13").format.numberFormat = FMT.currency4;
  s.getRange("J6:M13").format.numberFormat = FMT.count0;
  s.getRange("O6:O13").format.numberFormat = FMT.currency2;
  s.getRange("P6:P13").format.numberFormat = FMT.percent1;
  addStatusFormatting(s.getRange("N6:N13"));
  s.getRange("A15:P15").merge();
  s.getRange("A15").values = [["Worked example — agent.deep_research: $0.0200 unit cost implies 7 minimum credits at a 70% target GM; $4.00 confidence-adjusted value supports 20 credits at 5% capture; recommended weight = 20 credits and action GM = 90%. "]];
  s.getRange("A15:P15").format = { fill: COLORS.blueLight, font: { color: COLORS.navy, bold: true, size: 9 }, wrapText: true };
  s.getRange("A15:P15").format.rowHeight = 34;
  setWidths(s, [["A:A", 25], ["B:C", 13], ["D:E", 14], ["F:H", 14], ["I:I", 19], ["J:M", 17], ["N:N", 25], ["O:O", 16], ["P:P", 17]]);
  s.showGridLines = false;
  s.freezePanes.freezeRows(5);
  s.freezePanes.freezeColumns(1);
}

// Customer Drivers
{
  const s = sheets["Customer Drivers"];
  setTitle(s, "A1:AB1", "Customer Drivers", "A2:AB2", "One row per customer segment and metric. Workload mix allocates total successful agent activity across actions; each segment mix should sum to 100%.");
  setSection(s, "A4:R4", "Segment × Metric Demand Drivers");
  s.getRange("A5:R5").values = [[
    "Segment", "Metric", "Accounts", "Seats / Account", "Active Seat %", "Actions / Active Seat / Day", "Active Days",
    "Adoption %", "Completion %", "Workload Mix %", "Monthly Growth %", "Base Monthly Volume", "Month 12 Volume",
    "Credits / Action", "Base Monthly Credits", "Unit Cost", "Base Provider Cost", "Base Active Seats"
  ]];
  setHeader(s, "A5:R5");
  const segments = [
    { name: "Startup", accounts: 40, seats: 12, active: 0.65, actions: 2.0, days: 20, adoption: 0.70, completion: 0.95, growth: 0.03, mix: [0.25,0.05,0.15,0.15,0.10,0.10,0.12,0.08] },
    { name: "Mid-Market", accounts: 18, seats: 80, active: 0.72, actions: 2.6, days: 21, adoption: 0.78, completion: 0.96, growth: 0.025, mix: [0.20,0.08,0.14,0.14,0.10,0.12,0.12,0.10] },
    { name: "Enterprise", accounts: 5, seats: 500, active: 0.78, actions: 3.1, days: 22, adoption: 0.82, completion: 0.97, growth: 0.02, mix: [0.15,0.12,0.10,0.13,0.08,0.14,0.15,0.13] },
  ];
  const driverRows = [];
  for (const seg of segments) {
    metricNames.forEach((metric, i) => driverRows.push([
      seg.name, metric, seg.accounts, seg.seats, seg.active, seg.actions, seg.days,
      seg.adoption, seg.completion, seg.mix[i], seg.growth, null, null, null, null, null, null, null,
    ]));
  }
  s.getRange("A6:R29").values = driverRows;
  for (let r = 6; r <= 29; r++) {
    s.getRange(`L${r}`).formulas = [[`=C${r}*D${r}*E${r}*F${r}*G${r}*H${r}*I${r}*J${r}`]];
    s.getRange(`M${r}`).formulas = [[`=L${r}*(1+K${r})^11`]];
    s.getRange(`N${r}`).formulas = [[`=INDEX('Metric Weights'!$M$6:$M$13,MATCH(B${r},'Metric Weights'!$A$6:$A$13,0))`]];
    s.getRange(`O${r}`).formulas = [[`=L${r}*N${r}`]];
    s.getRange(`P${r}`).formulas = [[`=INDEX('Metric Weights'!$H$6:$H$13,MATCH(B${r},'Metric Weights'!$A$6:$A$13,0))`]];
    s.getRange(`Q${r}`).formulas = [[`=L${r}*P${r}`]];
    s.getRange(`R${r}`).formulas = [[`=C${r}*D${r}*E${r}`]];
  }
  setBody(s, "A6:R29");
  setInputs(s, "C6:K29");
  setLinks(s, "N6:N29");
  setLinks(s, "P6:P29");
  s.getRange("C6:D29").format.numberFormat = FMT.count0;
  s.getRange("E6:E29").format.numberFormat = FMT.percent1;
  s.getRange("F6:F29").format.numberFormat = FMT.decimal2;
  s.getRange("G6:G29").format.numberFormat = FMT.count0;
  s.getRange("H6:K29").format.numberFormat = FMT.percent1;
  s.getRange("L6:M29").format.numberFormat = FMT.count0;
  s.getRange("N6:O29").format.numberFormat = FMT.count0;
  s.getRange("P6:Q29").format.numberFormat = FMT.currency4;
  s.getRange("R6:R29").format.numberFormat = FMT.count1;

  setSection(s, "T4:AB4", "Segment Summary");
  s.getRange("T5:AB5").values = [["Segment", "Accounts", "Total Seats", "Active Seats", "Workload Mix Total", "Base Monthly Actions", "Base Monthly Credits", "Base Provider Cost", "Month 12 Actions"]];
  setHeader(s, "T5:AB5");
  s.getRange("T6:T8").values = [["Startup"], ["Mid-Market"], ["Enterprise"]];
  for (let r = 6; r <= 8; r++) {
    s.getRange(`U${r}`).formulas = [[`=SUMIF($A$6:$A$29,T${r},$C$6:$C$29)/COUNTIF($A$6:$A$29,T${r})`]];
    s.getRange(`V${r}`).formulas = [[`=U${r}*INDEX($D$6:$D$29,MATCH(T${r},$A$6:$A$29,0))`]];
    s.getRange(`W${r}`).formulas = [[`=V${r}*INDEX($E$6:$E$29,MATCH(T${r},$A$6:$A$29,0))`]];
    s.getRange(`X${r}`).formulas = [[`=SUMIF($A$6:$A$29,T${r},$J$6:$J$29)`]];
    s.getRange(`Y${r}`).formulas = [[`=SUMIF($A$6:$A$29,T${r},$L$6:$L$29)`]];
    s.getRange(`Z${r}`).formulas = [[`=SUMIF($A$6:$A$29,T${r},$O$6:$O$29)`]];
    s.getRange(`AA${r}`).formulas = [[`=SUMIF($A$6:$A$29,T${r},$Q$6:$Q$29)`]];
    s.getRange(`AB${r}`).formulas = [[`=SUMIF($A$6:$A$29,T${r},$M$6:$M$29)`]];
  }
  s.getRange("T9:AB9").values = [["TOTAL", null, null, null, null, null, null, null, null]];
  s.getRange("U9").formulas = [["=SUM(U6:U8)"]];
  s.getRange("V9").formulas = [["=SUM(V6:V8)"]];
  s.getRange("W9").formulas = [["=SUM(W6:W8)"]];
  s.getRange("X9").formulas = [["=MAX(ABS(X6-1),ABS(X7-1),ABS(X8-1))"]];
  s.getRange("Y9").formulas = [["=SUM(Y6:Y8)"]];
  s.getRange("Z9").formulas = [["=SUM(Z6:Z8)"]];
  s.getRange("AA9").formulas = [["=SUM(AA6:AA8)"]];
  s.getRange("AB9").formulas = [["=SUM(AB6:AB8)"]];
  setBody(s, "T6:AB9");
  s.getRange("T9:AB9").format = { fill: COLORS.tealLight, font: { bold: true, color: COLORS.navy, size: 9 }, borders: { top: { style: "thin", color: COLORS.teal } } };
  s.getRange("U6:W9").format.numberFormat = FMT.count0;
  s.getRange("X6:X9").format.numberFormat = FMT.percent1;
  s.getRange("Y6:Z9").format.numberFormat = FMT.count0;
  s.getRange("AA6:AA9").format.numberFormat = FMT.currency0;
  s.getRange("AB6:AB9").format.numberFormat = FMT.count0;
  s.getRange("T11:AB12").merge(true);
  s.getRange("T11").values = [["Summary row 9: X9 reports the maximum segment workload-mix deviation from 100%; all other numeric cells are totals."]];
  s.getRange("T12").values = [["Base Monthly Volume includes workload mix. Month 12 Volume compounds the visible monthly growth input for 11 months."]];
  s.getRange("T11:AB12").format = { fill: COLORS.grayLight, font: { italic: true, color: COLORS.gray, size: 9 }, wrapText: true };
  s.getRange("T11:AB12").format.rowHeight = 27;
  setWidths(s, [["A:A", 15], ["B:B", 24], ["C:D", 13], ["E:E", 13], ["F:F", 18], ["G:G", 12], ["H:K", 13], ["L:M", 17], ["N:N", 14], ["O:O", 17], ["P:Q", 15], ["R:R", 15], ["S:S", 3], ["T:T", 15], ["U:X", 14], ["Y:Z", 18], ["AA:AA", 18], ["AB:AB", 17]]);
  s.showGridLines = false;
  s.freezePanes.freezeRows(5);
  s.freezePanes.freezeColumns(2);
}

// Scenarios
{
  const s = sheets.Scenarios;
  setTitle(s, "A1:M1", "Scenarios", "A2:M2", "Monthly low, base, and high economics. Volume scales demand; token and cost multipliers scale provider cost.");
  setSection(s, "A4:M4", "Monthly Scenario Economics");
  s.getRange("A5:M5").values = [[
    "Scenario", "Volume Multiplier", "Token Multiplier", "Cost Multiplier", "Monthly Actions", "Monthly Credits",
    "Monthly Provider Cost", "Usage Revenue", "Gross Profit", "Gross Margin", "Credits / Active Seat",
    "Credits / Customer", "GM vs Target"
  ]];
  setHeader(s, "A5:M5");
  for (let i = 0; i < 3; i++) {
    const r = 6 + i;
    const ar = 17 + i;
    s.getRange(`A${r}`).formulas = [[`='Assumptions'!A${ar}`]];
    s.getRange(`B${r}`).formulas = [[`='Assumptions'!B${ar}`]];
    s.getRange(`C${r}`).formulas = [[`='Assumptions'!C${ar}`]];
    s.getRange(`D${r}`).formulas = [[`='Assumptions'!D${ar}`]];
    s.getRange(`E${r}`).formulas = [[`=SUM('Customer Drivers'!$L$6:$L$29)*B${r}`]];
    s.getRange(`F${r}`).formulas = [[`=SUMPRODUCT('Customer Drivers'!$L$6:$L$29,'Customer Drivers'!$N$6:$N$29)*B${r}`]];
    s.getRange(`G${r}`).formulas = [[`=SUMPRODUCT('Customer Drivers'!$L$6:$L$29,'Customer Drivers'!$P$6:$P$29)*B${r}*C${r}*D${r}`]];
    s.getRange(`H${r}`).formulas = [[`=F${r}*'Assumptions'!$C$6`]];
    s.getRange(`I${r}`).formulas = [[`=H${r}-G${r}`]];
    s.getRange(`J${r}`).formulas = [[`=IF(H${r}=0,0,I${r}/H${r})`]];
    s.getRange(`K${r}`).formulas = [[`=IF('Customer Drivers'!$W$9=0,0,F${r}/'Customer Drivers'!$W$9)`]];
    s.getRange(`L${r}`).formulas = [[`=IF('Customer Drivers'!$U$9=0,0,F${r}/'Customer Drivers'!$U$9)`]];
    s.getRange(`M${r}`).formulas = [[`=J${r}-'Assumptions'!$C$7`]];
  }
  setBody(s, "A6:M8");
  setLinks(s, "A6:M8");
  s.getRange("B6:D8").format.numberFormat = FMT.percent1;
  s.getRange("E6:F8").format.numberFormat = FMT.count0;
  s.getRange("G6:I8").format.numberFormat = FMT.currency0;
  s.getRange("J6:J8").format.numberFormat = FMT.percent1;
  s.getRange("K6:L8").format.numberFormat = FMT.count1;
  s.getRange("M6:M8").format.numberFormat = FMT.percent1;
  s.getRange("A7:M7").format.fill = COLORS.tealLight;

  setSection(s, "A11:M11", "Interpretation");
  s.getRange("A12:M14").merge(true);
  s.getRange("A12:A14").values = [
    ["Monthly credits = SUMPRODUCT(base monthly volume, recommended credit weight) × volume multiplier."],
    ["Monthly provider cost = SUMPRODUCT(base monthly volume, unit cost) × volume multiplier × token multiplier × cost multiplier."],
    ["Usage revenue uses realized price per credit; gross margin excludes fixed platform fees and does not assume breakage."],
  ];
  s.getRange("A12:M14").format = { wrapText: true, font: { size: 9, color: COLORS.gray } };
  s.getRange("A12:M14").format.rowHeight = 25;
  setWidths(s, [["A:A", 14], ["B:D", 14], ["E:F", 17], ["G:I", 19], ["J:J", 14], ["K:L", 18], ["M:M", 14]]);
  s.showGridLines = false;
  s.freezePanes.freezeRows(5);
}

// Plan Design
{
  const s = sheets["Plan Design"];
  setTitle(s, "A1:S1", "Plan Design", "A2:S2", "Included credits are the segment base demand per customer plus the allocation buffer, rounded up to the nearest 100 credits.");
  setSection(s, "A4:S4", "Subscription Package Economics");
  s.getRange("A5:S5").values = [[
    "Plan", "Target Segment", "Fixed Platform Fee", "Base Credits / Customer", "Included Credits", "Plan Price",
    "Realized Price / Credit", "Expected Utilization", "High-Usage Utilization", "Expected Provider Cost", "High Provider Cost",
    "Effective Usage Price / Consumed Credit", "Plan GM at Expected Use", "High Revenue incl. Top-ups", "Plan GM at High Use",
    "Top-up Likelihood", "Unused Credit %", "Top-up Pack Credits", "Top-up Pack Price"
  ]];
  setHeader(s, "A5:S5");
  for (let i = 0; i < 3; i++) {
    const r = 6 + i;
    const ar = 13 + i;
    s.getRange(`A${r}`).formulas = [[`='Assumptions'!G${ar}`]];
    s.getRange(`B${r}`).formulas = [[`='Assumptions'!H${ar}`]];
    s.getRange(`C${r}`).formulas = [[`='Assumptions'!I${ar}`]];
    s.getRange(`D${r}`).formulas = [[`=INDEX('Customer Drivers'!$Z$6:$Z$8,MATCH(B${r},'Customer Drivers'!$T$6:$T$8,0))/INDEX('Customer Drivers'!$U$6:$U$8,MATCH(B${r},'Customer Drivers'!$T$6:$T$8,0))`]];
    s.getRange(`E${r}`).formulas = [[`=ROUNDUP(D${r}*(1+'Assumptions'!$C$11),-2)`]];
    s.getRange(`F${r}`).formulas = [[`=C${r}+E${r}*'Assumptions'!$C$6`]];
    s.getRange(`G${r}`).formulas = [[`=IF(E${r}=0,0,(F${r}-C${r})/E${r})`]];
    s.getRange(`H${r}`).formulas = [[`=IF(E${r}=0,0,D${r}/E${r})`]];
    s.getRange(`I${r}`).formulas = [[`=IF(E${r}=0,0,D${r}*'Assumptions'!$B$19/E${r})`]];
    s.getRange(`J${r}`).formulas = [[`=INDEX('Customer Drivers'!$AA$6:$AA$8,MATCH(B${r},'Customer Drivers'!$T$6:$T$8,0))/INDEX('Customer Drivers'!$U$6:$U$8,MATCH(B${r},'Customer Drivers'!$T$6:$T$8,0))`]];
    s.getRange(`K${r}`).formulas = [[`=J${r}*'Assumptions'!$B$19*'Assumptions'!$C$19*'Assumptions'!$D$19`]];
    s.getRange(`L${r}`).formulas = [[`=IF(D${r}=0,0,(F${r}-C${r})/D${r})`]];
    s.getRange(`M${r}`).formulas = [[`=IF(F${r}=0,0,(F${r}-J${r})/F${r})`]];
    s.getRange(`N${r}`).formulas = [[`=F${r}+MAX(0,D${r}*'Assumptions'!$B$19-E${r})*'Assumptions'!$C$13`]];
    s.getRange(`O${r}`).formulas = [[`=IF(N${r}=0,0,(N${r}-K${r})/N${r})`]];
    s.getRange(`P${r}`).formulas = [[`=IF(I${r}>1,"HIGH",IF(H${r}>'Assumptions'!$C$12,"MEDIUM","LOW"))`]];
    s.getRange(`Q${r}`).formulas = [[`=MAX(0,1-H${r})`]];
    s.getRange(`R${r}`).formulas = [[`='Assumptions'!J${ar}`]];
    s.getRange(`S${r}`).formulas = [[`=R${r}*'Assumptions'!$C$13`]];
  }
  setBody(s, "A6:S8");
  setLinks(s, "A6:S8");
  s.getRange("C6:C8").format.numberFormat = FMT.currency0;
  s.getRange("D6:E8").format.numberFormat = FMT.count0;
  s.getRange("F6:G8").format.numberFormat = FMT.currency2;
  s.getRange("H6:I8").format.numberFormat = FMT.percent1;
  s.getRange("J6:L8").format.numberFormat = FMT.currency2;
  s.getRange("M6:M8").format.numberFormat = FMT.percent1;
  s.getRange("N6:N8").format.numberFormat = FMT.currency2;
  s.getRange("O6:Q8").format.numberFormat = FMT.percent1;
  s.getRange("R6:R8").format.numberFormat = FMT.count0;
  s.getRange("S6:S8").format.numberFormat = FMT.currency2;
  s.getRange("P6:P8").conditionalFormats.add("containsText", { text: "HIGH", format: { fill: COLORS.failFill, font: { color: COLORS.failText, bold: true } } });
  s.getRange("P6:P8").conditionalFormats.add("containsText", { text: "MEDIUM", format: { fill: COLORS.warnFill, font: { color: COLORS.warnText, bold: true } } });
  s.getRange("P6:P8").conditionalFormats.add("containsText", { text: "LOW", format: { fill: COLORS.passFill, font: { color: COLORS.passText, bold: true } } });

  setSection(s, "A11:S11", "Plan Logic Notes");
  s.getRange("A12:S15").merge(true);
  s.getRange("A12:A15").values = [
    ["Realized price per credit = (plan price − fixed platform fee) / included credits."],
    ["Expected utilization uses base segment credits/customer; high utilization applies the high scenario volume multiplier."],
    ["High-use revenue includes top-up credits at the top-up price per credit; high provider cost also applies token and cost multipliers."],
    ["Unused credits are disclosed. They are not used to offset weak action-level economics or feasibility failures."],
  ];
  s.getRange("A12:S15").format = { wrapText: true, font: { size: 9, color: COLORS.gray } };
  s.getRange("A12:S15").format.rowHeight = 25;
  setWidths(s, [["A:A", 13], ["B:B", 16], ["C:C", 16], ["D:E", 17], ["F:G", 16], ["H:I", 16], ["J:K", 18], ["L:L", 22], ["M:O", 18], ["P:P", 17], ["Q:Q", 15], ["R:S", 17]]);
  s.showGridLines = false;
  s.freezePanes.freezeRows(5);
  s.freezePanes.freezeColumns(2);
}

// Calibration
{
  const s = sheets.Calibration;
  setTitle(s, "A1:P1", "Calibration", "A2:P2", "Paste production actuals into yellow cells. Estimated usage and costs link to the current base model; variance and recalibrated cost-floor credits update automatically.");
  setSection(s, "A4:P4", "Estimated vs. Actual Production Usage and Cost");
  s.getRange("A5:P5").values = [[
    "Metric", "Estimated Monthly Actions", "Actual Monthly Actions", "Action Variance", "Action Variance %",
    "Estimated Unit Cost", "Actual Provider Cost", "Actual Unit Cost", "Unit Cost Variance %",
    "Estimated Total Cost", "Total Cost Variance", "Current Credit Weight", "Recalibrated Min Cost Credits",
    "Calibration Status", "Actual Avg Input Tokens", "Actual Avg Output Tokens"
  ]];
  setHeader(s, "A5:P5");
  s.getRange("A6:A13").values = metricNames.map((m) => [m]);
  for (let r = 6; r <= 13; r++) {
    s.getRange(`B${r}`).formulas = [[`=SUMIF('Customer Drivers'!$B$6:$B$29,A${r},'Customer Drivers'!$L$6:$L$29)`]];
    s.getRange(`D${r}`).formulas = [[`=IF(C${r}=0,"",C${r}-B${r})`]];
    s.getRange(`E${r}`).formulas = [[`=IF(C${r}=0,"",D${r}/B${r})`]];
    s.getRange(`F${r}`).formulas = [[`=INDEX('Metric Weights'!$H$6:$H$13,MATCH(A${r},'Metric Weights'!$A$6:$A$13,0))`]];
    s.getRange(`H${r}`).formulas = [[`=IF(C${r}=0,"",G${r}/C${r})`]];
    s.getRange(`I${r}`).formulas = [[`=IF(H${r}="","",H${r}/F${r}-1)`]];
    s.getRange(`J${r}`).formulas = [[`=B${r}*F${r}`]];
    s.getRange(`K${r}`).formulas = [[`=IF(G${r}=0,"",G${r}-J${r})`]];
    s.getRange(`L${r}`).formulas = [[`=INDEX('Metric Weights'!$M$6:$M$13,MATCH(A${r},'Metric Weights'!$A$6:$A$13,0))`]];
    s.getRange(`M${r}`).formulas = [[`=IF(H${r}="","",CEILING(H${r}/('Assumptions'!$C$6*(1-'Assumptions'!$C$7)),'Assumptions'!$C$10))`]];
    s.getRange(`N${r}`).formulas = [[`=IF(OR(C${r}=0,G${r}=0),"AWAITING DATA",IF(M${r}>L${r},"REVIEW WEIGHT","CALIBRATED"))`]];
  }
  setBody(s, "A6:P13");
  for (const range of ["C6:C13", "G6:G13", "O6:P13"]) setInputs(s, range);
  setLinks(s, "B6:B13");
  setLinks(s, "F6:F13");
  setLinks(s, "L6:M13");
  s.getRange("B6:D13").format.numberFormat = FMT.count0;
  s.getRange("E6:E13").format.numberFormat = FMT.percent1;
  s.getRange("F6:H13").format.numberFormat = FMT.currency4;
  s.getRange("I6:I13").format.numberFormat = FMT.percent1;
  s.getRange("J6:K13").format.numberFormat = FMT.currency0;
  s.getRange("L6:M13").format.numberFormat = FMT.count0;
  s.getRange("O6:P13").format.numberFormat = FMT.count0;
  s.getRange("N6:N13").conditionalFormats.add("containsText", { text: "CALIBRATED", format: { fill: COLORS.passFill, font: { color: COLORS.passText, bold: true } } });
  s.getRange("N6:N13").conditionalFormats.add("containsText", { text: "REVIEW", format: { fill: COLORS.failFill, font: { color: COLORS.failText, bold: true } } });
  s.getRange("N6:N13").conditionalFormats.add("containsText", { text: "AWAITING", format: { fill: COLORS.warnFill, font: { color: COLORS.warnText, bold: true } } });

  setSection(s, "A16:F16", "Calibration Coverage");
  s.getRange("A17:B20").values = [
    ["Metrics with actual usage", null],
    ["Coverage", null],
    ["Estimated total provider cost", null],
    ["Actual provider cost supplied", null],
  ];
  s.getRange("B17").formulas = [["=COUNT(C6:C13)"]];
  s.getRange("B18").formulas = [["=B17/COUNTA(A6:A13)"]];
  s.getRange("B19").formulas = [["=SUM(J6:J13)"]];
  s.getRange("B20").formulas = [["=SUM(G6:G13)"]];
  setBody(s, "A17:B20");
  s.getRange("A17:A20").format.font = { bold: true, color: COLORS.gray, size: 9 };
  s.getRange("B17").format.numberFormat = FMT.count0;
  s.getRange("B18").format.numberFormat = FMT.percent1;
  s.getRange("B19:B20").format.numberFormat = FMT.currency0;

  s.getRange("H16:P20").merge(true);
  s.getRange("H16").values = [["Production data mapping: actual actions should come from completed event counts; actual provider cost should come from model-cost records. Token averages are optional diagnostics. A zero or blank actual is treated as missing data, not as evidence of zero cost."]];
  s.getRange("H16:P20").format = { fill: COLORS.grayLight, font: { color: COLORS.gray, italic: true, size: 9 }, wrapText: true, verticalAlignment: "center" };
  setWidths(s, [["A:A", 25], ["B:D", 17], ["E:E", 15], ["F:H", 17], ["I:I", 16], ["J:K", 18], ["L:M", 18], ["N:N", 19], ["O:P", 18]]);
  s.showGridLines = false;
  s.freezePanes.freezeRows(5);
  s.freezePanes.freezeColumns(1);
}

// Add compact assumption/formula comments for auditability.
try {
  wb.comments.setSelf({ displayName: "User" });
  const assumptionComments = [
    [sheets.Assumptions, "C6", "User specification: realized price per credit = $0.01. Use this net of fixed platform fees."],
    [sheets.Assumptions, "C7", "User specification: target gross margin = 70%."],
    [sheets.Assumptions, "C8", "User specification: target value capture = 5%."],
    [sheets.Assumptions, "C9", "User specification: maximum value capture = 10%."],
    [sheets.Assumptions, "C10", "User specification: credit rounding increment = 1."],
    [sheets.Assumptions, "C11", "User specification: allocation buffer = 20%."],
    [sheets["Metric Weights"], "M7", "Worked example: MAX(7 minimum cost credits, 20 value-supported credits) = 20 recommended credits."],
    [sheets.Scenarios, "F7", "Base monthly credits use SUMPRODUCT of customer-driver volume and recommended action credit weights."],
  ];
  for (const [sheet, cell, text] of assumptionComments) {
    wb.comments.addThread({ cell: sheet.getRange(cell) }, text);
  }
} catch (error) {
  console.warn(`Comment creation warning: ${error.message}`);
}

// Export once formulas and formats are in place.
const exported = await SpreadsheetFile.exportXlsx(wb);
await exported.save(outputPath);

// Compact verification outputs.
const inspections = {};
for (const [name, range] of [
  ["README", "A1:H41"],
  ["Metric Weights", "A5:P13"],
  ["Customer Drivers", "T5:AB9"],
  ["Scenarios", "A5:M8"],
  ["Plan Design", "A5:S8"],
  ["Calibration", "A5:N13"],
]) {
  const result = await wb.inspect({ kind: "table", range: `'${name}'!${range}`, include: "values,formulas", tableMaxRows: 45, tableMaxCols: 20, maxChars: 10000 });
  inspections[name] = result.ndjson;
}
const formulaErrors = await wb.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});

for (const name of sheetNames) {
  const preview = await wb.render({ sheetName: name, autoCrop: "all", scale: 1, format: "png" });
  const safe = name.toLowerCase().replaceAll(" ", "_");
  await fs.writeFile(path.join(previewDir, `${safe}.png`), new Uint8Array(await preview.arrayBuffer()));
}

await fs.writeFile(path.join(previewDir, "verification.json"), JSON.stringify({ outputPath, inspections, formulaErrors: formulaErrors.ndjson }, null, 2));
console.log(JSON.stringify({ outputPath, previewDir, inspections, formulaErrors: formulaErrors.ndjson }, null, 2));
