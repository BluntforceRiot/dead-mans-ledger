import type { HazardTag } from './routes';

export type PrepActionId =
  | 'scout'
  | 'guards'
  | 'repair'
  | 'telegraph'
  | 'tip'
  | 'decoy'
  | 'insurance'
  | 'delay'
  | 'borrow';

export type HazardId =
  | 'ambush'
  | 'track-cut'
  | 'washed-bridge'
  | 'bad-weather'
  | 'inside-leak'
  | 'rival-sabotage'
  | 'telegraph-cut'
  | 'false-tip'
  | 'repair-ambush'
  | 'scout-missing'
  | 'clean';

export interface PrepAction {
  id: PrepActionId;
  name: string;
  cost: number;
  short: string;
  counters: HazardId[];
  asset: string;
}

export interface Hazard {
  id: HazardId;
  name: string;
  tag: HazardTag | 'clean';
  severity: number;
  copy: string;
  counters: PrepActionId[];
  asset: string;
}

export interface Shipment {
  name: string;
  value: number;
  trustWeight: number;
  copy: string;
}

export const prepActions: PrepAction[] = [
  { id: 'scout', name: 'Scout Ahead', cost: 120, short: 'Reveals danger and counters ambushes, cuts, weather, and false tips.', counters: ['ambush', 'track-cut', 'washed-bridge', 'rival-sabotage', 'telegraph-cut', 'false-tip', 'scout-missing'], asset: 'scout.svg' },
  { id: 'guards', name: 'Hire Guards', cost: 180, short: 'Protects against ambushes, sabotage, and guarded repair trouble.', counters: ['ambush', 'rival-sabotage', 'repair-ambush'], asset: 'guards.svg' },
  { id: 'repair', name: 'Send Repair Crew', cost: 160, short: 'Useful for track cuts and bridge damage.', counters: ['track-cut', 'washed-bridge'], asset: 'repair-crew.svg' },
  { id: 'telegraph', name: 'Telegraph Report', cost: 100, short: 'Reveals official intel and counters weather, leaks, sabotage, and false tips.', counters: ['bad-weather', 'inside-leak', 'rival-sabotage', 'false-tip'], asset: 'telegraph.svg' },
  { id: 'tip', name: 'Local Tip', cost: 0, short: 'Free rumor. Sometimes true, sometimes bait.', counters: [], asset: 'telegraph.svg' },
  { id: 'decoy', name: 'Decoy Strongbox', cost: 90, short: 'Confuses ambushes and inside leaks.', counters: ['ambush', 'inside-leak'], asset: 'decoy.svg' },
  { id: 'insurance', name: 'Insurance', cost: 140, short: 'Softens cash loss when a route goes wrong.', counters: [], asset: 'strongbox.svg' },
  { id: 'delay', name: 'Delay One Day', cost: 60, short: 'Lets weather or cut wires settle before dispatch.', counters: ['washed-bridge', 'bad-weather', 'telegraph-cut'], asset: 'telegraph.svg' },
  { id: 'borrow', name: 'Borrow Credit', cost: 0, short: 'Adds cash now, raises interest pressure later.', counters: [], asset: 'strongbox.svg' }
];

export const hazards: Hazard[] = [
  { id: 'ambush', name: 'Outlaw Ambush', tag: 'ambush', severity: 0.28, copy: 'Riders hit the strongbox route before dawn.', counters: ['scout', 'guards', 'decoy'], asset: 'ambush.svg' },
  { id: 'track-cut', name: 'Track Cut', tag: 'track', severity: 0.22, copy: 'A rail splice is torn out along the selected line.', counters: ['scout', 'repair'], asset: 'track-cut.svg' },
  { id: 'washed-bridge', name: 'Washed Bridge', tag: 'bridge', severity: 0.24, copy: 'The crossing is damaged and the cash cannot simply wait.', counters: ['scout', 'repair', 'delay'], asset: 'bridge-damage.svg' },
  { id: 'bad-weather', name: 'Bad Weather', tag: 'weather', severity: 0.2, copy: 'Weather closes around the engine and hides every bad decision.', counters: ['telegraph', 'delay', 'scout'], asset: 'snowstorm.svg' },
  { id: 'inside-leak', name: 'Inside Leak', tag: 'inside-leak', severity: 0.26, copy: 'Someone knew the manifest before the route was picked.', counters: ['telegraph', 'decoy'], asset: 'telegraph-warning.svg' },
  { id: 'rival-sabotage', name: 'Rival Company Sabotage', tag: 'sabotage', severity: 0.24, copy: 'A rival office bought a little silence and a lot of trouble.', counters: ['guards', 'telegraph', 'scout'], asset: 'track-cut.svg' },
  { id: 'telegraph-cut', name: 'Telegraph Cut', tag: 'telegraph', severity: 0.18, copy: 'The wire goes dead before the station can confirm passage.', counters: ['scout', 'delay'], asset: 'telegraph-warning.svg' },
  { id: 'false-tip', name: 'False Local Tip', tag: 'false-tip', severity: 0.2, copy: 'Free advice arrives wrapped in a smile and a bad map.', counters: ['telegraph', 'scout'], asset: 'ambush.svg' },
  { id: 'repair-ambush', name: 'Repair Crew Ambushed', tag: 'ambush', severity: 0.24, copy: 'The crew sent to fix the line becomes the bait.', counters: ['guards', 'scout'], asset: 'defended-ambush.svg' },
  { id: 'scout-missing', name: 'Scout Missing', tag: 'false-tip', severity: 0.18, copy: 'Your rider does not return before the shipment must move.', counters: ['scout', 'delay'], asset: 'failed-delivery.svg' },
  { id: 'clean', name: 'Clean Passage', tag: 'clean', severity: 0, copy: 'The route holds. The money arrives with its reputation intact.', counters: [], asset: 'successful-delivery.svg' }
];

export const shipments: Shipment[] = [
  { name: 'Federal Notes', value: 620, trustWeight: 1.2, copy: 'Paper confidence travels in a locked case.' },
  { name: 'Mine Payroll', value: 760, trustWeight: 0.8, copy: 'A camp gets paid or a mountain gets angry.' },
  { name: 'Bank Drafts', value: 680, trustWeight: 1.1, copy: 'A slim packet with a heavy consequence.' },
  { name: 'Merchant Credit', value: 540, trustWeight: 1, copy: "The town buys tomorrow with today's signature." },
  { name: 'Land Office Documents', value: 500, trustWeight: 1.3, copy: 'A clean title is worth more than its paper weight.' },
  { name: 'Silver Reserve', value: 900, trustWeight: 0.9, copy: 'Metal in the box, rumors outside it.' },
  { name: 'Treasury Packet', value: 820, trustWeight: 1.4, copy: 'Federal trust in a stamped envelope.' },
  { name: 'Railroad Wages', value: 700, trustWeight: 0.95, copy: 'Crews trust the rails when the payroll arrives.' },
  { name: 'County Tax Receipts', value: 580, trustWeight: 1.15, copy: 'Local government runs on paper that survives the road.' },
  { name: 'Bank Charter Documents', value: 860, trustWeight: 1.35, copy: 'A town becomes a market when its charter reaches the desk.' }
];

export const hazardTagFallbacks: Record<HazardTag, HazardId[]> = {
  ambush: ['ambush', 'repair-ambush'],
  track: ['track-cut'],
  bridge: ['washed-bridge'],
  weather: ['bad-weather'],
  'inside-leak': ['inside-leak'],
  sabotage: ['rival-sabotage'],
  telegraph: ['telegraph-cut'],
  'false-tip': ['false-tip', 'scout-missing']
};
