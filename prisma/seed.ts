/**
 * GlobeTrotter database seed.
 *
 * Design notes:
 *  - Trip dates are relative to "today" so a freshly seeded database always has
 *    genuinely upcoming trips, one in progress, and completed history.
 *  - Image URLs are generated from a deterministic photo service. Swap
 *    `imageFor()` for your CDN (or an uploaded asset) and the whole dataset
 *    updates at once. Nothing else depends on the URL shape.
 *  - Costs are indicative daily figures in the profile currency. Real trips
 *    override them per activity via ItineraryItem.customCost.
 *
 * Run with: npm run seed
 */
import { PrismaClient, ActivityCategory, ExpenseCategory, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';

loadEnv({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

const SEED_PASSWORD = process.env.SEED_USER_PASSWORD || 'Password123!';
const BCRYPT_ROUNDS = 10;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Deterministic, always-available imagery so the demo is never full of broken images. */
function imageFor(seed: string, width = 1400, height = 900): string {
  const clean = seed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `https://picsum.photos/seed/gt-${clean}/${width}/${height}`;
}

/** UTC-midnight Date, matching the @db.Date columns. */
function utcDate(daysFromToday: number): Date {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + daysFromToday);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** "HH:mm" + hours → "HH:mm", clamped inside a single day. */
function addHours(time: string, hours: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = Math.min(h * 60 + m + Math.round(hours * 60), 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// ── Cities & activities ──────────────────────────────────────────────────────
// Tuple shape: [name, category, durationHours, estimatedCost, description]

type ActivityTuple = [string, ActivityCategory, number, number, string];

const A = ActivityCategory;

const CITIES: Array<{
  name: string;
  country: string;
  region: string;
  description: string;
  costIndex: number;
  popularity: number;
  latitude: number;
  longitude: number;
  activities: ActivityTuple[];
}> = [
  {
    name: 'Mumbai',
    country: 'India',
    region: 'Maharashtra',
    description:
      "India's city of dreams, where Art Deco seafronts meet century-old bazaars. Mumbai rewards travellers who move between its extremes — dawn at the fish harbour, dusk on Marine Drive.",
    costIndex: 1.25,
    popularity: 96,
    latitude: 19.076,
    longitude: 72.8777,
    activities: [
      ['Gateway of India', A.SIGHTSEEING, 1.5, 0, 'The 1924 basalt arch on the harbour — start here before the crowds and the selfie sellers arrive.'],
      ['Marine Drive Sunset Walk', A.RELAXATION, 2, 0, 'The Queen\u2019s Necklace curves for 3.6 km. Best walked north-to-south as the lights come on.'],
      ['Elephanta Caves Ferry', A.CULTURE, 4.5, 600, 'A 50-minute harbour crossing to 6th-century rock-cut Shiva sanctuaries on Gharapuri Island.'],
      ['Colaba Causeway Walking Tour', A.SHOPPING, 2.5, 300, 'Street stalls, heritage arcades and the city\u2019s best sandwich at Caf\u00e9 Monde.'],
      ['Dharavi Community Walk', A.CULTURE, 3, 1200, 'A resident-led tour of Mumbai\u2019s recycling economy — ethical, eye-opening and never voyeuristic.'],
      ['Bandra Street Art Trail', A.SIGHTSEEING, 2.5, 0, 'Chapel Road to Bandra Fort, tracing the murals of the St+Art district.'],
      ['Vada Pav Tasting Crawl', A.FOOD, 2, 400, 'Five stalls, one benchmark: Dadar\u2019s Ashok Vada Pav sets the standard.'],
      ['Sanjay Gandhi National Park Cycle', A.NATURE, 3.5, 500, 'Ride the forest road to Kanheri Caves inside the city limits.'],
    ],
  },
  {
    name: 'Goa',
    country: 'India',
    region: 'Goa',
    description:
      'Palm-lined coves, Portuguese chapels and a pace that resists urgency. North Goa for the buzz, South Goa for the quiet — most travellers end up splitting their stay.',
    costIndex: 1.1,
    popularity: 98,
    latitude: 15.2993,
    longitude: 74.124,
    activities: [
      ['Baga Beach Morning', A.RELAXATION, 3, 0, 'Shacks open by 8am; the water is calmest and the beach almost empty before 10.'],
      ['Fort Aguada', A.SIGHTSEEING, 2, 300, 'A 1612 Portuguese bastion over the Mandovi mouth, with a working lighthouse.'],
      ['Scuba Diving at Grande Island', A.ADVENTURE, 5, 3500, 'Reef dives with 8–12 m visibility, plus a stop at the submerged Bat Island.'],
      ['Parasailing at Calangute', A.ADVENTURE, 1, 1500, 'A ten-minute tow above the surf line — tandem flights available.'],
      ['Old Goa Heritage Tour', A.CULTURE, 3, 500, 'Basilica of Bom Jesus, Se Cathedral, and the archaeology museum in one loop.'],
      ['Goan Food Trail', A.FOOD, 3.5, 1800, 'Xacuti, vindaloo and bebinca across three family-run kitchens in Panjim.'],
      ['Anjuna Flea Market', A.SHOPPING, 3, 0, 'Wednesday only. Arrive at 4pm when the heat breaks and the haggling begins.'],
      ['Dudhsagar Falls Jeep Safari', A.NATURE, 7, 2500, 'A full-day run into Bhagwan Mahaveer sanctuary, ending at a four-tier 310 m waterfall.'],
    ],
  },
  {
    name: 'Ahmedabad',
    country: 'India',
    region: 'Gujarat',
    description:
      "India's first UNESCO World Heritage city. The old town is a warren of 600-year-old pols, carved wooden facades and stepwells that double as geometry lessons.",
    costIndex: 0.85,
    popularity: 74,
    latitude: 23.0225,
    longitude: 72.5714,
    activities: [
      ['Sabarmati Ashram', A.CULTURE, 2, 0, "Gandhi's riverside home from 1917 to 1930, preserved as a free museum and archive."],
      ['Adalaj Stepwell', A.SIGHTSEEING, 1.5, 100, 'A five-storey subterranean well of carved sandstone, 18 km north of the city.'],
      ['Old City Pol Walking Tour', A.CULTURE, 3, 900, 'Guided walk through the pols, ending at a haveli rooftop for chai.'],
      ['Manek Chowk Night Food Street', A.FOOD, 2, 500, 'By day a jewellery market, by night a street-food grid serving until 2am.'],
      ['Kite Museum', A.CULTURE, 1, 50, 'Small, charming, and explains why the whole city takes to its roofs each January.'],
      ['Sarkhej Roza', A.SIGHTSEEING, 1.5, 0, 'A serene mosque-and-tomb complex often described as the Ahmedabad Acropolis.'],
    ],
  },
  {
    name: 'Delhi',
    country: 'India',
    region: 'Delhi',
    description:
      'Eight cities stacked on top of one another. Mughal tombs, Lutyens boulevards, and a street-food culture that runs from breakfast to midnight.',
    costIndex: 1.05,
    popularity: 94,
    latitude: 28.6139,
    longitude: 77.209,
    activities: [
      ['Red Fort & Chandni Chowk', A.SIGHTSEEING, 4, 600, 'Mughal ramparts followed by the bazaar lanes of Old Delhi.'],
      ['Qutub Minar Complex', A.CULTURE, 2, 600, 'A 73 m victory tower from 1193 and the oldest surviving iron pillar in the world.'],
      ['Humayun\u2019s Tomb', A.SIGHTSEEING, 2, 600, 'The garden tomb that seeded the Taj Mahal\u2019s design language.'],
      ['Lodhi Art District Walk', A.SIGHTSEEING, 2, 0, 'India\u2019s first open-air public art district, best in late afternoon light.'],
      ['Old Delhi Food Crawl', A.FOOD, 3.5, 900, 'Paranthe Wali Gali, Karim\u2019s, and a jalebi stop that closes when it sells out.'],
      ['Dilli Haat Craft Bazaar', A.SHOPPING, 2.5, 200, 'Handicrafts from every state in one open-air market; entry is nominal.'],
      ['Agrasen ki Baoli', A.SIGHTSEEING, 1, 0, 'A 60-step hidden stepwell in the middle of Connaught Place\u2019s backstreets.'],
    ],
  },
  {
    name: 'Jaipur',
    country: 'India',
    region: 'Rajasthan',
    description:
      'The Pink City, painted in 1876 for a royal visit and never repainted otherwise. Forts on the ridges, block-print workshops in the lanes, and the best sunset in Rajasthan.',
    costIndex: 0.95,
    popularity: 95,
    latitude: 26.9124,
    longitude: 75.7873,
    activities: [
      ['Amber Fort', A.SIGHTSEEING, 4, 700, 'Hilltop palace-fortress with the Sheesh Mahal. Go at 8am or you will queue in the sun.'],
      ['City Palace', A.CULTURE, 2.5, 700, 'Still the royal family\u2019s residence; the Chandra Mahal has the best courtyard views.'],
      ['Hawa Mahal', A.SIGHTSEEING, 1, 200, 'The 953-window facade built so royal women could watch street processions unseen.'],
      ['Jantar Mantar', A.CULTURE, 1.5, 200, '18th-century astronomical instruments that still tell time to the second.'],
      ['Rajasthani Food Tour', A.FOOD, 3, 1200, 'Dal baati churma, laal maas and ghewar across the old city.'],
      ['Nahargarh Sunset Viewpoint', A.RELAXATION, 2, 200, 'Drive up for the last hour of light over the whole city.'],
      ['Block Printing Workshop', A.CULTURE, 3, 1800, 'Hands-on session with a fifth-generation printer in Sanganer.'],
      ['Johari Bazaar Gem Walk', A.SHOPPING, 2, 0, 'Jaipur cuts roughly 80% of the world\u2019s emeralds; watch before you buy.'],
    ],
  },
  {
    name: 'Udaipur',
    country: 'India',
    region: 'Rajasthan',
    description:
      'Lakes, palaces and the Aravalli hills. Udaipur is Rajasthan at its most romantic, and small enough to see properly in three unhurried days.',
    costIndex: 0.9,
    popularity: 88,
    latitude: 24.5854,
    longitude: 73.7125,
    activities: [
      ['City Palace Udaipur', A.SIGHTSEEING, 3, 400, 'The largest palace complex in Rajasthan, above Lake Pichola.'],
      ['Lake Pichola Sunset Boat', A.RELAXATION, 1.5, 700, 'Glide past Jag Mandir as the Aravallis turn gold.'],
      ['Jagdish Temple', A.CULTURE, 1, 0, 'An Indo-Aryan temple from 1651, reached by 32 carved steps.'],
      ['Bagore ki Haveli Folk Show', A.ENTERTAINMENT, 1.5, 250, 'Nightly ghoomar and puppetry in an 18th-century haveli courtyard.'],
      ['Sajjangarh Monsoon Palace', A.SIGHTSEEING, 2, 300, 'A hill palace built to watch the monsoon roll in — superb at sunset.'],
      ['Mewari Cooking Class', A.FOOD, 3, 1500, 'Market visit then cook five dishes with a local family.'],
      ['Shilpgram Craft Village', A.SHOPPING, 2, 100, 'Living craft village with artisans from four states at work.'],
    ],
  },
  {
    name: 'Bengaluru',
    country: 'India',
    region: 'Karnataka',
    description:
      "India's garden city, now its technology capital. Cool year-round, excellent coffee, and a pub culture that rivals any European city.",
    costIndex: 1.15,
    popularity: 89,
    latitude: 12.9716,
    longitude: 77.5946,
    activities: [
      ['Lalbagh Botanical Garden', A.NATURE, 2.5, 100, '240 acres including a glasshouse modelled on Crystal Palace.'],
      ['Bangalore Palace', A.SIGHTSEEING, 2, 500, 'A Tudor-revival palace built in 1878, complete with woodcarvings and turrets.'],
      ['Vidhana Soudha & Cubbon Park', A.SIGHTSEEING, 2, 0, 'The state legislature building, then a walk through 300 acres of park.'],
      ['Third Wave Coffee Trail', A.FOOD, 3, 900, 'Indiranagar and Koramangala independents; the city\u2019s real social infrastructure.'],
      ['ISKCON & Bull Temple', A.CULTURE, 2, 0, 'Two very different temples on the same hill ridge.'],
      ['Commercial Street Shopping', A.SHOPPING, 2.5, 0, 'Bargain-heavy retail stretch through the old cantonment.'],
      ['Nandi Hills Sunrise Drive', A.NATURE, 5, 800, 'Leave at 4am, climb 1,478 m, and watch the cloud layer below you.'],
    ],
  },
  {
    name: 'Hyderabad',
    country: 'India',
    region: 'Telangana',
    description:
      'The City of Pearls. Nizami architecture, a 400-year-old bazaar district, and the most distinctive cuisine in India.',
    costIndex: 0.92,
    popularity: 82,
    latitude: 17.3850,
    longitude: 78.4867,
    activities: [
      ['Charminar', A.SIGHTSEEING, 1.5, 300, 'The 1591 four-minaret gateway; climb the spiral stair for the old city panorama.'],
      ['Golconda Fort', A.SIGHTSEEING, 3, 300, 'A ruined diamond-trading citadel with acoustic tricks worth the climb.'],
      ['Ramoji Film City', A.ENTERTAINMENT, 6, 1500, 'One of the world\u2019s largest film studio complexes, with full-day tours.'],
      ['Hyderabadi Biryani Trail', A.FOOD, 3, 1000, 'Paradise, Bawarchi and Shadab — dum-cooked, and much better at lunch.'],
      ['Chowmahalla Palace', A.CULTURE, 2, 300, 'Seat of the Nizams, with a collection of vintage Rolls-Royces.'],
      ['Laad Bazaar Bangles', A.SHOPPING, 1.5, 0, 'Lacquer bangles in every colour, sold in the lane behind Charminar.'],
      ['Hussain Sagar Lake Boat', A.RELAXATION, 1.5, 300, 'Boat across to the monolithic Buddha statue on Gibraltar Rock.'],
    ],
  },
  {
    name: 'Kochi',
    country: 'India',
    region: 'Kerala',
    description:
      'A port that has traded with the world since 1341 — Portuguese, Dutch, British and Chinese fishing nets all left their mark. Kerala\u2019s most walkable city.',
    costIndex: 0.88,
    popularity: 85,
    latitude: 9.9312,
    longitude: 76.2673,
    activities: [
      ['Fort Kochi Heritage Walk', A.CULTURE, 3, 700, 'Dutch, Portuguese and British layers across 500 years in 2 km.'],
      ['Chinese Fishing Nets at Sunset', A.RELAXATION, 1.5, 0, 'Cantilevered nets worked by hand since the 14th century.'],
      ['Kathakali Performance', A.ENTERTAINMENT, 2, 400, 'Watch the two-hour makeup ritual before the performance itself.'],
      ['Mattancherry Palace', A.CULTURE, 1.5, 100, 'Portuguese-built, Dutch-renovated, with remarkable Hindu murals.'],
      ['Backwater Houseboat Day Cruise', A.NATURE, 6, 4500, 'Alleppey-bound cruise through the Vembanad lake network.'],
      ['Kerala Sadya Lunch', A.FOOD, 2, 600, 'A 20-dish vegetarian feast served on a banana leaf.'],
      ['Jew Town Spice Walk', A.SHOPPING, 1.5, 0, 'Cardamom, pepper and the 1568 Paradesi Synagogue.'],
    ],
  },
  {
    name: 'Manali',
    country: 'India',
    region: 'Himachal Pradesh',
    description:
      'A Himalayan valley town at 2,050 m, on the old trade route to Ladakh. Pine forests, the Beas river, and access to some of the best high-altitude terrain in India.',
    costIndex: 0.8,
    popularity: 86,
    latitude: 32.2396,
    longitude: 77.1887,
    activities: [
      ['Solang Valley Adventure Park', A.ADVENTURE, 5, 3000, 'Paragliding, zorbing and ropeway rides, 13 km above town.'],
      ['Rohtang Pass Day Trip', A.NATURE, 8, 2500, 'A 3,978 m pass with year-round snow — permits are capped, book ahead.'],
      ['Hadimba Devi Temple', A.CULTURE, 1.5, 0, 'A 1553 cedar-wood temple set in a grove of deodars.'],
      ['Old Manali Riverside Walk', A.RELAXATION, 2.5, 0, 'Caf\u00e9s and apple orchards along the Beas riverbank.'],
      ['Jogini Falls Trek', A.ADVENTURE, 3, 0, 'A steep 4 km trail from Vashisht to a 150 m waterfall.'],
      ['Himachali Dham Lunch', A.FOOD, 2, 500, 'A traditional festive thali of lentils, curd and rice.'],
      ['Vashisht Hot Springs', A.RELAXATION, 1.5, 0, 'Natural sulphur springs, segregated by gender, free to use.'],
    ],
  },
  {
    name: 'Paris',
    country: 'France',
    region: '\u00cele-de-France',
    description:
      'Twenty arrondissements that each feel like a different city. Paris rewards walking far more than sightseeing — pick a neighbourhood and get deliberately lost.',
    costIndex: 2.1,
    popularity: 99,
    latitude: 48.8566,
    longitude: 2.3522,
    activities: [
      ['Eiffel Tower Summit', A.SIGHTSEEING, 3, 2900, 'Book the 2nd-floor lift then climb the last 674 steps for the best view.'],
      ['Louvre Museum', A.CULTURE, 4, 2200, 'Wing-by-wing is the only sane approach; the Denon wing alone takes three hours.'],
      ['Seine Evening Cruise', A.RELAXATION, 2, 1600, 'One hour from Pont Neuf, best on the last departure when the towers sparkle.'],
      ['Montmartre & Sacr\u00e9-C\u0153ur', A.SIGHTSEEING, 3, 0, 'Climb through the vineyard lanes of the 18th for the city\u2019s highest free viewpoint.'],
      ['March\u00e9 Bastille Food Tour', A.FOOD, 3, 4500, 'Cheese, charcuterie and oysters with a market guide in the 11th.'],
      ['Mus\u00e9e d\u2019Orsay', A.CULTURE, 3, 1800, 'The impressionist collection in a converted Beaux-Arts railway station.'],
      ['Marais Boutique Walk', A.SHOPPING, 2.5, 0, 'Concept stores and 17th-century hôtels particuliers in the 3rd and 4th.'],
      ['P\u00e8re Lachaise Cemetery', A.CULTURE, 2, 0, 'Cobbled avenues and the graves of Wilde, Morrison and Chopin.'],
    ],
  },
  {
    name: 'London',
    country: 'United Kingdom',
    region: 'England',
    description:
      'Roman walls, Georgian squares and a skyline that never stopped rebuilding. The museums are free, the parks are enormous, and the neighbourhoods are the real attraction.',
    costIndex: 2.2,
    popularity: 97,
    latitude: 51.5074,
    longitude: -0.1278,
    activities: [
      ['British Museum', A.CULTURE, 4, 0, 'Free entry to eight million objects, including the Rosetta Stone.'],
      ['Tower of London', A.CULTURE, 3.5, 3800, 'Norman fortress, armoury and the Crown Jewels in one ticket.'],
      ['Borough Market', A.FOOD, 2, 2000, 'A food market trading since 1014 — go on a weekday to actually eat.'],
      ['South Bank Walk', A.SIGHTSEEING, 2.5, 0, 'Tate Modern to Westminster along the river, best at dusk.'],
      ['West End Theatre Night', A.ENTERTAINMENT, 3, 6500, 'Same-day discount tickets at the TKTS booth in Leicester Square.'],
      ['Camden & Regent\u2019s Canal', A.SHOPPING, 3, 0, 'Market stalls, then a canal-side walk to Little Venice.'],
      ['Kew Gardens', A.NATURE, 3, 2400, 'A 121-hectare botanic garden with the world\u2019s largest Victorian glasshouse.'],
      ['Greenwich Observatory', A.SIGHTSEEING, 3, 1800, 'Stand on the prime meridian and cross the Thames by cable car.'],
    ],
  },
  {
    name: 'Tokyo',
    country: 'Japan',
    region: 'Kant\u014d',
    description:
      'Thirteen city centres that fuse into one. Tokyo is best explored by neighbourhood and by appetite — the food alone justifies the flight.',
    costIndex: 2.0,
    popularity: 98,
    latitude: 35.6762,
    longitude: 139.6503,
    activities: [
      ['Senso-ji Temple', A.CULTURE, 2, 0, 'Tokyo\u2019s oldest temple, reached through the Nakamise shopping street.'],
      ['Tsukiji Outer Market Breakfast', A.FOOD, 2.5, 2500, 'Tamagoyaki, uni and the freshest tuna anywhere, from 6am.'],
      ['Shibuya Crossing & Sky', A.SIGHTSEEING, 2, 2000, 'The world\u2019s busiest pedestrian scramble, seen from 230 m up.'],
      ['TeamLab Planets', A.ENTERTAINMENT, 2.5, 3200, 'Barefoot immersive digital art in a Toyosu warehouse.'],
      ['Shinjuku Omoide Yokocho', A.FOOD, 3, 3500, 'Tiny yakitori counters in lantern-lit postwar alleys.'],
      ['Meiji Shrine & Harajuku', A.SIGHTSEEING, 3, 0, 'Forest shrine, then Takeshita Street for the culture shock.'],
      ['Shimokitazawa Vintage Crawl', A.SHOPPING, 2.5, 0, 'Second-hand fashion and small live houses in the west of the city.'],
      ['Mount Takao Day Hike', A.NATURE, 6, 1200, 'An hour from Shinjuku, with a 599 m summit and a chairlift option.'],
    ],
  },
  {
    name: 'Dubai',
    country: 'United Arab Emirates',
    region: 'Dubai Emirate',
    description:
      'A city built at speed on a coastline of creeks and cranes. Old Deira and the skyscraper district are 20 minutes apart and feel like different centuries.',
    costIndex: 1.95,
    popularity: 93,
    latitude: 25.2048,
    longitude: 55.2708,
    activities: [
      ['Burj Khalifa At The Top', A.SIGHTSEEING, 2, 5500, 'Level 124 and 125; book sunset slots at least a week out.'],
      ['Dubai Desert Safari', A.ADVENTURE, 6, 6500, 'Dune bashing, camel ride and a Bedouin-style dinner under the stars.'],
      ['Old Dubai Creek Abra', A.CULTURE, 1.5, 50, 'A 25-fil rowboat across the creek between Deira and Bur Dubai.'],
      ['Gold & Spice Souks', A.SHOPPING, 2, 0, 'Haggle hard in the gold souk, then buy saffron in the spice lanes.'],
      ['Dubai Mall & Fountain Show', A.ENTERTAINMENT, 3, 0, 'The fountain runs every 30 minutes from 6pm; the mall has an aquarium.'],
      ['Palm Jumeirah Beach Day', A.RELAXATION, 4, 2500, 'Beach clubs on the palm\u2019s west crescent, best on weekdays.'],
      ['Al Fahidi Historic District', A.CULTURE, 2, 300, 'Wind-tower houses and the Dubai Museum in the oldest part of the city.'],
    ],
  },
  {
    name: 'Singapore',
    country: 'Singapore',
    region: 'Central Region',
    description:
      'A city-state that functions as an argument for urban planning. Superb hawker food, a genuine rainforest inside the city, and transport that makes a car pointless.',
    costIndex: 1.9,
    popularity: 92,
    latitude: 1.3521,
    longitude: 103.8198,
    activities: [
      ['Gardens by the Bay', A.NATURE, 3, 2800, 'Supertree Grove plus the Cloud Forest dome\u2019s indoor waterfall.'],
      ['Hawker Centre Crawl', A.FOOD, 3, 1200, 'Maxwell, Old Airport Road and Tiong Bahru — chicken rice is the benchmark.'],
      ['Marina Bay Sands SkyPark', A.SIGHTSEEING, 1.5, 3200, 'The 57th-floor observation deck over the bay.'],
      ['Sentosa Island', A.ENTERTAINMENT, 5, 4000, 'Cable car, Universal Studios and the Siloso beach bars.'],
      ['Kampong Glam & Haji Lane', A.SHOPPING, 2.5, 0, 'Peranakan shophouses, murals and independent boutiques.'],
      ['Southern Ridges Walk', A.NATURE, 4, 0, 'A 10 km canopy trail from Mount Faber to Kent Ridge.'],
      ['Chinatown Heritage Centre', A.CULTURE, 2, 1500, 'Three restored shophouses telling the story of Chinese migration.'],
    ],
  },
  {
    name: 'Bangkok',
    country: 'Thailand',
    region: 'Central Thailand',
    description:
      'Temple spires, canal boats and a street-food economy that never closes. Bangkok is chaotic in the best way — and remarkably easy to navigate once you learn the river.',
    costIndex: 1.0,
    popularity: 96,
    latitude: 13.7563,
    longitude: 100.5018,
    activities: [
      ['Grand Palace & Wat Phra Kaew', A.CULTURE, 3, 1800, 'The Emerald Buddha and 200 years of royal architecture. Dress code is enforced.'],
      ['Wat Arun Sunset', A.SIGHTSEEING, 1.5, 400, 'Cross the river by ferry and climb the porcelain-encrusted prang.'],
      ['Chao Phraya River Boat', A.SIGHTSEEING, 2, 200, 'The orange-flag express boat is the fastest way through the city.'],
      ['Chatuchak Weekend Market', A.SHOPPING, 4, 0, '15,000 stalls over 27 sections; go early and bring cash.'],
      ['Thai Cooking Class', A.FOOD, 4, 2200, 'Market tour then cook pad thai, som tam and a curry from paste.'],
      ['Bang Krachao Cycle Ride', A.NATURE, 4, 700, 'The green lung across the river, on elevated concrete paths through jungle.'],
      ['Yaowarat Street Food Night', A.FOOD, 3, 1300, 'Chinatown after dark: grilled seafood, oyster omelettes, and mango sticky rice.'],
      ['Traditional Thai Massage', A.RELAXATION, 1.5, 900, 'Wat Pho is the temple of the discipline; two hours is the standard booking.'],
    ],
  },
];

// ── Trip templates ───────────────────────────────────────────────────────────

interface ItineraryTemplate {
  city: string;
  /** Activity names pulled from the catalogue, one per listed day. */
  picks: string[];
}

interface TripTemplate {
  owner: 'demo' | 'admin' | 'traveller';
  name: string;
  description: string;
  /** Days from today that the trip starts (negative = in the past). */
  startsInDays: number;
  isPublic: boolean;
  budgetLimit?: number;
  template: ItineraryTemplate[];
}

const TRIPS: TripTemplate[] = [
  {
    owner: 'demo',
    name: 'Goa & Mumbai Escape',
    description:
      'A week split between Goan beaches and Mumbai\u2019s seafront. Slow first half, city second half — the order matters.',
    startsInDays: 12,
    isPublic: true,
    budgetLimit: 85000,
    template: [
      {
        city: 'Goa',
        picks: ['Baga Beach Morning', 'Fort Aguada', 'Scuba Diving at Grande Island', 'Goan Food Trail'],
      },
      {
        city: 'Mumbai',
        picks: ['Gateway of India', 'Elephanta Caves Ferry', 'Colaba Causeway Walking Tour'],
      },
    ],
  },
  {
    owner: 'demo',
    name: 'Rajasthan Heritage Trail',
    description:
      'Fort towns in sequence — Jaipur\u2019s pink grid, Udaipur\u2019s lakes, and Delhi\u2019s layered history as the bookend.',
    startsInDays: 34,
    isPublic: false,
    budgetLimit: 120000,
    template: [
      { city: 'Jaipur', picks: ['Amber Fort', 'City Palace', 'Rajasthani Food Tour'] },
      { city: 'Udaipur', picks: ['City Palace Udaipur', 'Lake Pichola Sunset Boat', 'Mewari Cooking Class'] },
      { city: 'Delhi', picks: ['Red Fort & Chandni Chowk', 'Qutub Minar Complex', 'Old Delhi Food Crawl'] },
    ],
  },
  {
    owner: 'demo',
    name: 'Paris & London Winter',
    description:
      'Two capitals by train. Museums and markets in Paris, then theatres and parks in London.',
    startsInDays: -64,
    isPublic: true,
    template: [
      { city: 'Paris', picks: ['Eiffel Tower Summit', 'Louvre Museum', 'Seine Evening Cruise'] },
      { city: 'London', picks: ['British Museum', 'Borough Market', 'West End Theatre Night'] },
    ],
  },
  {
    owner: 'demo',
    name: 'Tokyo Food Odyssey',
    description:
      'Built entirely around meals. Markets at dawn, yakitori alleys at midnight, with temples in between to walk it off.',
    startsInDays: 58,
    isPublic: true,
    budgetLimit: 210000,
    template: [
      {
        city: 'Tokyo',
        picks: ['Tsukiji Outer Market Breakfast', 'Senso-ji Temple', 'Shinjuku Omoide Yokocho', 'TeamLab Planets'],
      },
    ],
  },
  {
    owner: 'demo',
    name: 'Kerala Backwaters Reset',
    description: 'A short, deliberately slow week: Kochi\u2019s heritage quarter, then a houseboat and nothing else.',
    startsInDays: -18,
    isPublic: false,
    template: [
      { city: 'Kochi', picks: ['Fort Kochi Heritage Walk', 'Backwater Houseboat Day Cruise'] },
      { city: 'Bengaluru', picks: ['Lalbagh Botanical Garden', 'Third Wave Coffee Trail'] },
    ],
  },
  {
    owner: 'traveller',
    name: 'Bangkok Long Weekend',
    description: 'Four days, one river, and as much street food as is physically reasonable.',
    startsInDays: 21,
    isPublic: true,
    template: [
      {
        city: 'Bangkok',
        picks: ['Grand Palace & Wat Phra Kaew', 'Yaowarat Street Food Night', 'Chatuchak Weekend Market'],
      },
    ],
  },
  {
    owner: 'admin',
    name: 'Singapore & Dubai Stopover',
    description: 'Two city-states in five days, optimised for a long-haul routing between them.',
    startsInDays: 45,
    isPublic: true,
    template: [
      { city: 'Singapore', picks: ['Gardens by the Bay', 'Hawker Centre Crawl'] },
      { city: 'Dubai', picks: ['Burj Khalifa At The Top', 'Dubai Desert Safari'] },
    ],
  },
  {
    owner: 'traveller',
    name: 'Himalayan Workation',
    description: 'Two weeks in the mountains with a laptop and a lot of chai. Slow mornings, long walks.',
    startsInDays: 68,
    isPublic: false,
    template: [
      { city: 'Manali', picks: ['Old Manali Riverside Walk', 'Jogini Falls Trek', 'Vashisht Hot Springs'] },
      { city: 'Ahmedabad', picks: ['Sabarmati Ashram', 'Old City Pol Walking Tour'] },
    ],
  },
];

// ── Seeding ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌍  GlobeTrotter seed\n' + '─'.repeat(52));

  // Idempotent: wipe in FK-safe order so `npm run seed` can be re-run freely.
  console.log('• Clearing existing data…');
  await prisma.savedDestination.deleteMany();
  await prisma.itineraryItem.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.tripStop.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.city.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.user.deleteMany();

  // ── Users ──
  console.log('• Creating users…');
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, BCRYPT_ROUNDS);

  const demo = await prisma.user.create({
    data: {
      name: 'Aarav Sharma',
      email: 'demo@globetrotter.app',
      passwordHash,
      avatar: imageFor('aarav-sharma', 400, 400),
      language: 'en',
      currency: 'INR',
      role: Role.USER,
      tripsPublicByDefault: true,
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: 'Alex Mercer',
      email: 'admin@globetrotter.app',
      passwordHash,
      avatar: imageFor('alex-mercer', 400, 400),
      language: 'en',
      currency: 'USD',
      role: Role.ADMIN,
    },
  });

  const traveller = await prisma.user.create({
    data: {
      name: 'Priya Nair',
      email: 'priya@globetrotter.app',
      passwordHash,
      avatar: imageFor('priya-nair', 400, 400),
      language: 'en',
      currency: 'INR',
    },
  });

  const owners = { demo, admin, traveller } as const;

  // ── Cities & activities ──
  console.log('• Creating cities and activities…');
  const cityByName = new Map<string, string>();
  const activitiesByCity = new Map<string, Array<{ id: string; name: string; cost: number; category: ActivityCategory }>>();
  let activityCount = 0;

  for (const city of CITIES) {
    const created = await prisma.city.create({
      data: {
        name: city.name,
        country: city.country,
        region: city.region,
        description: city.description,
        image: imageFor(`${city.name}-skyline`),
        costIndex: city.costIndex,
        popularity: city.popularity,
        latitude: city.latitude,
        longitude: city.longitude,
      },
    });
    cityByName.set(city.name, created.id);

    const createdActivities = [];
    for (const [name, category, duration, cost, description] of city.activities) {
      const activity = await prisma.activity.create({
        data: {
          cityId: created.id,
          name,
          description,
          category,
          image: imageFor(`${city.name}-${name}`),
          duration,
          estimatedCost: cost,
          // Scatter coordinates slightly around the city centre so the map/route
          // view has plausible spread without pretending to be survey-grade.
          latitude: city.latitude + (Math.random() - 0.5) * 0.08,
          longitude: city.longitude + (Math.random() - 0.5) * 0.08,
          popularity: Math.floor(Math.random() * 45) + 55,
        },
      });
      createdActivities.push({ id: activity.id, name, cost, category });
      activityCount += 1;
    }
    activitiesByCity.set(city.name, createdActivities);
  }

  // ── Trips ──
  console.log('• Creating trips, stops, itinerary and expenses…');
  const expenseWeights: Array<[ExpenseCategory, number, string]> = [
    [ExpenseCategory.ACCOMMODATION, 0.4, 'Hotel booking'],
    [ExpenseCategory.TRANSPORT, 0.22, 'Transfers and taxis'],
    [ExpenseCategory.MEALS, 0.18, 'Dining and cafés'],
    [ExpenseCategory.ACTIVITIES, 0.14, 'Entrance tickets and tours'],
    [ExpenseCategory.MISCELLANEOUS, 0.06, 'SIM card, tips, sundries'],
  ];

  let tripCount = 0;
  let itineraryCount = 0;

  for (const template of TRIPS) {
    const owner = owners[template.owner];
    const tripStart = utcDate(template.startsInDays);

    // Distribute the total trip length across the stops.
    const stopDays = template.template.map((t) => t.picks.length);
    const totalDays = stopDays.reduce((a, b) => a + b, 0);

    const trip = await prisma.trip.create({
      data: {
        userId: owner.id,
        name: template.name,
        description: template.description,
        coverImage: imageFor(template.name),
        startDate: tripStart,
        endDate: addDays(tripStart, totalDays - 1),
        isPublic: template.isPublic,
        // Slug only exists on shared trips, mirroring the real share endpoint.
        publicSlug: template.isPublic
          ? `${template.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Math.random()
              .toString(36)
              .slice(2, 7)}`
          : null,
        budgetLimit: template.budgetLimit ?? null,
        viewCount: template.isPublic ? Math.floor(Math.random() * 400) + 40 : 0,
      },
    });
    tripCount += 1;

    let cursor = tripStart;
    let stopOrder = 0;

    for (const stopTemplate of template.template) {
      const cityId = cityByName.get(stopTemplate.city);
      if (!cityId) continue;

      const stopStart = cursor;
      const stopEnd = addDays(stopStart, stopTemplate.picks.length - 1);

      const stop = await prisma.tripStop.create({
        data: {
          tripId: trip.id,
          cityId,
          startDate: stopStart,
          endDate: stopEnd,
          order: stopOrder,
        },
      });

      const catalogue = activitiesByCity.get(stopTemplate.city) ?? [];
      const city = CITIES.find((c) => c.name === stopTemplate.city)!;

      for (let dayIndex = 0; dayIndex < stopTemplate.picks.length; dayIndex += 1) {
        const date = addDays(stopStart, dayIndex);
        const pickName = stopTemplate.picks[dayIndex];
        const matched = catalogue.find((a) => a.name === pickName);

        // 09:00 breakfast, then the featured activity late morning, a second
        // activity mid-afternoon where the catalogue allows, and dinner.
        const items: Array<{
          title: string;
          category: ActivityCategory | null;
          startTime: string;
          endTime: string | null;
          activityId: string | null;
          customCost: number | null;
          order: number;
          notes: string | null;
        }> = [];

        items.push({
          title: 'Breakfast at the hotel',
          category: ActivityCategory.FOOD,
          startTime: '08:30',
          endTime: '09:30',
          activityId: null,
          customCost: null,
          order: 0,
          notes: null,
        });

        if (matched) {
          const duration = city.activities.find((a) => a[0] === matched.name)?.[2] ?? 2;
          items.push({
            title: matched.name,
            category: matched.category,
            startTime: '10:30',
            endTime: addHours('10:30', duration),
            activityId: matched.id,
            customCost: null,
            order: 1,
            notes: null,
          });
        }

        // Add an afternoon filler from the same city for days with spare room.
        const filler = catalogue[(dayIndex + 2) % Math.max(catalogue.length, 1)];
        if (filler && filler.name !== pickName && dayIndex % 2 === 0) {
          items.push({
            title: filler.name,
            category: filler.category,
            startTime: '15:00',
            endTime: addHours('15:00', 2),
            activityId: filler.id,
            customCost: null,
            order: 2,
            notes: null,
          });
        }

        items.push({
          title: 'Dinner — local recommendation',
          category: ActivityCategory.FOOD,
          startTime: '19:30',
          endTime: '21:00',
          activityId: null,
          customCost: null,
          order: 3,
          notes: dayIndex === 0 ? 'Ask the concierge for a walk-in that takes reservations late.' : null,
        });

        for (const item of items) {
          await prisma.itineraryItem.create({
            data: {
              tripStopId: stop.id,
              tripId: trip.id,
              activityId: item.activityId,
              title: item.title,
              category: item.category,
              date,
              startTime: item.startTime,
              endTime: item.endTime,
              notes: item.notes,
              order: item.order,
              customCost: item.customCost,
            },
          });
          itineraryCount += 1;
        }
      }

      cursor = addDays(stopEnd, 1);
      stopOrder += 1;
    }

    // ── Expenses: a plausible split of the trip's estimated cost ──
    const tripNights = Math.max(totalDays - 1, 1);
    const accommodationBase = Math.round(3200 * tripNights);
    const dailyTransport = 900;
    const dailyMeals = 1400;
    const activityTotal = template.template.reduce((sum, stopTemplate) => {
      const catalogue = activitiesByCity.get(stopTemplate.city) ?? [];
      return (
        sum +
        stopTemplate.picks.reduce((inner, pick) => {
          const found = catalogue.find((a) => a.name === pick);
          return inner + (found?.cost ?? 0);
        }, 0)
      );
    }, 0);

    const bases: Record<string, number> = {
      ACCOMMODATION: accommodationBase,
      TRANSPORT: dailyTransport * totalDays,
      MEALS: dailyMeals * totalDays,
      ACTIVITIES: activityTotal,
      MISCELLANEOUS: 1200,
    };

    for (const [category, , description] of expenseWeights) {
      const amount = bases[category];
      if (!amount) continue;
      await prisma.expense.create({
        data: {
          tripId: trip.id,
          category,
          amount,
          description,
          date: addDays(tripStart, Math.min(1, totalDays - 1)),
        },
      });
    }

    // A couple of one-off expenses so the budget page has more than five rows.
    await prisma.expense.create({
      data: {
        tripId: trip.id,
        category: ExpenseCategory.TRANSPORT,
        amount: 4200,
        description: 'Return flights',
        date: addDays(tripStart, -7),
      },
    });
    await prisma.expense.create({
      data: {
        tripId: trip.id,
        category: ExpenseCategory.ACTIVITIES,
        amount: 1500,
        description: 'Travel insurance and visa fees',
        date: tripStart,
      },
    });
  }

  // ── Saved destinations ──
  console.log('• Creating saved destinations…');
  const savedFor: Array<[string, string[]]> = [
    ['demo', ['Tokyo', 'Paris', 'Manali', 'Jaipur']],
    ['admin', ['Bangkok', 'Mumbai']],
    ['traveller', ['Udaipur', 'Kochi']],
  ];
  for (const [ownerKey, cityNames] of savedFor) {
    for (const cityName of cityNames) {
      const cityId = cityByName.get(cityName);
      if (!cityId) continue;
      await prisma.savedDestination.create({
        data: { userId: owners[ownerKey as keyof typeof owners].id, cityId },
      });
    }
  }

  const userCount = await prisma.user.count();
  console.log('─'.repeat(52));
  console.log(`✅  Seeded ${userCount} users · ${CITIES.length} cities · ${activityCount} activities`);
  console.log(`✅  ${tripCount} trips · ${itineraryCount} itinerary items`);
  console.log('\n   Demo login:  demo@globetrotter.app / ' + SEED_PASSWORD);
  console.log('   Admin login: admin@globetrotter.app / ' + SEED_PASSWORD);
  console.log('');
}

main()
  .catch((error) => {
    console.error('\n❌  Seed failed:\n', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
