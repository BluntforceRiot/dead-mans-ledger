export type NodeType = 'port' | 'rail-hub' | 'frontier' | 'finance' | 'river' | 'industrial' | 'capital';
export type Region =
  | 'pacific'
  | 'mountain'
  | 'desert'
  | 'northern'
  | 'plains'
  | 'river'
  | 'gulf'
  | 'eastern';

export interface LedgerNode {
  id: string;
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  type: NodeType;
  region: Region;
  note: string;
}

export const nodes = [
  { id: 'seattle', name: 'Seattle', state: 'WA', latitude: 47.6062, longitude: -122.3321, type: 'port', region: 'pacific', note: 'Pacific money gate with northern express ambitions.' },
  { id: 'portland', name: 'Portland', state: 'OR', latitude: 45.5152, longitude: -122.6784, type: 'port', region: 'pacific', note: 'Columbia River commerce and timber credit.' },
  { id: 'medford', name: 'Medford', state: 'OR', latitude: 42.3265, longitude: -122.8756, type: 'frontier', region: 'pacific', note: 'Rugged southern Oregon pass station.' },
  { id: 'sacramento', name: 'Sacramento', state: 'CA', latitude: 38.5816, longitude: -121.4944, type: 'capital', region: 'pacific', note: 'Rail law, gold memory, and statehouse pressure.' },
  { id: 'san-francisco', name: 'San Francisco', state: 'CA', latitude: 37.7749, longitude: -122.4194, type: 'finance', region: 'pacific', note: 'Bank vaults, sea finance, and silver speculation.' },
  { id: 'reno', name: 'Reno', state: 'NV', latitude: 39.5296, longitude: -119.8138, type: 'rail-hub', region: 'mountain', note: 'Sierra crossing ledger choke point.' },
  { id: 'los-angeles', name: 'Los Angeles', state: 'CA', latitude: 34.0522, longitude: -118.2437, type: 'port', region: 'desert', note: 'Southern California market and desert route hinge.' },
  { id: 'san-diego', name: 'San Diego', state: 'CA', latitude: 32.7157, longitude: -117.1611, type: 'port', region: 'desert', note: 'Borderland port with long southern exposure.' },
  { id: 'spokane', name: 'Spokane', state: 'WA', latitude: 47.6588, longitude: -117.426, type: 'rail-hub', region: 'northern', note: 'Inland northwest interchange and mountain risk.' },
  { id: 'boise', name: 'Boise', state: 'ID', latitude: 43.615, longitude: -116.2023, type: 'frontier', region: 'mountain', note: 'Frontier office watching the Snake River country.' },
  { id: 'salt-lake-city', name: 'Salt Lake City', state: 'UT', latitude: 40.7608, longitude: -111.891, type: 'rail-hub', region: 'mountain', note: 'Mountain basin hub between coast and plains.' },
  { id: 'las-vegas', name: 'Las Vegas', state: 'NV', latitude: 36.1699, longitude: -115.1398, type: 'frontier', region: 'desert', note: 'Desert stop with scarce water and loud rumors.' },
  { id: 'phoenix', name: 'Phoenix', state: 'AZ', latitude: 33.4484, longitude: -112.074, type: 'frontier', region: 'desert', note: 'Salt River settlement where heat taxes every wagon.' },
  { id: 'tucson', name: 'Tucson', state: 'AZ', latitude: 32.2226, longitude: -110.9747, type: 'frontier', region: 'desert', note: 'Sonoran route post with unreliable tips.' },
  { id: 'albuquerque', name: 'Albuquerque', state: 'NM', latitude: 35.0844, longitude: -106.6504, type: 'rail-hub', region: 'desert', note: 'Rio Grande exchange for desert and plains traffic.' },
  { id: 'santa-fe', name: 'Santa Fe', state: 'NM', latitude: 35.687, longitude: -105.9378, type: 'capital', region: 'desert', note: 'Old road diplomacy and territorial credit.' },
  { id: 'bozeman', name: 'Bozeman', state: 'MT', latitude: 45.677, longitude: -111.0429, type: 'frontier', region: 'mountain', note: 'Mountain trail office watched by thieves and snow.' },
  { id: 'great-falls', name: 'Great Falls', state: 'MT', latitude: 47.5053, longitude: -111.3008, type: 'frontier', region: 'northern', note: 'Northern plains transfer by the Missouri.' },
  { id: 'deadwood', name: 'Deadwood', state: 'SD', latitude: 44.3767, longitude: -103.7296, type: 'frontier', region: 'plains', note: 'Black Hills payroll town with quick tempers.' },
  { id: 'cheyenne', name: 'Cheyenne', state: 'WY', latitude: 41.14, longitude: -104.8202, type: 'rail-hub', region: 'plains', note: 'Rail junction where weather and cattle money meet.' },
  { id: 'denver', name: 'Denver', state: 'CO', latitude: 39.7392, longitude: -104.9903, type: 'finance', region: 'mountain', note: 'Mint city, mountain cash, and express leverage.' },
  { id: 'north-platte', name: 'North Platte', state: 'NE', latitude: 41.1403, longitude: -100.7601, type: 'rail-hub', region: 'plains', note: 'Platte River rail hinge through open country.' },
  { id: 'sioux-falls', name: 'Sioux Falls', state: 'SD', latitude: 43.5446, longitude: -96.7311, type: 'frontier', region: 'plains', note: 'Eastern Dakota market and prairie weather post.' },
  { id: 'fargo', name: 'Fargo', state: 'ND', latitude: 46.8772, longitude: -96.7898, type: 'rail-hub', region: 'northern', note: 'Red River hub for cold northern contracts.' },
  { id: 'duluth', name: 'Duluth', state: 'MN', latitude: 46.7867, longitude: -92.1005, type: 'port', region: 'northern', note: 'Lake Superior iron, timber, and shipping trust.' },
  { id: 'minneapolis', name: 'Minneapolis', state: 'MN', latitude: 44.9778, longitude: -93.265, type: 'industrial', region: 'northern', note: 'Mill city where river commerce becomes credit.' },
  { id: 'des-moines', name: 'Des Moines', state: 'IA', latitude: 41.5868, longitude: -93.625, type: 'capital', region: 'plains', note: 'Iowa capital and prairie ledger checkpoint.' },
  { id: 'omaha', name: 'Omaha', state: 'NE', latitude: 41.2565, longitude: -95.9345, type: 'rail-hub', region: 'plains', note: 'Missouri River rail office and central risk hinge.' },
  { id: 'kansas-city', name: 'Kansas City', state: 'MO', latitude: 39.0997, longitude: -94.5786, type: 'rail-hub', region: 'river', note: 'Missouri River exchange with crowded route claims.' },
  { id: 'wichita', name: 'Wichita', state: 'KS', latitude: 37.6872, longitude: -97.3301, type: 'frontier', region: 'plains', note: 'South-central cattle money and dry-road choices.' },
  { id: 'oklahoma-city', name: 'Oklahoma City', state: 'OK', latitude: 35.4676, longitude: -97.5164, type: 'frontier', region: 'plains', note: 'Territorial market with unsettled contracts.' },
  { id: 'fort-worth', name: 'Fort Worth', state: 'TX', latitude: 32.7555, longitude: -97.3308, type: 'rail-hub', region: 'plains', note: 'Stockyard money and guarded payroll routes.' },
  { id: 'dallas', name: 'Dallas', state: 'TX', latitude: 32.7767, longitude: -96.797, type: 'finance', region: 'plains', note: 'North Texas finance house with fast obligations.' },
  { id: 'austin', name: 'Austin', state: 'TX', latitude: 30.2672, longitude: -97.7431, type: 'capital', region: 'gulf', note: 'State capital contracts and hill-country risk.' },
  { id: 'san-antonio', name: 'San Antonio', state: 'TX', latitude: 29.4241, longitude: -98.4936, type: 'frontier', region: 'gulf', note: 'Military road money and borderland heat.' },
  { id: 'houston', name: 'Houston', state: 'TX', latitude: 29.7604, longitude: -95.3698, type: 'port', region: 'gulf', note: 'Bayou port credit headed toward the Gulf.' },
  { id: 'new-orleans', name: 'New Orleans', state: 'LA', latitude: 29.9511, longitude: -90.0715, type: 'port', region: 'gulf', note: 'Great river port and volatile merchant paper.' },
  { id: 'memphis', name: 'Memphis', state: 'TN', latitude: 35.1495, longitude: -90.049, type: 'river', region: 'river', note: 'Mississippi crossing where river news travels fast.' },
  { id: 'st-louis', name: 'St. Louis', state: 'MO', latitude: 38.627, longitude: -90.1994, type: 'rail-hub', region: 'river', note: 'Gateway ledger hub, equal parts opportunity and trap.' },
  { id: 'milwaukee', name: 'Milwaukee', state: 'WI', latitude: 43.0389, longitude: -87.9065, type: 'port', region: 'northern', note: 'Lake Michigan market and northern exchange.' },
  { id: 'chicago', name: 'Chicago', state: 'IL', latitude: 41.8781, longitude: -87.6298, type: 'finance', region: 'northern', note: 'Rail capital where cash becomes velocity.' },
  { id: 'detroit', name: 'Detroit', state: 'MI', latitude: 42.3314, longitude: -83.0458, type: 'industrial', region: 'eastern', note: 'Detroit River industry and lake-route finance.' },
  { id: 'sault-ste-marie', name: 'Sault Ste. Marie', state: 'MI', latitude: 46.4953, longitude: -84.3453, type: 'port', region: 'northern', note: 'Soo Locks route watch at the eastern Upper Peninsula.' },
  { id: 'cleveland', name: 'Cleveland', state: 'OH', latitude: 41.4993, longitude: -81.6944, type: 'industrial', region: 'eastern', note: 'Lake Erie industry and iron route contracts.' },
  { id: 'pittsburgh', name: 'Pittsburgh', state: 'PA', latitude: 40.4406, longitude: -79.9959, type: 'industrial', region: 'eastern', note: 'Three-river industrial finance with sabotage risk.' },
  { id: 'indianapolis', name: 'Indianapolis', state: 'IN', latitude: 39.7684, longitude: -86.1581, type: 'capital', region: 'eastern', note: 'Crossroads capital and quiet ledger leverage.' },
  { id: 'cincinnati', name: 'Cincinnati', state: 'OH', latitude: 39.1031, longitude: -84.512, type: 'river', region: 'river', note: 'Ohio River exchange and merchant note station.' },
  { id: 'columbus', name: 'Columbus', state: 'OH', latitude: 39.9612, longitude: -82.9988, type: 'capital', region: 'eastern', note: 'Statehouse paper and inland transfer point.' },
  { id: 'nashville', name: 'Nashville', state: 'TN', latitude: 36.1627, longitude: -86.7816, type: 'capital', region: 'river', note: 'Cumberland River contracts and southern rail money.' },
  { id: 'atlanta', name: 'Atlanta', state: 'GA', latitude: 33.749, longitude: -84.388, type: 'rail-hub', region: 'eastern', note: 'Rail rebuilding and fast southern exchange.' },
  { id: 'charlotte', name: 'Charlotte', state: 'NC', latitude: 35.2271, longitude: -80.8431, type: 'finance', region: 'eastern', note: 'Carolina banking and textile credit.' },
  { id: 'washington-dc', name: 'Washington', state: 'DC', latitude: 38.9072, longitude: -77.0369, type: 'capital', region: 'eastern', note: 'Federal pressure, public confidence, and policy rumor.' },
  { id: 'philadelphia', name: 'Philadelphia', state: 'PA', latitude: 39.9526, longitude: -75.1652, type: 'finance', region: 'eastern', note: 'Old capital finance with printers watching the notes.' },
  { id: 'new-york', name: 'New York', state: 'NY', latitude: 40.7128, longitude: -74.006, type: 'finance', region: 'eastern', note: 'Wall Street velocity and ruthless scrutiny.' },
  { id: 'boston', name: 'Boston', state: 'MA', latitude: 42.3601, longitude: -71.0589, type: 'port', region: 'eastern', note: 'Atlantic port, memory, and merchant paper.' }
] as const satisfies readonly LedgerNode[];

export type NodeId = (typeof nodes)[number]['id'];

export const nodesById = Object.fromEntries(nodes.map((node) => [node.id, node])) as Record<NodeId, LedgerNode>;
