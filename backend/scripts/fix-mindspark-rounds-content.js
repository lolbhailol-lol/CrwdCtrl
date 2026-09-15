/**
 * Fix MindSpark competition rounds from RULEBOOK FINAL analysis.
 * Targets empty titles, mis-splits, mashed Overview tabs, and verbose duplicates.
 *
 * Usage: node scripts/fix-mindspark-rounds-content.js [--dry-run]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Competition = require('../src/model/competition_model');

const FEST_ID = '6a7f1010ed26d983b34e55c2';
const dryRun = process.argv.includes('--dry-run');

function round(n, title, { description = '', rules = [], offline = [], online = [] } = {}) {
  return {
    roundNumber: n,
    title,
    description,
    rules,
    offline: { rules: offline },
    online: { rules: online },
    roundRulesMessage: '',
    dateTime: '',
    venue: '',
  };
}

/** DB name → fixed rounds */
const FIXES = {
  FANDOM: [
    round(1, 'Multiple Choice Questions', {
      description: 'MCQ quiz on your chosen show. Score at least 60% to reach Round 2.',
      rules: [
        'Attempt the FANDOM quiz of one show only once.',
        'Report to the venue on time and attend only in your allotted slot.',
        'Teams scoring 60% or more of total marks proceed to Round 2.',
      ],
    }),
    round(2, 'Surprise Round', {
      description: 'Surprise round for teams that clear Round 1. No special prep beyond knowing the show well.',
      rules: [
        'Only teams shortlisted from Round 1 compete.',
        'No special preparations required — know your show thoroughly.',
        'Quiz Head decisions are final.',
      ],
    }),
  ],

  SHERLOCKED: [
    round(1, 'Multiple Short Cases', {
      description: 'Pen-and-paper round with multiple short cases. Bring your own stationery.',
      rules: [
        'Pen-and-paper short cases round.',
        'No pen or stationery is provided — bring your own.',
        '25 teams are shortlisted for Round 2.',
      ],
    }),
    round(2, 'Buzzer Round', {
      description: 'Buzzer round for teams shortlisted from Round 1.',
      rules: [
        'Only shortlisted teams from Round 1 participate.',
        '10 teams advance to the final round.',
        'No player changes mid-event; one person cannot be in multiple teams.',
      ],
    }),
    round(3, 'Murder Mystery Case', {
      description: 'Final single murder-mystery case for the top teams.',
      rules: [
        'Single murder-mystery case for finalists.',
        'No extra time unless declared by the Event Head.',
        'Cheating or unfair means leads to immediate disqualification.',
      ],
    }),
  ],

  Ideathon: [
    round(1, 'Preliminary Round', {
      description: 'Online video lecture plus short Google Forms test on industry challenges and solutions.',
      online: [
        'Recorded lecture, online test, and problem statement release: 5th September 2026.',
        'Doubt-solving session: 12th September 2026.',
        'Online test via Google Forms based on the lecture insights.',
      ],
    }),
    round(2, 'Abstract Collection & Evaluation', {
      description: 'Submit abstracts for evaluation. Team selection for finals uses abstract quality plus test scores.',
      rules: [
        'Abstract submission: 26th September 2026.',
        'Round 1 results declared: 29th September 2026.',
        'You may attempt all problem statements; only the best solution is selected.',
        'One team may submit only one final layout.',
        'Cheating or use of AI bots leads to disqualification.',
      ],
    }),
    round(3, 'Final Presentation', {
      description: 'Selected teams present ideas through a PowerPoint presentation in the final round.',
      rules: [
        'Only teams selected from abstract + test scores advance.',
        'Present your idea via PowerPoint in the Final Round.',
      ],
    }),
  ],

  Edifex: [
    round(1, 'Multiple Choice Questions', {
      description: 'MCQ elimination round on concepts relevant to the building-structure challenge.',
      rules: [
        'Multiple Choice Questions round.',
        'Qualified teams advance to the structure-building round.',
      ],
    }),
    round(2, 'Structure & Shake Table', {
      description: 'Build a structure from provided material only; tested on a shake table for seismic performance.',
      rules: [
        'Build from organizer-provided material only — no extras.',
        'One team builds one model; finish within allotted time.',
        'Testing follows the serial order assigned at the start.',
        'Shake-table test examines seismic performance of the structure.',
      ],
    }),
  ],

  'ON THE ETCH': [
    round(1, 'MCQ Test', {
      description: 'Multiple choice test on metallography and related concepts (40% of final score).',
      rules: [
        'Multiple Choice Questions (MCQ) Test.',
        'No phones, notes, AI tools, or reference material during the event.',
        'Round 1 contributes 40% of the total score.',
      ],
    }),
    round(2, 'Microstructure Identification', {
      description: 'Identify phases in an unknown sample from organizer-provided micrographs (60% of final score).',
      rules: [
        'Identify phases present by analysing the microstructure.',
        'Micrographs are provided by organizers — no external references.',
        'Round 2 contributes 60% of the total score.',
        'Top 3 teams by combined score are winners.',
      ],
    }),
  ],

  Assemblix: [
    round(1, 'MCQ Round', {
      description: 'Single-answer MCQs on machine drawing, components, and machine knowledge. Top 10 teams advance.',
      rules: [
        'MCQs with only one correct answer.',
        'Based on basics of machine drawing, components, and machines.',
        'About 10 teams are selected on marks for Round 2.',
      ],
    }),
    round(2, 'Assembly Sequence', {
      description: 'From an assembly or exploded drawing, decide the best sequence to assemble mechanical components.',
      rules: [
        'Only teams shortlisted from Round 1 participate.',
        'Given an assembly drawing or exploded view, decide the best assembly sequence.',
        'Judged on sequence quality and time taken.',
      ],
    }),
    round(3, 'Physical Assembly', {
      description: 'Assemble given machine components into the original assembly. Winners ranked by completion time.',
      rules: [
        'Assemble given components to form the original assembly.',
        'Tools are provided at the venue; bring a pen.',
        'Winners decided by time taken to complete Round 3.',
        'Tie-break: higher Round 2 score wins.',
      ],
    }),
  ],

  'Game of Innovation': [
    round(1, 'Project Submission', {
      description: 'Submit project ideas in PDF (description, designs, recognitions, photos, video links) by 22nd September.',
      online: [
        'Categories: Under 18, Undergraduate (UG), and Postgraduate (PG)/PhD.',
        'Submit detailed project ideas as PDF on the MindSpark website.',
        'Include descriptions, designs, recognitions, photos, and video links.',
        'Submission deadline: 22nd September.',
        'College clubs are not eligible.',
      ],
    }),
    round(2, 'TechExpo Showcase', {
      description: 'Shortlisted projects showcase at TechExpo (3–4 Oct). Winners via voting and critics’ choice.',
      rules: [
        'Top contestants from Round 1 get a TechExpo stall (3 days).',
        'Showcase on 3rd and 4th October 2026.',
        'Winner decided by voting system and critics’ choice.',
      ],
    }),
  ],

  'Robo Falconry': [
    round(1, 'Falconry — Payload Drop', {
      description: 'Qualifier: simple payload delivery with a dropping mechanism (cricket ball fed at start).',
      rules: [
        'Simple payload delivery — make a dropping mechanism.',
        'A cricket ball (~149 g, 7.2 cm) is fed manually at the start.',
        'Fly to the target and complete the drop task.',
      ],
    }),
    round(2, 'Timed Obstacle Race', {
      description: 'Timed obstacle qualifier. Best of 2 attempts; penalties add time. Combined with Round 1 for finals.',
      rules: [
        'Timed obstacle race — time subtracted from a constant for points.',
        '2 attempts; best of 2 counts. Timer starts at first hurdle, stops at loop exit.',
        'Penalty: +5 seconds for touching an obstacle or the ground.',
        'Missed checkpoint: resume from last completed checkpoint with timer running.',
        'Total of Round 1 + Round 2 scores qualify teams to finals.',
      ],
    }),
    round(3, 'Finals', {
      description: 'Finals for top teams — more complex timed course objectives.',
      rules: [
        'Finals for teams qualified on combined Round 1 + Round 2 scores.',
        'Objectives get more complex toward the win.',
        'Fastest clean run without straying off course wins.',
        'Max takeoff weight 2500 g; diagonal frame 200–600 mm; max 6 propellers.',
      ],
    }),
  ],

  'REVIT RUSH': [
    round(1, 'Problem Statement & Concept', {
      description: 'Online Revit concept round. Problem statement released at the start; submit one ZIP online.',
      online: [
        'Conducted online — problem statement released at the start of the round.',
        'Develop an initial design concept in Autodesk Revit within the given time.',
        'Submit a single ZIP file online only; late submissions are not accepted.',
        'Design must be original; references allowed for inspiration only.',
      ],
    }),
    round(2, 'Design Round', {
      description: 'Offline Revit design challenge. Bring your own laptop with Revit pre-installed.',
      offline: [
        'Held offline — final challenge and tasks announced before the round.',
        'Complete the architectural solution in Autodesk Revit within the allotted time.',
        'Submit a Design Report with the final Revit model.',
        'Bring your own laptop with Revit pre-installed.',
      ],
    }),
  ],

  'Beyond Suits': [
    round(1, 'MCQs & Case Study', {
      description: '45-minute MCQs covering law basics, corporate trivia, reasoning, optional Suits trivia, plus a case study.',
      rules: [
        'Time: 45 minutes.',
        'Topics: courtroom terminology, corporate law trivia, logical reasoning & situational judgment.',
        'Optional fun category: Suits series trivia.',
        'Includes a case study component.',
      ],
    }),
    round(2, 'Mock Trial', {
      description: '20-minute mock trial (Plaintiff vs Defendant). Random side assignment.',
      rules: [
        'Team round — randomly assigned Prosecution/Plaintiff or Defence.',
        'Opening statement (2 min), chief examination (3 min), cross (3 min), closing (2 min).',
        'About 20 minutes per trial.',
        'No player swaps mid-rounds; Event Head decisions are final.',
      ],
    }),
  ],

  Hackathon: [
    round(1, 'Shortlisting Round', {
      description: 'Screening round: PPT proposal if problem statement is early, otherwise MCQ online test.',
      online: [
        'If sponsor shares the problem early → submit PPT-based solution proposals.',
        'Otherwise → MCQ online test (domain knowledge, logic, etc.).',
        'Results with marks published on the website.',
        'Only shortlisted teams advance to the 24-hour final.',
      ],
    }),
    round(2, 'Final Hackathon', {
      description: '24-hour build of the working product/prototype. Non-evaluative mentor sessions during the round.',
      rules: [
        'Only shortlisted teams from Round 1 participate.',
        '24 hours of continuous development on a chosen problem statement.',
        'Solution may be desktop, web, mobile, data viz, or design prototype.',
        'Mentor round is guidance-only (non-evaluative) with industry mentors.',
      ],
    }),
  ],

  QuantQuest: [
    round(1, 'Case / Theory Test', {
      description: 'Individual test or case study on quantitative finance concepts and landmark events.',
      rules: [
        'Assesses theoretical understanding and application skills.',
        'AI tools (including LLMs) are prohibited for generating Round 1 reports.',
        'Submissions must be individually researched and authored.',
      ],
    }),
    round(2, 'Portfolio Simulation', {
      description: 'Virtual portfolio management in a simulated market based on a given scenario.',
      rules: [
        'Evaluated on decision-making and risk management.',
        'AI tools may not rebalance portfolios or make Round 2 decisions.',
        'Use only organizer-provided / in-tool data — no external datasets.',
      ],
    }),
  ],

  'Code Junkie': [
    round(1, 'MCQ Round', {
      description: '30-minute MCQ round with negative marking. Top teams advance.',
      rules: [
        'Multiple choice questions; 30 minutes allotted.',
        'Negative marking applies.',
        'Further details shared at the event.',
        'Top teams qualify for the coding round (about top 10).',
      ],
    }),
    round(2, 'Rapid Coding', {
      description: 'Rapid coding round — complete codes in time; judged on correctness and speed.',
      rules: [
        'Only teams shortlisted from Round 1 participate.',
        'Complete codes within the stipulated time.',
        'Submit the output file; judged on time taken to code.',
        'No electronic devices (phones, smartwatches, calculators) in either round.',
      ],
    }),
  ],

  WORLDWIZE: [
    round(1, 'Written Quiz', {
      description: '30 MCQs plus one-liner descriptive questions in 45 minutes at COEP Tech.',
      rules: [
        '30 MCQs and descriptive one-liners within 45 minutes.',
        'Held at COEP Tech.',
        'Score at least 75% of total to reach Round 2.',
      ],
    }),
    round(2, 'Surprise Round', {
      description: 'Surprise round for teams that clear Round 1.',
      rules: [
        'Only winning / qualifying teams from Round 1 compete.',
        'No electronic media — violation means on-spot disqualification.',
        'Quiz master’s decision is final.',
      ],
    }),
  ],

  Utopia: [
    round(1, 'Village Layout Design', {
      description: 'Design a village layout from population data and a contour map (hand or CAD).',
      rules: [
        'Given: number of families and a contour map CAD file.',
        'Include housing, water, sanitation, roads, and public amenities.',
        'Plan by hand on a printed map or digitally in CAD.',
        'Use only the provided contour map — no external site data.',
        'One team submits one final layout.',
      ],
    }),
    round(2, 'Presentation', {
      description: 'Shortlisted teams present on 3–4 Oct with Round 1 submission and a short PPT.',
      rules: [
        'Present on MindSpark days (3rd & 4th October).',
        'Bring Round 1 submission plus a short PowerPoint presentation.',
      ],
    }),
  ],

  Webscape: [
    round(1, 'Technical Quiz', {
      description: 'Offline quiz on web development basics. About 7 teams advance to Round 2.',
      rules: [
        'Technical quiz on web development basics.',
        'Both rounds are offline.',
        'About 7 teams are shortlisted for Round 2.',
      ],
    }),
    round(2, 'Website Redesign', {
      description: 'Improve a partially designed HTML/CSS/JS site for design and functionality.',
      rules: [
        'Given a partial HTML, CSS, JS site — improve design and functionality.',
        'Judged on responsiveness, authenticity, creativity, and functionality.',
        'Plagiarism checks on all code; unfair means means disqualification.',
        '3 winners selected from Round 2.',
      ],
    }),
  ],

  Mathletics: [
    round(1, 'MCQ Round', {
      description: '30 MCQs (fractions, algebra, trig, geometry, calculus, integration). Duration: 1 hour.',
      rules: [
        '30 multiple-choice questions; 1 hour.',
        'Score at least 54% to be eligible; top 16 teams advance.',
        'No calculators, phones, or smartwatches.',
      ],
    }),
    round(2, 'Subjective Paper', {
      description: 'Paper-based subjective problems (advanced calculus & integration). Duration: 2–3 hours.',
      rules: [
        'Detailed written solutions required.',
        'Evaluated on mathematical rigor, step accuracy, and final answers.',
        'Top 3 by Round 2 total score are overall winners.',
      ],
    }),
  ],

  Robosoccer: [
    round(1, 'Qualifier Matches', {
      description: 'Soccer-style bot matches. Two halves of 2 minutes; winners by goals / points.',
      rules: [
        'Build one robot; dimension/safety check before each match.',
        'Each match: two halves of 2 minutes; switch sides at half-time.',
        'Max weight 2 kg; must fit 300×300×300 mm; no LEGO kits or kick mechanisms.',
        'Most goals at full time wins; points deducted for multiple operators.',
      ],
    }),
  ],

  Robowars: [
    round(1, 'Qualifier Matches', {
      description: 'Combat robotics — last bot standing. Qualifier matches decide advancement by points.',
      rules: [
        'Build one robot; dimension/safety check before each match.',
        'Each match lasts 5 minutes; winners by points / winning criteria.',
        'Categories: 15 kg and 8 kg with size limits at match start.',
        'Wireless control only; no jumping, hopping, or flying.',
      ],
    }),
  ],

  'Virtual Robotics': [
    round(1, 'Project Presentation', {
      description: '10-minute robotics project presentation (concepts, designs, simulations, or research) plus Q&A.',
      rules: [
        'Technical robotics topic required; working prototype optional but valued.',
        '10 minutes to present, then short Q&A with judges.',
        'Cover problem, methodology, innovation, applications, and future scope.',
        'Judged on presentation skill, technical depth, applicability, and understanding.',
      ],
    }),
  ],

  'SEARCH N DESTROY': [
    round(1, 'Line Follow & Destroy', {
      description: 'Autonomous line-follower + maze task: clear checkpoints, then push the cube into the green zone.',
      rules: [
        '2-minute dry run to calibrate, then ~3 minutes of gameplay (5 minutes total window).',
        'Pass checkpoints on the track; each checkpoint is worth points.',
        'After checkpoints, push the cube from the yellow zone into the green zone (“destroy” opponent territory).',
        'Robot must fit 200×200 mm footprint at start; fully autonomous, onboard power ≤24V.',
        'Hand touch only with judge permission; unauthorized touch costs 10 points.',
      ],
    }),
  ],
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const comps = await Competition.find({ fest: FEST_ID }).select('name rounds').lean();
  const byName = new Map(comps.map((c) => [c.name, c]));

  let updated = 0;
  const missing = [];

  for (const [name, rounds] of Object.entries(FIXES)) {
    const doc = byName.get(name);
    if (!doc) {
      missing.push(name);
      console.log(`MISS  ${name}`);
      continue;
    }
    console.log(`${dryRun ? 'DRY' : 'SET '} ${name}: ${rounds.length} rounds — ${rounds.map((r) => r.title).join(' | ')}`);
    if (!dryRun) {
      await Competition.updateOne({ _id: doc._id }, { $set: { rounds } });
      updated += 1;
    }
  }

  console.log(`\nDone. updated=${updated} missing=${missing.length} dryRun=${dryRun}`);
  if (missing.length) console.log('Missing names:', missing);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
