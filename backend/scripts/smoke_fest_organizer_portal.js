/**
 * Smoke: fest organizer portal — create invite → signup → approve → login → dashboard → participants → checkin stats
 * Usage: node scripts/smoke_fest_organizer_portal.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

const API = process.env.SMOKE_API_BASE || 'http://127.0.0.1:8080/api';

async function json(path, { method = 'GET', body, token } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
}

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI missing');

    await mongoose.connect(uri);
    const FestOrganizer = require('../src/model/fest_organizer_model');
    const FestOrganizerAccount = require('../src/model/fest_organizer_account_model');
    const FestOrganizerProfileInvite = require('../src/model/fest_organizer_profile_invite_model');
    const Registration = require('../src/model/registration_model');

    const fest = await FestOrganizer.findOne({}).select('_id festName').lean();
    if (!fest) throw new Error('No fest found in DB — create one first');

    const stamp = Date.now().toString(36);
    const email = `fest-smoke-${stamp}@crwdctrl.test`;
    const username = `festsmoke_${stamp}`;
    const password = 'SmokeTest1!';

    await FestOrganizerProfileInvite.findOneAndUpdate(
        { email },
        { email, note: 'smoke', createdBy: null },
        { upsert: true, new: true },
    );

    const signup = await json('/fest-organizer/auth/signup', {
        method: 'POST',
        body: {
            name: 'Smoke Fest Org',
            username,
            email,
            phone: '9999999999',
            password,
        },
    });
    if (signup.status !== 201 && signup.status !== 200) {
        throw new Error(`signup failed ${signup.status}: ${JSON.stringify(signup.data)}`);
    }
    console.log('OK signup', signup.data.message || signup.status);

    const pendingLogin = await json('/fest-organizer/auth/login', {
        method: 'POST',
        body: { username, password },
    });
    if (pendingLogin.status !== 403 || pendingLogin.data.code !== 'pending_approval') {
        throw new Error(`expected pending_approval, got ${pendingLogin.status} ${JSON.stringify(pendingLogin.data)}`);
    }
    console.log('OK login blocked while pending');

    const account = await FestOrganizerAccount.findOne({ username });
    if (!account) throw new Error('account not in DB after signup');
    account.status = 'approved';
    account.isActive = true;
    account.assignedFestIds = [fest._id];
    account.approvedAt = new Date();
    await account.save();
    console.log('OK approved + assigned fest', String(fest._id), fest.festName);

    const login = await json('/fest-organizer/auth/login', {
        method: 'POST',
        body: { username, password },
    });
    if (!login.data.token) {
        throw new Error(`login failed ${login.status}: ${JSON.stringify(login.data)}`);
    }
    const token = login.data.token;
    console.log('OK login', login.data.fests?.length, 'fests');

    const me = await json('/fest-organizer/me', { token });
    if (!me.data.success || !(me.data.fests || []).length) {
        throw new Error(`me failed ${me.status}: ${JSON.stringify(me.data)}`);
    }
    console.log('OK me');

    const festId = String(fest._id);
    const dash = await json(`/fest-organizer/fests/${festId}/dashboard`, { token });
    if (!dash.data.stats) {
        throw new Error(`dashboard failed ${dash.status}: ${JSON.stringify(dash.data)}`);
    }
    console.log('OK dashboard', dash.data.stats);

    const parts = await json(`/fest-organizer/fests/${festId}/participants?limit=10`, { token });
    if (!parts.data.participants) {
        throw new Error(`participants failed ${parts.status}: ${JSON.stringify(parts.data)}`);
    }
    console.log('OK participants', parts.data.pagination?.total);

    const stats = await json(`/fest-organizer/fests/${festId}/checkin/stats`, { token });
    if (stats.status !== 200) {
        throw new Error(`checkin stats failed ${stats.status}: ${JSON.stringify(stats.data)}`);
    }
    console.log('OK checkin stats', stats.data);

    const reg = await Registration.findOne({
        fest: fest._id,
        status: 'approved',
        checkedIn: { $ne: true },
    }).select('_id').lean();
    if (reg) {
        const checkin = await json(`/fest-organizer/fests/${festId}/checkin`, {
            method: 'POST',
            token,
            body: { registrationId: String(reg._id) },
        });
        console.log('OK checkin', checkin.status, checkin.data?.message || checkin.data);
        await Registration.updateOne(
            { _id: reg._id },
            { $set: { checkedIn: false }, $unset: { checkedInAt: 1 } },
        );
    } else {
        console.log('SKIP checkin (no unchecked approved registration)');
    }

    // cleanup smoke account + invite
    await FestOrganizerAccount.deleteOne({ _id: account._id });
    await FestOrganizerProfileInvite.deleteOne({ email });
    console.log('OK cleanup');
    console.log('\nSMOKE PASSED');
}

main()
    .catch((e) => {
        console.error('SMOKE FAILED', e);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect().catch(() => {});
    });
