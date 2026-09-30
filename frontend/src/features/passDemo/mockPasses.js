export const DEMO_YEARS = [
    { id: 'first_year', label: 'First Year' },
    { id: 'second_year', label: 'Second Year' },
    { id: 'third_year', label: 'Third Year' },
    { id: 'fourth_year', label: 'Final Year' },
];

const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();

/** Sample requests covering every state an organizer will see. */
export const MOCK_PASSES = [
    {
        id: 'p1', name: 'Aarya Kulkarni', phone: '98220 41xxx', prn: '2611001042', yearId: 'first_year',
        status: 'pending', submittedAt: minutesAgo(4),
        look: { skin: '#e2b48f', hair: '#1f140f', shirt: '#f472b6', longHair: true },
    },
    {
        id: 'p2', name: 'Rohan Deshmukh', phone: '97654 12xxx', prn: '2511003017', yearId: 'second_year',
        status: 'pending', submittedAt: minutesAgo(11),
        look: { skin: '#c68e63', hair: '#111', shirt: '#60a5fa' },
    },
    {
        id: 'p3', name: 'Sneha Patil', phone: '90112 88xxx', prn: '2621002008', yearId: 'second_year',
        status: 'pending', submittedAt: minutesAgo(19),
        look: { skin: '#d9a882', hair: '#3b2416', shirt: '#a78bfa', longHair: true, glasses: true },
    },
    {
        id: 'p4', name: 'Kabir Shaikh', phone: '88050 33xxx', prn: '2611007063', yearId: 'second_year',
        status: 'pending', submittedAt: minutesAgo(26),
        look: { skin: '#b97d56', hair: '#1a1a1a', shirt: '#fbbf24' },
    },
    {
        id: 'p5', name: 'Omkar Jadhav', phone: '99700 21xxx', prn: '2521005012', yearId: 'third_year',
        status: 'pending', submittedAt: minutesAgo(33), noIdCard: true,
        look: { skin: '#c9926a', hair: '#24160f', shirt: '#34d399' },
    },
    {
        id: 'p6', name: 'Tanvi Gokhale', phone: '93710 56xxx', prn: '2411006077', yearId: 'third_year',
        status: 'pending', submittedAt: minutesAgo(41), blurryId: true,
        look: { skin: '#e8bf9c', hair: '#4a2c1a', shirt: '#fb7185', longHair: true },
    },
    {
        id: 'p7', name: 'Ishita Joshi', phone: '98906 70xxx', prn: '2411008021', yearId: 'third_year',
        status: 'approved', submittedAt: minutesAgo(95),
        look: { skin: '#dcaa84', hair: '#2a1a12', shirt: '#22d3ee', longHair: true },
    },
    {
        id: 'p8', name: 'Meera Iyer', phone: '95527 18xxx', prn: '2511009055', yearId: 'second_year',
        status: 'approved', submittedAt: minutesAgo(130),
        look: { skin: '#a8714c', hair: '#0f0f0f', shirt: '#c084fc', longHair: true },
    },
    {
        id: 'p9', name: 'Aditya Pawar', phone: '97300 64xxx', prn: '2311004099', yearId: 'fourth_year',
        status: 'approved', checkedIn: true, submittedAt: minutesAgo(210),
        look: { skin: '#c68e63', hair: '#1b120c', shirt: '#4ade80', glasses: true },
    },
    {
        id: 'p10', name: 'Nikhil More', phone: '91580 09xxx', prn: '2421001033', yearId: 'fourth_year',
        status: 'approved', checkedIn: true, submittedAt: minutesAgo(260),
        look: { skin: '#b5794f', hair: '#161616', shirt: '#f97316' },
    },
];
