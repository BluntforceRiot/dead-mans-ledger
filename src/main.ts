import './styles.css';
import { prepActions, type PrepActionId } from './data/gameContent';
import { nodes, nodesById, type NodeId } from './data/nodes';
import { routes, routesById, type LedgerRoute, type RouteId } from './data/routes';
import { clearHighScores, getHighScores, saveHighScore } from './game/highScores';
import {
  applyPrepAction,
  BORROW_AMOUNT,
  borrowCredit,
  canDispatch,
  createInitialState,
  creditLimit,
  describeIntel,
  describeHazardStack,
  dispatchOffices,
  dispatchResultStatusLabel,
  estimateRouteIncidentProbability,
  findNodeName,
  generateRouteStates,
  getAdjacentRoutes,
  getLegalAdjacentRoutes,
  hazardById,
  incidentExposure,
  isLegalRoute,
  meterClass,
  nextInterestCharge,
  officeById,
  otherEnd,
  repayDebt,
  resolveDispatch,
  routeClosesDistance,
  routeStatusLabel,
  startNewRun,
  type LedgerState,
  type MapMode,
  type OfficeId,
  type ScreenId
} from './game/sim';
import { MAP_HEIGHT, MAP_WIDTH, projectPoint } from './map/projection';

const appRoot = document.querySelector<HTMLDivElement>('#app')!;
const demoUrl = 'https://bluntforceriot.github.io/dead-mans-ledger/';
const repoUrl = 'https://github.com/BluntforceRiot/dead-mans-ledger';
const DISPATCH_ANIMATION_MS = 2600;

let state: LedgerState = createInitialState(screenFromHash());
let muted = window.localStorage.getItem('dead-mans-ledger.muted') === 'true';
let audioContext: AudioContext | undefined;
let pendingDispatch: { routeId: RouteId; timeoutId: number } | undefined;

type DispatchResultView = NonNullable<LedgerState['lastResult']>;
type StampTone = 'gold' | 'failure';
type EventSeal = 'clean' | 'weather' | 'ambush' | 'defended' | 'repair' | 'bridge' | 'rumor' | 'delivery' | 'loss';

interface ChronicleLeg {
  routeId: RouteId;
  from: NodeId;
  to: NodeId;
  routeLabel: string;
  seal: EventSeal;
  status: string;
  headline: string;
}

interface ChronicleState {
  contractId: string;
  origin: NodeId;
  destination: NodeId;
  legs: ChronicleLeg[];
  currentHeadline?: string;
  recentHeadlines: string[];
}

let chronicle: ChronicleState = createChronicleState(state);

window.addEventListener('hashchange', () => {
  state = { ...state, screen: screenFromHash() };
  render();
});

window.addEventListener('keydown', (event) => {
  if ((event.key === 'Escape' || event.key.toLowerCase() === 's') && state.dispatchingRouteId) {
    event.preventDefault();
    finishPendingDispatch();
    return;
  }
  if (state.screen === 'scores' && event.key.toLowerCase() === 'r') {
    handleScoreReset();
  }
  if (event.key.toLowerCase() === 'm') {
    muted = !muted;
    window.localStorage.setItem('dead-mans-ledger.muted', String(muted));
    render();
  }
  if (event.key === 'Escape' && state.screen !== 'title') {
    navigate('title');
  }
});

appRoot.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action], [data-screen], [data-route-id], [data-prep-id], [data-office-id]');
  if (!target) {
    return;
  }

  const officeId = target.dataset.officeId as OfficeId | undefined;
  if (officeId) {
    playCue('dispatch');
    state = startNewRun(officeId);
    chronicle = createChronicleState(state);
    playCue('stamp');
    updateHash('game');
    return;
  }

  const screen = target.dataset.screen as ScreenId | undefined;
  if (screen) {
    playCue('click');
    if (screen === 'game') {
      updateHash('office');
    } else {
      navigate(screen);
    }
    return;
  }

  const prepId = target.dataset.prepId as PrepActionId | undefined;
  if (prepId) {
    handlePrepClick(prepId);
    return;
  }

  const routeId = target.dataset.routeId as RouteId | undefined;
  if (routeId) {
    handleRouteClick(routeId);
    return;
  }

  switch (target.dataset.action) {
    case 'dispatch':
      dispatchSelectedRoute();
      break;
    case 'skip-dispatch':
      playCue('click');
      finishPendingDispatch();
      break;
    case 'map-focus':
      state = { ...state, mapMode: 'focus' };
      render();
      break;
    case 'map-full':
      state = { ...state, mapMode: 'full' };
      render();
      break;
    case 'repay-debt':
      playCue('click');
      state = repayDebt(state);
      render();
      break;
    case 'continue-result':
      playCue('click');
      if (state.firedReason) {
        playCue('fired');
        navigate('fired');
      } else {
        const endedContract = state.lastResult?.contractEnded;
        state = { ...state, lastResult: undefined };
        if (endedContract) {
          chronicle = createChronicleState(state);
          playCue('stamp');
        }
        render();
      }
      break;
    case 'regen-routes':
      playCue('click');
      state = {
        ...state,
        seed: Date.now() >>> 0,
        routeStates: generateRouteStates(Date.now() >>> 0, state.journey, state.currentNodeId, state.contract, state.outlawPressure),
        selectedRouteId: undefined
      };
      render();
      break;
    case 'save-score':
      playCue('success');
      saveCurrentScore();
      break;
    case 'skip-score':
      playCue('click');
      navigate('scores');
      break;
    case 'reset-scores':
      playCue('click');
      handleScoreReset();
      break;
    case 'toggle-sound':
      muted = !muted;
      window.localStorage.setItem('dead-mans-ledger.muted', String(muted));
      render();
      break;
    default:
      break;
  }
});

appRoot.addEventListener('keydown', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-route-id]');
  if (!target || (event.key !== 'Enter' && event.key !== ' ')) {
    return;
  }
  event.preventDefault();
  handleRouteClick(target.dataset.routeId as RouteId);
});

render();

function screenFromHash(): ScreenId {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  if (raw === 'office' || raw === 'howto' || raw === 'preview' || raw === 'about' || raw === 'game' || raw === 'scores') {
    return raw;
  }
  return 'title';
}

function updateHash(screen: ScreenId) {
  const next = screen === 'title' ? '#' : `#/${screen}`;
  if (window.location.hash !== next) {
    window.history.pushState(null, '', next);
  }
  state = { ...state, screen };
  render();
}

function navigate(screen: ScreenId) {
  updateHash(screen);
}

function assetUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path}`;
}

function handlePrepClick(prepId: PrepActionId) {
  if (state.screen !== 'game') {
    return;
  }

  playCue('click');
  if (prepId === 'borrow') {
    state = borrowCredit(state);
    render();
    return;
  }
  state = { ...state, selectedActionId: state.selectedActionId === prepId ? undefined : prepId };
  render();
}

function handleRouteClick(routeId: RouteId) {
  const routeState = state.routeStates[routeId];

  if (state.screen === 'preview') {
    state = { ...state, selectedRouteId: routeId };
    render();
    return;
  }

  if (state.screen !== 'game') {
    return;
  }

  const route = routesById[routeId];
  if (!routeState?.active) {
    state = { ...state, routeNotice: 'Route closed this contract.' };
    render();
    return;
  }

  if (!isLegalRoute(state, routeId)) {
    state = { ...state, selectedRouteId: routeId, routeNotice: 'That route is open elsewhere, not from this station.' };
    render();
    return;
  }

  if (state.selectedActionId) {
    playCue(state.selectedActionId === 'tip' ? 'tip' : 'click');
    state = applyPrepAction(state, routeId, state.selectedActionId);
  } else {
    playCue('click');
    state = { ...state, selectedRouteId: routeId, routeNotice: routeClosesDistance(state, route) ? undefined : 'Detour route: it does not shorten the trip to the destination.' };
  }
  render();
}

function dispatchSelectedRoute() {
  if (!state.selectedRouteId || !canDispatch(state)) {
    return;
  }

  const routeId = state.selectedRouteId;
  playCue('dispatch');
  state = { ...state, dispatchingRouteId: routeId, lastResult: undefined };
  render();
  const delay = prefersReducedMotion() ? 120 : DISPATCH_ANIMATION_MS;
  pendingDispatch = {
    routeId,
    timeoutId: window.setTimeout(() => finishPendingDispatch(), delay)
  };
}

function finishPendingDispatch() {
  if (!pendingDispatch) {
    return;
  }
  const { routeId, timeoutId } = pendingDispatch;
  window.clearTimeout(timeoutId);
  pendingDispatch = undefined;
  if (!state.dispatchingRouteId || state.dispatchingRouteId !== routeId) {
    return;
  }
  const before = state;
  const nextState = resolveDispatch(state, routeId);
  if (nextState.lastResult) {
    recordChronicleLeg(before, nextState.lastResult);
  }
  state = nextState;
  playCue('stamp');
  playResultCues(state.lastResult);
  render();
}

function saveCurrentScore() {
  const input = document.querySelector<HTMLInputElement>('#initials');
  const initials = (input?.value || 'DML').replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
  saveHighScore({ initials, score: state.score, journey: state.journey, date: new Date().toISOString() });
  navigate('scores');
}

function handleScoreReset() {
  const now = Date.now();
  if (state.resetConfirmUntil && state.resetConfirmUntil > now) {
    clearHighScores();
    state = { ...state, resetConfirmUntil: undefined };
  } else {
    state = { ...state, resetConfirmUntil: now + 3000 };
  }
  render();
}

function render() {
  appRoot.innerHTML =
    state.screen === 'title'
      ? renderTitle()
      : state.screen === 'office'
        ? renderOfficeChoice()
      : state.screen === 'howto'
        ? renderHowTo()
        : state.screen === 'preview'
          ? renderMapPreview()
          : state.screen === 'about'
            ? renderAbout()
            : state.screen === 'game'
              ? renderGame()
              : state.screen === 'fired'
                ? renderFired()
                : renderHighScores();
  hydrateSettlementAnimations();
}

function renderTitle() {
  return `
    <main class="title-screen">
      <div class="title-card">
        <div class="title-rails" aria-hidden="true"><span></span><span></span></div>
        <img src="${assetUrl('assets/ui/gold-logo.svg')}" alt="Dead Man's Ledger: The Money Engine" class="logo" />
        <p class="subtitle">The money provided independence. The route was the engine.</p>
        <p class="title-kicker">A frontier board-game sim about currency, risk, trust, and the routes that made paper money useful.</p>
        <div class="title-actions">
          <button data-screen="office">Start Ledger Run</button>
          <button data-screen="preview">Route Atlas</button>
          <button data-screen="howto">How To Play</button>
          <button data-screen="about">About</button>
          <button data-screen="scores">High Scores</button>
        </div>
        <p class="fine-print">v1.0 submission build &middot; Summer into AI Week 2: Independence Engines</p>
      </div>
    </main>
  `;
}

function renderOfficeChoice() {
  return `
    <main class="page-shell office-screen">
      <section class="paper-page">
        <p class="eyebrow">Dispatch Office</p>
        <h1>Choose the first ledger desk</h1>
        <p class="lead-copy">Each office starts on a different route web with a mild accounting edge. The contract destination is real; get the cargo there before the legs run out.</p>
        <div class="office-grid">
          ${dispatchOffices
            .map(
              (office) => `
                <button class="office-card" data-office-id="${office.id}">
                  <strong>${office.name}</strong>
                  <span>${findNodeName(office.nodeId)} office</span>
                  <small>${office.bonus}</small>
                </button>
              `
            )
            .join('')}
        </div>
        <div class="page-actions">
          <button data-screen="title">Title</button>
          <button data-screen="preview">Route Atlas</button>
        </div>
      </section>
    </main>
  `;
}

function renderHowTo() {
  return `
    <main class="page-shell">
      <section class="paper-page">
        <h1>How To Keep the Money Engine Turning</h1>
        <div class="rules-grid">
          <article>
            <h2>Pick a route</h2>
            <p>Click an active route from your current station. Your contract has a destination, cargo value, fee, and leg limit.</p>
          </article>
          <article>
            <h2>Prepare the line</h2>
            <p>Scout and Telegraph gather intel. Guards, repairs, decoys, delays, and insurance handle the danger.</p>
          </article>
          <article>
            <h2>Read the danger</h2>
            <p>Intel helps the right counter work, but information alone cannot guarantee survival.</p>
          </article>
          <article>
            <h2>Survive the board</h2>
            <p>Cash below ${formatMoney(-500)}, zero reputation, or zero currency trust ends the run. Debt charges interest only when debt exists.</p>
          </article>
        </div>
        <div class="page-actions">
          <button data-screen="office">Start Run</button>
          <button data-screen="title">Title</button>
        </div>
      </section>
    </main>
  `;
}

function renderAbout() {
  return `
    <main class="page-shell">
      <section class="paper-page about-page">
        <p class="eyebrow">Credits And Proof</p>
        <h1>About The Money Engine</h1>
        <div class="rules-grid">
          <article>
            <h2>Project Thesis</h2>
            <p>The money provided independence. The route was the engine. Contracts turn currency trust into a route-planning problem.</p>
          </article>
          <article>
            <h2>Week 2 Theme</h2>
            <p>Built for Summer into AI Week 2: Independence Engines. The engine here is circulation: paper money only works if trust can travel.</p>
          </article>
          <article>
            <h2>Map And Data</h2>
            <p>The base board is generated from open U.S. geodata. City and route overlays are drawn from coordinate data at runtime; no AI-generated geography or map screenshots are used.</p>
          </article>
          <article>
            <h2>AI Usage</h2>
            <p>AI assisted design direction, code integration, review-loop hardening, and lightweight original SVG/UI generation. No AI-generated geography is used.</p>
          </article>
          <article>
            <h2>Static Browser Proof</h2>
            <p>Runs as a static Vite browser game with local high scores only. No backend, login, online leaderboard, or private infrastructure is required.</p>
          </article>
          <article>
            <h2>Version And Links</h2>
            <p>Version: <strong>v1.0 submission build</strong>. Demo: <a href="${demoUrl}" target="_blank" rel="noopener noreferrer">${demoUrl}</a>. Repo: <a href="${repoUrl}" target="_blank" rel="noopener noreferrer">${repoUrl}</a>.</p>
            <details class="proof-details"><summary>Proof Details</summary><span>Journey seed: <strong>${state.seed}</strong></span></details>
          </article>
          <article>
            <h2>Credits</h2>
            <p>Libraries and data include Vite, TypeScript, D3 Geo, TopoJSON tooling, Sharp, Playwright, us-atlas, U.S. Census-derived boundaries, and local river fallback data.</p>
          </article>
        </div>
        <article class="competitor-card">
          <p class="eyebrow">Across The Competition</p>
          <h2>Dependency Day</h2>
          <p>While Dead Man&rsquo;s Ledger was already in development, Myles published Dependency Day, another Independence Engines project built around a branching node graph. I loved seeing the same broad visual grammar arrive through a completely different idea.</p>
          <p>Dependency Day asks what dependencies you cut.</p>
          <p>Dead Man&rsquo;s Ledger asks what risks you take to keep currency moving.</p>
          <p>His graph models severance. This one models circulation.</p>
          <a class="external-button" href="https://merlinforge.substack.com/p/dependency-day-a-single-file-in-browser" target="_blank" rel="noopener noreferrer">View Dependency Day</a>
        </article>
        <div class="page-actions">
          <button data-screen="office">Start Run</button>
          <button data-screen="preview">Route Atlas</button>
          <button data-screen="title">Title</button>
        </div>
      </section>
    </main>
  `;
}

function renderMapPreview() {
  const selected = state.selectedRouteId ? routesById[state.selectedRouteId] : undefined;
  const selectedState = selected ? state.routeStates[selected.id] : undefined;
  return `
    <main class="preview-shell">
      <aside class="side-panel">
        <h1>Route Atlas</h1>
        <p>Inspect the board geography, route types, express lines, and contract availability before opening the ledger.</p>
        ${renderLedgerStamp('ROUTE LEGEND', 'gold', 'atlas-stamp')}
        <p class="hint">Open U.S. geography styled as a playable frontier route board.</p>
        <dl>
          <dt>Nodes</dt><dd>${nodes.length}</dd>
          <dt>Routes</dt><dd>${routes.length}</dd>
          <dt>Scores</dt><dd>Saved on this device</dd>
        </dl>
        ${
          selected
            ? `<div class="route-card">
                <h2>${routeAtlasName(selected)}</h2>
                <p class="route-note">${selected.note}</p>
                <p><strong>${selected.type.toUpperCase()}</strong> &middot; ${selected.distanceTier} &middot; danger ${routeDangerLabel(selected, selectedState)} &middot; exposure ${incidentExposure(selected)} &middot; ${selected.express ? 'EXPRESS' : 'standard'}</p>
                <p>${selectedState?.active ? 'Open this contract' : 'Closed this contract'} &middot; Intel: ${selectedState ? describeIntel(selectedState) : 'Unknown'}</p>
              </div>`
            : '<p class="hint">Click a route line to inspect status, risk, exposure, and route type.</p>'
        }
        <div class="page-actions">
          <button data-screen="office">Start Run</button>
          <button data-screen="title">Title</button>
        </div>
      </aside>
      <section class="map-stage large">${renderMap('preview')}</section>
    </main>
  `;
}

function renderGame() {
  const selected = state.selectedRouteId ? routesById[state.selectedRouteId] : undefined;
  const adjacent = getLegalAdjacentRoutes(state);
  const selectedState = selected ? state.routeStates[selected.id] : undefined;
  const office = officeById(state.officeId);

  return `
    <main class="game-shell">
      <aside class="side-panel contract-panel">
        <p class="eyebrow">Current Contract</p>
        <h1>${state.contract.cargoName}</h1>
        ${renderLedgerStamp('CONTRACT ACCEPTED', 'gold', 'contract-accepted-stamp')}
        <p>${state.contract.copy}</p>
        <dl class="compact-list">
          <dt>Office</dt><dd>${office.name.replace(' Office', '')}</dd>
          <dt>Station</dt><dd>${findNodeName(state.currentNodeId)}</dd>
          <dt>Origin</dt><dd>${findNodeName(state.contract.origin)}</dd>
          <dt>Destination</dt><dd>${findNodeName(state.contract.destination)}</dd>
          <dt>Cargo type</dt><dd>${state.contract.cargoType}</dd>
          <dt>Cargo value</dt><dd>${formatMoney(state.contract.cargoValue)}</dd>
          <dt>Delivery fee</dt><dd>${formatMoney(state.contract.deliveryFee)}</dd>
          <dt>Legs remaining</dt><dd>${state.contract.legsRemaining}</dd>
          <dt>Active exits</dt><dd>${adjacent.length}</dd>
        </dl>
        ${renderStationRumorNotice()}
        ${renderFirstTurnRecommendation()}
        ${state.routeNotice ? `<p class="danger-copy small-copy">${state.routeNotice}</p>` : ''}
      </aside>
      <section class="map-stage">
        ${renderContractRibbon()}
        ${renderMap('game')}
        ${state.dispatchingRouteId ? renderDispatchCinematic(routesById[state.dispatchingRouteId]) : ''}
        ${renderSelectedRouteLedger(selected, selectedState)}
        ${renderDispatchChronicle()}
      </section>
      <aside class="side-panel actions-panel">
        <p class="eyebrow">Preparation</p>
        <h2>Route Actions</h2>
        ${renderActionGroups()}
        ${renderSelectedActionDetail()}
      </aside>
      <section class="hud">${renderHud()}</section>
      ${state.lastResult ? renderResultModal() : ''}
    </main>
  `;
}

const actionGroups: Array<{ title: string; ids: PrepActionId[] }> = [
  { title: 'Intelligence', ids: ['scout', 'telegraph', 'tip'] },
  { title: 'Protection', ids: ['guards', 'decoy', 'insurance'] },
  { title: 'Infrastructure', ids: ['repair', 'delay'] },
  { title: 'Finance', ids: ['borrow'] }
];

function renderFirstTurnRecommendation() {
  if (state.journey !== 1 || state.deliveryInJourney !== 1) {
    return '';
  }
  return `
    <div class="rumor-strip recommendation-strip">
      <strong>First-turn note</strong>
      <span>Scout or Telegraph a standard route toward ${findNodeName(state.contract.destination)}, assign a matching counter, then dispatch.</span>
    </div>
  `;
}

function renderStationRumorNotice() {
  const rumor = state.stationRumor;
  if (!rumor.available || rumor.used) {
    return '';
  }
  return `
    <div class="rumor-strip">
      <strong>Local Tip Available</strong>
      <span>${escapeHtml(rumor.notice)} ${Math.round(rumor.reliability * 100)}% reliable.</span>
    </div>
  `;
}

function renderContractRibbon() {
  const selected = state.selectedRouteId ? routesById[state.selectedRouteId] : undefined;
  const direction = selected ? routeTravelName(selected, state.currentNodeId) : `Choose a route toward ${findNodeName(state.contract.destination)}`;
  return `
    <header class="contract-ribbon">
      <div>
        <span>Origin</span>
        <strong>${findNodeName(state.contract.origin)}</strong>
      </div>
      <div class="destination-seal">
        <span>Destination</span>
        <strong>${findNodeName(state.contract.destination)}</strong>
      </div>
      <div>
        <span>Progress</span>
        <strong>${state.contract.legLimit - state.contract.legsRemaining}/${state.contract.legLimit}</strong>
      </div>
      <div class="shipment-seal">
        <span>Seal</span>
        <strong>${state.contract.cargoType}</strong>
      </div>
      <div class="route-direction">
        <span>Direction</span>
        <strong>${direction}</strong>
      </div>
      <div class="map-mode-toggle" role="group" aria-label="Map display mode">
        ${renderMapModeButton('focus', 'Focus Contract')}
        ${renderMapModeButton('full', 'Full Map')}
      </div>
    </header>
  `;
}

function renderMapModeButton(mode: MapMode, label: string) {
  const active = state.mapMode === mode;
  return `<button class="${active ? 'active' : ''}" data-action="${mode === 'focus' ? 'map-focus' : 'map-full'}" ${active ? 'aria-pressed="true"' : 'aria-pressed="false"'}>${label}</button>`;
}

function renderSelectedRouteLedger(selected?: LedgerRoute, selectedState?: LedgerState['routeStates'][RouteId]) {
  if (!selected || !selectedState) {
    return `
      <footer class="selected-route-ledger empty">
        <strong>Select a reachable gold route</strong>
        <span>Plot toward ${findNodeName(state.contract.destination)}, gather intelligence, assign counters, then dispatch.</span>
      </footer>
    `;
  }
  return `
    <footer class="selected-route-ledger">
      <div>
        <span>Selected Route</span>
        <strong>${routeTravelName(selected, state.currentNodeId)}</strong>
      </div>
      <div>
        <span>Type</span>
        <strong>${selected.express ? 'Express' : selected.type}</strong>
      </div>
      <div>
        <span>Danger</span>
        <strong>${routeDangerLabel(selected, selectedState)}</strong>
      </div>
      ${
        selectedState.tutorialProtected
          ? '<div class="tutorial-protection"><span>Board Note</span><strong>Board-cleared starter route</strong></div>'
          : ''
      }
      <div>
        <span>Exposure</span>
        <strong>${incidentExposure(selected)} check${incidentExposure(selected) === 1 ? '' : 's'}</strong>
      </div>
      <div>
        <span>Payout</span>
        <strong>x${selected.payoutMultiplier.toFixed(2)}</strong>
      </div>
      <div>
        <span>Threat</span>
        <strong>${describeHazardStack(selectedState)}</strong>
      </div>
      <div>
        <span>Counters</span>
        <strong>${selectedState.assigned.filter((id) => !['scout', 'telegraph', 'tip', 'borrow'].includes(id)).length ? selectedState.assigned.filter((id) => !['scout', 'telegraph', 'tip', 'borrow'].includes(id)).map((id) => actionName(id)).join(', ') : 'None'}</strong>
      </div>
      ${
        state.dispatchingRouteId
          ? '<button data-action="skip-dispatch">Skip Animation</button>'
          : `<button data-action="dispatch" ${canDispatch(state) ? '' : 'disabled'}>Dispatch Shipment</button>`
      }
    </footer>
  `;
}

function routeDangerLabel(route: LedgerRoute, routeState?: LedgerState['routeStates'][RouteId]) {
  if (routeState?.tutorialProtected) {
    return '0% protected';
  }
  const estimate = estimateRouteIncidentProbability(route, state.journey, state.outlawPressure);
  const percent = Math.round(estimate.probability * 100);
  const prefix = state.journey === 1 && !route.express && percent <= 32 ? 'Tutorial ' : '';
  const suffix = route.express ? ' any incident' : '';
  return `${prefix}${percent}%${suffix}`;
}

function renderDispatchChronicle() {
  const activeResult = state.lastResult;
  const contract = activeResult?.contract ?? state.contract;
  if (chronicle.contractId !== contract.id && !activeResult) {
    chronicle = createChronicleState(state);
  }
  const currentNode = activeResult ? activeResult.nextNodeId : state.currentNodeId;
  const completedStations = chronicle.legs.map((leg) => leg.to).filter((nodeId) => nodeId !== currentNode && nodeId !== contract.origin);
  const stationItems = [
    `<span class="chronicle-station origin"><em>Origin</em><strong>${findNodeName(contract.origin)}</strong></span>`,
    ...completedStations.map((nodeId) => `<span class="chronicle-station completed"><em>Stop</em><strong>${findNodeName(nodeId)}</strong></span>`),
    `<span class="chronicle-station current"><em>Current</em><strong>${findNodeName(currentNode)}</strong></span>`,
    `<span class="chronicle-station destination"><em>Destination</em><strong>${findNodeName(contract.destination)}</strong></span>`
  ];
  const eventSeals = chronicle.legs.length
    ? chronicle.legs
        .map(
          (leg, index) => `
            <span class="event-seal seal-${leg.seal}" title="${escapeHtml(leg.routeLabel)} | ${escapeHtml(leg.status)}: ${escapeHtml(leg.headline)}">
              <b>${sealIcon(leg.seal)}</b>
              <em>${index + 1}</em>
            </span>
          `
        )
        .join('')
    : '<span class="chronicle-empty">No completed legs yet.</span>';
  const headline = chronicle.currentHeadline ?? 'LEDGER WIRE AWAITS THE FIRST DISPATCH';
  const recent = chronicle.recentHeadlines.slice(0, 6);

  return `
    <section class="dispatch-chronicle" aria-label="Dispatch Chronicle" data-chronicle-contract="${escapeHtml(contract.id)}" data-chronicle-leg-count="${chronicle.legs.length}">
      <div class="chronicle-main">
        <div class="chronicle-title">
          <span>Dispatch Chronicle</span>
          <strong>${escapeHtml(headline)}</strong>
        </div>
        <div class="chronicle-route" data-testid="chronicle-stations">${stationItems.join('')}</div>
        <div class="chronicle-seals" data-testid="chronicle-seals">${eventSeals}</div>
      </div>
      <details class="ledger-wire-panel">
        <summary>Ledger Wire</summary>
        ${
          recent.length
            ? `<ol>${recent.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>`
            : '<p>No wire headlines filed yet.</p>'
        }
      </details>
    </section>
  `;
}

function renderDispatchCinematic(route: LedgerRoute) {
  return `
    <div class="dispatch-cinematic" role="status" aria-live="polite">
      <strong>Dispatch moving</strong>
      <span>${routeTravelName(route, state.currentNodeId)}</span>
      <button data-action="skip-dispatch">Skip Animation</button>
    </div>
  `;
}

function renderActionGroups() {
  return `
    <div class="action-groups">
      ${actionGroups
        .map(
          (group) => `
            <section class="action-group">
              <h3>${group.title}</h3>
              <div class="prep-list compact-prep-grid">
                ${group.ids.map((id) => renderPrepAction(id)).join('')}
                ${group.title === 'Finance' ? renderRepayAction() : ''}
              </div>
            </section>
          `
        )
        .join('')}
    </div>
  `;
}

function renderPrepAction(actionId: PrepActionId) {
  const action = prepActions.find((item) => item.id === actionId);
  if (!action) {
    return '';
  }
  if (action.id === 'tip' && (!state.stationRumor.available || state.stationRumor.used)) {
    return '';
  }
  const selected = state.selectedActionId === action.id;
  const disabled =
    action.id === 'borrow'
      ? state.creditBorrowedThisLeg || state.borrowedCredit >= creditLimit(state)
      : action.cost > state.cash;
  const costLine =
    action.id === 'borrow'
      ? state.creditBorrowedThisLeg
        ? 'Borrowed this leg'
        : `+${formatMoney(Math.min(BORROW_AMOUNT, creditLimit(state) - state.borrowedCredit))} credit`
      : action.cost === 0
        ? 'Free'
        : formatMoney(action.cost);
  return `
    <button class="prep-action ${selected ? 'selected' : ''}" data-prep-id="${action.id}" ${disabled ? 'disabled' : ''}>
      <img src="${assetUrl(`assets/tokens/${action.asset}`)}" alt="" />
      <span>
        <strong>${action.name}</strong>
        <small>${costLine}</small>
      </span>
    </button>
  `;
}

function renderRepayAction() {
  const disabled = state.borrowedCredit <= 0 || state.cash <= 120;
  return `
    <button class="prep-action finance-action" data-action="repay-debt" ${disabled ? 'disabled' : ''}>
      <img src="${assetUrl('assets/tokens/debt.svg')}" alt="" />
      <span>
        <strong>Repay Debt</strong>
        <small>${state.borrowedCredit > 0 ? `Pay up to ${formatMoney(Math.min(250, state.borrowedCredit, Math.max(0, state.cash - 120)))}` : 'No debt'}</small>
      </span>
    </button>
  `;
}

function renderSelectedActionDetail() {
  const action = state.selectedActionId ? prepActions.find((item) => item.id === state.selectedActionId) : undefined;
  if (!action) {
    return `
      <div class="action-detail-card">
        <strong>Select prep, then click a reachable route.</strong>
        <span>Reveal danger, assign counters, then dispatch.</span>
      </div>
    `;
  }
  return `
    <div class="action-detail-card selected">
      <strong>${action.name}</strong>
      <span>${action.short}</span>
      <em>${action.id === 'borrow' ? `Credit line ${formatMoney(creditLimit(state))}; next interest ${formatMoney(nextInterestCharge(state))}.` : action.cost === 0 ? 'No cash cost.' : `${formatMoney(action.cost)} cash cost.`}</em>
    </div>
  `;
}

function renderHud() {
  return `
    <div class="meter cash"><span>Cash</span><strong>${formatMoney(state.cash)}</strong></div>
    <div class="meter"><span>Score</span><strong>${Math.max(0, state.score).toLocaleString()}</strong></div>
    <div class="bar-meter ${meterClass(state.reputation)}"><span>Reputation</span><b style="width:${state.reputation}%"></b><strong>${state.reputation}</strong></div>
    <div class="bar-meter ${meterClass(state.trust)}"><span>Currency Trust</span><b style="width:${state.trust}%"></b><strong>${state.trust}</strong></div>
    <div class="meter pressure-meter" title="Higher pressure increases hazard frequency and makes protection less reliable."><span>Outlaw Pressure</span><strong>${state.outlawPressure}</strong></div>
    <div class="meter debt"><span>Debt</span><strong>${formatMoney(state.borrowedCredit)}</strong></div>
    <div class="meter"><span>Rate</span><strong>${state.interestRate.toFixed(1)}%</strong></div>
    <div class="meter"><span>Next Interest</span><strong>${formatMoney(nextInterestCharge(state))}</strong></div>
    <div class="meter"><span>Contract</span><strong>${state.journey} &middot; Leg ${state.deliveryInJourney}</strong></div>
    <button class="mute-button" data-action="toggle-sound" title="M toggles sound">${muted ? 'Muted' : 'Sound On'}</button>
  `;
}

function renderResultModal() {
  const result = state.lastResult;
  if (!result) {
    return '';
  }
  const eventAsset = eventAssetForResult(result);
  const effectClass = eventEffectClass(result);
  const statusLabel = dispatchResultStatusLabel(result);
  return `
    <div class="modal-backdrop">
      <article class="result-card ${result.success ? 'success-result' : 'failure-result'} ${result.journeyComplete ? 'legend-result' : ''}" data-result-status="${escapeHtml(statusLabel)}">
        <div class="event-frame ${effectClass}">
          <img src="${assetUrl(`assets/events/${eventAsset}`)}" alt="" class="event-art" />
          <div class="event-fx event-fx-one"></div>
          <div class="event-fx event-fx-two"></div>
          <div class="event-fx event-fx-three"></div>
          <div class="event-spark"></div>
        </div>
        <div>
          ${renderResultStamp(result)}
          <p class="eyebrow">${result.arrivedAtDestination ? 'Destination Arrival' : result.success ? 'Route Result' : 'Board Incident'}</p>
          <h1>${result.arrivedAtDestination ? 'CONTRACT DELIVERED' : result.message}</h1>
          <p class="result-outcome ${result.success ? 'outcome-good' : 'outcome-bad'}">${statusLabel}${result.prepUsed.length ? ` &middot; ${result.prepUsed.length} counter${result.prepUsed.length === 1 ? '' : 's'} attempted` : ''}</p>
          ${renderLedgerWireCurrent(result)}
          <p>${result.detail}</p>
          ${result.arrivedAtDestination ? '<p class="success-copy">The named destination signed the receipt. The money engine keeps turning.</p>' : ''}
          <button class="result-primary-action" data-action="continue-result">${result.firedReason ? 'Face the Board' : result.contractEnded ? 'Review Next Contract' : 'Continue'}</button>
          ${renderResultSections(result)}
          ${
            result.firedReason
              ? `<p class="danger-copy">${result.firedReason}</p>`
              : result.arrivedAtDestination
                ? '<p class="success-copy">New destination contract is posted behind this card.</p>'
                : result.success
                ? '<p class="success-copy">The route engine keeps turning. A harder contract is waiting.</p>'
                : '<p class="danger-copy">The board permits another journey, but the ledger is bruised.</p>'
          }
        </div>
      </article>
    </div>
  `;
}

function renderResultStamp(result: DispatchResultView) {
  const label = stampLabelForResult(result);
  if (!label) {
    return '';
  }
  const tone: StampTone = label === 'CONTRACT EXPIRED' || label === 'FIRED BY THE BOARD' ? 'failure' : 'gold';
  return renderLedgerStamp(label, tone, 'result-stamp');
}

function renderLedgerWireCurrent(result: DispatchResultView) {
  const headline = chronicle.currentHeadline ?? buildLedgerHeadline(result);
  return `
    <aside class="ledger-wire-current" data-testid="ledger-wire-headline" data-headline="${escapeHtml(headline)}">
      <span>The Ledger Wire</span>
      <strong>${escapeHtml(headline)}</strong>
    </aside>
  `;
}

function renderResultSections(result: NonNullable<LedgerState['lastResult']>) {
  const overview = [
    ['Route', routeTravelName(result.route, result.fromNodeId)],
    ['Threat', result.incidents.map((incident) => incident.hazard.name).join(' + ')],
    ['Counter result', result.countersSucceeded.length ? `${result.countersSucceeded.map((id) => actionName(id)).join(', ')} worked` : result.countersAttempted.length ? 'Counter attempted; incident still pressed through' : 'No counter required'],
    ['Exposure', `${result.incidents.length} check${result.incidents.length === 1 ? '' : 's'}`]
  ];
  const contractRows = [
    ['Contract', `${findNodeName(result.contract.origin)} -> ${findNodeName(result.contract.destination)}`],
    ['Cargo value', formatMoney(result.contract.cargoValue)],
    ['Cargo type', result.contract.cargoType]
  ];
  const intel = result.intelGathered.map((report) => [intelLabel(report.source), compactIntelText(report)]);
  if (result.localRumorOutcome) {
    intel.push(['Local rumor followed', localRumorOutcomeText(result.localRumorOutcome)]);
  }
  const attempted = result.countersAttempted.length
    ? [['Counters', result.countersAttempted.map((id) => actionName(id)).join(', ')]]
    : [];
  const succeeded = result.countersSucceeded.length
    ? [['Succeeded', result.countersSucceeded.map((id) => actionName(id)).join(', ')], ['Effect', 'Prevented or reduced the incident.']]
    : [];
  const failed = result.countersFailed.length
    ? [['Failed', result.countersFailed.map((id) => actionName(id)).join(', ')], ['Effect', 'Attempted, but the incident still broke through.']]
    : [];
  const financial = [
    ...amountRow('Payout', result.grossFee, 'money', 'coin'),
    ...amountRow('Net fee', result.netFee, 'signed-money', 'coin'),
    ...amountRow('Score', result.scoreDelta, 'signed-number', 'coin'),
    ...amountRow('Cash', result.cashDelta, 'signed-money', 'cash'),
    ...amountRow('Insurance applied', result.mitigationApplied.includes('insurance') ? Math.round(result.contract.cargoValue * 0.3) : 0, 'money', 'cash'),
    ...amountRow('Debt principal used', result.debtUsed, 'money', 'debt'),
    ...amountRow('Debt principal repaid', result.principalRepaid, 'money', 'debt'),
    ...amountRow('Interest paid', result.interestCharge, 'money', 'interest'),
    ...amountRow('Reputation', result.reputationDelta, 'signed-number', 'reputation'),
    ...amountRow('Currency trust', result.trustDelta, 'signed-number', 'trust'),
    ...amountRow('Outlaw Pressure', result.pressureDelta, 'signed-number', 'pressure')
  ];
  const reserve = result.protectionHeld.length ? [['Protection held in reserve', renderPrepChipList(result.protectionHeld)]] : [];
  const backtrack = result.backtrackPenalty ? [['Backtrack penalty', 'Fee and score reduced.']] : [];
  const primarySections = [
    renderResultSection('Route Summary', overview),
    renderResultSection('Ledger Settlement', financial),
    renderResultSection('Intel Summary', intel.slice(0, 3)),
    renderResultSection('Protection Held In Reserve', reserve)
  ].join('');
  const detailSections = [
    renderResultSection('Contract Details', contractRows),
    renderResultSection('Intel Gathered', intel),
    renderResultSection('Counters Attempted', attempted),
    renderResultSection('Counters Succeeded', succeeded),
    renderResultSection('Counters Failed', failed),
    renderResultSection('Other Ledger Notes', backtrack)
  ].join('');

  return `
    <div class="result-sections result-primary-sections">
      ${primarySections}
    </div>
    ${
      detailSections.trim()
        ? `<details class="full-ledger-details">
            <summary>Full Ledger Details</summary>
            <div class="result-sections result-detail-sections">${detailSections}</div>
          </details>`
        : ''
    }
  `;
}

function renderResultSection(title: string, rows: string[][]) {
  if (rows.length === 0) {
    return '';
  }
  return `
    <section class="result-section">
      <h2>${title}</h2>
      <dl class="result-grid">
        ${rows.map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join('')}
      </dl>
    </section>
  `;
}

function amountRow(label: string, value: number, mode: 'money' | 'signed-money' | 'signed-number', category: string) {
  if (Math.round(value) === 0) {
    return [];
  }
  const rendered = mode === 'money' ? formatMoney(value) : mode === 'signed-money' ? signedMoney(value) : signedNumber(value);
  const klass = value >= 0 ? 'positive-result' : 'negative-result';
  const moneyClass = mode === 'money' ? 'money-result' : klass;
  return [
    [
      label,
      `<span class="${moneyClass} settlement-value settlement-${category}" data-settle-value data-to="${Math.round(value)}" data-format="${mode}" data-final="${escapeHtml(rendered)}" aria-label="${escapeHtml(rendered)}">${prefersReducedMotion() ? rendered : mode === 'signed-number' || mode === 'signed-money' ? '+0' : '$0'}</span>`
    ]
  ];
}

function intelLabel(source: string) {
  return source === 'scout' ? 'Scout report' : source === 'telegraph' ? 'Telegraph report' : 'Local rumor';
}

function intelQualityText(quality: string) {
  if (quality === 'true') {
    return '(useful intelligence)';
  }
  if (quality === 'partial') {
    return '(incomplete information)';
  }
  if (quality === 'false' || quality === 'bait') {
    return '(false rumor)';
  }
  return '(unverified rumor)';
}

function compactIntelText(report: { source: string; quality: string; text: string }) {
  const cleaned = report.text
    .replace(/^Scout:\s*/i, '')
    .replace(/^Wire:\s*/i, '')
    .replace(/^Tip:\s*/i, '')
    .replace(/\.$/, '');
  return `${cleaned}; ${intelQualityText(report.quality).replace(/[()]/g, '')}`;
}

function renderPrepChipList(ids: PrepActionId[]) {
  return `<span class="prep-chip-list">${ids.map((id) => `<b>${escapeHtml(actionName(id))}</b>`).join('')}</span>`;
}

function localRumorOutcomeText(outcome: string) {
  if (outcome === 'useful') {
    return 'Useful local intelligence.';
  }
  if (outcome === 'incomplete') {
    return 'Incomplete information.';
  }
  return 'False rumor.';
}

function createChronicleState(source: LedgerState): ChronicleState {
  return {
    contractId: source.contract.id,
    origin: source.contract.origin,
    destination: source.contract.destination,
    legs: [],
    recentHeadlines: []
  };
}

function recordChronicleLeg(before: LedgerState, result: DispatchResultView) {
  if (chronicle.contractId !== result.contract.id) {
    chronicle = {
      contractId: result.contract.id,
      origin: result.contract.origin,
      destination: result.contract.destination,
      legs: [],
      recentHeadlines: chronicle.recentHeadlines
    };
  }
  const headline = buildLedgerHeadline(result);
  const status = dispatchResultStatusLabel(result);
  chronicle = {
    ...chronicle,
    currentHeadline: headline,
    recentHeadlines: [headline, ...chronicle.recentHeadlines.filter((item) => item !== headline)].slice(0, 8),
    legs: [
      ...chronicle.legs,
      {
        routeId: result.route.id,
        from: result.fromNodeId,
        to: result.nextNodeId,
        routeLabel: routeTravelName(result.route, result.fromNodeId),
        seal: eventSealForResult(result),
        status,
        headline
      }
    ]
  };
}

function eventSealForResult(result: DispatchResultView): EventSeal {
  if (result.arrivedAtDestination) {
    return 'delivery';
  }
  if (!result.success) {
    return result.hazard.id === 'bad-weather'
      ? 'weather'
      : result.hazard.id === 'washed-bridge'
        ? 'bridge'
        : result.hazard.id === 'false-tip' || result.hazard.id === 'scout-missing'
          ? 'rumor'
          : result.hazard.tag === 'ambush' || result.hazard.tag === 'sabotage'
            ? 'ambush'
            : 'loss';
  }
  if (result.countered && (result.hazard.tag === 'ambush' || result.hazard.tag === 'sabotage')) {
    return 'defended';
  }
  if (result.hazard.id === 'clean') {
    return 'clean';
  }
  if (result.hazard.id === 'bad-weather') {
    return 'weather';
  }
  if (result.hazard.id === 'track-cut') {
    return 'repair';
  }
  if (result.hazard.id === 'washed-bridge') {
    return 'bridge';
  }
  if (result.hazard.id === 'false-tip' || result.hazard.id === 'scout-missing') {
    return 'rumor';
  }
  return result.countered ? 'defended' : 'clean';
}

function sealIcon(seal: EventSeal) {
  const icons: Record<EventSeal, string> = {
    clean: 'CP',
    weather: 'WX',
    ambush: 'AM',
    defended: 'DF',
    repair: 'TR',
    bridge: 'BR',
    rumor: 'FR',
    delivery: 'DL',
    loss: 'LS'
  };
  return icons[seal];
}

function buildLedgerHeadline(result: DispatchResultView) {
  const cargo = headlineCargo(result.contract.cargoType);
  const destination = findNodeName(result.contract.destination).toUpperCase();
  const route = routeTravelName(result.route, result.fromNodeId).toUpperCase();
  const net = result.netFee >= 0 ? `NET ${formatMoney(result.netFee)}` : `COST ${formatMoney(Math.abs(result.netFee))}`;

  if (result.arrivedAtDestination) {
    return `${cargo} REACHES ${destination} VIA ${route} WITH ${net}`;
  }
  if (!result.success) {
    if (result.localRumorOutcome === 'false' || result.hazard.id === 'false-tip' || result.hazard.id === 'scout-missing') {
      return `FALSE RUMOR SENDS CREW ON ${route} INTO EMPTY COUNTRY`;
    }
    return `${cargo} LOSS ON ${route} SHAKES ${destination} TRUST`;
  }
  if (result.countered && (result.hazard.tag === 'ambush' || result.hazard.tag === 'sabotage')) {
    return `GUARDS BREAK AMBUSH ON ${route}`;
  }
  if (result.hazard.id === 'track-cut') {
    return `TRACK REOPENED ON ${route} BEFORE ${cargo} LOSES TRUST`;
  }
  if (result.hazard.id === 'washed-bridge') {
    return `BRIDGE CREW KEEPS ${cargo} MOVING ON ${route}`;
  }
  if (result.hazard.id === 'bad-weather') {
    return `${cargo} BEATS WEATHER ON ${route}`;
  }
  if (result.hazard.id === 'clean') {
    return `${cargo} CLEARS ${route} WITHOUT INCIDENT`;
  }
  return `${cargo} HOLDS ON ${route} FOR ${net}`;
}

function headlineCargo(cargoType: string) {
  return cargoType.replace(/\s+/g, ' ').trim().toUpperCase();
}

function stampLabelForResult(result: DispatchResultView) {
  if (result.firedReason) {
    return 'FIRED BY THE BOARD';
  }
  if (result.arrivedAtDestination) {
    return 'DELIVERED';
  }
  if (result.contractEnded && result.success) {
    return 'CONTRACT EXPIRED';
  }
  if (result.countered) {
    return 'COUNTER WORKED';
  }
  if (result.success && result.hazard.id === 'clean') {
    return 'CLEAN PASSAGE';
  }
  return '';
}

function renderLedgerStamp(label: string, tone: StampTone, extraClass = '') {
  const lines = label.split(' ');
  const top = lines.slice(0, Math.ceil(lines.length / 2)).join(' ');
  const bottom = lines.slice(Math.ceil(lines.length / 2)).join(' ');
  return `
    <div class="gold-ledger-stamp stamp-${tone} ${extraClass}" aria-label="${escapeHtml(label)}">
      <svg viewBox="0 0 260 94" role="img" aria-hidden="true" focusable="false">
        <rect x="8" y="8" width="244" height="78" rx="12"></rect>
        <path d="M24 26 H236 M24 68 H236"></path>
        <text x="130" y="${bottom ? 43 : 57}" text-anchor="middle">${escapeHtml(top)}</text>
        ${bottom ? `<text x="130" y="65" text-anchor="middle">${escapeHtml(bottom)}</text>` : ''}
      </svg>
      <span class="stamp-glint"></span>
    </div>
  `;
}

function hydrateSettlementAnimations() {
  const values = [...document.querySelectorAll<HTMLElement>('[data-settle-value]')];
  if (!values.length) {
    return;
  }
  if (prefersReducedMotion()) {
    for (const element of values) {
      element.textContent = element.dataset.final ?? element.textContent;
    }
    return;
  }

  const start = performance.now();
  const duration = 620;
  const update = (time: number) => {
    const t = Math.min(1, (time - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    for (const element of values) {
      const target = Number(element.dataset.to ?? 0);
      const mode = element.dataset.format as 'money' | 'signed-money' | 'signed-number';
      const current = Math.round(target * eased);
      element.textContent = t >= 1 ? element.dataset.final ?? formatSettlementValue(target, mode) : formatSettlementValue(current, mode);
    }
    if (t < 1) {
      window.requestAnimationFrame(update);
    }
  };
  window.requestAnimationFrame(update);
}

function formatSettlementValue(value: number, mode: 'money' | 'signed-money' | 'signed-number') {
  if (mode === 'money') {
    return formatMoney(value);
  }
  if (mode === 'signed-money') {
    return signedMoney(value);
  }
  return signedNumber(value);
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}


function renderFired() {
  if (!state.firedReason) {
    return renderTitle();
  }
  return `
    <main class="page-shell fired-screen">
      <section class="paper-page compact">
        ${renderLedgerStamp('FIRED BY THE BOARD', 'failure', 'page-stamp')}
        <p class="eyebrow">Final Board Review</p>
        <h1>FIRED BY THE BOARD</h1>
        <p>Payroll failed. Merchants refused paper. The route lost trust. The town went back to dust, favors, and shotguns.</p>
        <p class="danger-copy">${state.firedReason}</p>
        <dl class="result-grid">
          <dt>Final score</dt><dd>${state.score.toLocaleString()}</dd>
          <dt>Journey reached</dt><dd>${state.journey}.${state.deliveryInJourney}</dd>
          <dt>Cash</dt><dd>${formatMoney(state.cash)}</dd>
          <dt>Trust</dt><dd>${state.trust}</dd>
        </dl>
        <label class="initials-label" for="initials">Initials</label>
        <input id="initials" maxlength="3" value="DML" />
        <div class="page-actions">
          <button data-action="save-score">Save Score</button>
          <button data-action="skip-score">Skip</button>
          <button data-screen="title">Title</button>
        </div>
      </section>
    </main>
  `;
}

function renderHighScores() {
  const scores = getHighScores();
  const resetMessage = state.resetConfirmUntil && state.resetConfirmUntil > Date.now() ? '<p class="danger-copy">Press R or Reset again to clear local scores.</p>' : '';
  return `
    <main class="page-shell">
      <section class="paper-page compact score-page">
        <div class="ledger-stamp">LOCAL LEDGER</div>
        <p class="eyebrow">Local Browser Storage</p>
        <h1>High Scores</h1>
        <ol class="score-list">
          ${
            scores.length
              ? scores.map((score) => `<li><span>${escapeHtml(score.initials)}</span><strong>${score.score.toLocaleString()}</strong><em>Journey ${score.journey}</em></li>`).join('')
              : '<li class="empty-score">No local ledgers saved yet.</li>'
          }
        </ol>
        ${resetMessage}
        <p class="hint">Scores are saved on this device. No online leaderboard is used.</p>
        <div class="page-actions">
          <button data-screen="office">Play Again</button>
          <button data-screen="title">Title</button>
          <button data-action="reset-scores">Reset Local Scores</button>
        </div>
      </section>
    </main>
  `;
}

function renderMap(mode: 'preview' | 'game') {
  const focus = mode === 'game' && state.dispatchingRouteId ? mapRouteFocusState(routesById[state.dispatchingRouteId]) : mode === 'game' && state.mapMode === 'focus' ? mapFocusState() : undefined;
  const focused = Boolean(focus);
  const focusNodeIds = focus?.nodeIds ?? new Set<NodeId>();
  const labels = nodes
    .map((node) => {
      const point = projectPoint(node.longitude, node.latitude);
      const current = node.id === state.currentNodeId;
      const destination = node.id === state.contract.destination;
      const reachable = getAdjacentRoutes(state.currentNodeId, state.routeStates).some((route) => otherEnd(route, state.currentNodeId) === node.id);
      const dense = isDenseNode(node.id);
      const offset = labelOffset(node.id);
      return `
        <g class="node ${current ? 'current' : ''} ${destination ? 'destination' : ''} ${reachable ? 'reachable-node' : ''} ${dense ? 'dense-node' : ''} ${focusNodeIds.has(node.id) ? 'focus-relevant' : ''}" transform="translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})">
          <circle r="${current ? 20 : destination ? 18 : 12}" />
          ${current ? '<circle class="station-ring" r="33" />' : ''}
          ${destination ? '<circle class="destination-ring" r="31" />' : ''}
          <text x="${offset.x}" y="${offset.y + (mode === 'preview' ? 1 : 0)}">${escapeHtml(node.name)}</text>
        </g>
      `;
    })
    .join('');

  const routeLines = routes
    .map((route) => {
      const routeState = state.routeStates[route.id];
      const selected = state.selectedRouteId === route.id;
      const dispatching = state.dispatchingRouteId === route.id;
      const connected = route.from === state.currentNodeId || route.to === state.currentNodeId;
      const reachable = Boolean(routeState?.active && connected);
      const inspectable = mode === 'preview' || reachable;
      const d = routePath(route);
      const classes = [
        'route-line',
        routeState?.active ? 'active' : 'inactive',
        route.express ? 'express' : '',
        `type-${route.type}`,
        selected ? 'selected' : '',
        reachable ? 'reachable' : '',
        state.dispatchingRouteId && !dispatching ? 'dispatch-muted' : '',
        dispatching ? 'dispatching' : ''
      ].join(' ');
      const aria = routeAriaLabel(route, routeState, mode);
      return `
        <path d="${d}" class="route-hit ${inspectable ? '' : 'disabled'}" ${inspectable ? `data-route-id="${route.id}" tabindex="0" role="button" aria-label="${escapeHtml(aria)}"` : 'tabindex="-1" aria-hidden="true"'}><title>${escapeHtml(routeTooltip(route, routeState, mode))}</title></path>
        <path d="${d}" class="${classes}"></path>
        ${routeState?.assigned.length ? renderRouteBadges(route, routeState.assigned) : ''}
        ${routeState?.revealed && routeState.hazardId !== 'clean' ? renderHazardPip(route) : ''}
        ${dispatching ? renderIncidentPulse(route) : ''}
      `;
    })
    .join('');

  const token = state.dispatchingRouteId
    ? renderMovingToken(routesById[state.dispatchingRouteId])
    : renderStationToken(state.currentNodeId);

  return `
    <div class="map-wrap ${focused ? 'focus-contract' : 'full-network'} ${state.dispatchingRouteId ? 'cinematic-focus' : ''}" ${focus?.attrs ?? ''}>
      <img src="${assetUrl('assets/map/map-base-usa-4k.webp')}" alt="Antique geodata-derived United States map" class="map-base" />
      <svg class="map-overlay" viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}" aria-label="Clickable route graph">
        <g class="route-layer">${routeLines}</g>
        <g class="node-layer">${labels}</g>
        ${token}
      </svg>
    </div>
  `;
}

function mapFocusState() {
  const nodeIds = new Set<NodeId>([state.currentNodeId, state.contract.destination]);
  const legalRoutes = getLegalAdjacentRoutes(state);
  for (const route of legalRoutes) {
    nodeIds.add(route.from);
    nodeIds.add(route.to);
    if (routeClosesDistance(state, route)) {
      nodeIds.add(otherEnd(route, state.currentNodeId));
    }
  }
  if (state.selectedRouteId) {
    const selected = routesById[state.selectedRouteId];
    nodeIds.add(selected.from);
    nodeIds.add(selected.to);
  }

  const points = [...nodeIds].map((nodeId) => projectPoint(nodesById[nodeId].longitude, nodesById[nodeId].latitude));
  const minX = Math.max(0, Math.min(...points.map((point) => point.x)) - 210);
  const maxX = Math.min(MAP_WIDTH, Math.max(...points.map((point) => point.x)) + 210);
  const minY = Math.max(0, Math.min(...points.map((point) => point.y)) - 170);
  const maxY = Math.min(MAP_HEIGHT, Math.max(...points.map((point) => point.y)) + 170);
  const boxWidth = Math.max(1, maxX - minX);
  const boxHeight = Math.max(1, maxY - minY);
  const scale = clampValue(Math.min((MAP_WIDTH / boxWidth) * 0.74, (MAP_HEIGHT / boxHeight) * 0.74), 1.15, 2.35);
  const centerX = ((minX + maxX) / 2 / MAP_WIDTH) * 100;
  const centerY = ((minY + maxY) / 2 / MAP_HEIGHT) * 100;
  const minPan = 100 - scale * 100;
  const panX = clampValue(50 - scale * centerX, minPan, 0);
  const panY = clampValue(50 - scale * centerY, minPan, 0);
  const focusArea = (boxWidth * boxHeight) / (MAP_WIDTH * MAP_HEIGHT);

  return {
    nodeIds,
    attrs: `style="--focus-scale:${scale.toFixed(3)};--focus-pan-x:${panX.toFixed(2)}%;--focus-pan-y:${panY.toFixed(2)}%;" data-focus-scale="${scale.toFixed(3)}" data-focus-area="${focusArea.toFixed(4)}"`
  };
}

function mapRouteFocusState(route: LedgerRoute) {
  const nodeIds = new Set<NodeId>([route.from, route.to, state.contract.destination]);
  const points = [route.from, route.to].map((nodeId) => projectPoint(nodesById[nodeId].longitude, nodesById[nodeId].latitude));
  const minX = Math.max(0, Math.min(...points.map((point) => point.x)) - 250);
  const maxX = Math.min(MAP_WIDTH, Math.max(...points.map((point) => point.x)) + 250);
  const minY = Math.max(0, Math.min(...points.map((point) => point.y)) - 210);
  const maxY = Math.min(MAP_HEIGHT, Math.max(...points.map((point) => point.y)) + 210);
  const boxWidth = Math.max(1, maxX - minX);
  const boxHeight = Math.max(1, maxY - minY);
  const scale = clampValue(Math.min((MAP_WIDTH / boxWidth) * 0.7, (MAP_HEIGHT / boxHeight) * 0.7), 1.18, 2.15);
  const centerX = ((minX + maxX) / 2 / MAP_WIDTH) * 100;
  const centerY = ((minY + maxY) / 2 / MAP_HEIGHT) * 100;
  const minPan = 100 - scale * 100;
  const panX = clampValue(50 - scale * centerX, minPan, 0);
  const panY = clampValue(50 - scale * centerY, minPan, 0);
  const focusArea = (boxWidth * boxHeight) / (MAP_WIDTH * MAP_HEIGHT);

  return {
    nodeIds,
    attrs: `style="--focus-scale:${scale.toFixed(3)};--focus-pan-x:${panX.toFixed(2)}%;--focus-pan-y:${panY.toFixed(2)}%;" data-focus-scale="${scale.toFixed(3)}" data-focus-area="${focusArea.toFixed(4)}" data-dispatch-route="${route.id}"`
  };
}

function clampValue(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function renderIncidentPulse(route: LedgerRoute) {
  const routeState = state.routeStates[route.id];
  const hazard = hazardById(routeState.hazardIds.find((id) => id !== 'clean') ?? routeState.hazardId);
  const mid = routeMidPoint(route);
  const label = hazard.id === 'clean' ? 'Clean passage check' : hazard.name;
  return `
    <g class="incident-pulse" transform="translate(${mid.x.toFixed(1)} ${mid.y.toFixed(1)})">
      <circle class="incident-ring" r="22"></circle>
      <circle class="incident-core" r="7"></circle>
      <title>${escapeHtml(label)}</title>
    </g>
  `;
}

function renderHazardPip(route: LedgerRoute) {
  const mid = routeMidPoint(route);
  const hazard = hazardById(state.routeStates[route.id].hazardId);
  return `
    <g class="hazard-pip" transform="translate(${mid.x.toFixed(1)} ${mid.y.toFixed(1)})">
      <circle r="18"></circle>
      <text y="8">!</text>
      <title>${escapeHtml(hazard.name)}</title>
    </g>
  `;
}

function renderRouteBadges(route: LedgerRoute, assigned: PrepActionId[]) {
  const mid = routeMidPoint(route);
  return `
    <g class="route-badges" transform="translate(${mid.x.toFixed(1)} ${mid.y.toFixed(1)})">
      ${assigned
        .map((actionId, index) => {
          const action = prepActions.find((item) => item.id === actionId);
          const x = (index - (assigned.length - 1) / 2) * 40;
          return `
            <g class="route-badge" transform="translate(${x.toFixed(1)} -36)">
              <circle r="18"></circle>
              <image href="${assetUrl(`assets/tokens/${action?.asset ?? 'strongbox.svg'}`)}" x="-13" y="-13" width="26" height="26"></image>
              <title>${escapeHtml(action?.name ?? actionId)}</title>
            </g>
          `;
        })
        .join('')}
    </g>
  `;
}

function renderStationToken(nodeId: NodeId) {
  const point = projectPoint(nodesById[nodeId].longitude, nodesById[nodeId].latitude);
  return `
    <g class="vehicle-token" transform="translate(${(point.x - 44).toFixed(1)} ${(point.y - 66).toFixed(1)})">
      <image href="${assetUrl('assets/tokens/strongbox.svg')}" width="88" height="74"></image>
    </g>
  `;
}

function renderMovingToken(route: LedgerRoute) {
  const path = routePath(route, state.currentNodeId);
  const duration = prefersReducedMotion() ? '0.12s' : `${(DISPATCH_ANIMATION_MS / 1000).toFixed(1)}s`;
  return `
    <g class="vehicle-token moving">
      <circle class="token-dust dust-one" cx="-54" cy="18" r="10"></circle>
      <circle class="token-dust dust-two" cx="-78" cy="26" r="7"></circle>
      <circle class="token-glint" cx="30" cy="-22" r="8"></circle>
      <image href="${assetUrl(`assets/tokens/${route.type === 'stage' || route.type === 'branch' ? 'stagecoach.svg' : 'train.svg'}`)}" x="-52" y="-48" width="104" height="72"></image>
      <animateMotion dur="${duration}" fill="freeze" path="${path}"></animateMotion>
    </g>
  `;
}

function routePath(route: LedgerRoute, startNodeId: NodeId = route.from) {
  const start = nodesById[startNodeId];
  const endNodeId = startNodeId === route.from ? route.to : route.from;
  const end = nodesById[endNodeId];
  const a = projectPoint(start.longitude, start.latitude);
  const b = projectPoint(end.longitude, end.latitude);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy) || 1;
  const sign = hashString(route.id) % 2 === 0 ? 1 : -1;
  const curve = (route.express ? 0.17 : route.type === 'river' ? 0.1 : 0.065) * sign;
  const mx = (a.x + b.x) / 2 + (-dy / distance) * distance * curve;
  const my = (a.y + b.y) / 2 + (dx / distance) * distance * curve;
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

function routeMidPoint(route: LedgerRoute) {
  const a = projectPoint(nodesById[route.from].longitude, nodesById[route.from].latitude);
  const b = projectPoint(nodesById[route.to].longitude, nodesById[route.to].latitude);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function routeAtlasName(route: LedgerRoute) {
  return `${findNodeName(route.from)} <-> ${findNodeName(route.to)}`;
}

function routeTravelName(route: LedgerRoute, fromNodeId: NodeId) {
  return `${findNodeName(fromNodeId)} -> ${findNodeName(otherEnd(route, fromNodeId))}`;
}

function routeTooltip(route: LedgerRoute, routeState: LedgerState['routeStates'][RouteId] | undefined, mode: 'preview' | 'game') {
  const prep = routeState?.assigned.length ? routeState.assigned.map((id) => actionName(id)).join(', ') : 'No prep assigned';
  const name = mode === 'game' && (route.from === state.currentNodeId || route.to === state.currentNodeId) ? routeTravelName(route, state.currentNodeId) : routeAtlasName(route);
  const tutorial = routeState?.tutorialProtected ? ' | BOARD-CLEARED STARTER ROUTE: The board cleared one opening route so the first contract can teach the ledger.' : '';
  return `${name} | ${route.type} ${route.express ? 'express' : 'route'} | danger ${routeDangerLabel(route, routeState)}${tutorial} | fee x${route.payoutMultiplier.toFixed(2)} | exposure ${incidentExposure(route)} | ${routeState?.active ? 'open' : 'closed'} | ${prep}`;
}

function routeAriaLabel(route: LedgerRoute, routeState: LedgerState['routeStates'][RouteId] | undefined, mode: 'preview' | 'game') {
  const status = mode === 'preview' ? (routeState?.active ? 'open this contract' : 'closed this contract') : routeStatusLabel(state, route);
  const name = mode === 'game' && (route.from === state.currentNodeId || route.to === state.currentNodeId) ? routeTravelName(route, state.currentNodeId) : routeAtlasName(route);
  const tutorial = routeState?.tutorialProtected ? ', board-cleared starter route, 0 percent protected, the board cleared one opening route so the first contract can teach the ledger' : '';
  return `${name}, ${status}, ${route.type}${route.express ? ' express' : ''}, danger ${routeDangerLabel(route, routeState)}${tutorial}, fee multiplier ${route.payoutMultiplier.toFixed(2)}, incident exposure ${incidentExposure(route)}`;
}

function renderPrepBadge(actionId: PrepActionId) {
  const action = prepActions.find((item) => item.id === actionId);
  return `
    <span class="prep-chip">
      <img src="${assetUrl(`assets/tokens/${action?.asset ?? 'strongbox.svg'}`)}" alt="" />
      ${escapeHtml(action?.name ?? actionId)}
    </span>
  `;
}

function actionName(actionId: PrepActionId) {
  return prepActions.find((action) => action.id === actionId)?.name ?? actionId;
}

function eventAssetForResult(result: NonNullable<LedgerState['lastResult']>) {
  if (result.arrivedAtDestination) {
    return 'destination-arrival.svg';
  }
  if (result.success && result.hazard.id === 'clean') {
    return 'successful-delivery.svg';
  }
  if (result.success && result.hazard.id === 'inside-leak' && result.helpfulPrep.includes('decoy')) {
    return 'decoy-success.svg';
  }
  if (result.success && (result.hazard.id === 'track-cut' || result.hazard.id === 'washed-bridge')) {
    return 'repair-crew.svg';
  }
  if (result.success && result.hazard.id === 'ambush') {
    return 'defended-ambush.svg';
  }
  if (result.hazard.id === 'repair-ambush') {
    return 'repair-ambush.svg';
  }
  if (result.hazard.id === 'inside-leak') {
    return 'inside-leak.svg';
  }
  return result.success ? 'successful-delivery.svg' : result.hazard.asset;
}

function eventEffectClass(result: NonNullable<LedgerState['lastResult']>) {
  if (result.success && result.hazard.id === 'clean') {
    return 'effect-success';
  }
  if (!result.success) {
    return 'effect-failure';
  }
  if (result.hazard.tag === 'weather') {
    return 'effect-weather';
  }
  if (result.hazard.tag === 'track' || result.hazard.tag === 'bridge') {
    return 'effect-sparks';
  }
  if (result.hazard.tag === 'ambush' || result.hazard.tag === 'sabotage') {
    return 'effect-smoke';
  }
  if (result.hazard.tag === 'telegraph' || result.hazard.tag === 'inside-leak' || result.hazard.tag === 'false-tip') {
    return 'effect-telegraph';
  }
  return 'effect-success';
}

function labelOffset(nodeId: NodeId) {
  const offsets: Partial<Record<NodeId, { x: number; y: number }>> = {
    'new-york': { x: 24, y: -16 },
    philadelphia: { x: 24, y: 18 },
    'washington-dc': { x: 20, y: 34 },
    boston: { x: 24, y: 2 },
    pittsburgh: { x: 24, y: -10 },
    cleveland: { x: 24, y: 10 },
    detroit: { x: 24, y: -10 },
    chicago: { x: 24, y: 12 },
    milwaukee: { x: 24, y: -10 },
    cincinnati: { x: 24, y: 22 },
    columbus: { x: 24, y: -12 },
    indianapolis: { x: 24, y: 16 },
    dallas: { x: 18, y: -16 },
    'fort-worth': { x: -118, y: 8 },
    houston: { x: 18, y: 20 },
    'san-antonio': { x: -110, y: 20 }
  };
  return offsets[nodeId] ?? { x: 22, y: 8 };
}

function isDenseNode(nodeId: NodeId) {
  return new Set<NodeId>([
    'new-york',
    'philadelphia',
    'washington-dc',
    'boston',
    'pittsburgh',
    'cleveland',
    'columbus',
    'cincinnati',
    'indianapolis',
    'chicago',
    'milwaukee',
    'detroit'
  ]).has(nodeId);
}

function formatMoney(value: number) {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

function signedMoney(value: number) {
  return `${value >= 0 ? '+' : '-'}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

function signedNumber(value: number) {
  return `${value >= 0 ? '+' : ''}${Math.round(value).toLocaleString()}`;
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

type Cue = 'click' | 'dispatch' | 'success' | 'failure' | 'fired' | 'tip' | 'stamp' | 'coin' | 'drawer' | 'debt';

function playResultCues(result?: DispatchResultView) {
  if (!result) {
    return;
  }
  if (result.firedReason) {
    playCue('fired');
    return;
  }
  if (!result.success) {
    playCue('failure');
    if (result.interestCharge > 0 || result.cashDelta < 0) {
      window.setTimeout(() => playCue('debt'), 160);
    }
    return;
  }
  playCue(result.arrivedAtDestination ? 'success' : 'drawer');
  if (result.grossFee > 0 || result.scoreDelta > 0) {
    window.setTimeout(() => playCue('coin'), 130);
  }
  if (result.interestCharge > 0 || result.principalRepaid > 0) {
    window.setTimeout(() => playCue('debt'), 260);
  }
}

function playCue(cue: Cue) {
  if (muted) {
    return;
  }

  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === 'suspended') {
      void audioContext.resume();
    }
    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    const osc = audioContext.createOscillator();
    const table: Record<Cue, [number, number, OscillatorType]> = {
      click: [420, 0.035, 'square'],
      dispatch: [250, 0.16, 'sawtooth'],
      success: [660, 0.2, 'triangle'],
      failure: [160, 0.22, 'sawtooth'],
      fired: [92, 0.45, 'sawtooth'],
      tip: [520, 0.08, 'triangle'],
      stamp: [150, 0.08, 'square'],
      coin: [900, 0.1, 'triangle'],
      drawer: [330, 0.13, 'square'],
      debt: [118, 0.18, 'sawtooth']
    };
    const [frequency, duration, type] = table[cue];
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (cue === 'success' || cue === 'coin') {
      osc.frequency.exponentialRampToValueAtTime(990, now + duration);
    } else if (cue === 'stamp') {
      osc.frequency.exponentialRampToValueAtTime(80, now + duration * 0.7);
    } else if (cue === 'failure' || cue === 'fired' || cue === 'debt') {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.55), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(cue === 'fired' ? 0.12 : cue === 'stamp' ? 0.08 : 0.055, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  } catch {
    muted = true;
  }
}
