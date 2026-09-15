/**
 * Upsert TrekkVede monsoon trek catalog from organizer WhatsApp briefs.
 * Run: node scripts/seed-trekvede-treks.js
 *
 * Safe to re-run: matches by communityId + trekName (case-insensitive).
 */
require('dotenv').config();
const mongoose = require('mongoose');
const TrekCommunity = require('../src/model/trek_community_model');
const Trek = require('../src/model/trek_model');

const COMMUNITY_MATCH = /trek+k?vede|trekk?\s*vede/i;

/** Category chips on community page (same pattern as EV community categories). */
const COMMUNITY_CATEGORIES = ['Hiking', 'Adventure', 'Trail Walks'];

function isoFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Upcoming weekday ISO dates for the next `weeks` weeks (from today).
 * dayOfWeek: 0=Sun … 5=Fri, 6=Sat
 */
function upcomingWeekdays(dayOfWeek, weeks = 8) {
  const out = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const cursor = new Date(start);
  // walk to the first matching weekday on/after today
  while (cursor.getDay() !== dayOfWeek) {
    cursor.setDate(cursor.getDate() + 1);
  }
  for (let i = 0; i < weeks; i += 1) {
    const d = new Date(cursor);
    d.setDate(cursor.getDate() + i * 7);
    out.push(isoFromDate(d));
  }
  return out;
}

/** Rolling weekend catalogs — keeps treks in Upcoming like EV event dates. */
function buildWeekendDates(weeks = 8) {
  const fri = upcomingWeekdays(5, weeks);
  const sat = upcomingWeekdays(6, weeks);
  const sun = upcomingWeekdays(0, weeks);
  const everyWeekend = [];
  for (let i = 0; i < weeks; i += 1) {
    if (sat[i]) everyWeekend.push(sat[i]);
    if (sun[i]) everyWeekend.push(sun[i]);
  }
  return {
    fri,
    sat,
    sun,
    friSat: fri,
    satSun: sat,
    everyWeekend,
    overnight: [...fri, ...sat].sort(),
  };
}

const WEEKENDS = buildWeekendDates(8);

/**
 * Cover + hero slider + gallery from real place monsoon photos (Wikimedia Commons).
 * First URL is the card cover; full list fills heroImages + images gallery.
 */
function monsoonCovers(urls = []) {
  const list = [...new Set(urls.filter(Boolean))];
  const primary = list[0];
  if (!primary) return {};
  const wide = list[1] || primary;
  const hero = list[2] || primary;
  const portrait = list[3] || primary;
  return {
    coverImage: primary,
    coverImages: {
      page: primary,
      portrait,
      wide,
      hero,
      landscape: wide,
    },
    heroImages: list.slice(0, 5),
    images: list,
  };
}

const W = 'https://upload.wikimedia.org/wikipedia/commons';

const TREK_IMAGES = {
  // Harishchandragad — Kokankada monsoon cliffs & trails
  harishchandragad: monsoonCovers([
    `${W}/b/bc/Kokankada.jpg`,
    `${W}/7/72/Kokankada_%2833292964631%29.jpg`,
    `${W}/d/d9/Kokankada_hills.jpg`,
    `${W}/7/73/On_the_crest_of_Kokankada_%2833265563382%29.jpg`,
    `${W}/c/c4/Trail_towards_Kokankada_%2832577897544%29.jpg`,
    `${W}/0/0d/Trail_from_Pachnai_to_Harishchandragad_%2832606500883%29.jpg`,
  ]),
  // Devkund — waterfall + stream monsoon set
  devkund: monsoonCovers([
    `${W}/2/2c/Devkund_waterfalls.jpg`,
    `${W}/c/c2/Devkund_rivers_stream.jpg`,
    `${W}/2/2a/Devkund_lake_site_maharashtra.jpg`,
    `${W}/7/7f/Sahyadri_Waterfall.jpg`,
    `${W}/9/9a/Monsoon_Waterfall.jpg`,
  ]),
  // Kalu / God’s Valley — Malshej monsoon ranges
  kalu: monsoonCovers([
    `${W}/2/2b/Malshej_Hills.jpg`,
    `${W}/f/f4/Malshej_Ghat_from_the_top.jpg`,
    `${W}/e/e9/Sahayadri_ranges_from_malshej_ghat.jpg`,
    `${W}/2/26/Thumb_point_malshej_ghat.jpg`,
    `${W}/a/aa/Verdant_Sahyadri_Hills.jpg`,
    `${W}/7/71/Monsoon_Stream%2C_Rajmachi%2C_The_Sahyadri_Ranges.jpg`,
  ]),
  // Savlya Ghat — Tamhini monsoon ghat + forest falls
  savlya: monsoonCovers([
    `${W}/1/18/Tamhini_Ghat.jpg`,
    `${W}/7/77/Madhe_Ghat_Waterfall.jpg`,
    `${W}/4/43/Waterfalls_in_forest_%28India%2C_2018%29.jpg`,
    `${W}/7/7f/Sahyadri_Waterfall.jpg`,
    `${W}/9/9a/Monsoon_Waterfall.jpg`,
    `${W}/9/9f/Awsoome_Matheran_Climate.jpg`,
  ]),
  // Mahabaleshwar monsoon — misty hills, Lingmala, valley, Venna
  mahabaleshwar: monsoonCovers([
    `${W}/0/0f/Mahabaleshwar_during_monsoon.jpg`,
    `${W}/b/b6/Lingmala_waterfall_1.jpg`,
    `${W}/7/78/Waterfall_Valley_Mahabaleshwar.jpg`,
    `${W}/9/90/Venna_Lake%2C_Mahabaleshwar.jpg`,
    `${W}/a/aa/Verdant_Sahyadri_Hills.jpg`,
  ]),
};

const DEFAULT_FORM = [
  { label: 'Full Name', fieldName: 'full_name', type: 'text', required: true, placeholder: 'Your full name' },
  { label: 'Phone', fieldName: 'phone', type: 'tel', required: true, placeholder: '10-digit mobile' },
  { label: 'E-mail', fieldName: 'email', type: 'email', required: true, placeholder: 'you@example.com' },
  { label: 'Age', fieldName: 'age', type: 'number', required: true, placeholder: 'Age' },
  { label: 'City', fieldName: 'city', type: 'text', required: false, placeholder: 'City' },
  {
    label: 'I agree to the trek terms & safety guidelines',
    fieldName: 'agree_terms',
    type: 'agree',
    required: true,
    options: ['Yes'],
  },
];

function baseRegistration({ availableDates, locationOptions, timeSlots = [] }) {
  return {
    status: 'open',
    mode: 'internal_form',
    requireLogin: true,
    availableDates,
    timeSlots,
    locationOptions,
    maxPeoplePerBooking: 0,
    formSchema: DEFAULT_FORM,
    genderQuotas: { enabled: false, femaleSeats: 0, maleSeats: 0, othersSeats: 0 },
    genderPhase: 'all',
    qrAutoConfirm: false,
  };
}

function batchesFromDates(dates, timing, note = '') {
  return dates.map((date) => ({ date, batchSize: 0, timing, note }));
}

function buildTreks() {
  return [
    {
      matchNames: [/harishchandra/i, /harishchandragad/i],
      payload: {
        trekName: 'Iconic Monsoon Trek to Harishchandragad',
        difficultyLevel: 'moderate',
        trekDuration: '2 Days / 1 Night',
        startingPoint: 'Mumbai / Pune / Kasara',
        destination: 'Harishchandragad',
        meetingLocation: 'Andheri · Ghatkopar · Thane · Pune pickups · Kasara Station',
        departureTime: '09:00 PM (Day 1)',
        returnTime: '09:00 PM (Day 2)',
        city: 'Pune / Mumbai',
        trekCategory: 'hiking',
        dateLabel: 'Every Weekend (Fri–Sat | Sat–Sun)',
        featuredSection: 'weekend',
        ...TREK_IMAGES.harishchandragad,
        description:
          'TrekkVede presents the Iconic Monsoon Trek to Harishchandragad. Overnight monsoon adventure with pickups from Mumbai & Pune, plus Kasara jeep transfer option. Visit Kokankada, Harishchandreshwar Temple, Pushkarni, and Ganpati Cave.',
        registrationFee: 1499,
        platformFeePercent: 0, // Razorpay community — no platform fee
        status: 'published',
        inclusions: [
          'Travel as per selected pickup (Mumbai bus / Pune bus / Kasara jeep transfer)',
          'Trip coordination by TrekkVede',
          'Basic first aid kit',
        ],
        exclusions: [
          'Personal expenses',
          'Any meal / stay not mentioned',
          'Travel insurance',
        ],
        thingsToCarry: [
          'Min 3-liter water bottle',
          'Good trekking / sports shoes',
          'Raincoat / poncho (monsoon)',
          'Torch / headlamp',
          'Personal medicines & ID proof',
          'Extra pair of clothes',
        ],
        itinerary: [
          {
            day: 1,
            title: 'Departure night',
            description: 'Board from your pickup point and travel to base.',
            points: [
              { text: 'Mumbai bus: Andheri (Gundavali) 8:00 PM → Ghatkopar 8:30 PM → Thane 9:00 PM', level: 'main', showDot: true },
              { text: 'Pune bus: Ch. Shivajinagar 9:00 PM → Aundh 9:15 PM → Jagtap Dairy 9:30 PM → Nashik Phata 9:45 PM', level: 'main', showDot: true },
              { text: 'Kasara jeep: Kasara Station 11:15 PM', level: 'main', showDot: true },
              { text: 'Train option Mumbai→Kasara: CSMT 8:44 PM · Dadar 8:58 · Ghatkopar 9:11 · Thane 9:26 · Kalyan 9:52 · Kasara 11:04 PM', level: 'sub', showDot: true },
            ],
          },
          {
            day: 2,
            title: 'Harishchandragad exploration & return',
            description: 'Trek highlights and return by evening.',
            points: [
              { text: 'Kokankada viewpoint', level: 'main', showDot: true },
              { text: 'Harishchandreshwar Temple', level: 'main', showDot: true },
              { text: 'Pushkarni', level: 'main', showDot: true },
              { text: 'Ganpati Cave', level: 'main', showDot: true },
              { text: 'Return by ~09:00 PM (Day 2)', level: 'main', showDot: true },
            ],
          },
        ],
        detailBoxes: [
          { id: 'duration', label: 'Duration', value: '2D / 1N', icon: 'clock', order: 1 },
          { id: 'departure', label: 'Departure', value: '9:00 PM Day 1', icon: 'default', order: 2 },
          { id: 'return', label: 'Return', value: '9:00 PM Day 2', icon: 'default', order: 3 },
          { id: 'level', label: 'Difficulty', value: 'Moderate', icon: 'default', order: 4 },
        ],
        trekFilters: {
          duration: ['Weekend', 'Multi-day'],
          difficulty: [],
          budget: ['₹1000 – ₹3000'],
          experience: ['Sunrise View'],
          timing: ['Evening'],
          terrain: ['Mountain'],
          style: ['Group'],
        },
        registration: baseRegistration({
          availableDates: [...WEEKENDS.friSat, ...WEEKENDS.satSun],
          locationOptions: [
            'Andheri (Gundavali Bus Stop) – 8:00 PM',
            'Ghatkopar – 8:30 PM',
            'Thane – 9:00 PM',
            'Ch. Shivajinagar – 9:00 PM',
            'Aundh – 9:15 PM',
            'Jagtap Dairy – 9:30 PM',
            'Nashik Phata – 9:45 PM',
            'Kasara Station – 11:15 PM',
          ],
          timeSlots: ['Fri–Sat batch', 'Sat–Sun batch'],
        }),
        trekBatches: [
          ...batchesFromDates(WEEKENDS.friSat, '09:00 PM', 'Fri–Sat'),
          ...batchesFromDates(WEEKENDS.satSun, '09:00 PM', 'Sat–Sun'),
        ],
      },
    },
    {
      matchNames: [/devkund/i],
      payload: {
        trekName: 'Devkund Waterfall Trek',
        difficultyLevel: 'easy',
        trekDuration: '1 Day',
        startingPoint: 'Pune',
        destination: 'Devkund Waterfall',
        meetingLocation: 'Hadapsar · Viman Nagar · Ch. Shivajinagar · Kothrud · Wakad · Hinjewadi',
        departureTime: '05:00 AM',
        returnTime: '10:00 PM',
        city: 'Pune',
        trekCategory: 'hiking',
        dateLabel: 'Every Saturday & Sunday',
        featuredSection: 'weekend',
        ...TREK_IMAGES.devkund,
        description:
          'TrekkVede presents trek to Devkund Waterfall. Full-day monsoon trek from Pune with private non-AC bus, breakfast, tea & lunch. Group discounts available.',
        registrationFee: 1499,
        platformFeePercent: 0,
        status: 'published',
        inclusions: [
          'Pune to Pune private Non-AC bus travel',
          'Breakfast and tea',
          'Lunch',
          'Basic first aid kit (not for major medical issues)',
        ],
        exclusions: [
          'Personal expenses',
          'Anything not mentioned in inclusions',
        ],
        thingsToCarry: [
          'Min 3-liter water bottle',
          'Good trekking / sports shoes',
          'Towel / extra clothes for waterfall',
          'Raincoat / poncho',
          'Personal medicines & ID proof',
        ],
        itinerary: [
          {
            day: 1,
            title: 'Devkund day trek',
            description: 'Pune pickup to waterfall and return.',
            points: [
              { text: '05:00 AM — Meet at pickup points and start from Pune', level: 'main', showDot: true },
              { text: '08:30 AM — Reach base village and have breakfast', level: 'main', showDot: true },
              { text: '09:00 AM — Start trek', level: 'main', showDot: true },
              { text: '11:00 AM — Reach waterfall and enjoy the water', level: 'main', showDot: true },
              { text: '12:30 PM — Start return trek to base village', level: 'main', showDot: true },
              { text: '02:00 PM — Reach base village and have lunch', level: 'main', showDot: true },
              { text: '04:00 PM — Start return journey to Pune', level: 'main', showDot: true },
              { text: '10:00 PM — Reach Pune; trek ends', level: 'main', showDot: true },
            ],
          },
        ],
        detailBoxes: [
          { id: 'duration', label: 'Duration', value: '1 Day', icon: 'clock', order: 1 },
          { id: 'fee', label: 'Charges', value: '₹1499', icon: 'default', order: 2 },
          { id: 'departure', label: 'Departure', value: '5:00 AM', icon: 'default', order: 3 },
          { id: 'return', label: 'Return', value: '10:00 PM', icon: 'default', order: 4 },
        ],
        trekFilters: {
          duration: ['Full Day'],
          difficulty: [],
          budget: ['₹1000 – ₹3000'],
          experience: [],
          timing: ['Morning'],
          terrain: ['Forest', 'Mountain'],
          style: ['Group'],
        },
        registration: baseRegistration({
          availableDates: WEEKENDS.everyWeekend,
          locationOptions: [
            'Hadapsar',
            'Viman Nagar',
            'Ch. Shivajinagar',
            'Kothrud Depot',
            'Wakad',
            'Hinjewadi',
          ],
          timeSlots: ['05:00 AM'],
        }),
        trekBatches: batchesFromDates(WEEKENDS.everyWeekend, '05:00 AM', 'Sat/Sun'),
      },
    },
    {
      matchNames: [/kalu/i],
      payload: {
        trekName: 'Kalu Waterfall Trek',
        difficultyLevel: 'moderate',
        trekDuration: '2 Days / 1 Night',
        startingPoint: 'Pune',
        destination: 'Kalu Waterfall',
        meetingLocation: 'Ch. Shivajinagar · Aundh · Jagtap Dairy · Nashik Phata',
        departureTime: '10:00 PM (Day 1)',
        returnTime: '09:00 PM (Day 2)',
        city: 'Pune',
        trekCategory: 'hiking',
        dateLabel: 'Every Weekend (Fri–Sat | Sat–Sun)',
        featuredSection: 'weekend',
        ...TREK_IMAGES.kalu,
        description:
          'TrekkVede presents trek to Kalu Waterfall. Overnight monsoon trek from Pune with private Non-AC travel, breakfast, tea, veg lunch, entry fees and first aid. Group-friendly weekend batches.',
        registrationFee: 1499,
        platformFeePercent: 0,
        status: 'published',
        inclusions: [
          'Entry fees',
          'Pune to Pune private Non-AC travel',
          'Breakfast and tea',
          'Lunch (Veg)',
          'First aid kit',
        ],
        exclusions: [
          'Personal expenses',
          'Anything not mentioned in inclusions',
        ],
        thingsToCarry: [
          'Min 3-liter water bottle',
          'Good trekking / sports shoes',
          'Towel / extra clothes for waterfall',
          'Raincoat / poncho',
          'Torch / headlamp',
          'Personal medicines & ID proof',
        ],
        itinerary: [
          {
            day: 1,
            title: 'Night departure from Pune',
            description: 'Board from Pune pickup points.',
            points: [
              { text: '10:00 PM — Start journey from Pune (Ch. Shivajinagar)', level: 'main', showDot: true },
              { text: '10:15 PM — Aundh pickup', level: 'sub', showDot: true },
              { text: '10:30 PM — Jagtap Dairy pickup', level: 'sub', showDot: true },
              { text: '10:45 PM — Nashik Phata pickup', level: 'sub', showDot: true },
            ],
          },
          {
            day: 2,
            title: 'Kalu Waterfall trek & return',
            description: 'Full day at the waterfall, then return to Pune.',
            points: [
              { text: '05:30 AM — Reach base village, breakfast, trek starts', level: 'main', showDot: true },
              { text: '09:30 AM — Enjoy trek towards Kalu Waterfall', level: 'main', showDot: true },
              { text: '11:00 AM — Explore Kalu waterfall', level: 'main', showDot: true },
              { text: '03:30 PM — Finish trek, lunch, start return journey', level: 'main', showDot: true },
              { text: '09:00 PM — Reach Pune', level: 'main', showDot: true },
            ],
          },
        ],
        detailBoxes: [
          { id: 'duration', label: 'Duration', value: '2D / 1N', icon: 'clock', order: 1 },
          { id: 'fee', label: 'Charges', value: '₹1499', icon: 'default', order: 2 },
          { id: 'departure', label: 'Departure', value: '10:00 PM Day 1', icon: 'default', order: 3 },
          { id: 'return', label: 'Return', value: '9:00 PM Day 2', icon: 'default', order: 4 },
        ],
        trekFilters: {
          duration: ['Weekend', 'Multi-day'],
          difficulty: [],
          budget: ['₹1000 – ₹3000'],
          experience: ['Sunrise View'],
          timing: ['Evening'],
          terrain: ['Forest', 'Mountain'],
          style: ['Group'],
        },
        registration: baseRegistration({
          availableDates: WEEKENDS.overnight,
          locationOptions: [
            'Ch. Shivajinagar – 10:00 PM',
            'Aundh – 10:15 PM',
            'Jagtap Dairy – 10:30 PM',
            'Nashik Phata – 10:45 PM',
          ],
          timeSlots: ['Fri–Sat batch', 'Sat–Sun batch'],
        }),
        trekBatches: batchesFromDates(WEEKENDS.overnight, '10:00 PM', 'Weekend overnight'),
      },
    },
    {
      matchNames: [/savlya/i, /savalia/i],
      payload: {
        trekName: 'Savlya Ghat with Hidden Waterfall Trek',
        difficultyLevel: 'easy',
        trekDuration: '1 Day',
        startingPoint: 'Pune',
        destination: 'Savlya Ghat & Hidden Waterfall',
        meetingLocation: 'Hadapsar · Viman Nagar · JM Corner · Aundh · Wakad · Hinjewadi',
        departureTime: '05:00 AM',
        returnTime: '08:00 PM',
        city: 'Pune',
        trekCategory: 'trail',
        dateLabel: 'Every Saturday & Sunday',
        featuredSection: 'weekend',
        ...TREK_IMAGES.savlya,
        description:
          'TrekkVede presents Savlya Ghat with Hidden Waterfall trek. Day monsoon trek from Pune with forest entry, Non-AC travel, breakfast, tea, veg lunch and first aid. Group discounts available.',
        registrationFee: 1499,
        platformFeePercent: 0,
        status: 'published',
        inclusions: [
          'Forest entry fees',
          'Pune to Pune private Non-AC travel',
          'Breakfast and tea',
          'Lunch (Veg)',
          'First aid kit',
        ],
        exclusions: [
          'Personal expenses',
          'Anything not mentioned in inclusions',
        ],
        thingsToCarry: [
          'Min 3-liter water bottle',
          'Good trekking / sports shoes',
          'Towel / extra clothes',
          'Raincoat / poncho',
          'Personal medicines & ID proof',
        ],
        itinerary: [
          {
            day: 1,
            title: 'Savlya Ghat day trek',
            description: 'Morning departure, waterfall, return by night.',
            points: [
              { text: '05:00 AM — Start from Hadapsar', level: 'main', showDot: true },
              { text: '05:15 AM — Viman Nagar · 05:30 JM Corner · 05:45 Aundh · 06:00 Wakad · 06:10 Hinjewadi', level: 'sub', showDot: true },
              { text: '08:30 AM — Reach base, breakfast, trek starts', level: 'main', showDot: true },
              { text: '09:00 AM — Explore Savlya Ghat', level: 'main', showDot: true },
              { text: '12:30 PM — Trek to hidden waterfall and enjoy', level: 'main', showDot: true },
              { text: '02:30 PM — Finish trek, freshen up, lunch, start return', level: 'main', showDot: true },
              { text: '08:00 PM — Reach Pune', level: 'main', showDot: true },
            ],
          },
        ],
        detailBoxes: [
          { id: 'duration', label: 'Duration', value: '1 Day', icon: 'clock', order: 1 },
          { id: 'fee', label: 'Charges', value: '₹1499', icon: 'default', order: 2 },
          { id: 'departure', label: 'Departure', value: '5:00 AM', icon: 'default', order: 3 },
          { id: 'return', label: 'Return', value: '8:00 PM', icon: 'default', order: 4 },
        ],
        trekFilters: {
          duration: ['Full Day'],
          difficulty: [],
          budget: ['₹1000 – ₹3000'],
          experience: [],
          timing: ['Morning'],
          terrain: ['Forest', 'Mountain'],
          style: ['Group'],
        },
        registration: baseRegistration({
          availableDates: WEEKENDS.everyWeekend,
          locationOptions: [
            'Hadapsar – 05:00 AM',
            'Viman Nagar – 05:15 AM',
            'JM Corner – 05:30 AM',
            'Aundh – 05:45 AM',
            'Wakad – 06:00 AM',
            'Hinjewadi – 06:10 AM',
          ],
          timeSlots: ['05:00 AM'],
        }),
        trekBatches: batchesFromDates(WEEKENDS.everyWeekend, '05:00 AM', 'Sat/Sun'),
      },
    },
    {
      matchNames: [/mahabaleshwar/i],
      payload: {
        trekName: 'Mahabaleshwar Monsoon Special',
        difficultyLevel: 'easy',
        trekDuration: '1 Day',
        startingPoint: 'Pune',
        destination: 'Mahabaleshwar',
        meetingLocation: 'Deccan Gymkhana · Wakad Bridge · Navale Bridge',
        departureTime: '06:00 AM',
        returnTime: 'Evening (as per itinerary)',
        city: 'Pune',
        trekCategory: 'adventure',
        dateLabel: 'Every Saturday & Sunday',
        featuredSection: 'weekend',
        ...TREK_IMAGES.mahabaleshwar,
        description:
          'TrekkVede presents Mahabaleshwar Monsoon Special. Full-day sightseeing from Pune covering Lingmala Waterfall, Arthur Seat, Echo Point, Needle Hole, Savitri Point, temples, Venna Lake, Mapro Garden and more scenic viewpoints.',
        registrationFee: 1499,
        platformFeePercent: 0,
        status: 'published',
        inclusions: [
          'Pune to Mahabaleshwar to Pune private Non-AC vehicle',
          'Breakfast + tea',
          'Lunch (Veg)',
          'Complete sightseeing as per itinerary',
          'Entry fees',
          'Trip expertise & coordination by experienced trip captain',
          'Basic first aid kit',
          'Fun group experience',
        ],
        exclusions: [
          'Boating charges',
          'Personal expenses',
          'Anything not mentioned in inclusions',
        ],
        thingsToCarry: [
          'Min 2–3 liter water bottle',
          'Comfortable shoes',
          'Raincoat / poncho / umbrella',
          'Cap / sunglasses',
          'Personal medicines & ID proof',
        ],
        itinerary: [
          {
            day: 1,
            title: 'Mahabaleshwar monsoon sightseeing',
            description: 'Pickup from Pune and full-day highlights.',
            points: [
              { text: '06:00 AM — Deccan Gymkhana pickup', level: 'main', showDot: true },
              { text: '06:30 AM — Wakad Bridge · 07:00 AM — Navale Bridge', level: 'sub', showDot: true },
              { text: 'Lingmala Waterfall', level: 'main', showDot: true },
              { text: 'Wai Ganesh Temple', level: 'main', showDot: true },
              { text: 'Arthur Seat Point · Echo Point · Needle Hole Point · Savitri Point', level: 'main', showDot: true },
              { text: 'Mahabaleshwar Temple · Panchganga Temple', level: 'main', showDot: true },
              { text: 'Venna Lake · Mapro Garden · multiple scenic viewpoints', level: 'main', showDot: true },
              { text: 'Return to Pune in the evening', level: 'main', showDot: true },
            ],
          },
        ],
        detailBoxes: [
          { id: 'duration', label: 'Duration', value: '1 Day', icon: 'clock', order: 1 },
          { id: 'fee', label: 'Charges', value: '₹1499', icon: 'default', order: 2 },
          { id: 'departure', label: 'Departure', value: '6:00 AM', icon: 'default', order: 3 },
          { id: 'highlights', label: 'Highlights', value: 'Waterfalls + viewpoints', icon: 'default', order: 4 },
        ],
        trekFilters: {
          duration: ['Full Day'],
          difficulty: [],
          budget: ['₹1000 – ₹3000'],
          experience: [],
          timing: ['Morning'],
          terrain: ['Mountain'],
          style: ['Group', 'Family'],
        },
        registration: baseRegistration({
          availableDates: WEEKENDS.everyWeekend,
          locationOptions: [
            'Deccan Gymkhana – 06:00 AM',
            'Wakad Bridge – 06:30 AM',
            'Navale Bridge – 07:00 AM',
          ],
          timeSlots: ['06:00 AM'],
        }),
        trekBatches: batchesFromDates(WEEKENDS.everyWeekend, '06:00 AM', 'Sat/Sun'),
      },
    },
    {
      matchNames: [/^aadrai/i, /aadrai jungle/i],
      payload: {
        trekName: 'Aadrai Jungle trek',
        difficultyLevel: 'moderate',
        trekDuration: '1 Day',
        startingPoint: 'Pune / Mumbai',
        destination: 'Aadrai Jungle',
        city: 'Pune',
        trekCategory: 'hiking',
        dateLabel: 'Every Saturday & Sunday',
        featuredSection: 'weekend',
        registrationFee: 1499,
        platformFeePercent: 0,
        status: 'published',
        registration: baseRegistration({
          availableDates: WEEKENDS.everyWeekend,
          locationOptions: [],
          timeSlots: ['Morning'],
        }),
        trekBatches: batchesFromDates(WEEKENDS.everyWeekend, '06:00 AM', 'Sat/Sun'),
        keepExistingFee: true,
        keepExistingCover: true,
      },
    },
    {
      matchNames: [/bhimashankar/i, /bhorgiri/i],
      payload: {
        trekName: 'Bhimashankar to Bhorgiri',
        difficultyLevel: 'moderate',
        trekDuration: '2 Days / 1 Night',
        startingPoint: 'Pune',
        destination: 'Bhimashankar → Bhorgiri',
        city: 'Pune',
        trekCategory: 'adventure',
        dateLabel: 'Every Weekend (Fri–Sat | Sat–Sun)',
        featuredSection: 'weekend',
        registrationFee: 1499,
        platformFeePercent: 0,
        status: 'published',
        registration: baseRegistration({
          availableDates: WEEKENDS.overnight,
          locationOptions: [],
          timeSlots: ['Fri–Sat batch', 'Sat–Sun batch'],
        }),
        trekBatches: [
          ...batchesFromDates(WEEKENDS.friSat, '09:00 PM', 'Fri–Sat'),
          ...batchesFromDates(WEEKENDS.satSun, '09:00 PM', 'Sat–Sun'),
        ],
        keepExistingFee: true,
        keepExistingCover: true,
      },
    },
  ];
}

async function findCommunity() {
  const all = await TrekCommunity.find({}).select('name slug paymentGateway status').lean();
  const hit = all.find((c) => COMMUNITY_MATCH.test(c.name || '') || COMMUNITY_MATCH.test(c.slug || ''));
  return hit || null;
}

async function upsertTrek(communityId, { matchNames, payload }) {
  const existing = await Trek.find({ communityId }).select('_id trekName registrationFee coverImage coverImages heroImages images').lean();
  const found = existing.find((t) => matchNames.some((re) => re.test(t.trekName || '')));

  const { keepExistingFee, keepExistingCover, ...data } = payload;
  const doc = {
    ...data,
    communityId,
  };

  if (keepExistingCover && found) {
    delete doc.coverImage;
    delete doc.coverImages;
    delete doc.heroImages;
    delete doc.images;
  }

  if (found) {
    if (keepExistingFee && Number(found.registrationFee) > 0) {
      delete doc.registrationFee;
    }
    await Trek.findByIdAndUpdate(found._id, { $set: doc }, { runValidators: true });
    // Trigger slug/date hooks via save when needed
    const trek = await Trek.findById(found._id);
    if (trek) {
      Object.assign(trek, doc);
      await trek.save();
    }
    return { action: 'updated', id: String(found._id), name: doc.trekName || found.trekName };
  }

  if (keepExistingFee && !(Number(doc.registrationFee) > 0)) {
    // Harishchandragad fee missing in brief — leave 0; organizer can set in admin
    doc.registrationFee = 0;
  }

  const trek = new Trek(doc);
  await trek.save();
  return { action: 'created', id: String(trek._id), name: trek.trekName };
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const community = await findCommunity();
  if (!community) {
    console.error('TrekkVede community not found. Create it in admin first.');
    process.exit(1);
  }

  console.log(`Community: ${community.name} (${community._id}) gateway=${community.paymentGateway || 'cashfree'}`);

  const communityPatch = {
    paymentGateway: 'razorpay',
    trekCategories: COMMUNITY_CATEGORIES,
    status: 'published',
    contactPhone: community.contactPhone || '7840979191',
    contactInstagram: community.contactInstagram || '@trekkvede',
    contacts:
      Array.isArray(community.contacts) && community.contacts.length > 0
        ? community.contacts
        : [
            { name: 'TrekkVede', role: 'Bookings', phone: community.contactPhone || '7840979191' },
          ],
  };
  await TrekCommunity.updateOne({ _id: community._id }, { $set: communityPatch });
  console.log(`Set community categories: ${COMMUNITY_CATEGORIES.join(', ')} · paymentGateway=razorpay`);
  console.log(`Contact: ${communityPatch.contactPhone} · ${communityPatch.contactInstagram}`);

  console.log('Upcoming weekend dates used:');
  console.log(`  Fri: ${WEEKENDS.fri.slice(0, 4).join(', ')}…`);
  console.log(`  Sat: ${WEEKENDS.sat.slice(0, 4).join(', ')}…`);
  console.log(`  Sun: ${WEEKENDS.sun.slice(0, 4).join(', ')}…`);

  const results = [];
  for (const item of buildTreks()) {
    const result = await upsertTrek(community._id, item);
    results.push(result);
    console.log(`${result.action.toUpperCase()}  ${result.name}  (${result.id})`);
  }

  // Refresh trekDate on any other published TrekkVede treks (Aadrai, etc.)
  const others = await Trek.find({ communityId: community._id, status: 'published' });
  for (const trek of others) {
    if (trek.trekBatches?.length) {
      await trek.save();
    }
  }

  const published = await Trek.find({ communityId: community._id, status: 'published' })
    .select('trekName registrationFee slug trekDate trekCategory coverImage dateLabel')
    .lean();
  console.log('\nPublished TrekkVede treks:');
  published.forEach((t) => {
    const td = t.trekDate ? new Date(t.trekDate).toISOString().slice(0, 10) : '—';
    console.log(`  - ${t.trekName} · ₹${t.registrationFee || 0} · ${t.trekCategory || '—'} · trekDate=${td} · img=${t.coverImage ? 'yes' : 'no'} · /trek/${t.slug || t._id}`);
  });

  await mongoose.disconnect();
  console.log(`\nDone. ${results.filter((r) => r.action === 'created').length} created, ${results.filter((r) => r.action === 'updated').length} updated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
