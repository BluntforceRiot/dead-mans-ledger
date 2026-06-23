import './styles.css';
import { prepActions, type PrepActionId } from './data/gameContent';
import { nodes, nodesById, type NodeId } from './data/nodes';
import { routes, routesById, type LedgerRoute, type RouteId } from './data/routes';
import { clearHighScores, getHighScores, HIGH_SCORE_KEY, saveHighScore } from './game/highScores';
import {
  applyPrepAction,
  canDispatch,
  createInitialState,
  findNodeName,
  generateRouteStates,
  getAdjacentRoutes,
  hazardById,
  meterClass,
  otherEnd,
  resolveDispatch,
  startNewRun,
  type LedgerState,
  type ScreenId
} from './game/sim';
import { MAP_HEIGHT, MAP_WIDTH, projectPoint } from './map/projection';

const appRoot = document.querySelector<HTMLDivElement>('#app')!;

let state: LedgerState = createInitialState(screenFromHash());

window.addEventListener('hashchange', () => {
  state = { ...state, screen: screenFromHash() };
  render();
});

window.addEventListener('keydown', (event) => {
  if (state.screen === 'scores' && event.key.toLowerCase() === 'r') {
    handleScoreReset();
  }
  if (event.key === 'Escape' && state.screen !== 'title') {
    navigate('title');
  }
});

appRoot.addEventListener('click', (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action], [data-screen], [data-route-id], [data-prep-id]');
  if (!target) {
    return;
  }

  const screen = target.dataset.screen as ScreenId | undefined;
  if (screen) {
    if (screen === 'game') {
      state = startNewRun();
      updateHash('game');
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
    case 'continue-result':
      if (state.firedReason) {
        navigate('fired');
      } else {
        state = { ...state, lastResult: undefined };
        render();
      }
      break;
    case 'regen-routes':
      state = {
        ...state,
        seed: Date.now() >>> 0,
        routeStates: generateRouteStates(Date.now() >>> 0, state.journey, state.currentNodeId),
        selectedRouteId: undefined
      };
      render();
      break;
    case 'save-score':
      saveCurrentScore();
      break;
    case 'skip-score':
      navigate('scores');
      break;
    case 'reset-scores':
      handleScoreReset();
      break;
    default:
      break;
  }
});

render();

function screenFromHash(): ScreenId {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  if (raw === 'howto' || raw === 'preview' || raw === 'game' || raw === 'fired' || raw === 'scores') {
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

  if (prepId === 'borrow') {
    state = {
      ...state,
      cash: state.cash + 400,
      interestRate: Math.min(18, state.interestRate + 1.2),
      trust: Math.max(0, state.trust - 2),
      selectedActionId: undefined
    };
    render();
    return;
  }

  state = { ...state, selectedActionId: state.selectedActionId === prepId ? undefined : prepId };
  render();
}

function handleRouteClick(routeId: RouteId) {
  const routeState = state.routeStates[routeId];
  if (!routeState?.active) {
    return;
  }

  if (state.screen === 'preview') {
    state = { ...state, selectedRouteId: routeId };
    render();
    return;
  }

  if (state.screen !== 'game') {
    return;
  }

  const route = routesById[routeId];
  const reachable = route.from === state.currentNodeId || route.to === state.currentNodeId;
  if (!reachable) {
    state = { ...state, selectedRouteId: routeId };
    render();
    return;
  }

  if (state.selectedActionId) {
    state = applyPrepAction(state, routeId, state.selectedActionId);
  } else {
    state = { ...state, selectedRouteId: routeId };
  }
  render();
}

function dispatchSelectedRoute() {
  if (!state.selectedRouteId || !canDispatch(state)) {
    return;
  }

  const routeId = state.selectedRouteId;
  state = { ...state, dispatchingRouteId: routeId, lastResult: undefined };
  render();
  window.setTimeout(() => {
    state = resolveDispatch(state, routeId);
    render();
  }, 900);
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
      : state.screen === 'howto'
        ? renderHowTo()
        : state.screen === 'preview'
          ? renderMapPreview()
          : state.screen === 'game'
            ? renderGame()
            : state.screen === 'fired'
              ? renderFired()
              : renderHighScores();
}

function renderTitle() {
  return `
    <main class="title-screen">
      <div class="title-card">
        <img src="${assetUrl('assets/ui/gold-logo.svg')}" alt="Dead Man's Ledger: The Money Engine" class="logo" />
        <p class="subtitle">The money provided independence. The route was the engine.</p>
        <div class="title-actions">
          <button data-screen="game">Start Ledger Run</button>
          <button data-screen="preview">Map Preview</button>
          <button data-screen="howto">How To Play</button>
          <button data-screen="scores">High Scores</button>
        </div>
        <p class="fine-print">Summer into AI Week 2: Independence Engines &middot; v0.1 foundation</p>
      </div>
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
            <p>Click an active route from your current station. Long express routes pay more, but hide nastier complications.</p>
          </article>
          <article>
            <h2>Prepare the line</h2>
            <p>Choose scouts, guards, repair crews, telegraph reports, decoys, insurance, delays, or credit before dispatching.</p>
          </article>
          <article>
            <h2>Read the danger</h2>
            <p>Scout and telegraph actions can reveal hidden trouble. Matching the right counter earns score and reputation.</p>
          </article>
          <article>
            <h2>Survive the board</h2>
            <p>Cash below ${formatMoney(-500)}, zero reputation, or zero currency trust ends the run.</p>
          </article>
        </div>
        <div class="page-actions">
          <button data-screen="game">Start Run</button>
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
        <h1>Map Preview</h1>
        <p>Base geography is a raster generated from open geodata. Cities and routes are drawn live from <code>nodes.ts</code> and <code>routes.ts</code>.</p>
        <button data-action="regen-routes">Regenerate Availability</button>
        <dl>
          <dt>Nodes</dt><dd>${nodes.length}</dd>
          <dt>Routes</dt><dd>${routes.length}</dd>
          <dt>High score key</dt><dd>${HIGH_SCORE_KEY}</dd>
        </dl>
        ${
          selected
            ? `<div class="route-card">
                <h2>${routeName(selected)}</h2>
                <p>${selected.note}</p>
                <p><strong>${selected.type.toUpperCase()}</strong> &middot; ${selected.distanceTier} &middot; risk ${Math.round(selected.baseRisk * 100)}% &middot; ${selected.express ? 'EXPRESS' : 'standard'}</p>
                <p>${selectedState?.active ? 'Active this run' : 'Inactive this run'}${selectedState?.revealed ? ` &middot; ${hazardById(selectedState.hazardId).name}` : ''}</p>
              </div>`
            : '<p class="hint">Click a route line or city marker to inspect the graph.</p>'
        }
        <div class="page-actions">
          <button data-screen="game">Start Run</button>
          <button data-screen="title">Title</button>
        </div>
      </aside>
      <section class="map-stage large">${renderMap('preview')}</section>
    </main>
  `;
}

function renderGame() {
  const selected = state.selectedRouteId ? routesById[state.selectedRouteId] : undefined;
  const adjacent = getAdjacentRoutes(state.currentNodeId, state.routeStates);
  const selectedState = selected ? state.routeStates[selected.id] : undefined;

  return `
    <main class="game-shell">
      <aside class="side-panel contract-panel">
        <p class="eyebrow">Current Contract</p>
        <h1>${state.shipment.name}</h1>
        <p>${state.shipment.copy}</p>
        <dl class="compact-list">
          <dt>Station</dt><dd>${findNodeName(state.currentNodeId)}</dd>
          <dt>Shipment value</dt><dd>${formatMoney(state.shipment.value)}</dd>
          <dt>Active exits</dt><dd>${adjacent.length}</dd>
        </dl>
        ${
          selected
            ? `<div class="route-card selected-route">
                <p class="eyebrow">Selected Route</p>
                <h2>${routeName(selected)}</h2>
                <p>${selected.note}</p>
                <dl class="compact-list">
                  <dt>Type</dt><dd>${selected.type}${selected.express ? ' express' : ''}</dd>
                  <dt>Risk</dt><dd>${Math.round(selected.baseRisk * 100)}%</dd>
                  <dt>Payout</dt><dd>x${selected.payoutMultiplier.toFixed(2)}</dd>
                  <dt>Intel</dt><dd>${selectedState?.revealed ? hazardById(selectedState.hazardId).name : 'Unconfirmed'}</dd>
                  <dt>Prep</dt><dd>${selectedState?.assigned.length ? selectedState.assigned.map((id) => actionName(id)).join(', ') : 'None'}</dd>
                </dl>
                <button data-action="dispatch" ${canDispatch(state) ? '' : 'disabled'}>${state.dispatchingRouteId ? 'Dispatching...' : 'Dispatch Shipment'}</button>
              </div>`
            : '<p class="hint">Click a route from your current brass marker, then dispatch.</p>'
        }
      </aside>
      <section class="map-stage">${renderMap('game')}</section>
      <aside class="side-panel actions-panel">
        <p class="eyebrow">Preparation</p>
        <h2>Route Actions</h2>
        <p class="hint">Click an action, then click a reachable route. Scout and telegraph reveal hidden trouble.</p>
        <div class="prep-list">
          ${prepActions.map((action) => renderPrepAction(action.id)).join('')}
        </div>
      </aside>
      <section class="hud">${renderHud()}</section>
      ${state.lastResult ? renderResultModal() : ''}
    </main>
  `;
}

function renderPrepAction(actionId: PrepActionId) {
  const action = prepActions.find((item) => item.id === actionId);
  if (!action) {
    return '';
  }
  const selected = state.selectedActionId === action.id;
  const disabled = action.cost > state.cash && action.id !== 'borrow';
  return `
    <button class="prep-action ${selected ? 'selected' : ''}" data-prep-id="${action.id}" ${disabled ? 'disabled' : ''}>
      <img src="${assetUrl(`assets/tokens/${action.asset}`)}" alt="" />
      <span>
        <strong>${action.name}</strong>
        <small>${action.id === 'borrow' ? '+$400 credit' : `${formatMoney(action.cost)} &middot; ${action.short}`}</small>
      </span>
    </button>
  `;
}

function renderHud() {
  return `
    <div class="meter cash"><span>Cash</span><strong>${formatMoney(state.cash)}</strong></div>
    <div class="meter"><span>Score</span><strong>${Math.max(0, state.score).toLocaleString()}</strong></div>
    <div class="bar-meter ${meterClass(state.reputation)}"><span>Reputation</span><b style="width:${state.reputation}%"></b><strong>${state.reputation}</strong></div>
    <div class="bar-meter ${meterClass(state.trust)}"><span>Currency Trust</span><b style="width:${state.trust}%"></b><strong>${state.trust}</strong></div>
    <div class="meter"><span>Outlaw Pressure</span><strong>${state.outlawPressure}</strong></div>
    <div class="meter"><span>Interest</span><strong>${state.interestRate.toFixed(1)}%</strong></div>
    <div class="meter"><span>Journey</span><strong>${state.journey}</strong></div>
  `;
}

function renderResultModal() {
  const result = state.lastResult;
  if (!result) {
    return '';
  }
  const eventAsset = result.success
    ? result.hazard.id === 'clean'
      ? 'successful-delivery.svg'
      : 'defended-ambush.svg'
    : result.hazard.asset;
  return `
    <div class="modal-backdrop">
      <article class="result-card">
        <img src="${assetUrl(`assets/events/${eventAsset}`)}" alt="" class="event-art" />
        <div>
          <p class="eyebrow">${result.success ? 'Route Result' : 'Board Incident'}</p>
          <h1>${result.message}</h1>
          <p>${result.detail}</p>
          <dl class="result-grid">
            <dt>Route</dt><dd>${routeName(result.route)}</dd>
            <dt>Event</dt><dd>${result.hazard.name}</dd>
            <dt>Payout</dt><dd>${formatMoney(result.payout)}</dd>
            <dt>Score</dt><dd>${signedNumber(result.scoreDelta)}</dd>
            <dt>Cash</dt><dd>${signedMoney(result.cashDelta)}</dd>
            <dt>Trust</dt><dd>${signedNumber(result.trustDelta)}</dd>
          </dl>
          ${
            result.firedReason
              ? `<p class="danger-copy">${result.firedReason}</p>`
              : result.success
                ? '<p class="success-copy">The route engine keeps turning. A harder contract is waiting.</p>'
                : '<p class="danger-copy">The board permits another journey, but the ledger is bruised.</p>'
          }
          <button data-action="continue-result">${result.firedReason ? 'Face the Board' : 'Continue'}</button>
        </div>
      </article>
    </div>
  `;
}

function renderFired() {
  return `
    <main class="page-shell fired-screen">
      <section class="paper-page compact">
        <p class="eyebrow">Final Board Review</p>
        <h1>FIRED BY THE BOARD</h1>
        <p>Payroll failed. Merchants refused paper. The route lost trust. The town went back to dust, favors, and shotguns.</p>
        <p class="danger-copy">${state.firedReason ?? 'Demonstration board hearing for review capture.'}</p>
        <dl class="result-grid">
          <dt>Final score</dt><dd>${state.score.toLocaleString()}</dd>
          <dt>Journey reached</dt><dd>${state.journey}</dd>
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
      <section class="paper-page compact">
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
        <p class="hint">Scores live only in <code>${HIGH_SCORE_KEY}</code> on this browser.</p>
        <div class="page-actions">
          <button data-screen="game">Play Again</button>
          <button data-screen="title">Title</button>
          <button data-action="reset-scores">Reset Local Scores</button>
        </div>
      </section>
    </main>
  `;
}

function renderMap(mode: 'preview' | 'game') {
  const labels = nodes
    .map((node) => {
      const point = projectPoint(node.longitude, node.latitude);
      const current = node.id === state.currentNodeId;
      return `
        <g class="node ${current ? 'current' : ''}" transform="translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})">
          <circle r="${current ? 20 : 12}" />
          <text x="22" y="${mode === 'preview' ? 8 : 7}">${escapeHtml(node.name)}</text>
        </g>
      `;
    })
    .join('');

  const routeLines = routes
    .map((route) => {
      const routeState = state.routeStates[route.id];
      const selected = state.selectedRouteId === route.id;
      const reachable = route.from === state.currentNodeId || route.to === state.currentNodeId;
      const d = routePath(route);
      const classes = [
        'route-line',
        routeState?.active ? 'active' : 'inactive',
        route.express ? 'express' : '',
        selected ? 'selected' : '',
        reachable ? 'reachable' : '',
        state.dispatchingRouteId === route.id ? 'dispatching' : ''
      ].join(' ');
      return `
        <path d="${d}" class="route-hit" data-route-id="${route.id}"></path>
        <path d="${d}" class="${classes}"></path>
        ${routeState?.revealed && routeState.hazardId !== 'clean' ? renderHazardPip(route) : ''}
      `;
    })
    .join('');

  const token = state.dispatchingRouteId
    ? renderMovingToken(routesById[state.dispatchingRouteId])
    : renderStationToken(state.currentNodeId);

  return `
    <div class="map-wrap">
      <img src="${assetUrl('assets/map/map-base-usa-4k.webp')}" alt="Antique geodata-derived United States map" class="map-base" />
      <svg class="map-overlay" viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}" aria-label="Clickable route graph">
        <g class="route-layer">${routeLines}</g>
        <g class="node-layer">${labels}</g>
        ${token}
      </svg>
    </div>
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
  return `
    <g class="vehicle-token moving">
      <image href="${assetUrl(`assets/tokens/${route.type === 'stage' || route.type === 'branch' ? 'stagecoach.svg' : 'train.svg'}`)}" x="-52" y="-48" width="104" height="72"></image>
      <animateMotion dur="0.9s" fill="freeze" path="${path}"></animateMotion>
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

function routeName(route: LedgerRoute) {
  return `${findNodeName(route.from)} to ${findNodeName(route.to)}`;
}

function actionName(actionId: PrepActionId) {
  return prepActions.find((action) => action.id === actionId)?.name ?? actionId;
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
