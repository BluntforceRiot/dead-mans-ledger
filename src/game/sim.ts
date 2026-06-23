import { prepActions, hazards, hazardTagFallbacks, shipments, type Hazard, type HazardId, type PrepActionId, type Shipment } from '../data/gameContent';
import { nodes, type NodeId } from '../data/nodes';
import { routes, routesById, type LedgerRoute, type RouteId } from '../data/routes';

export const LEGS_PER_JOURNEY = 6;
export const BORROW_AMOUNT = 400;

export type IntelSource = 'scout' | 'telegraph' | 'tip';
export type IntelQuality = 'true' | 'partial' | 'false' | 'rumor';

export interface RouteState {
  routeId: RouteId;
  active: boolean;
  hazardId: HazardId;
  revealed: boolean;
  assigned: PrepActionId[];
  intelSource?: IntelSource;
  intelQuality?: IntelQuality;
  intelHazardId?: HazardId;
  intelText?: string;
}

export interface LedgerState {
  screen: ScreenId;
  currentNodeId: NodeId;
  cash: number;
  score: number;
  reputation: number;
  trust: number;
  outlawPressure: number;
  interestRate: number;
  borrowedCredit: number;
  interestPaid: number;
  journey: number;
  deliveryInJourney: number;
  shipment: Shipment;
  seed: number;
  routeStates: Record<RouteId, RouteState>;
  selectedRouteId?: RouteId;
  selectedActionId?: PrepActionId;
  dispatchingRouteId?: RouteId;
  lastResult?: DispatchResult;
  firedReason?: string;
  resetConfirmUntil?: number;
}

export type ScreenId = 'title' | 'howto' | 'preview' | 'game' | 'fired' | 'scores';

export interface DispatchResult {
  route: LedgerRoute;
  hazard: Hazard;
  countered: boolean;
  success: boolean;
  assigned: PrepActionId[];
  helpfulPrep: PrepActionId[];
  failedPrep: PrepActionId[];
  payout: number;
  scoreDelta: number;
  cashDelta: number;
  cashAfter: number;
  interestCharge: number;
  reputationDelta: number;
  trustDelta: number;
  pressureDelta: number;
  message: string;
  detail: string;
  nextNodeId: NodeId;
  journeyComplete: boolean;
  firedReason?: string;
}

export const debtLimit = -500;

function random(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function choose<T>(items: readonly T[], next: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(next() * items.length))];
}

function seededFromNow() {
  return (Date.now() ^ Math.floor(Math.random() * 1_000_000)) >>> 0;
}

export function createInitialState(screen: ScreenId = 'title'): LedgerState {
  const seed = seededFromNow();
  return {
    screen,
    currentNodeId: 'seattle',
    cash: 1200,
    score: 0,
    reputation: 72,
    trust: 74,
    outlawPressure: 20,
    interestRate: 6,
    borrowedCredit: 0,
    interestPaid: 0,
    journey: 1,
    deliveryInJourney: 1,
    shipment: shipments[0],
    seed,
    routeStates: generateRouteStates(seed, 1, 'seattle')
  };
}

export function startNewRun(): LedgerState {
  return createInitialState('game');
}

export function generateRouteStates(seed: number, journey: number, currentNodeId: NodeId): Record<RouteId, RouteState> {
  const next = random(seed + journey * 7919);
  const hazardChance = Math.min(0.5, 0.3 + journey * 0.025);
  const routeStates = Object.fromEntries(
    routes.map((route) => {
      const activeRoll = next();
      let active =
        route.availability === 'core'
          ? activeRoll < 0.92
          : route.availability === 'swing'
            ? activeRoll < 0.7
            : activeRoll < 0.46;

      if (route.from === currentNodeId || route.to === currentNodeId) {
        active = active || next() < 0.82;
      }

      const hasHazard = active && next() < Math.min(0.68, hazardChance + route.baseRisk * 0.38);
      return [
        route.id,
        {
          routeId: route.id,
          active,
          hazardId: hasHazard ? pickHazard(route, next).id : 'clean',
          revealed: false,
          assigned: []
        }
      ];
    })
  ) as Record<RouteId, RouteState>;

  const adjacentActive = getAdjacentRoutes(currentNodeId).filter((route) => routeStates[route.id].active);
  if (adjacentActive.length === 0) {
    getAdjacentRoutes(currentNodeId)
      .slice(0, 3)
      .forEach((route) => {
        routeStates[route.id].active = true;
      });
  }

  return routeStates;
}

export function getAdjacentRoutes(nodeId: NodeId, onlyActive?: Record<RouteId, RouteState>) {
  return routes.filter((route) => {
    if (route.from !== nodeId && route.to !== nodeId) {
      return false;
    }
    return onlyActive ? onlyActive[route.id]?.active : true;
  });
}

export function otherEnd(route: LedgerRoute, nodeId: NodeId): NodeId {
  return route.from === nodeId ? route.to : route.from;
}

export function pickHazard(route: LedgerRoute, next: () => number): Hazard {
  const possibleHazardIds = route.tags.flatMap((tag) => hazardTagFallbacks[tag] ?? []);
  const unique = [...new Set(possibleHazardIds)];
  const pickedId = unique.length > 0 ? choose(unique, next) : 'ambush';
  return hazards.find((hazard) => hazard.id === pickedId) ?? hazards[0];
}

export function hazardById(id: HazardId) {
  return hazards.find((hazard) => hazard.id === id) ?? hazards[hazards.length - 1];
}

export function actionById(id: PrepActionId) {
  return prepActions.find((action) => action.id === id) ?? prepActions[0];
}

export function applyPrepAction(state: LedgerState, routeId: RouteId, actionId: PrepActionId): LedgerState {
  const action = actionById(actionId);
  if (!state.routeStates[routeId]?.active) {
    return state;
  }
  if (state.routeStates[routeId].assigned.includes(actionId)) {
    return state;
  }
  if (actionId === 'borrow') {
    const routeState = state.routeStates[routeId];
    return {
      ...state,
      cash: state.cash + BORROW_AMOUNT,
      borrowedCredit: state.borrowedCredit + BORROW_AMOUNT,
      interestRate: Math.min(18, state.interestRate + 1.2),
      trust: Math.max(0, state.trust - 2),
      routeStates: {
        ...state.routeStates,
        [routeId]: {
          ...routeState,
          assigned: [...routeState.assigned, actionId]
        }
      },
      selectedActionId: undefined
    };
  }
  if (state.cash < action.cost) {
    return state;
  }

  const intel = buildIntelForAction(state, routeId, actionId);
  return {
    ...state,
    cash: state.cash - action.cost,
    routeStates: {
      ...state.routeStates,
      [routeId]: {
        ...state.routeStates[routeId],
        assigned: [...state.routeStates[routeId].assigned, actionId],
        revealed: state.routeStates[routeId].revealed || Boolean(intel),
        ...intel
      }
    },
    selectedActionId: undefined,
    selectedRouteId: routeId
  };
}

export function resolveDispatch(state: LedgerState, routeId: RouteId): LedgerState {
  const route = routesById[routeId];
  const routeState = state.routeStates[routeId];
  const hazard = hazardById(routeState.hazardId);
  const nextNodeId = otherEnd(route, state.currentNodeId);
  const assignments = routeState.assigned;
  const helpfulPrep = assignments.filter((actionId) => hazard.counters.includes(actionId));
  const failedPrep = assignments.filter((actionId) => !hazard.counters.includes(actionId) && actionId !== 'insurance' && actionId !== 'borrow' && actionId !== 'tip');
  const countered = hazard.id === 'clean' || helpfulPrep.length > 0;
  const insured = assignments.includes('insurance');
  const basePayout = Math.round(state.shipment.value * route.payoutMultiplier * (1 + state.journey * 0.045));
  const expressBonus = route.express ? Math.round(basePayout * 0.22) : 0;
  const riskBonus = Math.round(basePayout * route.baseRisk);
  const counterBonus = countered && hazard.id !== 'clean' ? 260 + state.journey * 35 : 0;
  const budgetBonus = Math.max(0, Math.round(state.cash * 0.015));
  const trustStreakBonus = state.trust >= 75 ? 160 : 0;
  const journeyBonus = 90 * state.journey;

  let success = countered;
  if (!countered && hazard.severity < 0.2 && state.reputation > 65) {
    success = true;
  }

  let cashDelta = 0;
  let scoreDelta = 0;
  let reputationDelta = 0;
  let trustDelta = 0;
  let message = '';
  let detail = '';

  if (success) {
    const deliveredValue = basePayout + expressBonus;
    cashDelta += deliveredValue;
    scoreDelta += deliveredValue + riskBonus + counterBonus + budgetBonus + trustStreakBonus + journeyBonus;
    reputationDelta += countered && hazard.id !== 'clean' ? 5 : 2;
    trustDelta += Math.round(2 + state.shipment.trustWeight * 3);
    message = hazard.id === 'clean' ? 'Clean Passage' : countered ? 'Counter Worked' : 'Narrow Delivery';
    detail =
      hazard.id === 'clean'
        ? 'The engine kept turning. No one fired a shot, and the notes arrived on time.'
        : countered
          ? `${hazard.name} hit the line, but your preparation held. The board loves a risk that pays.`
          : `${hazard.name} nearly ruined the route, but reputation carried the shipment through.`;
  } else {
    const loss = Math.round(state.shipment.value * (insured ? 0.28 : 0.62) + route.baseRisk * 260);
    cashDelta -= loss;
    scoreDelta -= Math.round(loss * 0.45);
    reputationDelta -= insured ? 8 : 16;
    trustDelta -= Math.round((insured ? 8 : 18) * state.shipment.trustWeight);
    message = insured ? 'Insurance Saved the Ledger' : 'Shipment Failed';
    detail = insured
      ? `${hazard.name} tore into the route. Insurance softened the cash loss, but trust still fell.`
      : `${hazard.name} broke the line. Merchants saw paper fail in public.`;
  }

  const interestCharge = Math.round(state.interestRate * 12 + state.borrowedCredit * 0.018);
  const cashAfterInterest = Math.round(state.cash + cashDelta - interestCharge);
  const journeyComplete = state.deliveryInJourney >= LEGS_PER_JOURNEY;
  const nextJourney = journeyComplete ? state.journey + 1 : state.journey;
  const nextDeliveryInJourney = journeyComplete ? 1 : state.deliveryInJourney + 1;
  const nextSeed = (state.seed + nextJourney * 104729 + nextDeliveryInJourney * 53 + Math.floor(basePayout * 13)) >>> 0;
  const newCash = cashAfterInterest;
  const newReputation = Math.max(0, Math.min(100, state.reputation + reputationDelta));
  const newTrust = Math.max(0, Math.min(100, state.trust + trustDelta));
  const pressureDelta = 2 + (success ? 1 : 5) + (journeyComplete ? 3 : 0);
  const firedReason = newCash < debtLimit ? 'Cash fell below the board debt limit.' : newReputation <= 0 ? 'Reputation reached zero.' : newTrust <= 0 ? 'Currency trust reached zero.' : undefined;

  const result: DispatchResult = {
    route,
    hazard,
    countered,
    success,
    assigned: assignments,
    helpfulPrep,
    failedPrep,
    payout: success ? basePayout + expressBonus : 0,
    scoreDelta,
    cashDelta: cashDelta - interestCharge,
    cashAfter: newCash,
    interestCharge,
    reputationDelta,
    trustDelta,
    pressureDelta,
    message,
    detail,
    nextNodeId,
    journeyComplete,
    firedReason
  };

  return {
    ...state,
    currentNodeId: nextNodeId,
    cash: newCash,
    score: Math.max(0, state.score + scoreDelta),
    reputation: newReputation,
    trust: newTrust,
    outlawPressure: Math.min(95, state.outlawPressure + pressureDelta),
    interestRate: Math.min(18, state.interestRate + 0.25 + (state.cash < 300 ? 0.5 : 0) + (journeyComplete ? 0.35 : 0)),
    borrowedCredit: Math.max(0, Math.round(state.borrowedCredit * (journeyComplete ? 0.82 : 0.94))),
    interestPaid: state.interestPaid + interestCharge,
    journey: nextJourney,
    deliveryInJourney: nextDeliveryInJourney,
    shipment: shipments[(nextJourney + nextDeliveryInJourney) % shipments.length],
    seed: nextSeed,
    routeStates: generateRouteStates(nextSeed, nextJourney + nextDeliveryInJourney, nextNodeId),
    selectedRouteId: undefined,
    selectedActionId: undefined,
    dispatchingRouteId: undefined,
    lastResult: result,
    firedReason
  };
}

export function canDispatch(state: LedgerState) {
  const route = state.selectedRouteId ? routesById[state.selectedRouteId] : undefined;
  return Boolean(
    route &&
      state.routeStates[route.id].active &&
      (route.from === state.currentNodeId || route.to === state.currentNodeId) &&
      !state.dispatchingRouteId
  );
}

export function meterClass(value: number) {
  if (value >= 70) {
    return 'good';
  }
  if (value >= 35) {
    return 'warn';
  }
  return 'danger';
}

export function findNodeName(nodeId: NodeId) {
  return nodes.find((node) => node.id === nodeId)?.name ?? nodeId;
}

export function describeIntel(routeState: RouteState) {
  if (!routeState.revealed) {
    return 'Unknown';
  }
  return routeState.intelText ?? hazardById(routeState.hazardId).name;
}

function buildIntelForAction(state: LedgerState, routeId: RouteId, actionId: PrepActionId): Partial<RouteState> | undefined {
  const routeState = state.routeStates[routeId];
  const hazard = hazardById(routeState.hazardId);

  if (actionId === 'scout') {
    const physical = new Set<HazardId>(['ambush', 'track-cut', 'washed-bridge', 'repair-ambush', 'scout-missing']);
    const found = hazard.id === 'clean' || physical.has(hazard.id);
    return {
      intelSource: 'scout',
      intelQuality: found ? 'true' : 'partial',
      intelHazardId: found ? hazard.id : undefined,
      intelText: found ? `Scout: ${hazard.name}.` : 'Scout: physical clear; official unknown.'
    };
  }

  if (actionId === 'telegraph') {
    const official = new Set<HazardId>(['bad-weather', 'inside-leak', 'rival-sabotage', 'telegraph-cut', 'false-tip']);
    const found = hazard.id === 'clean' || official.has(hazard.id);
    return {
      intelSource: 'telegraph',
      intelQuality: found ? 'true' : 'partial',
      intelHazardId: found ? hazard.id : undefined,
      intelText: found ? `Wire: ${hazard.name}.` : 'Wire: official clear; physical unknown.'
    };
  }

  if (actionId === 'tip') {
    const roll = deterministicRoll(`${state.seed}:${state.journey}:${state.deliveryInJourney}:${routeId}:tip`);
    if (roll < 0.32) {
      return {
        intelSource: 'tip',
        intelQuality: 'true',
        intelHazardId: hazard.id,
        intelText: `Tip: maybe ${hazard.name}.`
      };
    }
    if (roll < 0.68) {
      const wrong = hazards.find((item) => item.id !== hazard.id && item.id !== 'clean') ?? hazards[0];
      return {
        intelSource: 'tip',
        intelQuality: 'false',
        intelHazardId: wrong.id,
        intelText: `Tip: maybe ${wrong.name}.`
      };
    }
    return {
      intelSource: 'tip',
      intelQuality: 'rumor',
      intelText: 'Tip: rumor only.'
    };
  }

  return undefined;
}

function deterministicRoll(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0x100000000;
}
