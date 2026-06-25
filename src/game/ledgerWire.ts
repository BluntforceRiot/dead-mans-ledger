import { findNodeName, otherEnd, type DispatchResult } from './sim';

export function buildLedgerHeadline(result: DispatchResult) {
  const cargo = headlineCargo(result.contract.cargoType);
  const destination = findNodeName(result.contract.destination).toUpperCase();
  const route = routeTravelName(result).toUpperCase();
  const net = result.netFee >= 0 ? `NET ${formatMoney(result.netFee)}` : `COST ${formatMoney(Math.abs(result.netFee))}`;

  if (result.arrivedAtDestination) {
    return `${cargo} REACHES ${destination} VIA ${route} WITH ${net}`;
  }
  if (!result.success) {
    if (result.localRumorOutcome === 'false' && result.hazard.id === 'clean') {
      return `FALSE RUMOR SENDS CREW ON ${route} INTO EMPTY COUNTRY`;
    }
    if (result.localRumorOutcome === 'false') {
      return `BAD TIP MISREADS ${route}; ${result.hazard.name.toUpperCase()} SHAKES ${destination} TRUST`;
    }
    return `${cargo} LOSS ON ${route} SHAKES ${destination} TRUST`;
  }
  if (result.countered && (result.hazard.tag === 'ambush' || result.hazard.tag === 'sabotage')) {
    return `COUNTER BREAKS AMBUSH ON ${route}`;
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

function routeTravelName(result: DispatchResult) {
  return `${findNodeName(result.fromNodeId)} -> ${findNodeName(otherEnd(result.route, result.fromNodeId))}`;
}

function headlineCargo(cargoType: string) {
  return cargoType.replace(/\s+/g, ' ').trim().toUpperCase();
}

function formatMoney(value: number) {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(value)).toLocaleString()}`;
}
