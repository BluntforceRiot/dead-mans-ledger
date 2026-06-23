import type { NodeId, Region } from './nodes';

export type RouteType = 'rail' | 'stage' | 'branch' | 'river' | 'sea';
export type DistanceTier = 'short' | 'medium' | 'long' | 'express';
export type Availability = 'core' | 'swing' | 'rare';
export type HazardTag =
  | 'ambush'
  | 'track'
  | 'bridge'
  | 'weather'
  | 'inside-leak'
  | 'sabotage'
  | 'telegraph'
  | 'false-tip';

export interface LedgerRoute {
  id: string;
  from: NodeId;
  to: NodeId;
  type: RouteType;
  biome: Region;
  baseRisk: number;
  distanceTier: DistanceTier;
  payoutMultiplier: number;
  express: boolean;
  tags: HazardTag[];
  availability: Availability;
  note: string;
}

function r(
  id: string,
  from: NodeId,
  to: NodeId,
  type: RouteType,
  biome: Region,
  baseRisk: number,
  distanceTier: DistanceTier,
  payoutMultiplier: number,
  express: boolean,
  tags: HazardTag[],
  availability: Availability,
  note: string
): LedgerRoute {
  return { id, from, to, type, biome, baseRisk, distanceTier, payoutMultiplier, express, tags, availability, note };
}

export const routes = [
  r('west-seattle-portland', 'seattle', 'portland', 'rail', 'pacific', 0.15, 'short', 1.05, false, ['weather', 'bridge'], 'core', 'Wet coastal rail work with bridge trouble.'),
  r('west-portland-medford', 'portland', 'medford', 'stage', 'pacific', 0.2, 'medium', 1.12, false, ['ambush', 'weather'], 'core', 'Southern Oregon pass route.'),
  r('west-medford-sacramento', 'medford', 'sacramento', 'stage', 'pacific', 0.24, 'medium', 1.18, false, ['ambush', 'bridge'], 'core', 'Mountain road into California.'),
  r('west-sacramento-san-francisco', 'sacramento', 'san-francisco', 'rail', 'pacific', 0.12, 'short', 1.08, false, ['inside-leak', 'sabotage'], 'core', 'Bank-paper transfer toward the bay.'),
  r('west-sacramento-reno', 'sacramento', 'reno', 'rail', 'mountain', 0.27, 'medium', 1.28, false, ['track', 'weather'], 'core', 'Sierra crossing with rail-cut risk.'),
  r('west-san-francisco-reno', 'san-francisco', 'reno', 'rail', 'mountain', 0.3, 'long', 1.38, false, ['track', 'ambush', 'weather'], 'swing', 'Silver and bank drafts through the Sierra.'),
  r('west-san-francisco-los-angeles', 'san-francisco', 'los-angeles', 'sea', 'pacific', 0.18, 'long', 1.24, false, ['weather', 'inside-leak'], 'swing', 'Coastal packet route.'),
  r('west-los-angeles-san-diego', 'los-angeles', 'san-diego', 'stage', 'desert', 0.18, 'short', 1.12, false, ['ambush', 'false-tip'], 'core', 'Southern road with bandit rumors.'),
  r('west-los-angeles-las-vegas', 'los-angeles', 'las-vegas', 'stage', 'desert', 0.3, 'medium', 1.34, false, ['weather', 'ambush'], 'swing', 'Dry road to the desert office.'),
  r('west-reno-salt-lake-city', 'reno', 'salt-lake-city', 'rail', 'mountain', 0.32, 'long', 1.42, false, ['track', 'weather', 'telegraph'], 'core', 'Mountain basin rail corridor.'),
  r('express-san-francisco-salt-lake-city', 'san-francisco', 'salt-lake-city', 'rail', 'mountain', 0.44, 'express', 1.82, true, ['track', 'weather', 'sabotage'], 'rare', 'High-pay express over the Sierra and basin.'),

  r('nw-seattle-spokane', 'seattle', 'spokane', 'rail', 'northern', 0.25, 'medium', 1.26, false, ['weather', 'bridge', 'telegraph'], 'core', 'Cascade and inland northwest connection.'),
  r('nw-spokane-boise', 'spokane', 'boise', 'stage', 'mountain', 0.3, 'medium', 1.32, false, ['ambush', 'weather'], 'swing', 'Snake country transfer.'),
  r('nw-boise-salt-lake-city', 'boise', 'salt-lake-city', 'rail', 'mountain', 0.28, 'medium', 1.3, false, ['track', 'bridge'], 'core', 'Mountain rail leg south and east.'),
  r('nw-spokane-bozeman', 'spokane', 'bozeman', 'stage', 'mountain', 0.34, 'medium', 1.38, false, ['ambush', 'weather', 'false-tip'], 'core', 'Mountain pass route with uncertain local tips.'),
  r('nw-bozeman-great-falls', 'bozeman', 'great-falls', 'stage', 'northern', 0.24, 'short', 1.2, false, ['weather', 'ambush'], 'core', 'Northern Montana frontier leg.'),
  r('nw-great-falls-fargo', 'great-falls', 'fargo', 'rail', 'northern', 0.38, 'long', 1.55, false, ['weather', 'track', 'telegraph'], 'swing', 'Cold northern rail stretch.'),
  r('express-seattle-fargo', 'seattle', 'fargo', 'rail', 'northern', 0.5, 'express', 2.05, true, ['weather', 'track', 'telegraph', 'sabotage'], 'rare', 'Big northern express that can make or break a run.'),

  r('north-fargo-duluth', 'fargo', 'duluth', 'rail', 'northern', 0.24, 'medium', 1.24, false, ['weather', 'track'], 'core', 'Red River money to Lake Superior.'),
  r('north-duluth-sault-ste-marie', 'duluth', 'sault-ste-marie', 'sea', 'northern', 0.3, 'medium', 1.36, false, ['weather', 'inside-leak'], 'core', 'Lake Superior packet line toward the Soo.'),
  r('north-sault-detroit', 'sault-ste-marie', 'detroit', 'sea', 'northern', 0.27, 'medium', 1.32, false, ['weather', 'inside-leak'], 'core', 'Lakes passage into Detroit River industry.'),
  r('express-duluth-detroit', 'duluth', 'detroit', 'sea', 'northern', 0.42, 'express', 1.78, true, ['weather', 'inside-leak', 'sabotage'], 'rare', 'Fast lake packet with high scrutiny.'),
  r('north-detroit-cleveland', 'detroit', 'cleveland', 'rail', 'eastern', 0.18, 'short', 1.14, false, ['sabotage', 'inside-leak'], 'core', 'Industrial transfer along the lakes.'),
  r('north-cleveland-pittsburgh', 'cleveland', 'pittsburgh', 'rail', 'eastern', 0.18, 'short', 1.16, false, ['track', 'sabotage'], 'core', 'Iron and river money to Pittsburgh.'),
  r('north-cleveland-new-york', 'cleveland', 'new-york', 'rail', 'eastern', 0.3, 'long', 1.44, false, ['inside-leak', 'sabotage', 'track'], 'swing', 'High-value eastern bank line.'),
  r('north-new-york-boston', 'new-york', 'boston', 'rail', 'eastern', 0.16, 'short', 1.14, false, ['inside-leak', 'sabotage'], 'core', 'Atlantic finance dash.'),

  r('plains-denver-cheyenne', 'denver', 'cheyenne', 'rail', 'plains', 0.18, 'short', 1.12, false, ['weather', 'track'], 'core', 'Front Range rail handoff.'),
  r('plains-cheyenne-north-platte', 'cheyenne', 'north-platte', 'rail', 'plains', 0.22, 'medium', 1.22, false, ['track', 'weather', 'ambush'], 'core', 'Platte corridor eastbound.'),
  r('plains-north-platte-omaha', 'north-platte', 'omaha', 'rail', 'plains', 0.2, 'medium', 1.2, false, ['track', 'bridge'], 'core', 'Nebraska rail through open country.'),
  r('plains-omaha-des-moines', 'omaha', 'des-moines', 'rail', 'plains', 0.16, 'short', 1.12, false, ['bridge', 'inside-leak'], 'core', 'Missouri River crossing to Iowa.'),
  r('plains-des-moines-chicago', 'des-moines', 'chicago', 'rail', 'northern', 0.2, 'medium', 1.22, false, ['track', 'sabotage'], 'core', 'Prairie money into Chicago velocity.'),
  r('plains-denver-kansas-city', 'denver', 'kansas-city', 'rail', 'plains', 0.28, 'long', 1.4, false, ['ambush', 'weather', 'track'], 'swing', 'Long plains run to the Missouri.'),
  r('express-denver-chicago', 'denver', 'chicago', 'rail', 'plains', 0.47, 'express', 1.95, true, ['track', 'weather', 'sabotage'], 'rare', 'Dangerous express into the rail capital.'),
  r('plains-omaha-sioux-falls', 'omaha', 'sioux-falls', 'stage', 'plains', 0.22, 'medium', 1.2, false, ['weather', 'ambush'], 'swing', 'Dakota branch with prairie exposure.'),
  r('plains-sioux-falls-fargo', 'sioux-falls', 'fargo', 'rail', 'plains', 0.22, 'medium', 1.22, false, ['weather', 'track'], 'core', 'Northern plains office chain.'),

  r('upper-fargo-minneapolis', 'fargo', 'minneapolis', 'rail', 'northern', 0.2, 'medium', 1.2, false, ['weather', 'track'], 'core', 'Cold run to mill-city credit.'),
  r('upper-minneapolis-duluth', 'minneapolis', 'duluth', 'rail', 'northern', 0.17, 'short', 1.12, false, ['weather', 'bridge'], 'core', 'Mill money to Lake Superior.'),
  r('upper-minneapolis-milwaukee', 'minneapolis', 'milwaukee', 'rail', 'northern', 0.22, 'medium', 1.22, false, ['track', 'sabotage'], 'swing', 'Upper Midwest bank line.'),
  r('upper-milwaukee-chicago', 'milwaukee', 'chicago', 'rail', 'northern', 0.12, 'short', 1.08, false, ['inside-leak', 'sabotage'], 'core', 'Lake Michigan city pair.'),
  r('upper-minneapolis-des-moines', 'minneapolis', 'des-moines', 'rail', 'plains', 0.18, 'medium', 1.16, false, ['weather', 'track'], 'core', 'River and prairie credit transfer.'),
  r('upper-des-moines-omaha', 'des-moines', 'omaha', 'rail', 'plains', 0.16, 'short', 1.12, false, ['bridge', 'false-tip'], 'core', 'Central plains ledger shuttle.'),

  r('central-santa-fe-albuquerque', 'santa-fe', 'albuquerque', 'stage', 'desert', 0.16, 'short', 1.1, false, ['false-tip', 'weather'], 'core', 'Old road paper between New Mexico offices.'),
  r('central-salt-lake-denver', 'salt-lake-city', 'denver', 'rail', 'mountain', 0.35, 'long', 1.5, false, ['track', 'weather', 'bridge'], 'core', 'Mountain rail line into Denver.'),
  r('central-salt-lake-las-vegas', 'salt-lake-city', 'las-vegas', 'stage', 'desert', 0.3, 'medium', 1.34, false, ['weather', 'ambush'], 'swing', 'Dry basin branch.'),
  r('central-las-vegas-phoenix', 'las-vegas', 'phoenix', 'stage', 'desert', 0.34, 'medium', 1.4, false, ['weather', 'false-tip', 'ambush'], 'core', 'Desert heat and scarce intel.'),
  r('central-phoenix-tucson', 'phoenix', 'tucson', 'stage', 'desert', 0.22, 'short', 1.18, false, ['ambush', 'false-tip'], 'core', 'Sonoran branch.'),
  r('central-tucson-albuquerque', 'tucson', 'albuquerque', 'stage', 'desert', 0.34, 'medium', 1.42, false, ['ambush', 'weather', 'false-tip'], 'swing', 'Hard desert route to the Rio Grande.'),
  r('central-albuquerque-wichita', 'albuquerque', 'wichita', 'rail', 'plains', 0.3, 'long', 1.44, false, ['track', 'weather'], 'swing', 'Dry plains transfer.'),
  r('central-wichita-oklahoma-city', 'wichita', 'oklahoma-city', 'rail', 'plains', 0.18, 'short', 1.14, false, ['track', 'ambush'], 'core', 'South-central rail hop.'),
  r('central-oklahoma-kansas-city', 'oklahoma-city', 'kansas-city', 'rail', 'plains', 0.22, 'medium', 1.22, false, ['track', 'inside-leak'], 'core', 'Territory money toward the Missouri.'),
  r('central-kansas-city-st-louis', 'kansas-city', 'st-louis', 'rail', 'river', 0.18, 'medium', 1.18, false, ['bridge', 'inside-leak'], 'core', 'Missouri River paper line.'),
  r('central-wichita-kansas-city', 'wichita', 'kansas-city', 'rail', 'plains', 0.18, 'short', 1.14, false, ['track', 'false-tip'], 'core', 'Kansas money northbound.'),
  r('central-oklahoma-fort-worth', 'oklahoma-city', 'fort-worth', 'rail', 'plains', 0.22, 'medium', 1.2, false, ['ambush', 'track'], 'core', 'Territory to stockyard transfer.'),

  r('gulf-fort-worth-dallas', 'fort-worth', 'dallas', 'rail', 'plains', 0.1, 'short', 1.06, false, ['inside-leak'], 'core', 'Twin north Texas offices.'),
  r('gulf-dallas-austin', 'dallas', 'austin', 'rail', 'gulf', 0.18, 'medium', 1.16, false, ['track', 'sabotage'], 'core', 'Statehouse papers southbound.'),
  r('gulf-fort-worth-austin', 'fort-worth', 'austin', 'stage', 'gulf', 0.21, 'medium', 1.18, false, ['ambush', 'false-tip'], 'swing', 'Hill-country wagon contract.'),
  r('gulf-austin-san-antonio', 'austin', 'san-antonio', 'stage', 'gulf', 0.16, 'short', 1.12, false, ['ambush', 'weather'], 'core', 'Capital to military-road leg.'),
  r('gulf-austin-houston', 'austin', 'houston', 'rail', 'gulf', 0.18, 'medium', 1.18, false, ['bridge', 'weather'], 'core', 'Hill country to bayou credit.'),
  r('gulf-san-antonio-houston', 'san-antonio', 'houston', 'rail', 'gulf', 0.2, 'medium', 1.2, false, ['track', 'weather'], 'core', 'Gulf-bound transfer.'),
  r('gulf-houston-new-orleans', 'houston', 'new-orleans', 'sea', 'gulf', 0.28, 'medium', 1.34, false, ['weather', 'inside-leak'], 'core', 'Gulf packet exposed to storms and leaks.'),
  r('express-san-antonio-new-orleans', 'san-antonio', 'new-orleans', 'stage', 'gulf', 0.44, 'express', 1.78, true, ['ambush', 'weather', 'inside-leak'], 'rare', 'Hard southern express with a handsome payout.'),
  r('gulf-new-orleans-memphis', 'new-orleans', 'memphis', 'river', 'river', 0.26, 'medium', 1.3, false, ['bridge', 'weather', 'inside-leak'], 'core', 'Mississippi run upriver.'),

  r('east-memphis-st-louis', 'memphis', 'st-louis', 'river', 'river', 0.22, 'medium', 1.24, false, ['weather', 'inside-leak', 'bridge'], 'core', 'River commerce into the gateway.'),
  r('east-st-louis-chicago', 'st-louis', 'chicago', 'rail', 'river', 0.18, 'medium', 1.18, false, ['track', 'sabotage'], 'core', 'Gateway to rail capital.'),
  r('east-chicago-detroit', 'chicago', 'detroit', 'rail', 'eastern', 0.18, 'medium', 1.18, false, ['track', 'inside-leak'], 'core', 'Lake belt finance line.'),
  r('east-st-louis-indianapolis', 'st-louis', 'indianapolis', 'rail', 'eastern', 0.17, 'medium', 1.16, false, ['track', 'false-tip'], 'core', 'Crossroads contract.'),
  r('east-indianapolis-columbus', 'indianapolis', 'columbus', 'rail', 'eastern', 0.14, 'short', 1.12, false, ['inside-leak', 'sabotage'], 'core', 'Midwest statehouse transfer.'),
  r('east-columbus-pittsburgh', 'columbus', 'pittsburgh', 'rail', 'eastern', 0.16, 'short', 1.14, false, ['track', 'sabotage'], 'core', 'Industrial money eastbound.'),
  r('east-pittsburgh-philadelphia', 'pittsburgh', 'philadelphia', 'rail', 'eastern', 0.2, 'medium', 1.22, false, ['track', 'inside-leak'], 'core', 'Mountain-to-printer finance line.'),
  r('east-philadelphia-new-york', 'philadelphia', 'new-york', 'rail', 'eastern', 0.12, 'short', 1.1, false, ['inside-leak', 'sabotage'], 'core', 'Dense bank corridor.'),
  r('east-washington-philadelphia', 'washington-dc', 'philadelphia', 'rail', 'eastern', 0.14, 'short', 1.12, false, ['inside-leak', 'telegraph'], 'core', 'Federal paper to old capital printers.'),
  r('east-st-louis-washington', 'st-louis', 'washington-dc', 'rail', 'eastern', 0.42, 'express', 1.82, true, ['track', 'inside-leak', 'sabotage'], 'rare', 'Political express with brutal scrutiny.'),
  r('east-cincinnati-columbus', 'cincinnati', 'columbus', 'rail', 'river', 0.13, 'short', 1.1, false, ['inside-leak'], 'core', 'Ohio state transfer.'),
  r('east-st-louis-cincinnati', 'st-louis', 'cincinnati', 'river', 'river', 0.2, 'medium', 1.2, false, ['bridge', 'weather'], 'swing', 'River-linked merchant paper.'),
  r('east-cincinnati-nashville', 'cincinnati', 'nashville', 'rail', 'river', 0.22, 'medium', 1.22, false, ['track', 'ambush'], 'core', 'Southern rail contract.'),
  r('east-nashville-atlanta', 'nashville', 'atlanta', 'rail', 'eastern', 0.22, 'medium', 1.24, false, ['track', 'sabotage'], 'core', 'Southern rebuilding line.'),
  r('east-atlanta-charlotte', 'atlanta', 'charlotte', 'rail', 'eastern', 0.2, 'medium', 1.2, false, ['sabotage', 'inside-leak'], 'core', 'Carolina bank transfer.'),
  r('east-charlotte-washington', 'charlotte', 'washington-dc', 'rail', 'eastern', 0.24, 'medium', 1.26, false, ['track', 'inside-leak'], 'core', 'Federal corridor out of Carolina.'),
  r('east-atlanta-new-orleans', 'atlanta', 'new-orleans', 'rail', 'gulf', 0.28, 'long', 1.38, false, ['track', 'weather', 'sabotage'], 'swing', 'Southern long-haul into the Gulf.'),
  r('east-nashville-memphis', 'nashville', 'memphis', 'rail', 'river', 0.18, 'short', 1.14, false, ['track', 'inside-leak'], 'core', 'Cumberland to Mississippi transfer.')
] as const satisfies readonly LedgerRoute[];

export type RouteId = (typeof routes)[number]['id'];

export const routesById = Object.fromEntries(routes.map((route) => [route.id, route])) as Record<RouteId, LedgerRoute>;
