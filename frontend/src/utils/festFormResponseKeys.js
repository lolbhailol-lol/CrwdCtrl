/**
 * Form answer keys that duplicate core participant columns
 * (name / email / phone / team / college / etc.).
 * Keep Excel + organizer UI clean — show those once in fixed columns.
 */
const CORE_RESPONSE_SKIP = new Set([
    'manual_entry',
    'added_by_organizer',
    'organizer_note',
    'password',
    'token',
    'qr',
]);

const IDENTITY_ALIASES = new Set([
    'name', 'full_name', 'fullname', 'leader_name', 'participant_name', 'user_name', 'username',
    'firstname', 'first_name', 'lastname', 'last_name',
    'email', 'email_id', 'emailid', 'e_mail', 'mail', 'user_email',
    'phone', 'mobile', 'contact', 'contact_no', 'contact_number', 'contact_num',
    'phone_number', 'phonenumber', 'mobile_number', 'whatsapp', 'whatsapp_number', 'user_phone',
    'team', 'team_name', 'teamname', 'group_name', 'band_name',
    'college', 'college_name', 'collegename', 'institution', 'university',
    'city', 'location', 'hometown',
    'year', 'year_of_study', 'academic_year', 'class', 'year_of_graduation',
    'course', 'branch', 'department', 'stream',
    'team_members', 'members', 'member_names', 'teammates', 'team_size', 'person_fields',
]);

function normalizeFormKey(key = '') {
    return String(key)
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
}

/** True if this form key should not appear again next to core user columns */
export function isRedundantFestFormFieldKey(key) {
    const k = normalizeFormKey(key);
    if (!k || k.startsWith('_') || CORE_RESPONSE_SKIP.has(k)) return true;
    if (IDENTITY_ALIASES.has(k)) return true;

    if (/^(full|leader|participant|user|captain)_?name$/.test(k)) return true;
    // email* but not college_email-style rare fields — skip plain email variants
    if (/^(e[_]?mail|user_email|email_id)/.test(k)) return true;
    // phone/mobile/whatsapp/contact — keep emergency/parent/alt
    if (/^(phone|mobile|whatsapp|contact)/.test(k) && !/(emergency|parent|alt|guardian|secondary)/.test(k)) {
        return true;
    }
    if (/^(team|group|band)_?name$/.test(k)) return true;
    if (/^(college|institution|university)_?name$/.test(k)) return true;

    return false;
}

export function filterExtraFestFormResponses(responses = {}) {
    if (!responses || typeof responses !== 'object') return [];
    return Object.entries(responses).filter(([key, value]) => {
        if (isRedundantFestFormFieldKey(key)) return false;
        if (value == null || value === '') return false;
        return true;
    });
}
