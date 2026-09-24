require('dotenv').config();

const path = require('path');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
const Fest = require('../src/model/fest_organizer_model');
const Competition = require('../src/model/competition_model');

const ROOT = path.resolve(__dirname, '../..');
const SLUG = 'kshitij-pune-multicity-event-2026';
const LEGACY_SLUG = 'kshitij-pune-regionals-2026';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const baseForm = [
  { id: 'name', type: 'text', label: 'Full Name', fieldName: 'name', required: true },
  { id: 'email', type: 'email', label: 'Email', fieldName: 'email', required: true },
  { id: 'phone', type: 'tel', label: 'Phone Number', fieldName: 'phone', required: true },
  { id: 'college', type: 'text', label: 'College', fieldName: 'college', required: true },
];

const personFields = [
  { id: 'pf_name', key: 'name', type: 'text', label: 'Full name', placeholder: 'Full name', required: true, scope: 'person' },
  { id: 'pf_email', key: 'email', type: 'email', label: 'Email address', placeholder: 'you@example.com', required: true, scope: 'person' },
  { id: 'pf_phone', key: 'phone', type: 'tel', label: 'Phone number', placeholder: '10-digit mobile number', required: true, scope: 'person' },
  { id: 'pf_college', key: 'college', type: 'text', label: 'College / institution', placeholder: 'College or institution name', required: true, scope: 'person' },
];

const competitions = [
  {
    name: 'Family Feud', subtitle: '', competitionType: 'quiz', category: 'QUIZ', module: 'INFORMALS', eventCategory: 'USP', eventFormat: 'Eliminations + Finals',
    imageSource: 'https://images.pexels.com/photos/1181396/pexels-photo-1181396.jpeg?auto=compress&cs=tinysrgb&w=1200',
    description: 'Put your guessing skills, pop-culture knowledge, and quick thinking to the ultimate test across two exciting rounds: race against the clock to answer category-based questions, then take on Family Feud to match the crowd’s answers.',
    dateTime: '29 Sep 2026, 11:00 AM - 2:30 PM', venue: 'Classroom, MIT-WPU Campus, Pune', slotsAllotted: 0,
    teamSizeMin: 2, teamSizeMax: 2, teamSizeLabel: 'Team of 2',
    prizePool: '1st Place: ₹3,000/-',
    commonRules: [],
    judgingCriteria: [],
    rounds: [
      {
        roundNumber: 1,
        title: 'Beat the Clock',
        description: 'Sixteen teams receive categories; after a five-minute trading period, each team gets 60 seconds of rapid-fire questions. The top eight teams advance.',
        rules: [
          'Each team is allotted a category placard according to its slot.',
          'A five-minute category-trading period begins after all categories are allotted.',
          'A trade is valid only when both teams agree and the organising committee is informed.',
          'No category changes or trades are permitted after the trading period ends.',
          'Each team has 60 seconds to answer as many questions as possible from its final category.',
          'The timer begins as soon as the first question is asked.',
          'Questions continue in rapid-fire format until the timer ends.',
          'Team members may discuss, but only the designated spokesperson may give the final answer.',
          'An answer from anyone other than the spokesperson is not considered.',
          'Teams may pass; a passed question returns only after all 20 category questions are exhausted.',
          'Each category contains 20 questions.',
          'Correct answer: 1 point. Wrong, passed, or unanswered question: 0 points.',
          'There is no negative marking.',
          'No answer is accepted after the 60-second timer ends.',
          'Phones, smartwatches, tablets, laptops, calculators, and other electronic devices are prohibited.',
          'Notes, books, internet access, and all other external assistance are prohibited.',
          'Audience or team prompting, signalling, cheating, or assistance may lead to a penalty or disqualification.',
          'Tied teams face a head-to-head mathematics question; the first correct answer advances.',
          'The quizmaster’s decisions on answers, timing, scoring, repetition, and tie-breakers are final.',
          'Teams must be ready before their turn; misconduct or rule violations may lead to disqualification.',
        ],
        dateTime: '29 Sep 2026, from 11:00 AM',
        venue: 'Classroom, MIT-WPU Campus, Pune',
      },
      {
        roundNumber: 2,
        title: 'Family Feud',
        description: 'Each round includes 2 questions lasting 5 mins maximum each, held in knockout style, producing first- and second-place winners.',
        rules: [
          'Each round will include 2 questions each lasting 5 mins maximum each. The rounds will be held in knockout style.',
          'Teams buzz in to determine who answers first.',
          'Teams may not press the buzzer before the emcee finishes the full question.',
          'Each guess must be given and locked within 15 seconds by saying “Answer Locked”.',
          'A response not locked within 15 seconds is not considered.',
          'Answers must use the complete word, phrase, or title; abbreviations, acronyms, and short forms are not accepted.',
          'Exact or close answer variations may be accepted at the organising committee’s discretion.',
          'The team with the highest score advances.',
          'Prompting may lead to consequences.',
          'Vulgarity, profanity, and inappropriate answers are prohibited.',
          'Phones, smartwatches, tablets, notes, internet access, and outside assistance are prohibited.',
          'If neither team finds all ten answers, only points from correct guesses count.',
          'Tied teams receive an additional question to score more points.',
          'The referee and organising committee decisions are final and binding.',
          'Teams can have only 3 wrong guesses after which game will be over. Failure to answer a question in the 15 seconds is also considered a wrong guess.',
          'Answers will only be considered in english unless the question requires including a hindi name or noun.',
        ],
        dateTime: '29 Sep 2026',
        venue: 'Classroom, MIT-WPU Campus, Pune',
      },
    ],
  },
  {
    name: 'The Boardroom Battle', subtitle: 'Group Discussion', competitionType: 'business', category: 'ACADEMIC', module: 'BUSINESS EVENTS', eventCategory: 'Popular', eventFormat: 'Direct Finals',
    imageSource: 'https://images.pexels.com/photos/31739411/pexels-photo-31739411.jpeg?auto=compress&cs=tinysrgb&w=1200',
    description: 'The Corporate Clash is a high-stakes group discussion event where 8 participants will have conflicting corporate stakeholder roles to debate a major strategic business decision and negotiate a realistic unified resolution under pressure.',
    dateTime: '29 Sep 2026, 11:00 AM - 1:30 PM', venue: 'Classroom, MIT-WPU Campus, Pune', slotsAllotted: 0,
    teamSizeMin: 1, teamSizeMax: 1, teamSizeLabel: 'Solo',
    prizePool: '1st Place: ₹3,000/-',
    commonRules: ['Further rules & regulations and topics will be revealed on the day of the event.'],
    judgingCriteria: [],
    rounds: [
      { roundNumber: 1, title: 'Direct Finals', description: 'Details and topics will be revealed on the day of the event.', dateTime: '29 Sep 2026, 11:00 AM - 1:30 PM', venue: 'Classroom, MIT-WPU Campus, Pune' },
    ],
  },
  {
    name: 'Shuttle Showdown', subtitle: 'Badminton', competitionType: 'sports', category: 'SPORTS', module: 'GAMING AND SPORTS', eventCategory: 'Others', eventFormat: 'Knockouts',
    imageSource: 'https://images.pexels.com/photos/26238655/pexels-photo-26238655.jpeg?auto=compress&cs=tinysrgb&w=1200',
    description: 'A high-energy badminton tournament where every smash, rally, and drop shot tests your skill and speed. Battle through intense matches, outplay your opponents, and fight your way to the finals.',
    dateTime: '29 Sep 2026, 3:00 PM - 6:00 PM', venue: 'Badminton Court, MIT-WPU Campus, Pune', slotsAllotted: 0,
    teamSizeMin: 1, teamSizeMax: 1, teamSizeLabel: 'Solo',
    prizePool: '1st Place: ₹2,000/-',
    commonRules: ['Each match is played as a single game, with the first player to reach 11 points declared the winner.', 'A player must win by two clear points.', 'If the score reaches 10-10, play continues until one player gains a two-point lead.', 'Every rally awards one point, regardless of who served.', 'The serve must be played diagonally into the opponent’s correct service court.', 'The opponent receives a point if the shuttle lands out, fails to cross the net, or a player commits a fault.', 'Players must not touch the net with their body or racket while the shuttle is in play.', 'A serve touching the net remains live if it lands in the correct service court unless the umpire calls a let.', 'Players must be ready at their assigned court before match time; excessive delay may result in a walkover.', 'Only equipment approved or provided by the organisers may be used.', 'Appropriate sports attire and proper sports shoes are mandatory; unsuitable clothing or footwear may prevent participation.', 'Abusive language, deliberate distraction, inappropriate behaviour, or intentional equipment damage may lead to penalties, suspension, or disqualification.', 'Players must respect opponents, officials, and organisers throughout the match.', 'The referee/organiser decision is final in every dispute.', 'The winner is the first player to reach 11 points while maintaining the required two-point advantage, including during deuce.'],
    judgingCriteria: [],
    rounds: [{ roundNumber: 1, title: 'Knockouts', description: 'Singles knockout bracket; first to 11 with a two-point advantage wins.', dateTime: '29 Sep 2026, 3:00 PM - 6:00 PM', venue: 'Badminton Court, MIT-WPU Campus, Pune' }],
  },
  {
    name: 'Sur Taal', subtitle: 'Bollywood Solo Singing', competitionType: 'music', category: 'MUSIC', module: 'PERFORMING ARTS', eventCategory: 'Popular', eventFormat: 'Direct Finals',
    imageSource: 'https://images.pexels.com/photos/38996316/pexels-photo-38996316.jpeg?auto=compress&cs=tinysrgb&w=1200',
    description: 'Let your voice bring the magic of Bollywood to life. Celebrate the soul of Hindi cinema through music by performing anything from soulful Bollywood classics to energetic chartbusters. Theme: Open.',
    dateTime: '30 Sep 2026, 11:00 AM - 12:30 PM', venue: 'Auditorium, MIT-WPU Campus, Pune', slotsAllotted: 0,
    teamSizeMin: 1, teamSizeMax: 1, teamSizeLabel: 'Solo',
    prizePool: '1st Place: ₹2,000/-',
    commonRules: ['Performance duration: 1-2 minutes.', 'Only Bollywood and Hindi album songs are allowed.', 'Mashups and medleys are allowed.', 'One instrument or a minus-one track is allowed.', 'Original compositions are not allowed.'],
    judgingCriteria: [],
    rounds: [{ roundNumber: 1, title: 'Direct Finals', description: 'Solo Bollywood singing final.', dateTime: '30 Sep 2026, 11:00 AM - 12:30 PM', venue: 'Auditorium, MIT-WPU Campus, Pune' }],
  },
  {
    name: 'Bollywood Dhamaka', subtitle: 'Bollywood Group Dance', competitionType: 'dance', category: 'DANCE', module: 'PERFORMING ARTS', eventCategory: 'Popular', eventFormat: 'Direct Finals',
    imageSource: 'https://images.pexels.com/photos/12442276/pexels-photo-12442276.jpeg?auto=compress&cs=tinysrgb&w=1200',
    description: 'Groove to the beats of Bollywood! Watch vibrant teams set the stage ablaze with high-energy performances, dazzling costumes, and electrifying moves in this showcase event. Theme: Open.',
    dateTime: '30 Sep 2026, 1:30 PM - 3:00 PM', venue: 'Auditorium, MIT-WPU Campus, Pune', slotsAllotted: 0,
    teamSizeMin: 6, teamSizeMax: 8, teamSizeLabel: '6-8 members',
    prizePool: '1st Place: ₹6,000/-',
    commonRules: [
      'Performance duration: 2-3 minutes.',
      'Props are allowed.',
      'Costumes are mandatory.',
      'Only Bollywood and Hindi album songs are allowed.',
      'Voice-overs are allowed.',
      'A pen drive consisting of one track only should be submitted at the Re-registration Desk in .mp3 or .wav format only.',
    ],
    judgingCriteria: [],
    rounds: [{ roundNumber: 1, title: 'Direct Finals', description: 'Bollywood group dance final.', dateTime: '30 Sep 2026, 1:30 PM - 3:00 PM', venue: 'Auditorium, MIT-WPU Campus, Pune' }],
  },
  {
    name: 'Solo Crossover', subtitle: 'Solo Street Showcase', competitionType: 'dance', category: 'DANCE', module: 'PERFORMING ARTS', eventCategory: 'Popular', eventFormat: 'Direct Finals',
    imageSource: 'https://images.pexels.com/photos/1701202/pexels-photo-1701202.jpeg?auto=compress&cs=tinysrgb&w=1200',
    description: 'A high-energy solo dance competition where dancers take the stage to showcase their individual style, musicality, expressions, and street-dance skills. Participants can explore styles such as B-Boying, Popping, Locking, Krumping, Waacking, Breaking, and Tutting while creating their own unique performance and owning the stage.',
    dateTime: '29 Sep 2026, 11:00 AM - 1:30 PM', venue: 'Auditorium, MIT-WPU Campus, Pune', slotsAllotted: 0,
    teamSizeMin: 1, teamSizeMax: 1, teamSizeLabel: 'Solo',
    prizePool: '1st Place: ₹3,000/-',
    commonRules: [
      'Participants must perform street-style dance forms only.',
      'Vulgar gestures, throwing anything at an opponent, or physical contact with an opponent may lead to consequences.',
      'Participants may use props.',
      'Voiceovers are allowed.',
      'Each participant must submit a pen drive containing one track only at the registration desk.',
      'Audio files must be in .mp3 or .wav format.',
      'Performance duration: 1–2 minutes.',
      'Format: Direct Finals.',
      'Number of participants: 16.',
    ],
    judgingCriteria: [],
    rounds: [{
      roundNumber: 1,
      title: 'Direct Finals',
      description: 'Duration: 32 minutes + buffer 20 minutes = 52 minutes. Theme: open.',
      dateTime: '29 Sep 2026, 11:00 AM - 1:30 PM',
      venue: 'Auditorium, MIT-WPU Campus, Pune',
    }],
  },
  {
    name: 'Fifa', subtitle: '', competitionType: 'esports', category: 'GAMING', module: 'GAMING AND SPORTS', eventCategory: 'Popular', eventFormat: 'Knockouts',
    imageSource: 'https://images.pexels.com/photos/34543044/pexels-photo-34543044.jpeg?auto=compress&cs=tinysrgb&w=1200',
    description: 'Fast-paced football knockout matches where every pass, tackle, and goal matters. Each match is six minutes (three minutes per half) with a four-minute buffer. With Legendary difficulty and exciting twists, only the best will rise to the top and win the crown.',
    dateTime: '30 Sep 2026, 11:00 AM - 2:30 PM', venue: 'Classroom, MIT-WPU Campus, Pune', slotsAllotted: 0,
    teamSizeMin: 2, teamSizeMax: 2, teamSizeLabel: 'Team of 2',
    prizePool: '1st Place: ₹3,000/-',
    commonRules: ['Basic FIFA rules apply with the event-specific modifications below.', 'Game difficulty is Legendary.', 'Camera view is set to Classic.', 'Only active clubs may be selected; classic teams such as Soccer Aid, Adidas 11, and all-star teams are prohibited.', 'All games use Classic mode.', 'Team management is allowed only before the match or at halftime.', 'Pausing or pressing the Options button during gameplay is prohibited and may have consequences.', 'Technical glitches require a restart.', 'Ties before the semifinals and finals go directly to penalties with no extra time.'],
    judgingCriteria: [],
    rounds: [{ roundNumber: 1, title: 'Knockouts', description: 'Sixteen-team FIFA knockout bracket. Each match is six minutes (three minutes per half) with a four-minute buffer.', dateTime: '30 Sep 2026, 11:00 AM - 2:30 PM', venue: 'Classroom, MIT-WPU Campus, Pune' }],
  },
];

async function upload(file, publicId, resourceType = 'image') {
  return cloudinary.uploader.upload(path.join(ROOT, file), {
    public_id: publicId,
    overwrite: true,
    resource_type: resourceType,
  });
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI or MONGO_URI is required');
  if (!process.env.CLOUDINARY_CLOUD_NAME) throw new Error('Cloudinary configuration is required');

  const [wide, portrait, rulebook, schedule] = await Promise.all([
    upload('backend/scripts/assets/kshitij-pune-regionals/cover-wide.jpg', 'crwdctrl/fests/kshitij-pune-regionals-2026/cover-wide'),
    upload('backend/scripts/assets/kshitij-pune-regionals/cover-portrait.jpg', 'crwdctrl/fests/kshitij-pune-regionals-2026/cover-portrait'),
    upload('backend/scripts/assets/kshitij-pune-regionals/event-rulebook.pdf', 'crwdctrl/fests/kshitij-pune-regionals-2026/event-rulebook', 'raw'),
    upload('backend/scripts/assets/kshitij-pune-regionals/event-schedule.pdf', 'crwdctrl/fests/kshitij-pune-regionals-2026/event-schedule', 'raw'),
  ]);

  const competitionImages = new Map();
  for (const item of competitions) {
    const image = await cloudinary.uploader.upload(item.imageSource, {
      public_id: `crwdctrl/fests/kshitij-pune-regionals-2026/competitions/${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      overwrite: true,
      resource_type: 'image',
    });
    competitionImages.set(item.name, image.secure_url);
  }

  await mongoose.connect(uri);
  const [techfest, mindspark] = await Promise.all([
    Fest.findOne({ slug: 'techfest-iit-bombay-2026' }).select('_id').lean(),
    Fest.findOne({ $or: [{ slug: 'mindspark-2026' }, { festName: /mindspark/i }] }).select('_id').lean(),
  ]);
  let fest = await Fest.findOne({
    $or: [
      { slug: SLUG },
      { slug: LEGACY_SLUG },
      { previousSlugs: LEGACY_SLUG },
      { festName: /^Kshitij Pune (?:Regionals|Multicity(?: Event)?)$/i },
    ],
  });
  const festPayload = {
    festName: 'Kshitij Pune Multicity',
    subtitle: 'Kshitij ’26 - Soaring Beyond the Horizon',
    collegeName: 'Mithibai College',
    festType: 'cultural',
    festDate: '29-30 Sep 2026',
    venue: 'MIT-WPU Campus, Pune',
    ticketPrice: 'To Be Announced', feeAmount: 0,
    platformFeePercent: 0,
    description: 'Kshitij`26 is taking over Pune!\n\nBringing the Kshitij experience to a new city, this edition brings together culture, competition and creativity across two action-packed days. From performing arts, gaming and sports, informals and business events, Pune is set to experience Kshitij like never before.',
    coverImage: wide.secure_url,
    coverImages: { page: wide.secure_url, wide: wide.secure_url, landscape: wide.secure_url, hero: wide.secure_url, portrait: portrait.secure_url },
    registration: {
      mode: 'INTERNAL_FORM',
      formType: 'SINGLE_STEP',
      formSchema: baseForm,
      formInstructions: 'Select a competition and complete the free registration form. No payment is required.',
      resourceLinks: [{ label: 'Event Rulebook', url: rulebook.secure_url }, { label: 'Event Schedule', url: schedule.secure_url }],
    },
    status: 'upcoming', slug: SLUG,
    previousSlugs: [...new Set([...(fest?.previousSlugs || []), LEGACY_SLUG])],
    isApproved: true, competitionsHeading: 'Multicity Events',
    relatedFestIds: [techfest?._id, mindspark?._id].filter(Boolean),
  };
  if (fest) { Object.assign(fest, festPayload); await fest.save(); } else { fest = await Fest.create(festPayload); }

  const ids = [];
  for (const item of competitions) {
    const doc = {
      ...item, imageSource: undefined, coverImage: competitionImages.get(item.name), gallery: [competitionImages.get(item.name)],
      fest: fest._id,
      prizePool: item.prizePool || '',
      registrationFee: 'Free', feeAmount: 0,
      commonRulesMessage: item.commonRulesMessage || '',
      showSlotsPublic: false,
      registrationType: 'fest',
      registration: {
        status: 'internal_form',
        formType: 'SINGLE_STEP',
        formSchema: [],
        personFields,
      },
      isApproved: true,
    };
    const existing = await Competition.findOne({ fest: fest._id, name: item.name });
    const comp = existing ? await Competition.findByIdAndUpdate(existing._id, { $set: doc }, { new: true, runValidators: true }) : await Competition.create(doc);
    ids.push(comp._id);
  }
  fest.competitions = ids;
  await fest.save();

  const count = await Competition.countDocuments({ fest: fest._id });
  if (count !== competitions.length) throw new Error(`Expected ${competitions.length} competitions, found ${count}`);
  console.log(JSON.stringify({ action: 'upserted', festId: String(fest._id), slug: fest.slug, competitions: count, names: competitions.map((c) => c.name), rulebook: rulebook.secure_url, schedule: schedule.secure_url }, null, 2));
}

if (require.main === module) {
  main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => mongoose.disconnect());
}

module.exports = { competitions, personFields };
