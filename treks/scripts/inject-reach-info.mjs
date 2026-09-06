import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const EXTRA = {
  devkund: {
    howToReach: [
      'Train/road to Mangaon or Kolad, then local taxi to Bhira village.',
      'Park near Tata Power / Bhira base — do not block the approach road.',
      'Follow the marked forest path toward the dam stream; start before 7 AM on weekends.',
    ],
    emergencyContacts: [
      'Base checkpoint / local volunteers at Bhira parking (seasonal)',
      'Nearest help: Mangaon / Kolad town clinics',
      'In distress: dial 112 (national emergency)',
    ],
  },
  'kalu-waterfall': {
    howToReach: [
      'Approach via Malshej / Junnar road; last stretch is village approach.',
      'Park at the common base lot — overflow fills early on weekends.',
      'Follow ridge trail markers toward the cascade viewpoint.',
    ],
    emergencyContacts: [
      'Base volunteers on peak weekends',
      'Junnar / Malshej local clinics for minor injuries',
      'Emergency: 112',
    ],
  },
  'nanemachi-waterfall': {
    howToReach: [
      'Reach via Pune district village roads to Nanemachi base.',
      'Limited parking near village — arrive early.',
      'Follow the stream-side path; poles help on wet rock.',
    ],
    emergencyContacts: [
      'Ask village base for local guide contacts',
      'Nearest town medical help — confirm before you leave',
      'Emergency: 112',
    ],
  },
  'lingmala-waterfall': {
    howToReach: [
      'Mahabaleshwar main roads to Lingmala viewpoint / trail entry.',
      'Paid parking near entry — fills by late morning in monsoon.',
      'Short descent / viewpoint walk; stay behind barriers.',
    ],
    emergencyContacts: [
      'Site staff / ticket counter at entry',
      'Mahabaleshwar town hospitals',
      'Emergency: 112',
    ],
  },
  'thoseghar-waterfalls': {
    howToReach: [
      'Satara → Thoseghar Waterfall entry road.',
      'Park at designated lot; roadside overflow on busy days.',
      'Follow managed viewpoint paths — do not cross railings.',
    ],
    emergencyContacts: [
      'Entry / ticket staff on site',
      'Satara town medical facilities',
      'Emergency: 112',
    ],
  },
  'bhivpuri-waterfall': {
    howToReach: [
      'Karjat / Bhivpuri Road access; very busy on monsoon weekends.',
      'Use designated lots early — approach road congests after 8 AM.',
      'Short cascade approaches; expect picnic crowds.',
    ],
    emergencyContacts: [
      'Local parking / base volunteers (seasonal)',
      'Karjat clinics for first aid',
      'Emergency: 112',
    ],
  },
  'randha-falls': {
    howToReach: [
      'Drive to Randha Falls viewpoint parking.',
      'Short walk to viewpoint; stay on marked paths.',
      'Avoid edge rock when wet.',
    ],
    emergencyContacts: [
      'Viewpoint / parking attendants when present',
      'Nearest town clinic — ask at base',
      'Emergency: 112',
    ],
  },
  andharban: {
    howToReach: [
      'One-way jungle: start Pimpri (Tamhini side); arrange exit pickup in advance.',
      'Forest permission often required — confirm before travel.',
      'Carry all water and packed lunch; network dies inside canopy.',
    ],
    emergencyContacts: [
      'Organiser / guide contact (required for most groups)',
      'Forest desk at permission checkpoint (when active)',
      'Emergency: 112',
    ],
  },
  aadrai: {
    howToReach: [
      'Tamhini region base — confirm exact start with organiser.',
      'Valid forest permission usually mandatory.',
      'Long humid day; not ideal as a first monsoon trek.',
    ],
    emergencyContacts: [
      'Local guide / organiser (strongly recommended)',
      'Forest department checkpoint when open',
      'Emergency: 112',
    ],
  },
  'madhe-ghat': {
    howToReach: [
      'Route-dependent bases in Pune / Satara belt — go with someone who knows the trail.',
      'Monsoon growth can hide paths; start early.',
      'Pack food and 2–2.5L water.',
    ],
    emergencyContacts: [
      'Local trek organisers familiar with the route',
      'Nearest village / town clinic',
      'Emergency: 112',
    ],
  },
  'plus-valley': {
    howToReach: [
      'Tamhini / Plus Valley access base.',
      'Permission may apply — verify before travel.',
      'Open valley weather changes fast; watch stream crossings.',
    ],
    emergencyContacts: [
      'Base checkpoint / permission desk when active',
      'Nearest Tamhini-area help — ask at base',
      'Emergency: 112',
    ],
  },
  naneghat: {
    howToReach: [
      'Common approaches: Naneghat base or Ghatghar side (confirm route).',
      'Pass and cave sections — carry a torch.',
      'Edge sections need care in wind / monsoon.',
    ],
    emergencyContacts: [
      'Local base stalls / frequent trek groups on weekends',
      'Junnar town medical help',
      'Emergency: 112',
    ],
  },
}

function fmtArray(arr, indent = '    ') {
  const inner = arr.map((line) => `${indent}  '${line.replace(/'/g, "\\'")}',`).join('\n')
  return `[\n${inner}\n${indent}]`
}

function inject(filePath) {
  let src = fs.readFileSync(filePath, 'utf8')
  if (src.includes('howToReach:')) {
    console.log('skip (already injected):', filePath)
    return
  }
  for (const [slug, extra] of Object.entries(EXTRA)) {
    const re = new RegExp(`(slug: '${slug}',[\\s\\S]*?startingPoint: '[^']*',)\\n`)
    if (!re.test(src)) {
      console.error('no match for', slug, 'in', filePath)
      continue
    }
    src = src.replace(
      re,
      `$1\n    howToReach: ${fmtArray(extra.howToReach)},\n    emergencyContacts: ${fmtArray(extra.emergencyContacts)},\n`,
    )
  }
  fs.writeFileSync(filePath, src)
  console.log('updated', filePath)
}

inject(path.resolve(__dirname, '../backend/src/data/treks.js'))
inject(path.resolve(__dirname, '../frontend/src/data/treks.js'))
