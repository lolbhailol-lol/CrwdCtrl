import MarathonBrowseIcon from '../assets/mobile-icons/marathon.png';
import RunClubsBrowseIcon from '../assets/mobile-icons/run clubs.png';
import SportClubsBrowseIcon from '../assets/mobile-icons/sports club.png';
import OthersBrowseIcon from '../assets/mobile-icons/others.png';

export const SPORTS_BROWSE_CATEGORIES = [
    {
        id: 'marathon',
        label: 'Marathon',
        sportTypes: ['marathon'],
        image: MarathonBrowseIcon,
    },
    {
        id: 'run_club',
        label: 'Run Clubs',
        sportTypes: ['run_club'],
        image: RunClubsBrowseIcon,
    },
    {
        id: 'sport_clubs',
        label: 'Sport Clubs',
        sportTypes: ['football', 'cricket', 'badminton', 'gymkhana'],
        image: SportClubsBrowseIcon,
    },
    {
        id: 'other',
        label: 'Others',
        sportTypes: ['other'],
        image: OthersBrowseIcon,
    },
];

export function getBrowseCategoryForSportType(sportType) {
    return SPORTS_BROWSE_CATEGORIES.find((cat) => cat.sportTypes.includes(sportType));
}
