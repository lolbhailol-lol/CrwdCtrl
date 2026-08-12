const mongoose = require('mongoose');
const crypto = require('crypto');
const FestCompetitionProbable = require('../model/fest_competition_probable_model');
const Registration = require('../model/registration_model');
const User = require('../model/usermodel');

function normalizePhone(raw) {
    return String(raw || '').trim().replace(/\s+/g, '').slice(0, 20);
}

function formatProbable(row) {
    return {
        id: row._id,
        festId: row.fest,
        competitionId: row.competition?._id || row.competition,
        competitionName: row.competitionName
            || row.competition?.name
            || '',
        name: row.name,
        phone: row.phone,
        note: row.note || '',
        status: row.status || 'probable',
        contacted: Boolean(row.contacted),
        convertedRegistrationId: row.convertedRegistrationId || null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

exports.listProbables = async (req, res) => {
    try {
        const festId = req.festId;
        const status = String(req.query.status || '').trim();
        const competitionId = String(req.query.competitionId || '').trim();
        const search = String(req.query.search || '').trim();

        const filter = { fest: festId };
        if (['probable', 'converted', 'dropped'].includes(status)) {
            filter.status = status;
        }
        if (competitionId && mongoose.Types.ObjectId.isValid(competitionId)) {
            filter.competition = competitionId;
        }
        if (search) {
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [{ name: regex }, { phone: regex }, { competitionName: regex }];
        }

        const Competition = mongoose.model('Competition');
        const [rows, competitions, counts] = await Promise.all([
            FestCompetitionProbable.find(filter)
                .populate('competition', 'name')
                .sort({ createdAt: -1 })
                .limit(300)
                .lean(),
            Competition.find({ fest: festId }).select('name').sort({ name: 1 }).lean(),
            FestCompetitionProbable.aggregate([
                { $match: { fest: new mongoose.Types.ObjectId(String(festId)) } },
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]),
        ]);

        const byStatus = { probable: 0, converted: 0, dropped: 0, total: 0 };
        for (const row of counts) {
            if (byStatus[row._id] !== undefined) byStatus[row._id] = row.count;
            byStatus.total += row.count;
        }

        res.json({
            success: true,
            counts: byStatus,
            competitions: competitions.map((c) => ({ id: c._id, name: c.name || 'Competition' })),
            probables: rows.map(formatProbable),
        });
    } catch (error) {
        console.error('[festProbables.list]', error);
        res.status(500).json({ success: false, message: 'Failed to load probables' });
    }
};

exports.createProbable = async (req, res) => {
    try {
        const name = String(req.body.name || '').trim().slice(0, 120);
        const phone = normalizePhone(req.body.phone);
        const note = String(req.body.note || '').trim().slice(0, 500);
        const competitionId = String(req.body.competitionId || '').trim();

        if (!name || name.length < 2) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }
        if (!phone || phone.length < 8) {
            return res.status(400).json({ success: false, message: 'Valid phone is required' });
        }
        if (!mongoose.Types.ObjectId.isValid(competitionId)) {
            return res.status(400).json({ success: false, message: 'Select a competition' });
        }

        const Competition = mongoose.model('Competition');
        const competition = await Competition.findOne({ _id: competitionId, fest: req.festId })
            .select('name')
            .lean();
        if (!competition) {
            return res.status(404).json({ success: false, message: 'Competition not found for this fest' });
        }

        const row = await FestCompetitionProbable.create({
            fest: req.festId,
            competition: competition._id,
            competitionName: competition.name || '',
            name,
            phone,
            note,
            status: 'probable',
            createdByOrganizer: req.organizerId || null,
        });

        res.status(201).json({
            success: true,
            message: 'Probable added',
            probable: formatProbable(row.toObject()),
        });
    } catch (error) {
        console.error('[festProbables.create]', error);
        res.status(500).json({ success: false, message: 'Failed to add probable' });
    }
};

exports.updateProbable = async (req, res) => {
    try {
        const { probableId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(probableId)) {
            return res.status(400).json({ success: false, message: 'Invalid id' });
        }

        const row = await FestCompetitionProbable.findOne({ _id: probableId, fest: req.festId });
        if (!row) return res.status(404).json({ success: false, message: 'Not found' });

        if (req.body.contacted !== undefined) {
            row.contacted = Boolean(req.body.contacted);
        }
        if (req.body.note !== undefined) {
            row.note = String(req.body.note || '').trim().slice(0, 500);
        }
        if (['probable', 'dropped'].includes(String(req.body.status || ''))) {
            if (row.status !== 'converted') row.status = req.body.status;
        }
        if (req.body.name) row.name = String(req.body.name).trim().slice(0, 120);
        if (req.body.phone) row.phone = normalizePhone(req.body.phone);

        await row.save();
        const populated = await FestCompetitionProbable.findById(row._id)
            .populate('competition', 'name')
            .lean();

        res.json({ success: true, probable: formatProbable(populated) });
    } catch (error) {
        console.error('[festProbables.update]', error);
        res.status(500).json({ success: false, message: 'Failed to update' });
    }
};

exports.deleteProbable = async (req, res) => {
    try {
        const { probableId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(probableId)) {
            return res.status(400).json({ success: false, message: 'Invalid id' });
        }
        const row = await FestCompetitionProbable.findOneAndDelete({ _id: probableId, fest: req.festId });
        if (!row) return res.status(404).json({ success: false, message: 'Not found' });
        res.json({ success: true, message: 'Deleted' });
    } catch (error) {
        console.error('[festProbables.delete]', error);
        res.status(500).json({ success: false, message: 'Failed to delete' });
    }
};

/** Convert probable → real competition registration (manual entry) */
exports.convertProbable = async (req, res) => {
    try {
        const { probableId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(probableId)) {
            return res.status(400).json({ success: false, message: 'Invalid id' });
        }

        const row = await FestCompetitionProbable.findOne({ _id: probableId, fest: req.festId });
        if (!row) return res.status(404).json({ success: false, message: 'Not found' });
        if (row.status === 'converted' && row.convertedRegistrationId) {
            return res.status(400).json({ success: false, message: 'Already converted to an entry' });
        }

        const Competition = mongoose.model('Competition');
        const competition = await Competition.findOne({ _id: row.competition, fest: req.festId })
            .select('name feeAmount registrationFee')
            .lean();
        if (!competition) {
            return res.status(404).json({ success: false, message: 'Competition no longer exists' });
        }

        const name = String(req.body.name || row.name || '').trim();
        const phone = normalizePhone(req.body.phone || row.phone);
        if (!name || name.length < 2) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }
        if (!phone || phone.length < 8) {
            return res.status(400).json({ success: false, message: 'Valid phone is required' });
        }
        const paymentStatusRaw = String(req.body.paymentStatus || 'pending').trim().toLowerCase();
        const paymentStatus = ['free', 'pending', 'paid', 'failed'].includes(paymentStatusRaw)
            ? paymentStatusRaw
            : 'pending';
        const feeDefault = Number(competition.feeAmount ?? competition.registrationFee) || 0;
        let amountPaid = Number(req.body.amountPaid);
        if (!Number.isFinite(amountPaid)) {
            amountPaid = paymentStatus === 'paid' ? feeDefault : 0;
        }

        let user = await User.findOne({
            $or: [{ phone }, { phoneNumber: phone }],
        });
        if (!user) {
            user = new User({
                name,
                email: `fest-probable+${crypto.randomBytes(6).toString('hex')}@crwdctrl.local`,
                phoneNumber: phone,
                password: crypto.randomBytes(24).toString('hex'),
                isVerified: true,
                signupMethod: 'password',
            });
            await user.save();
        }

        const reg = await Registration.create({
            fest: req.festId,
            user: user._id,
            competitionId: competition._id,
            responses: {
                full_name: name,
                phone,
                manual_entry: 'yes',
                added_by_organizer: 'yes',
                from_probable: 'yes',
                organizer_note: row.note || 'Converted from competition probable',
            },
            status: 'approved',
            paymentStatus,
            amountPaid: Math.max(0, amountPaid),
            payment_gateway: 'manual_organizer',
            submittedAt: new Date(),
        });

        row.status = 'converted';
        row.convertedRegistrationId = reg._id;
        row.contacted = true;
        await row.save();

        res.json({
            success: true,
            message: 'Converted to competition entry',
            probable: formatProbable(row.toObject()),
            registrationId: reg._id,
        });
    } catch (error) {
        console.error('[festProbables.convert]', error);
        res.status(500).json({ success: false, message: 'Failed to convert probable' });
    }
};
