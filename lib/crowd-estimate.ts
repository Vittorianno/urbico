// Estimativa de lotação: função pura, barata e explicável (sem banco, sem rede).
//
// Como funciona:
//  1. Considera relatos da janela recente (ESTIMATE_WINDOW_MINUTES).
//  2. Descarta relatos de outro sentido (quando ambos o conhecem).
//  3. Cada pessoa conta uma vez (o relato mais recente de cada reporterKey);
//     relatos sem reporterKey (legado/Norby) entram com confiança reduzida.
//  4. Peso = decaimento exponencial por idade (meia-vida HALF_LIFE_MINUTES)
//     x fatores de confiança (viagem ativa, mesmo veículo, mesmo sentido).
//  5. Nível = média ponderada arredondada. CHECK_INS ativos NÃO inventam um
//     nível: só aumentam a confiança.
//  6. Confiança = volume (50%) + concordância (25%) + recência (15%)
//     + bônus de CHECK_INS (até 0,2) + bônus de veículo identificado (0,1).
import { CROWD_LEVELS, CROWD_LEVEL_CODES, type CrowdLevel } from "./trip-rules";

export const ESTIMATE_WINDOW_MINUTES = 45;
export const HALF_LIFE_MINUTES = 12;

export type EstimateReport = {
  level: CrowdLevel;
  createdAt: Date;
  reporterKey: string | null;
  tripId: number | null;
  direction: number | null;
  vehiclePrefix: string | null;
};

export type EstimateInput = {
  reports: EstimateReport[];
  now: Date;
  activeCheckIns: number;
  direction?: number | null;
  vehiclePrefix?: string | null;
};

export type Confidence = "HIGH" | "MEDIUM" | "LOW" | "NONE";

export type CrowdEstimate = {
  level: CrowdLevel | null;
  code: (typeof CROWD_LEVEL_CODES)[CrowdLevel] | null;
  levelIndex: number;
  score: number | null;
  confidence: Confidence;
  confidenceScore: number;
  reportCount: number;
  effectiveReports: number;
  activeCheckIns: number;
  windowMinutes: number;
  reasons: string[];
};

const round2 = (value: number) => Math.round(value * 100) / 100;

export function estimateCrowd(input: EstimateInput): CrowdEstimate {
  const { now, activeCheckIns } = input;
  const windowMs = ESTIMATE_WINDOW_MINUTES * 60 * 1000;
  const base = { activeCheckIns, windowMinutes: ESTIMATE_WINDOW_MINUTES };

  const latestByReporter = new Map<string, EstimateReport>();
  const keyless: EstimateReport[] = [];
  for (const report of input.reports) {
    const age = now.getTime() - report.createdAt.getTime();
    if (age > windowMs) continue;
    if (input.direction != null && report.direction != null && report.direction !== input.direction) continue;
    if (report.reporterKey === null) {
      keyless.push(report);
      continue;
    }
    const current = latestByReporter.get(report.reporterKey);
    if (!current || report.createdAt.getTime() > current.createdAt.getTime()) latestByReporter.set(report.reporterKey, report);
  }
  const considered = [...latestByReporter.values(), ...keyless];

  if (considered.length === 0) {
    return {
      ...base,
      level: null,
      code: null,
      levelIndex: -1,
      score: null,
      confidence: "NONE",
      confidenceScore: 0,
      reportCount: 0,
      effectiveReports: 0,
      reasons: ["Sem relatos recentes para esta linha."],
    };
  }

  let totalWeight = 0;
  let weightedSum = 0;
  let freshnessSum = 0;
  let vehicleMatched = false;
  const weighted = considered.map((report) => {
    const ageMinutes = Math.max(0, now.getTime() - report.createdAt.getTime()) / 60000;
    const freshness = 0.5 ** (ageMinutes / HALF_LIFE_MINUTES);
    let weight = freshness;
    if (report.reporterKey === null) weight *= 0.5;
    if (report.tripId !== null) weight *= 1.3;
    if (input.direction != null && report.direction === input.direction) weight *= 1.2;
    if (input.vehiclePrefix && report.vehiclePrefix) {
      if (report.vehiclePrefix === input.vehiclePrefix) {
        weight *= 1.5;
        vehicleMatched = true;
      } else {
        weight *= 0.6;
      }
    }
    const index = CROWD_LEVELS.indexOf(report.level);
    totalWeight += weight;
    weightedSum += weight * index;
    freshnessSum += freshness;
    return { weight, index };
  });

  const score = weightedSum / totalWeight;
  const levelIndex = Math.min(CROWD_LEVELS.length - 1, Math.max(0, Math.round(score)));
  const variance = weighted.reduce((sum, item) => sum + item.weight * (item.index - score) ** 2, 0) / totalWeight;
  const spread = Math.sqrt(variance);

  const count = considered.length;
  const volume = Math.min(1, totalWeight / 4);
  const agreement = count >= 2 ? Math.max(0, 1 - spread / 2) : 0.5;
  const recency = freshnessSum / count;
  const checkInBoost = Math.min(0.2, 0.05 * activeCheckIns);
  const vehicleBoost = vehicleMatched ? 0.1 : 0;
  const confidenceScore = Math.min(1, 0.5 * volume + 0.25 * agreement + 0.15 * recency + checkInBoost + vehicleBoost);
  const confidence: Confidence = confidenceScore >= 0.7 ? "HIGH" : confidenceScore >= 0.45 ? "MEDIUM" : "LOW";

  const reasons = [`${count} ${count === 1 ? "relato recente" : "relatos recentes"}`];
  if (activeCheckIns > 0) reasons.push(`${activeCheckIns} ${activeCheckIns === 1 ? "passageiro a bordo" : "passageiros a bordo"}`);
  if (count >= 2 && agreement < 0.5) reasons.push("relatos divergentes");
  if (vehicleMatched) reasons.push("veículo identificado");
  if (recency < 0.5) reasons.push("relatos mais antigos pesam menos");

  return {
    ...base,
    level: CROWD_LEVELS[levelIndex],
    code: CROWD_LEVEL_CODES[CROWD_LEVELS[levelIndex]],
    levelIndex,
    score: round2(score),
    confidence,
    confidenceScore: round2(confidenceScore),
    reportCount: count,
    effectiveReports: round2(totalWeight),
    reasons,
  };
}
