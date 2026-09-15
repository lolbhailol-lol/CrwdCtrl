import HikingBrowseIcon from '../assets/mobile-icons/hiking.png';
import TrailBrowseIcon from '../assets/mobile-icons/trail walks.png';
import BackpackingBrowseIcon from '../assets/mobile-icons/backpacking.png';
import CampingBrowseIcon from '../assets/mobile-icons/camping.png';
const AdventureBrowseIcon = '/category-icons/adventure.webp';
const NatureBrowseIcon = '/category-icons/nature.webp';

export const TREK_BROWSE_CATEGORIES = [
    { id: 'hiking', label: 'Hiking', image: HikingBrowseIcon },
    { id: 'trail', label: 'Trail Walks', image: TrailBrowseIcon },
    { id: 'backpacking', label: 'Backpacking', image: BackpackingBrowseIcon },
    { id: 'camping', label: 'Camping', image: CampingBrowseIcon },
    { id: 'adventure', label: 'Adventure', image: AdventureBrowseIcon },
    { id: 'nature', label: 'Nature', image: NatureBrowseIcon },
];

export function getTrekBrowseCategory(id) {
    return TREK_BROWSE_CATEGORIES.find((cat) => cat.id === id);
}
