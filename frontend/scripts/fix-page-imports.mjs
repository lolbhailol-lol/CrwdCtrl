import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'pages');

const componentNames = new Set([
  'HomeEventCardSkeleton', 'CardFavoriteButton', 'CarouselDotPagination', 'CustomPageSectionsRenderer',
  'HomeCategoryBar', 'MobileStickyHeader', 'CategorySearchRow', 'MobileHeroSearchField', 'AppLogo',
  'CardShareButton', 'HeroBanner', 'Sidebar', 'Navbar', 'ProfileSidebar', 'LocalQRCode', 'ContentImage',
  'HomeEventCard', 'HomeCarouselSection', 'HeroSearchBar', 'HeroSearchDropdown', 'MobileSearchOverlay',
  'ProfileAvatarUpload', 'LoginSuccessToast', 'PageTransitionSkeleton', 'CheckinScannerPage',
]);

const adminComponentNames = new Set([
  'CardSizePicker', 'TargetPagePicker', 'SectionListByPage', 'SectionLivePreview',
  'FestFormModal', 'Competition_Modal', 'FestTable', 'EventShowFormModal', 'TrekFormModal',
  'TrekCommunityFormModal', 'SportsFormModal', 'RunClubFormModal', 'ScannerSetupForm',
  'FestScannerSetup', 'TrekScannerSetup', 'SportScannerSetup', 'StatsCard', 'AdminStatsCard',
]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(jsx?|tsx?)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // ../../../ -> ../../ (profile-pages was one level deeper)
  content = content.replace(/from ['"](\.\.\/){3}/g, "from '../../");

  // ../admin/X -> ../../components/admin/X (organizer pages)
  content = content.replace(
    /from ['"]\.\.\/admin\/([^'"]+)['"]/g,
    "from '../../components/admin/$1'",
  );

  // ../login, ../register -> ../auth/login etc (profile pages)
  content = content.replace(/from ['"]\.\.\/login['"]/g, "from '../auth/login'");
  content = content.replace(/from ['"]\.\.\/register['"]/g, "from '../auth/register'");

  // ../ComponentName -> ../../components/ComponentName
  content = content.replace(/from ['"]\.\.\/([^'"/.][^'"]*)['"]/g, (match, name) => {
    if (componentNames.has(name)) {
      return `from '../../components/${name}'`;
    }
    return match;
  });

  // ./admin sibling in pages/admin importing modals
  content = content.replace(/from ['"]\.\/([^'"]+)['"]/g, (match, name) => {
    if (adminComponentNames.has(name.replace('.jsx', ''))) {
      return `from '../../components/admin/${name}'`;
    }
    return match;
  });

  // pages/admin importing from ./CardSizePicker etc
  content = content.replace(/from ['"]\.\/([^'"]+)['"]/g, (match, rel) => {
    const base = rel.replace(/\.jsx$/, '');
    if (adminComponentNames.has(base)) {
      return `from '../../components/admin/${rel}'`;
    }
    return match;
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  return false;
}

const files = walk(root);
let count = 0;
for (const f of files) {
  if (fixFile(f)) {
    count++;
    console.log('fixed:', path.relative(root, f));
  }
}
console.log(`Done. ${count} files updated.`);
