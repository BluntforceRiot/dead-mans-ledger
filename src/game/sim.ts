import { prepActions, hazards, hazardTagFallbacks, shipments, type Hazard, type HazardId, type PrepActionId, type Shipment } from '../data/gameContent';
import { nodes, type NodeId } from '../data/nodes';
import { routes, routesById, type LedgerRoute, type RouteId } from '../data/routes';

export { nodes, routes, routesById };

export const BORROW_AMOUNT = 350;
export const debtLimit = -500;

export type ScreenId = 'title' | 'office' | 'howto' | 'preview' | 'about' | 'game' | 'fired' | 'scores';
export type IntelSource = 'scout' | 'telegraph' | 'tip';
export type IntelQuality = 'true' | 'partial' | 'false' | 'rumor' | 'bait';
export type OfficeId = 'new-york' | 'st-louis' | 'new-orleans' | 'san-francisco';
export type MapMode = 'focus' | 'full';
export type LocalRumorOutcome = 'useful' | 'incomplete' | 'false';

export interface DispatchOffice {
  id: OfficeId;
  name: string;
  nodeId: NodeId;
  bonus: string;
  cashBonus: number;
  reputationBonus: number;
  trustBonus: number;
  pressureBonus: number;
  rateBonus: number;
}

export interface IntelReport {
  source: IntelSource;
  quality: IntelQuality;
  hazardId?: HazardId;
  confidence: number;
  text: string;
}

export interface StationRumor {
  available: boolean;
  used: boolean;
  notice: string;
  reliability: number;
  quality: IntelQuality;
  suggestedHazardId?: HazardId;
}

export interface RouteState {
  routeId: RouteId;
  active: boolean;
  hazardId: HazardId;
  hazardIds: HazardId[];
  hazardsGenerated: boolean;
  activatedInitially: boolean;
  activatedForDestination: boolean;
  activatedForAdjacency: boolean;
  tutorialProtected: boolean;
  revealed: boolean;
  assigned: PrepActionId[];
  intelReports: IntelReport[];
  closedReason?: string;
}

export interface Contract {
  id: string;
  origin: NodeId;
  destination: NodeId;
  cargoName: string;
  cargoType: string;
  cargoValue: number;
  deliveryFee: number;
  trustWeight: number;
  urgency: string;
  legLimit: number;
  legsRemaining: number;
  plannedHops: number;
  routeRiskBonus: number;
  copy: string;
}

export interface LedgerState {
  screen: ScreenId;
  currentNodeId: NodeId;
  previousNodeId?: NodeId;
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
  contract: Contract;
  officeId: OfficeId;
  seed: number;
  routeStates: Record<RouteId, RouteState>;
  segmentHistory: Record<string, number>;
  creditBorrowedThisLeg: boolean;
  stationRumor: StationRumor;
  mapMode: MapMode;
  selectedRouteId?: RouteId;
  selectedActionId?: PrepActionId;
  dispatchingRouteId?: RouteId;
  routeNotice?: string;
  lastResult?: DispatchResult;
  firedReason?: string;
  resetConfirmUntil?: number;
}

export interface IncidentResolution {
  hazard: Hazard;
  success: boolean;
  counterAttempted: PrepActionId[];
  counterWorked: boolean;
  roll: number;
  chance: number;
  detail: string;
}

export interface DispatchResult {
  route: LedgerRoute;
  fromNodeId: NodeId;
  contract: Contract;
  incidents: IncidentResolution[];
  hazard: Hazard;
  countered: boolean;
  success: boolean;
  assigned: PrepActionId[];
  prepUsed: PrepActionId[];
  mitigationApplied: PrepActionId[];
  prepNotNeeded: PrepActionId[];
  helpfulPrep: PrepActionId[];
  failedPrep: PrepActionId[];
  countersAttempted: PrepActionId[];
  countersSucceeded: PrepActionId[];
  countersFailed: PrepActionId[];
  protectionHeld: PrepActionId[];
  intelGathered: IntelReport[];
  localRumorOutcome?: LocalRumorOutcome;
  debtUsed: number;
  payout: number;
  scoreDelta: number;
  cashDelta: number;
  cashAfter: number;
  grossFee: number;
  netFee: number;
  interestCharge: number;
  principalRepaid: number;
  reputationDelta: number;
  trustDelta: number;
  pressureDelta: number;
  deadheadRun: boolean;
  deadheadPenalty: number;
  message: string;
  detail: string;
  nextNodeId: NodeId;
  arrivedAtDestination: boolean;
  contractEnded: boolean;
  journeyComplete: boolean;
  backtrackPenalty: boolean;
  firedReason?: string;
}

export function dispatchResultStatusLabel(result: DispatchResult) {
  if (result.arrivedAtDestination) {
    return 'DELIVERED';
  }
  if (!result.success) {
    return 'SHIPMENT DISRUPTED';
  }
  if (result.contractEnded) {
    return 'CONTRACT EXPIRED';
  }
  if (result.countered) {
    return 'COUNTER WORKED';
  }
  if (result.hazard.id === 'clean') {
    return 'CLEAN PASSAGE';
  }
  return 'IN TRANSIT';
}

export const dispatchOffices: DispatchOffice[] = [
  {
    id: 'new-york',
    name: 'New York Financial Hub',
    nodeId: 'new-york',
    bonus: '+$180 cash, +4 trust, lower starting rate.',
    cashBonus: 180,
    reputationBonus: 0,
    trustBonus: 4,
    pressureBonus: 0,
    rateBonus: -0.6
  },
  {
    id: 'st-louis',
    name: 'St. Louis Gateway',
    nodeId: 'st-louis',
    bonus: '+3 reputation and lower outlaw pressure.',
    cashBonus: 80,
    reputationBonus: 3,
    trustBonus: 0,
    pressureBonus: -5,
    rateBonus: 0
  },
  {
    id: 'new-orleans',
    name: 'New Orleans Gulf Office',
    nodeId: 'new-orleans',
    bonus: '+$120 cash, +2 trust, softer pressure.',
    cashBonus: 120,
    reputationBonus: 0,
    trustBonus: 2,
    pressureBonus: -3,
    rateBonus: 0.2
  },
  {
    id: 'san-francisco',
    name: 'San Francisco Mint Office',
    nodeId: 'san-francisco',
    bonus: '+$150 cash and +2 reputation for western contracts.',
    cashBonus: 150,
    reputationBonus: 2,
    trustBonus: 0,
    pressureBonus: 0,
    rateBonus: 0.1
  }
];

const physicalIntelHazards = new Set<HazardId>(['ambush', 'track-cut', 'washed-bridge', 'repair-ambush', 'scout-missing']);
const officialIntelHazards = new Set<HazardId>(['bad-weather', 'inside-leak', 'rival-sabotage', 'telegraph-cut', 'false-tip']);
const deadheadCashPenaltyBase = 45;
const deadheadScorePenaltyBase = 800;

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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function createInitialState(screen: ScreenId = 'title'): LedgerState {
  const seed = seededFromNow();
  return buildRunState(seed, 'san-francisco', screen);
}

export function startNewRun(officeId: OfficeId = 'san-francisco'): LedgerState {
  return buildRunState(seededFromNow(), officeId, 'game');
}

export function startSeededRun(seed: number, officeId: OfficeId = 'san-francisco'): LedgerState {
  return buildRunState(seed >>> 0, officeId, 'game');
}

function buildRunState(seed: number, officeId: OfficeId, screen: ScreenId): LedgerState {
  const office = officeById(officeId);
  const contract = generateContract(seed, 1, office.nodeId);
  const routeStates = generateRouteStates(seed, 1, office.nodeId, contract, clamp(20 + office.pressureBonus, 0, 95));
  return {
    screen,
    currentNodeId: office.nodeId,
    cash: 1320 + office.cashBonus,
    score: 0,
    reputation: clamp(72 + office.reputationBonus, 0, 100),
    trust: clamp(74 + office.trustBonus, 0, 100),
    outlawPressure: clamp(20 + office.pressureBonus, 0, 95),
    interestRate: clamp(6 + office.rateBonus, 3.5, 18),
    borrowedCredit: 0,
    interestPaid: 0,
    journey: 1,
    deliveryInJourney: 1,
    shipment: shipmentFromContract(contract),
    contract,
    officeId,
    seed,
    routeStates,
    segmentHistory: {},
    creditBorrowedThisLeg: false,
    stationRumor: generateStationRumor(seed, 1, 1, office.nodeId, routeStates),
    mapMode: 'focus'
  };
}

export function generateRouteStates(
  seed: number,
  journey: number,
  currentNodeId: NodeId,
  contract?: Contract,
  outlawPressure = 20
): Record<RouteId, RouteState> {
  const next = random(seed + journey * 7919 + outlawPressure * 17);
  const routeStates = Object.fromEntries(
    routes.map((route) => {
      const activeRoll = next();
      let active =
        route.availability === 'core'
          ? activeRoll < 0.91
          : route.availability === 'swing'
            ? activeRoll < 0.66
            : activeRoll < 0.38;

      if (route.from === currentNodeId || route.to === currentNodeId) {
        active = active || next() < 0.76;
      }

      return [
        route.id,
        {
          routeId: route.id,
          active,
          hazardId: 'clean',
          hazardIds: ['clean'],
          hazardsGenerated: false,
          activatedInitially: active,
          activatedForDestination: false,
          activatedForAdjacency: false,
          tutorialProtected: false,
          revealed: false,
          assigned: [],
          intelReports: []
        }
      ];
    })
  ) as Record<RouteId, RouteState>;

  if (contract) {
    activatePathToDestination(routeStates, contract.origin, contract.destination);
  }

  ensureAdjacentRoute(routeStates, currentNodeId);
  ensureHazardsForActiveRoutes(routeStates, seed, journey, outlawPressure);
  if (journey === 1 && contract) {
    softenFirstContractOpening(routeStates, currentNodeId, contract);
  }
  return routeStates;
}

export interface RouteIncidentEstimate {
  probability: number;
  perCheck: number[];
  exposure: number;
}

export function routeIncidentCheckProbability(route: LedgerRoute, journey: number, outlawPressure: number, exposureIndex = 0) {
  const pressureLift = outlawPressure / 100;
  const tutorialEase = journey === 1 ? -0.12 : 0;
  const hazardChance = clamp(0.22 + journey * 0.018 + pressureLift * 0.22 + tutorialEase, 0.08, 0.72);
  return clamp(hazardChance + route.baseRisk * 0.42 + (route.express ? 0.12 : 0) + exposureIndex * 0.08, 0.08, 0.86);
}

export function estimateRouteIncidentProbability(route: LedgerRoute, journey: number, outlawPressure: number): RouteIncidentEstimate {
  const perCheck = Array.from({ length: incidentExposure(route) }, (_, index) => routeIncidentCheckProbability(route, journey, outlawPressure, index));
  return {
    probability: 1 - perCheck.reduce((safe, chance) => safe * (1 - chance), 1),
    perCheck,
    exposure: perCheck.length
  };
}

function generateHazardsForRoute(route: LedgerRoute, seed: number, journey: number, outlawPressure: number): HazardId[] {
  const exposure = incidentExposure(route);
  const hazardIds: HazardId[] = [];
  for (let index = 0; index < exposure; index += 1) {
    const chance = routeIncidentCheckProbability(route, journey, outlawPressure, index);
    const routeSeed = `${seed}:${journey}:${outlawPressure}:${route.id}:${index}`;
    const hazardNext = random(hashString(routeSeed));
    hazardIds.push(deterministicRoll(routeSeed) < chance ? pickHazard(route, hazardNext, outlawPressure).id : 'clean');
  }
  return hazardIds.length ? hazardIds : ['clean'];
}

export function incidentExposure(route: LedgerRoute) {
  return route.express ? 2 : 1;
}

function activatePathToDestination(routeStates: Record<RouteId, RouteState>, origin: NodeId, destination: NodeId) {
  const path = shortestPath(origin, destination, false);
  for (const route of path) {
    activateRoute(routeStates, route.id, 'destination');
  }
}

export function ensureAdjacentRoute(routeStates: Record<RouteId, RouteState>, nodeId: NodeId, previousNodeId?: NodeId) {
  const adjacentActive = getAdjacentRoutes(nodeId).filter((route) => routeStates[route.id].active);
  const forwardActive = previousNodeId ? adjacentActive.filter((route) => otherEnd(route, nodeId) !== previousNodeId) : adjacentActive;
  if (forwardActive.length > 0) {
    return;
  }
  const candidates = getAdjacentRoutes(nodeId).filter((route) => !previousNodeId || otherEnd(route, nodeId) !== previousNodeId);
  (candidates.length ? candidates : getAdjacentRoutes(nodeId))
    .slice(0, 2)
    .forEach((route) => {
      activateRoute(routeStates, route.id, 'adjacency');
    });
}

function activateRoute(routeStates: Record<RouteId, RouteState>, routeId: RouteId, reason: 'destination' | 'adjacency') {
  const routeState = routeStates[routeId];
  if (!routeState) {
    return;
  }
  const wasActive = routeState.active;
  routeStates[routeId] = {
    ...routeState,
    active: true,
    activatedForDestination: routeState.activatedForDestination || (!wasActive && reason === 'destination'),
    activatedForAdjacency: routeState.activatedForAdjacency || (!wasActive && reason === 'adjacency')
  };
}

function ensureHazardsForActiveRoutes(routeStates: Record<RouteId, RouteState>, seed: number, journey: number, outlawPressure: number) {
  for (const route of routes) {
    const routeState = routeStates[route.id];
    if (!routeState?.active || routeState.hazardsGenerated || routeState.tutorialProtected) {
      continue;
    }
    const hazardIds = generateHazardsForRoute(route, seed, journey, outlawPressure);
    routeStates[route.id] = {
      ...routeState,
      hazardId: hazardIds[0],
      hazardIds,
      hazardsGenerated: true
    };
  }
}

const stationRumorNotices = [
  'A freight clerk heard something.',
  'A card player claims the northern line is watched.',
  'The bartender says the bridge crew never arrived.',
  'A station porter swears the wire desk went quiet.',
  'A rail hand mutters about fresh hoofprints.',
  'A cashier saw a rival agent asking too many questions.'
];

export function generateStationRumor(seed: number, journey: number, deliveryInJourney: number, nodeId: NodeId, routeStates: Record<RouteId, RouteState>): StationRumor {
  const adjacentRoutes = getAdjacentRoutes(nodeId, routeStates);
  const roll = deterministicRoll(`${seed}:${journey}:${deliveryInJourney}:${nodeId}:rumor-offer`);
  const stationBoost = nodeId === 'st-louis' || nodeId === 'new-orleans' || nodeId === 'san-francisco' || nodeId === 'new-york' ? 0.08 : 0;
  const availability = clamp(0.32 + stationBoost - Math.min(0.08, journey * 0.006), 0.26, 0.45);
  if (roll > availability || adjacentRoutes.length === 0) {
    return {
      available: false,
      used: false,
      notice: 'No local rumor worth trusting at this station.',
      reliability: 0,
      quality: 'rumor'
    };
  }

  const qualityRoll = deterministicRoll(`${seed}:${journey}:${deliveryInJourney}:${nodeId}:rumor-quality`);
  const next = random(seed + journey * 349 + deliveryInJourney * 53 + hashString(nodeId));
  const realHazards = adjacentRoutes
    .flatMap((route) => routeStates[route.id]?.hazardIds ?? [])
    .filter((hazardId): hazardId is HazardId => Boolean(hazardId && hazardId !== 'clean'));
  const realHazardSet = new Set(realHazards);
  const falseHazardPool = hazards.filter((hazard) => hazard.id !== 'clean' && !realHazardSet.has(hazard.id));
  const quality: IntelQuality = qualityRoll < 0.3 ? 'true' : qualityRoll < 0.56 ? 'partial' : qualityRoll < 0.78 ? 'false' : qualityRoll < 0.9 ? 'rumor' : 'bait';
  const suggestedHazardId =
    quality === 'true' || quality === 'partial'
      ? realHazards.length
        ? choose(realHazards, next)
        : undefined
      : quality === 'false' || quality === 'bait'
        ? falseHazardPool.length
          ? choose(falseHazardPool, next).id
          : undefined
        : undefined;

  return {
    available: true,
    used: false,
    notice: choose(stationRumorNotices, next),
    reliability: quality === 'true' ? 0.38 : quality === 'partial' ? 0.28 : quality === 'rumor' ? 0.2 : 0.16,
    quality,
    suggestedHazardId
  };
}

function softenFirstContractOpening(routeStates: Record<RouteId, RouteState>, nodeId: NodeId, contract: Contract) {
  const candidates = getAdjacentRoutes(nodeId)
    .filter((route) => !route.express && routeClosesDistanceForNodes(otherEnd(route, nodeId), nodeId, contract.destination))
    .sort((a, b) => a.baseRisk - b.baseRisk);
  const safest = candidates[0] ?? getAdjacentRoutes(nodeId).filter((route) => !route.express).sort((a, b) => a.baseRisk - b.baseRisk)[0];
  if (!safest) {
    return;
  }
  routeStates[safest.id] = {
    ...routeStates[safest.id],
    active: true,
    hazardId: 'clean',
    hazardIds: ['clean'],
    hazardsGenerated: true,
    tutorialProtected: true,
    revealed: false,
    intelReports: []
  };
}

function routeClosesDistanceForNodes(nextNodeId: NodeId, currentNodeId: NodeId, destination: NodeId, includeExpress = false) {
  return hopDistance(nextNodeId, destination, includeExpress) < hopDistance(currentNodeId, destination, includeExpress);
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

export function pickHazard(route: LedgerRoute, next: () => number, outlawPressure = 20): Hazard {
  const possibleHazardIds = route.tags.flatMap((tag) => hazardTagFallbacks[tag] ?? []);
  const unique = [...new Set(possibleHazardIds)];
  const pressureWeighted = outlawPressure >= 60 ? unique.filter((id) => hazardsByPressure.has(id)) : unique;
  const pickedId = (pressureWeighted.length ? choose(pressureWeighted, next) : unique.length > 0 ? choose(unique, next) : 'ambush') as HazardId;
  return hazards.find((hazard) => hazard.id === pickedId) ?? hazards[0];
}

const hazardsByPressure = new Set<HazardId>(['ambush', 'repair-ambush', 'rival-sabotage', 'inside-leak', 'track-cut']);

export function hazardById(id: HazardId) {
  return hazards.find((hazard) => hazard.id === id) ?? hazards[hazards.length - 1];
}

export function actionById(id: PrepActionId) {
  return prepActions.find((action) => action.id === id) ?? prepActions[0];
}

export function officeById(id: OfficeId) {
  return dispatchOffices.find((office) => office.id === id) ?? dispatchOffices[0];
}

export function creditLimit(state: LedgerState) {
  return Math.round(420 + state.reputation * 7 + Math.max(0, state.trust - 50) * 3);
}

export function nextInterestCharge(state: LedgerState) {
  if (state.borrowedCredit <= 0) {
    return 0;
  }
  return Math.max(1, Math.round(state.borrowedCredit * (state.interestRate / 100) * 0.18));
}

export function borrowCredit(state: LedgerState): LedgerState {
  if (state.creditBorrowedThisLeg || state.borrowedCredit >= creditLimit(state)) {
    return state;
  }
  const amount = Math.min(BORROW_AMOUNT, creditLimit(state) - state.borrowedCredit);
  return {
    ...state,
    cash: state.cash + amount,
    borrowedCredit: state.borrowedCredit + amount,
    interestRate: clamp(state.interestRate + 0.45, 3.5, 18),
    trust: clamp(state.trust - 2, 0, 100),
    creditBorrowedThisLeg: true,
    selectedActionId: undefined,
    routeNotice: `Borrowed ${formatMoneyPlain(amount)} against the company credit line.`
  };
}

export function repayDebt(state: LedgerState): LedgerState {
  if (state.borrowedCredit <= 0 || state.cash <= 0) {
    return {
      ...state,
      routeNotice: 'No debt principal is waiting for repayment.'
    };
  }
  const amount = Math.min(250, state.borrowedCredit, Math.max(0, state.cash - 120));
  if (amount <= 0) {
    return {
      ...state,
      routeNotice: 'The board requires a small cash reserve before voluntary repayment.'
    };
  }
  return {
    ...state,
    cash: state.cash - amount,
    borrowedCredit: state.borrowedCredit - amount,
    interestRate: clamp(state.interestRate - 0.18, 3.5, 18),
    routeNotice: `Repaid ${formatMoneyPlain(amount)} of principal before dispatch.`
  };
}

export function applyPrepAction(state: LedgerState, routeId: RouteId, actionId: PrepActionId): LedgerState {
  if (actionId === 'borrow') {
    return borrowCredit(state);
  }

  if (actionId === 'tip' && (!state.stationRumor.available || state.stationRumor.used)) {
    return {
      ...state,
      selectedActionId: undefined,
      routeNotice: 'No fresh local rumor is available at this station.'
    };
  }

  const action = actionById(actionId);
  const routeState = state.routeStates[routeId];
  if (!routeState?.active || routeState.assigned.includes(actionId)) {
    return state;
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
        ...routeState,
        assigned: [...routeState.assigned, actionId],
        revealed: routeState.revealed || Boolean(intel),
        intelReports: intel ? mergeIntelReports(routeState.intelReports, intel) : routeState.intelReports
      }
    },
    routeNotice: undefined,
    stationRumor: actionId === 'tip' ? { ...state.stationRumor, used: true, available: false } : state.stationRumor,
    selectedActionId: undefined,
    selectedRouteId: routeId
  };
}

export function resolveDispatch(state: LedgerState, routeId: RouteId): LedgerState {
  const route = routesById[routeId];
  const routeState = state.routeStates[routeId];
  const nextNodeId = otherEnd(route, state.currentNodeId);
  const assignments = routeState.assigned;
  const backtrackPenalty = Boolean(state.previousNodeId && nextNodeId === state.previousNodeId && getLegalAdjacentRoutes(state).length > 1);
  const incidentIds = routeState.hazardIds.length ? routeState.hazardIds : [routeState.hazardId];
  const incidents = incidentIds.map((hazardId, index) => resolveIncident(state, route, routeState, hazardById(hazardId), index));
  const success = incidents.every((incident) => incident.success);
  const hazard = incidents.find((incident) => incident.hazard.id !== 'clean')?.hazard ?? hazardById('clean');
  const countered = incidents.some((incident) => incident.counterWorked);
  const arrivedAtDestination = success && nextNodeId === state.contract.destination;
  const contractEnded = arrivedAtDestination || !success || state.contract.legsRemaining <= 1;
  const repeatCount = state.segmentHistory[segmentKey(route)] ?? 0;
  const repeatedTraversal = repeatCount > 0;
  const deadheadRun = success && wouldDeadhead(state, route);
  const repeatPenalty = repeatedTraversal ? Math.max(0.25, 1 - repeatCount * 0.28) : 1;
  const backtrackMultiplier = backtrackPenalty ? 0.3 : 1;
  const riskScore = Math.round(route.baseRisk * 1000 * state.contract.routeRiskBonus);
  const distanceScore = distanceScoreForRoute(route);
  const expressScore = route.express ? 520 : 0;
  const counterScore = countered ? 360 + state.journey * 25 : 0;
  const destinationBonus = arrivedAtDestination ? Math.round(state.contract.cargoValue * 0.42 + state.contract.deliveryFee * 0.7) : 0;
  const legFeeBase = Math.round((state.contract.deliveryFee / Math.max(1, state.contract.plannedHops)) * route.payoutMultiplier);
  const counterFeeBonus = countered ? Math.round(90 + route.baseRisk * 240 + state.contract.routeRiskBonus * 35) : 0;
  const deadheadPenalty = deadheadRun ? deadheadPenaltyForRoute(route) : 0;
  const grossFee = success && !deadheadRun ? Math.round((legFeeBase + counterFeeBonus + (arrivedAtDestination ? state.contract.deliveryFee * 0.35 : 0)) * repeatPenalty * backtrackMultiplier) : 0;
  const principalRepaid = success ? Math.min(state.borrowedCredit, Math.round(grossFee * 0.35)) : 0;
  const interestCharge = nextInterestCharge(state);
  const netFee = grossFee - principalRepaid - interestCharge;
  const insured = assignments.includes('insurance');
  const liability = success ? 0 : Math.round(state.contract.cargoValue * (insured ? 0.2 : 0.5) * (1 + route.baseRisk * 0.8));
  const insuranceMitigation = !success && insured ? Math.round(state.contract.cargoValue * 0.3) : 0;

  const initialCash = state.cash;
  const initialScore = state.score;
  const initialReputation = state.reputation;
  const initialTrust = state.trust;

  let cashDeltaRaw = success ? netFee - deadheadPenalty : -liability - interestCharge;
  let scoreDeltaRaw = success
    ? Math.round((state.contract.cargoValue * 0.15 + riskScore + distanceScore + expressScore + counterScore + destinationBonus) * repeatPenalty * backtrackMultiplier)
    : -Math.round(liability * 0.38);
  let reputationDeltaRaw = success ? (countered ? 4 : 2) + (arrivedAtDestination ? 3 : 0) : insured ? -8 : -15;
  let trustDeltaRaw = success
    ? Math.round(2 + state.contract.trustWeight * (arrivedAtDestination ? 5 : 2))
    : -Math.round((insured ? 7 : 17) * state.contract.trustWeight);

  if (deadheadRun) {
    scoreDeltaRaw = -Math.round(deadheadScorePenaltyBase + route.baseRisk * 420 + (route.express ? 80 : 0));
    reputationDeltaRaw = Math.min(reputationDeltaRaw, -2);
    trustDeltaRaw = Math.min(trustDeltaRaw, -2);
  }

  if (state.contract.legsRemaining <= 1 && !arrivedAtDestination) {
    cashDeltaRaw -= Math.round(state.contract.cargoValue * 0.22);
    scoreDeltaRaw -= Math.round(state.contract.cargoValue * 0.22);
    reputationDeltaRaw -= 7;
    trustDeltaRaw -= 9;
  }

  const prepUsed = uniquePrep(incidents.flatMap((incident) => incident.counterAttempted));
  const countersAttempted = prepUsed;
  const countersSucceeded = uniquePrep(incidents.filter((incident) => incident.counterWorked).flatMap((incident) => incident.counterAttempted));
  const countersFailed = uniquePrep(
    incidents
      .filter((incident) => incident.counterAttempted.length > 0 && !incident.counterWorked)
      .flatMap((incident) => incident.counterAttempted)
  ).filter((actionId) => !countersSucceeded.includes(actionId));
  const mitigationApplied = uniquePrep([
    ...(!success && insured ? (['insurance'] as PrepActionId[]) : []),
    ...(principalRepaid > 0 ? (['borrow'] as PrepActionId[]) : [])
  ]);
  const protectionActions = new Set<PrepActionId>(['guards', 'repair', 'decoy', 'delay', 'insurance']);
  const protectionHeld = assignments.filter((actionId) => protectionActions.has(actionId) && !prepUsed.includes(actionId) && !mitigationApplied.includes(actionId));
  const prepNotNeeded = protectionHeld;
  const localRumorOutcome = classifyLocalRumor(routeState.intelReports, incidentIds);
  const pressureDelta = calculatePressureDelta(state, route, success, countered);
  const newCash = Math.round(initialCash + cashDeltaRaw);
  const newScore = Math.max(0, initialScore + scoreDeltaRaw);
  const newReputation = clamp(initialReputation + reputationDeltaRaw, 0, 100);
  const newTrust = clamp(initialTrust + trustDeltaRaw, 0, 100);
  const cashDelta = newCash - initialCash;
  const scoreDelta = newScore - initialScore;
  const reputationDelta = newReputation - initialReputation;
  const trustDelta = newTrust - initialTrust;
  const newDebt = Math.max(0, state.borrowedCredit - principalRepaid);
  const firedReason = newCash < debtLimit ? 'Cash fell below the board debt limit.' : newReputation <= 0 ? 'Reputation reached zero.' : newTrust <= 0 ? 'Currency trust reached zero.' : undefined;
  const resultContract = state.contract;
  const result: DispatchResult = {
    route,
    fromNodeId: state.currentNodeId,
    contract: resultContract,
    incidents,
    hazard,
    countered,
    success,
    assigned: assignments,
    prepUsed,
    mitigationApplied,
    prepNotNeeded,
    helpfulPrep: prepUsed,
    failedPrep: countersFailed,
    countersAttempted,
    countersSucceeded,
    countersFailed,
    protectionHeld,
    intelGathered: routeState.intelReports,
    localRumorOutcome,
    debtUsed: state.borrowedCredit,
    payout: grossFee,
    scoreDelta,
    cashDelta,
    cashAfter: newCash,
    grossFee,
    netFee,
    interestCharge,
    principalRepaid,
    reputationDelta,
    trustDelta,
    pressureDelta,
    deadheadRun,
    deadheadPenalty,
    message: resultMessage(success, arrivedAtDestination, countered, state.contract.legsRemaining <= 1),
    detail: resultDetail(success, arrivedAtDestination, hazard, countered, insured, insuranceMitigation, deadheadRun),
    nextNodeId,
    arrivedAtDestination,
    contractEnded,
    journeyComplete: arrivedAtDestination,
    backtrackPenalty,
    firedReason
  };

  const nextJourney = contractEnded ? state.journey + 1 : state.journey;
  const nextDelivery = contractEnded ? 1 : state.deliveryInJourney + 1;
  const nextSeed = (state.seed + nextJourney * 104729 + nextDelivery * 53 + Math.floor(state.contract.cargoValue * 13) + hashString(routeId)) >>> 0;
  const segmentHistory = {
    ...state.segmentHistory,
    [segmentKey(route)]: repeatCount + 1
  };
  const nextPressure = clamp(state.outlawPressure + pressureDelta, 0, 95);

  let nextContract = {
    ...state.contract,
    legsRemaining: Math.max(0, state.contract.legsRemaining - 1)
  };
  let routeStates = markRouteResolved(state.routeStates, routeId);
  if (contractEnded && !firedReason) {
    nextContract = generateContract(nextSeed, nextJourney, nextNodeId);
    routeStates = generateRouteStates(nextSeed, nextJourney, nextNodeId, nextContract, nextPressure);
  } else {
    ensureAdjacentRoute(routeStates, nextNodeId, state.currentNodeId);
    ensureHazardsForActiveRoutes(routeStates, state.seed, nextJourney, nextPressure);
  }
  const stationRumor = generateStationRumor(nextSeed, nextJourney, nextDelivery, nextNodeId, routeStates);

  return {
    ...state,
    currentNodeId: nextNodeId,
    previousNodeId: state.currentNodeId,
    cash: newCash,
    score: newScore,
    reputation: newReputation,
    trust: newTrust,
    outlawPressure: nextPressure,
    interestRate: clamp(state.interestRate + (newDebt > 0 ? 0.18 : -0.08) + (newCash < 300 ? 0.45 : 0), 3.5, 18),
    borrowedCredit: newDebt,
    interestPaid: state.interestPaid + interestCharge,
    journey: nextJourney,
    deliveryInJourney: nextDelivery,
    shipment: shipmentFromContract(nextContract),
    contract: nextContract,
    seed: nextSeed,
    routeStates,
    segmentHistory,
    creditBorrowedThisLeg: false,
    stationRumor,
    selectedRouteId: undefined,
    selectedActionId: undefined,
    dispatchingRouteId: undefined,
    routeNotice: undefined,
    lastResult: result,
    firedReason
  };
}

function resolveIncident(state: LedgerState, route: LedgerRoute, routeState: RouteState, hazard: Hazard, index: number): IncidentResolution {
  if (hazard.id === 'clean') {
    return {
      hazard,
      success: true,
      counterAttempted: [],
      counterWorked: false,
      roll: 0,
      chance: 1,
      detail: 'No incident on this exposure.'
    };
  }

  const counterAttempted = routeState.assigned.filter((actionId) => hazard.counters.includes(actionId));
  const intelBonus = intelBonusForHazard(routeState, hazard.id);
  const roll = deterministicRoll(`${state.seed}:${state.journey}:${state.deliveryInJourney}:${route.id}:${hazard.id}:${index}`);
  const pressurePenalty = state.outlawPressure * 0.0028;
  const expressPenalty = route.express ? 0.075 : 0;
  const severityPenalty = hazard.severity * 0.28 + route.baseRisk * 0.15;
  const reputationHelp = state.reputation * 0.0011;
  let chance = 0;

  if (counterAttempted.length > 0) {
    chance = 0.56 + Math.min(0.18, (counterAttempted.length - 1) * 0.09) + intelBonus + reputationHelp - pressurePenalty - expressPenalty - severityPenalty;
  } else {
    chance = 0.08 + intelBonus * 0.24 + reputationHelp - pressurePenalty - expressPenalty - hazard.severity * 0.36;
  }
  chance = clamp(chance, counterAttempted.length > 0 ? 0.34 : 0.02, counterAttempted.length > 0 ? 0.88 : 0.16);
  const success = roll < chance;
  return {
    hazard,
    success,
    counterAttempted,
    counterWorked: success && counterAttempted.length > 0,
    roll,
    chance,
    detail: counterAttempted.length
      ? `${counterAttempted.map((id) => actionById(id).name).join(', ')} tested at ${Math.round(chance * 100)}%.`
      : `No hard counter assigned; reputation and intel tested at ${Math.round(chance * 100)}%.`
  };
}

function intelBonusForHazard(routeState: RouteState, hazardId: HazardId) {
  const best = routeState.intelReports.reduce((value, report) => {
    if (report.hazardId !== hazardId) {
      return value;
    }
    if (report.quality === 'true') {
      return Math.max(value, report.source === 'tip' ? 0.06 : 0.12);
    }
    if (report.quality === 'partial') {
      return Math.max(value, 0.05);
    }
    return value;
  }, 0);
  return best;
}

function markRouteResolved(routeStates: Record<RouteId, RouteState>, routeId: RouteId): Record<RouteId, RouteState> {
  const next = { ...routeStates };
  next[routeId] = {
    ...next[routeId],
    hazardsGenerated: true,
    assigned: [],
    intelReports: [],
    revealed: false
  };
  return next;
}

export function canDispatch(state: LedgerState) {
  const route = state.selectedRouteId ? routesById[state.selectedRouteId] : undefined;
  return Boolean(route && isLegalRoute(state, route.id) && !state.dispatchingRouteId);
}

export function isLegalRoute(state: LedgerState, routeId: RouteId) {
  const route = routesById[routeId];
  return Boolean(
    route &&
      state.routeStates[route.id]?.active &&
      (route.from === state.currentNodeId || route.to === state.currentNodeId)
  );
}

export function getLegalAdjacentRoutes(state: LedgerState) {
  return getAdjacentRoutes(state.currentNodeId, state.routeStates).filter((route) => isLegalRoute(state, route.id));
}

export function routeClosesDistance(state: LedgerState, route: LedgerRoute) {
  const nextNodeId = otherEnd(route, state.currentNodeId);
  return activeHopDistance(nextNodeId, state.contract.destination, state.routeStates, true) < activeHopDistance(state.currentNodeId, state.contract.destination, state.routeStates, true);
}

export function deadheadPenaltyForRoute(route: LedgerRoute) {
  return Math.round(deadheadCashPenaltyBase + route.baseRisk * 180 + (route.express ? 35 : 0));
}

export function wouldDeadhead(state: LedgerState, route: LedgerRoute) {
  const nextNodeId = otherEnd(route, state.currentNodeId);
  if (nextNodeId === state.contract.destination) {
    return false;
  }
  const repeatCount = state.segmentHistory[segmentKey(route)] ?? 0;
  const repeatedTraversal = repeatCount > 0;
  const backtrackPenalty = Boolean(state.previousNodeId && nextNodeId === state.previousNodeId && getLegalAdjacentRoutes(state).length > 1);
  return repeatedTraversal || backtrackPenalty || !routeClosesDistance(state, route);
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
  if (!routeState.revealed || routeState.intelReports.length === 0) {
    return 'Unknown';
  }
  return routeState.intelReports.map((report) => report.text).join(' ');
}

export function describeHazardStack(routeState: RouteState) {
  if (!routeState.revealed || routeState.intelReports.length === 0) {
    return 'Unknown';
  }
  return routeState.intelReports.map((report) => report.text).join(' ');
}

export function visibleHazardIdFromIntel(routeState: RouteState) {
  const reported = routeState.intelReports.find((report) => report.hazardId);
  return reported?.hazardId;
}

export function routeStatusLabel(state: LedgerState, route: LedgerRoute) {
  const routeState = state.routeStates[route.id];
  if (!routeState?.active) {
    return 'Closed this contract';
  }
  if (route.from === state.currentNodeId || route.to === state.currentNodeId) {
    return routeClosesDistance(state, route) ? 'Reachable toward destination' : 'Reachable detour';
  }
  return 'Open elsewhere';
}

function buildIntelForAction(state: LedgerState, routeId: RouteId, actionId: PrepActionId): IntelReport | undefined {
  const routeState = state.routeStates[routeId];
  const hazardIds = routeState.hazardIds.length ? routeState.hazardIds : [routeState.hazardId];

  if (actionId === 'scout') {
    const found = hazardIds.find((id) => physicalIntelHazards.has(id));
    const allClean = hazardIds.every((id) => id === 'clean');
    if (found) {
      return {
        source: 'scout',
        quality: 'true',
        hazardId: found,
        confidence: 0.86,
        text: `Scout: ${hazardById(found).name}.`
      };
    }
    if (allClean) {
      return {
        source: 'scout',
        quality: 'partial',
        confidence: 0.58,
        text: 'Scout: physical trail looks clear.'
      };
    }
    return {
      source: 'scout',
      quality: 'partial',
      confidence: 0.45,
      text: 'Scout: no physical sign; official trouble still possible.'
    };
  }

  if (actionId === 'telegraph') {
    const found = hazardIds.find((id) => officialIntelHazards.has(id));
    const allClean = hazardIds.every((id) => id === 'clean');
    if (found) {
      return {
        source: 'telegraph',
        quality: 'true',
        hazardId: found,
        confidence: 0.88,
        text: `Wire: ${hazardById(found).name}.`
      };
    }
    if (allClean) {
      return {
        source: 'telegraph',
        quality: 'partial',
        confidence: 0.6,
        text: 'Wire: no official warning posted.'
      };
    }
    return {
      source: 'telegraph',
      quality: 'partial',
      confidence: 0.45,
      text: 'Wire: official desk is quiet; physical danger unknown.'
    };
  }

  if (actionId === 'tip') {
    const realHazards = new Set<HazardId>(hazardIds.filter((id) => id !== 'clean'));
    const realHazard = hazardIds.find((id) => id !== 'clean') ?? 'clean';
    const rumor = state.stationRumor;
    if (!rumor.available || rumor.used) {
      return undefined;
    }
    if (rumor.quality === 'true') {
      return {
        source: 'tip',
        quality: 'true',
        hazardId: realHazard === 'clean' ? undefined : realHazard,
        confidence: rumor.reliability,
        text: realHazard === 'clean' ? 'Tip: locals think the line is quiet.' : `Tip: maybe ${hazardById(realHazard).name}.`
      };
    }
    if (rumor.quality === 'partial') {
      return {
        source: 'tip',
        quality: 'partial',
        hazardId: rumor.suggestedHazardId === 'clean' ? undefined : rumor.suggestedHazardId,
        confidence: rumor.reliability,
        text: rumor.suggestedHazardId ? `Tip: something like ${hazardById(rumor.suggestedHazardId).name}.` : 'Tip: locals think the line is quiet.'
      };
    }
    if (rumor.quality === 'false' || rumor.quality === 'bait') {
      const suggestedWrong = rumor.suggestedHazardId && !realHazards.has(rumor.suggestedHazardId) ? hazardById(rumor.suggestedHazardId) : undefined;
      const wrong = suggestedWrong ?? hazards.find((item) => item.id !== 'clean' && !realHazards.has(item.id)) ?? hazardById('clean');
      return {
        source: 'tip',
        quality: rumor.quality,
        hazardId: wrong.id === 'clean' ? undefined : wrong.id,
        confidence: rumor.reliability,
        text: rumor.quality === 'bait' ? `Tip: a stranger insists on ${wrong.name}.` : `Tip: maybe ${wrong.name}.`
      };
    }
    return {
      source: 'tip',
      quality: 'rumor',
      confidence: rumor.reliability,
      text: 'Tip: rumor only.'
    };
  }

  return undefined;
}

function mergeIntelReports(reports: IntelReport[], report: IntelReport) {
  if (report.source === 'tip') {
    return [...reports, report];
  }
  const withoutSameSource = reports.filter((item) => item.source !== report.source);
  return [...withoutSameSource, report].sort((a, b) => b.confidence - a.confidence);
}

function classifyLocalRumor(reports: IntelReport[], incidentIds: HazardId[]): LocalRumorOutcome | undefined {
  const report = reports.find((item) => item.source === 'tip');
  if (!report) {
    return undefined;
  }
  const realHazards = new Set<HazardId>(incidentIds.filter((id) => id !== 'clean'));
  const reportedClean = !report.hazardId;
  const exactHazardMatch = Boolean(report.hazardId && realHazards.has(report.hazardId));
  if ((reportedClean && realHazards.size === 0) || exactHazardMatch) {
    return report.quality === 'partial' || report.quality === 'rumor' ? 'incomplete' : 'useful';
  }
  if (report.quality === 'true' && reportedClean && realHazards.size === 0) {
    return 'useful';
  }
  if (report.quality === 'partial' || report.quality === 'rumor') {
    return 'incomplete';
  }
  return 'false';
}

function calculatePressureDelta(state: LedgerState, route: LedgerRoute, success: boolean, countered: boolean) {
  const base = route.express ? 3 : 1;
  if (!success) {
    return base + 5;
  }
  if (countered) {
    return -Math.max(1, Math.round(2 - state.reputation / 80));
  }
  return base;
}

function resultMessage(success: boolean, arrivedAtDestination: boolean, countered: boolean, deadlineMissed: boolean) {
  if (arrivedAtDestination) {
    return 'Destination Delivered';
  }
  if (deadlineMissed && success) {
    return 'Contract Deadline Missed';
  }
  if (success && countered) {
    return 'Counter Worked';
  }
  if (success) {
    return 'Clean Passage';
  }
  return 'Shipment Failed';
}

function resultDetail(success: boolean, arrivedAtDestination: boolean, hazard: Hazard, countered: boolean, insured: boolean, insuranceMitigation: number, deadheadRun = false) {
  if (arrivedAtDestination) {
    return 'The shipment reached the named office. The fee was earned, the paper held, and the board has another contract waiting.';
  }
  if (deadheadRun) {
    return 'The shipment moved, but the board marks repeated backtracking as deadhead travel: no route fee, no score farm, and a small operating charge.';
  }
  if (success && hazard.id === 'clean') {
    return 'The route held. No one fired a shot, and the ledger stayed legible.';
  }
  if (success && countered) {
    return `${hazard.name} hit the line, but the chosen protection carried the shipment through.`;
  }
  if (success) {
    return `${hazard.name} nearly ruined the route, but reputation and luck kept the case moving.`;
  }
  return insured
    ? `${hazard.name} broke the line. Insurance softened roughly ${formatMoneyPlain(insuranceMitigation)} of the liability, but trust still fell.`
    : `${hazard.name} broke the line. The cargo value became liability instead of income.`;
}

function distanceScoreForRoute(route: LedgerRoute) {
  switch (route.distanceTier) {
    case 'short':
      return 120;
    case 'medium':
      return 240;
    case 'long':
      return 390;
    case 'express':
      return 540;
    default:
      return 160;
  }
}

export function generateContract(seed: number, journey: number, origin: NodeId): Contract {
  const next = random(seed + journey * 431 + hashString(origin));
  const shipment = choose(shipments, next);
  const destination = pickDestination(origin, next);
  const plannedHops = Math.max(2, hopDistance(origin, destination, false));
  const cargoLift = 1 + Math.min(0.55, journey * 0.035 + plannedHops * 0.035);
  const cargoValue = Math.round(shipment.value * cargoLift);
  const commissionRate = clamp(0.1 + plannedHops * 0.025 + journey * 0.004, 0.12, 0.25);
  const routeRiskBonus = journey === 1 ? 1 + Math.min(0.28, plannedHops * 0.04) : 1 + Math.min(0.5, plannedHops * 0.06 + journey * 0.012);
  const deliveryFee = Math.round(cargoValue * commissionRate + plannedHops * 38 + (journey === 1 ? 70 : 0));
  const legLimit = plannedHops + (journey === 1 ? 3 : 2);
  return {
    id: `${journey}-${origin}-${destination}-${Math.floor(next() * 10000)}`,
    origin,
    destination,
    cargoName: shipment.name,
    cargoType: shipment.cargoType,
    cargoValue,
    deliveryFee,
    trustWeight: shipment.trustWeight,
    urgency: legLimit <= 4 ? 'Tight' : legLimit <= 6 ? 'Standard' : 'Flexible',
    legLimit,
    legsRemaining: legLimit,
    plannedHops,
    routeRiskBonus,
    copy: shipment.copy
  };
}

function pickDestination(origin: NodeId, next: () => number): NodeId {
  const candidates = nodes
    .map((node) => ({ nodeId: node.id as NodeId, distance: hopDistance(origin, node.id as NodeId, false) }))
    .filter((item) => item.nodeId !== origin && item.distance >= 2 && item.distance <= 5);
  const far = candidates.filter((item) => item.distance >= 3);
  return choose(far.length ? far : candidates, next).nodeId;
}

function hopDistance(from: NodeId, to: NodeId, includeExpress: boolean) {
  if (from === to) {
    return 0;
  }
  const queue: Array<{ nodeId: NodeId; distance: number }> = [{ nodeId: from, distance: 0 }];
  const visited = new Set<NodeId>([from]);
  while (queue.length) {
    const item = queue.shift()!;
    for (const route of getAdjacentRoutes(item.nodeId).filter((candidate) => includeExpress || !candidate.express)) {
      const nextNode = otherEnd(route, item.nodeId);
      if (nextNode === to) {
        return item.distance + 1;
      }
      if (!visited.has(nextNode)) {
        visited.add(nextNode);
        queue.push({ nodeId: nextNode, distance: item.distance + 1 });
      }
    }
  }
  return 99;
}

function activeHopDistance(from: NodeId, to: NodeId, routeStates: Record<RouteId, RouteState>, includeExpress: boolean) {
  if (from === to) {
    return 0;
  }
  const queue: Array<{ nodeId: NodeId; distance: number }> = [{ nodeId: from, distance: 0 }];
  const visited = new Set<NodeId>([from]);
  while (queue.length) {
    const item = queue.shift()!;
    for (const route of getAdjacentRoutes(item.nodeId, routeStates).filter((candidate) => includeExpress || !candidate.express)) {
      const nextNode = otherEnd(route, item.nodeId);
      if (nextNode === to) {
        return item.distance + 1;
      }
      if (!visited.has(nextNode)) {
        visited.add(nextNode);
        queue.push({ nodeId: nextNode, distance: item.distance + 1 });
      }
    }
  }
  return 99;
}

function shortestPath(from: NodeId, to: NodeId, includeExpress: boolean): LedgerRoute[] {
  const queue: Array<{ nodeId: NodeId; path: LedgerRoute[] }> = [{ nodeId: from, path: [] }];
  const visited = new Set<NodeId>([from]);
  while (queue.length) {
    const item = queue.shift()!;
    for (const route of getAdjacentRoutes(item.nodeId).filter((candidate) => includeExpress || !candidate.express)) {
      const nextNode = otherEnd(route, item.nodeId);
      const path = [...item.path, route];
      if (nextNode === to) {
        return path;
      }
      if (!visited.has(nextNode)) {
        visited.add(nextNode);
        queue.push({ nodeId: nextNode, path });
      }
    }
  }
  return [];
}

function shipmentFromContract(contract: Contract): Shipment {
  return {
    name: contract.cargoName,
    cargoType: contract.cargoType,
    value: contract.cargoValue,
    trustWeight: contract.trustWeight,
    copy: contract.copy
  };
}

export function segmentKey(route: LedgerRoute) {
  return [route.from, route.to].sort().join('|');
}

function uniquePrep(items: PrepActionId[]) {
  return [...new Set(items)];
}

function deterministicRoll(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0x100000000;
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function formatMoneyPlain(value: number) {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString()}`;
}
