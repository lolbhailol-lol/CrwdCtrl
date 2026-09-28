import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { prefetchMindSparkBundleOffer } from '../../../services/api/mindsparkBundle.api';

const NON_TECH_EVENT_IDS = [
  '6a7f158e0e5ff505e2a4c48d',
  '6a7f15b543825c1b6ced8059',
  '6a7f158f0e5ff505e2a4c4b6',
  '6a7f158f0e5ff505e2a4c4a4',
  '6a7f158f0e5ff505e2a4c4a7',
  '6a7f15b543825c1b6ced805c',
  '6ab9616b9da31251f82b3ab6',
];

const BUNDLE_EVENT_IDS = [
  '6a7f158e0e5ff505e2a4c495',
  '6a7f158f0e5ff505e2a4c498',
  '6a7f158f0e5ff505e2a4c49b',
  '6a7f158e0e5ff505e2a4c48d',
  '6a7f158e0e5ff505e2a4c48f',
  '6a7f158e0e5ff505e2a4c492',
  '6a7f15c84a2df24d5b0ef4b1',
  '6a7f15b543825c1b6ced8059',
  '6a7f158f0e5ff505e2a4c4b6',
  '6a7f158f0e5ff505e2a4c4a1',
  '6a7f158f0e5ff505e2a4c4b9',
  '6a7f158f0e5ff505e2a4c4a4',
  '6a7f158f0e5ff505e2a4c4a7',
  '6a7f15b543825c1b6ced805c',
  '6a7f15900e5ff505e2a4c4d9',
  '6a7f15900e5ff505e2a4c4dc',
  '6a7f15900e5ff505e2a4c4df',
  '6a7f15900e5ff505e2a4c4e3',
  '6a7f15900e5ff505e2a4c4e9',
  '6ab9616b9da31251f82b3ab6',
];

const allowedEventIds = new Set(BUNDLE_EVENT_IDS);
const nonTechEventIds = new Set(NON_TECH_EVENT_IDS);

export function mindsparkEventGroup(event) {
  const id = String(event?._id || '');
  if (event?.group === 'technical' || event?.group === 'non_technical') return event.group;
  return nonTechEventIds.has(id) ? 'non_technical' : 'technical';
}

export function mindsparkBundleEvents(events) {
  return (events || [])
    .filter((event) => allowedEventIds.has(String(event?._id || '')))
    .map((event) => ({ ...event, group: mindsparkEventGroup(event) }));
}

export const MINDSPARK_BUNDLE_CHOICES = [
  { key: 'hat_trick', slug: 'hat-trick', name: 'Hat-Trick', basket: 'Hat-Trick basket', off: 65, size: 3, pick: 'Any 3 events', blurb: 'Any 3 events from the list', rule: 'any', guide: 'Pick any 3 different events. One payment covers all three at 65% off.' },
  { key: 'tech_duo', slug: 'tech-duo', name: 'Tech duo', basket: 'Tech duo basket', off: 50, size: 2, pick: '2 tech events', blurb: '2 tech events', rule: 'both_tech', guide: 'Pick 2 different tech events. One payment covers both at 50% off.' },
  { key: 'dynamic_duo', slug: 'dynamic-duo', name: 'Dynamic duo', basket: 'Dynamic duo basket', off: 40, size: 2, pick: '1 tech + 1 non-tech', blurb: '1 tech + 1 non-tech', rule: 'one_each', guide: 'Pick 1 tech event and 1 non-tech event. One payment covers both at 40% off.' },
];

export function mindsparkBundlePath(key, { desk = false } = {}) {
  const choice = MINDSPARK_BUNDLE_CHOICES.find((bundle) => bundle.key === key) || MINDSPARK_BUNDLE_CHOICES[0];
  const path = `/mindspark/bundle/${choice.slug}`;
  return desk ? `${path}?desk=1` : path;
}

export function mindsparkBundleKeyFromSlug(slug) {
  const raw = String(slug || '').trim().toLowerCase();
  const hit = MINDSPARK_BUNDLE_CHOICES.find((bundle) => bundle.slug === raw || bundle.key === raw);
  return hit?.key || '';
}

export default function MindSparkBundleChoices({
  isDark = true,
  selectedKey = '',
  onPick,
  title = 'Pick a bundle',
  subtitle = 'One payment covers every event you choose.',
}) {
  useEffect(() => {
    prefetchMindSparkBundleOffer();
    void import('./MindSparkBundlePage');
  }, []);
  return (
    <div>
      {title ? (
        <div className="mb-2.5">
          <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</p>
          {subtitle ? (
            <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{subtitle}</p>
          ) : null}
        </div>
      ) : null}
      <div className="space-y-2">
        {MINDSPARK_BUNDLE_CHOICES.map((bundle) => {
          const on = selectedKey === bundle.key;
          const path = mindsparkBundlePath(bundle.key);
          const className = `flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition active:scale-[0.99] ${
            on
              ? 'border-[#0ECCEE] bg-[#0ECCEE]/12'
              : isDark
                ? 'border-white/10 bg-white/[0.04] hover:border-[#0ECCEE]/45'
                : 'border-gray-200 bg-white hover:border-[#0ECCEE]/50'
          }`;
          const body = (
            <>
              <span
                className={`grid h-12 w-14 shrink-0 place-items-center rounded-xl text-base font-black tabular-nums ${
                  on
                    ? 'bg-[#0ECCEE] text-black'
                    : isDark
                      ? 'bg-[#0ECCEE]/15 text-[#0ECCEE]'
                      : 'bg-cyan-50 text-cyan-800'
                }`}
              >
                {bundle.off}%
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{bundle.name}</span>
                <span className={`block text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{bundle.pick}</span>
              </span>
              <span className={`shrink-0 text-[11px] font-bold ${on ? 'text-[#0ECCEE]' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                {on ? 'Selected' : 'Choose'}
              </span>
            </>
          );
          if (onPick) {
            return (
              <button key={bundle.key} type="button" onClick={() => onPick(bundle.key)} aria-pressed={on} className={className}>
                {body}
              </button>
            );
          }
          return (
            <Link key={bundle.key} to={path} className={className}>
              {body}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
