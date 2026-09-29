/** Cult Night pass handout. 30 Sep and 1 Oct. */
export const CULT_NIGHT_PASS_DAYS = [
  {
    id: '30',
    label: '30 Sep',
    years: [
      { id: 'first_year', label: 'First year' },
      { id: 'second_year', label: 'Second year' },
      { id: 'mba', label: 'MBA' },
    ],
  },
  {
    id: '01',
    label: '1 Oct',
    years: [
      { id: 'third_year', label: 'Third year' },
      { id: 'fourth_year', label: 'Fourth year' },
      { id: 'mtech', label: 'M.Tech' },
    ],
  },
];

export const CULT_NIGHT_YEARS = CULT_NIGHT_PASS_DAYS.flatMap((day) =>
  day.years.map((year) => ({ ...year, dayId: day.id, dayLabel: day.label })),
);

export function cultNightDayForCategory(categoryId) {
  return CULT_NIGHT_YEARS.find((year) => year.id === String(categoryId || '')) || null;
}
