/**
 * Canonical FAQ content for CrwdCtrl.
 *
 * Single source of truth shared by the visible <FaqSection> UI, the runtime
 * <Seo> FAQPage JSON-LD, and the build-time prerender script. Keeping the
 * questions/answers identical across visible content and structured data keeps
 * the markup legitimate for Google rich results and maximally useful for answer
 * engines (ChatGPT, Perplexity, Gemini, Claude) and AI Overviews.
 *
 * Answers are written answer-first, factual and self-contained so a generative
 * engine can quote a single Q/A without needing surrounding context.
 */

export const HOME_FAQ = [
  {
    question: 'What is CrwdCtrl?',
    answer:
      'CrwdCtrl is a community and event discovery platform where you can find and register for college fests, tech and sports events, running clubs, gym communities, treks, and local meetups near you.',
  },
  {
    question: 'Is CrwdCtrl free to use?',
    answer:
      'Yes. Browsing and discovering events on CrwdCtrl is free. Some individual events or fests may charge their own registration or ticket fee, which is always shown on the event page before you register.',
  },
  {
    question: 'How do I register for a college fest on CrwdCtrl?',
    answer:
      'Open the fest you are interested in, review the details and competitions, then tap Register and complete the registration form. You receive a confirmation and a QR ticket where applicable.',
  },
  {
    question: 'Which cities and colleges does CrwdCtrl cover?',
    answer:
      'CrwdCtrl focuses on college fests, events and communities across India, and you can browse events near your current location or explore listings from colleges and organizers nationwide.',
  },
  {
    question: 'Can organizers list their own fest or event on CrwdCtrl?',
    answer:
      'Yes. Organizers can list a fest, competition, trek, or running event through the "List your fest" page and manage registrations and check-ins from the organizer dashboard.',
  },
];

export const ABOUT_FAQ = [
  {
    question: 'What is CrwdCtrl?',
    answer:
      "CrwdCtrl is India's platform for discovering, exploring and registering for college fests, competitions, treks, running clubs and events — all in one place.",
  },
  {
    question: 'What can I find on CrwdCtrl?',
    answer:
      'You can find college fests (cultural, technical and sports), competitions, treks and adventure communities, running clubs, gym communities, and local events and meetups near you.',
  },
  {
    question: 'Who is CrwdCtrl for?',
    answer:
      'CrwdCtrl is for students and young people who want to discover and join events, and for organizers who want to list their fests, competitions and activities and manage registrations.',
  },
  {
    question: 'How does CrwdCtrl make event discovery easier?',
    answer:
      'CrwdCtrl brings fests, competitions, treks, runs and meetups into a single searchable app with location-based browsing, categories, favourites, and one-tap registration, so you do not have to track events across scattered Instagram pages and forms.',
  },
  {
    question: 'How do I contact CrwdCtrl?',
    answer:
      'You can reach KARAN BAPURAO JADHAV at crwdctrl.work@gmail.com or +91 7006225981, through the Contact Us page, or on Instagram at @crwdctrl.in.',
  },
];

export const FESTS_FAQ = [
  {
    question: 'How do I register for a college fest?',
    answer:
      'Open the fest page on CrwdCtrl, browse its competitions and details, tap Register, and complete the form. Free fests confirm instantly, while paid fests show the fee and let you pay securely before issuing your ticket.',
  },
  {
    question: 'What types of college fests are listed on CrwdCtrl?',
    answer:
      'CrwdCtrl lists cultural fests (music, dance, drama, fashion, art), technical fests (hackathons, coding and robotics competitions), and sports fests (tournaments and athletic meets) from colleges across India.',
  },
  {
    question: 'Are college fests on CrwdCtrl free to attend?',
    answer:
      'Many fests and competitions are free, and some charge a registration or entry fee. The exact price, or "Free", is shown on each fest and competition page before you register.',
  },
];

export const TREKS_FAQ = [
  {
    question: 'How do I book a trek on CrwdCtrl?',
    answer:
      'Open the trek you want, review the itinerary, difficulty, duration and price, then tap Book and complete the booking. You can also follow a trekking community to see all of their upcoming treks.',
  },
  {
    question: 'What kinds of treks can I find on CrwdCtrl?',
    answer:
      'CrwdCtrl lists day hikes, weekend treks, backpacking trips, camping and adventure outings run by verified trekking communities, with difficulty levels and durations shown for each.',
  },
  {
    question: 'Can I join a trekking community on CrwdCtrl?',
    answer:
      'Yes. Each trekking community has its own page listing its upcoming treks and details, so you can follow the communities you like and book directly from their listings.',
  },
];

export const SPORTS_FAQ = [
  {
    question: 'How do I join a running club or sports event?',
    answer:
      'Open a running club or sports event page on CrwdCtrl, view the schedule and details, and register or book to join. Running clubs list their upcoming runs so you can pick a session that fits you.',
  },
  {
    question: 'What sports and fitness activities are on CrwdCtrl?',
    answer:
      'CrwdCtrl features running clubs, runs and marathons, gym communities, sports fests and tournaments, so you can find active communities and events near you.',
  },
  {
    question: 'Are running clubs on CrwdCtrl beginner friendly?',
    answer:
      'Many running clubs welcome all levels and indicate the skill level for each run, so beginners can find sessions suited to them and progress at their own pace.',
  },
];

export const EVENTS_FAQ = [
  {
    question: 'What kind of events can I find on CrwdCtrl?',
    answer:
      'CrwdCtrl lists events and shows such as concerts, stand-up comedy, workshops, meetups and community gatherings happening near you.',
  },
  {
    question: 'How do I get tickets for an event?',
    answer:
      'Open the event page on CrwdCtrl and use the booking link to reserve or buy your tickets. Event details, timings and venue are shown on each listing.',
  },
  {
    question: 'How do I find events near me?',
    answer:
      'CrwdCtrl lets you browse events by your location and category, so you can quickly discover concerts, comedy shows, workshops and meetups happening around you.',
  },
];
