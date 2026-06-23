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
  cargoType: string;
  value: number;
  trustWeight: number;
  copy: string;
}

export const prepActions: PrepAction[] = [
  { id: 'scout', name: 'Scout Ahead', cost: 35, short: 'Reveals physical danger and improves matching counters.', counters: [], asset: 'scout.svg' },
  { id: 'guards', name: 'Hire Guards', cost: 75, short: 'Protects against ambushes, sabotage, and guarded repair trouble.', counters: ['ambush', 'rival-sabotage', 'repair-ambush'], asset: 'guards.svg' },
  { id: 'repair', name: 'Send Repair Crew', cost: 75, short: 'Useful for track cuts and bridge damage.', counters: ['track-cut', 'washed-bridge'], asset: 'repair-crew.svg' },
  { id: 'telegraph', name: 'Telegraph Report', cost: 35, short: 'Reveals official warnings and improves matching counters.', counters: [], asset: 'telegraph.svg' },
  { id: 'tip', name: 'Local Tip', cost: 0, short: 'Free rumor. Sometimes true, sometimes bait.', counters: [], asset: 'telegraph.svg' },
  { id: 'decoy', name: 'Decoy Strongbox', cost: 55, short: 'Confuses ambushes and inside leaks.', counters: ['ambush', 'inside-leak'], asset: 'decoy.svg' },
  { id: 'insurance', name: 'Insurance', cost: 80, short: 'Softens cash loss when a route goes wrong.', counters: [], asset: 'strongbox.svg' },
  { id: 'delay', name: 'Delay One Day', cost: 25, short: 'Lets weather or cut wires settle before dispatch.', counters: ['washed-bridge', 'bad-weather', 'telegraph-cut', 'false-tip', 'scout-missing'], asset: 'telegraph.svg' },
  { id: 'borrow', name: 'Borrow Credit', cost: 0, short: 'Adds cash now, raises interest pressure later.', counters: [], asset: 'strongbox.svg' }
];

export const hazards: Hazard[] = [
  { id: 'ambush', name: 'Outlaw Ambush', tag: 'ambush', severity: 0.28, copy: 'Riders hit the strongbox route before dawn.', counters: ['guards', 'decoy'], asset: 'ambush.svg' },
  { id: 'track-cut', name: 'Track Cut', tag: 'track', severity: 0.22, copy: 'A rail splice is torn out along the selected line.', counters: ['repair'], asset: 'track-cut.svg' },
  { id: 'washed-bridge', name: 'Washed Bridge', tag: 'bridge', severity: 0.24, copy: 'The crossing is damaged and the cash cannot simply wait.', counters: ['repair', 'delay'], asset: 'bridge-damage.svg' },
  { id: 'bad-weather', name: 'Bad Weather', tag: 'weather', severity: 0.2, copy: 'Weather closes around the engine and hides every bad decision.', counters: ['delay'], asset: 'bad-weather.svg' },
  { id: 'inside-leak', name: 'Inside Leak', tag: 'inside-leak', severity: 0.26, copy: 'Someone knew the manifest before the route was picked.', counters: ['decoy'], asset: 'telegraph-warning.svg' },
  { id: 'rival-sabotage', name: 'Rival Company Sabotage', tag: 'sabotage', severity: 0.24, copy: 'A rival office bought a little silence and a lot of trouble.', counters: ['guards'], asset: 'rival-sabotage.svg' },
  { id: 'telegraph-cut', name: 'Telegraph Cut', tag: 'telegraph', severity: 0.18, copy: 'The wire goes dead before the station can confirm passage.', counters: ['delay'], asset: 'telegraph-cut.svg' },
  { id: 'false-tip', name: 'False Local Tip', tag: 'false-tip', severity: 0.2, copy: 'Free advice arrives wrapped in a smile and a bad map.', counters: ['delay'], asset: 'ambush.svg' },
  { id: 'repair-ambush', name: 'Repair Crew Ambushed', tag: 'ambush', severity: 0.24, copy: 'The crew sent to fix the line becomes the bait.', counters: ['guards'], asset: 'defended-ambush.svg' },
  { id: 'scout-missing', name: 'Scout Missing', tag: 'false-tip', severity: 0.18, copy: 'Your rider does not return before the shipment must move.', counters: ['delay'], asset: 'failed-delivery.svg' },
  { id: 'clean', name: 'Clean Passage', tag: 'clean', severity: 0, copy: 'The route holds. The money arrives with its reputation intact.', counters: [], asset: 'successful-delivery.svg' }
];

export const shipments: Shipment[] = [
  { name: 'Federal Notes', cargoType: 'Currency notes', value: 620, trustWeight: 1.2, copy: 'Paper confidence travels in a locked case.' },
  { name: 'Mine Payroll', cargoType: 'Payroll specie', value: 760, trustWeight: 0.8, copy: 'A camp gets paid or a mountain gets angry.' },
  { name: 'Bank Drafts', cargoType: 'Bank paper', value: 680, trustWeight: 1.1, copy: 'A slim packet with a heavy consequence.' },
  { name: 'Merchant Credit', cargoType: 'Merchant note', value: 540, trustWeight: 1, copy: "The town buys tomorrow with today's signature." },
  { name: 'Land Office Documents', cargoType: 'Land papers', value: 500, trustWeight: 1.3, copy: 'A clean title is worth more than its paper weight.' },
  { name: 'Silver Reserve', cargoType: 'Silver reserve', value: 900, trustWeight: 0.9, copy: 'Metal in the box, rumors outside it.' },
  { name: 'Treasury Packet', cargoType: 'Treasury packet', value: 820, trustWeight: 1.4, copy: 'Federal trust in a stamped envelope.' },
  { name: 'Railroad Wages', cargoType: 'Rail wages', value: 700, trustWeight: 0.95, copy: 'Crews trust the rails when the payroll arrives.' },
  { name: 'County Tax Receipts', cargoType: 'Tax receipts', value: 580, trustWeight: 1.15, copy: 'Local government runs on paper that survives the road.' },
  { name: 'Bank Charter Documents', cargoType: 'Charter papers', value: 860, trustWeight: 1.35, copy: 'A town becomes a market when its charter reaches the desk.' }
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
