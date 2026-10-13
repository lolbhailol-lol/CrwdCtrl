const MysteryCase = require('../models/MysteryCase');
const EvidenceNode = require('../models/EvidenceNode');
const InvestigationBranch = require('../models/InvestigationBranch');
const FightsBackEvent = require('../models/FightsBackEvent');
const { generateRandomCode } = require('../utils/generateCode');

const createCase = async (req, res) => {
  try {
    const { title, tagline, synopsis, mysteryIdentityName, mysteryIdentityPrompt, difficulty, estimatedMinutes, campusMode, college, correctIdentityTheory } = req.body;
    if (!title || !synopsis) return res.status(400).json({ error: 'title aur synopsis required hain' });

    const mysteryCase = await MysteryCase.create({
      title, tagline, synopsis, mysteryIdentityName, mysteryIdentityPrompt,
      difficulty, estimatedMinutes, campusMode, college, correctIdentityTheory,
      createdBy: req.user.userId,
      createdByRole: req.user.role === 'organizer' ? 'self_serve_organizer' : 'admin',
    });
    res.status(201).json(mysteryCase);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create case', detail: err.message });
  }
};

// Ek evidence-node add karo (kisi world me)
const addEvidence = async (req, res) => {
  try {
    const { caseId } = req.params;
    const {
      code, world, title, description, timestampLabel, canonicalOrder, reliability,
      requiresQR, unlockedByEvidenceIds, unlockedByBranchId, unlockedByLeadId,
      connectsToEvidenceIds, points, canBeInvalidated, imageUrl,
    } = req.body;

    if (!code || !world || !title || !description || !reliability) {
      return res.status(400).json({ error: 'code, world, title, description, reliability required hain' });
    }

    const qrSecret = requiresQR ? generateRandomCode(10) : null;

    const evidence = await EvidenceNode.create({
      caseId, code, world, title, description, timestampLabel: timestampLabel || '',
      canonicalOrder: canonicalOrder || 0, reliability,
      requiresQR: !!requiresQR, qrSecret,
      unlockedByEvidenceIds: unlockedByEvidenceIds || [],
      unlockedByBranchId: unlockedByBranchId || null,
      unlockedByLeadId: unlockedByLeadId || null,
      connectsToEvidenceIds: connectsToEvidenceIds || [],
      points: points || 10,
      canBeInvalidated: !!canBeInvalidated,
      imageUrl: imageUrl || '',
    });
    res.status(201).json(evidence); // admin view — full data (reliability included) milta hai
  } catch (err) {
    res.status(500).json({ error: 'Failed to add evidence', detail: err.message });
  }
};

// "Which lead do you pursue?" wala decision-point add karo
const addBranch = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { order, prompt, leads } = req.body;
    if (!order || !prompt || !Array.isArray(leads) || leads.length < 2) {
      return res.status(400).json({ error: 'order, prompt, aur kam se kam 2 leads chahiye' });
    }
    const branch = await InvestigationBranch.create({ caseId, order, prompt, leads });
    res.status(201).json(branch);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add branch', detail: err.message });
  }
};

// "Mystery Fights Back" twist-trigger add karo
const addFightsBackEvent = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { triggerAfterEvidenceCount, invalidatedEvidenceId, systemMessage } = req.body;
    if (!triggerAfterEvidenceCount || !invalidatedEvidenceId || !systemMessage) {
      return res.status(400).json({ error: 'triggerAfterEvidenceCount, invalidatedEvidenceId, systemMessage required hain' });
    }
    const event = await FightsBackEvent.create({ caseId, triggerAfterEvidenceCount, invalidatedEvidenceId, systemMessage });
    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add fights-back event', detail: err.message });
  }
};

const publishCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const evidenceCount = await EvidenceNode.countDocuments({ caseId });
    if (evidenceCount === 0) return res.status(400).json({ error: 'Kam se kam ek evidence chahiye publish se pehle' });

    const mysteryCase = await MysteryCase.findByIdAndUpdate(caseId, { status: 'published' }, { new: true });
    res.status(200).json(mysteryCase);
  } catch (err) {
    res.status(500).json({ error: 'Failed to publish case', detail: err.message });
  }
};

const listCases = async (req, res) => {
  try {
    const cases = await MysteryCase.find({ status: 'published' })
      .select('title tagline synopsis difficulty estimatedMinutes campusMode college mysteryIdentityPrompt');
    res.status(200).json(cases);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
};

// Admin-detail — poora data (reliability/connections sahit), authoring ke liye
const getCaseAdminDetail = async (req, res) => {
  try {
    const { caseId } = req.params;
    const mysteryCase = await MysteryCase.findById(caseId);
    if (!mysteryCase) return res.status(404).json({ error: 'Case not found' });
    const evidence = await EvidenceNode.find({ caseId }).sort({ world: 1, canonicalOrder: 1 });
    const branches = await InvestigationBranch.find({ caseId }).sort({ order: 1 });
    const fightsBackEvents = await FightsBackEvent.find({ caseId });
    res.status(200).json({ case: mysteryCase, evidence, branches, fightsBackEvents });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch case' });
  }
};

module.exports = { createCase, addEvidence, addBranch, addFightsBackEvent, publishCase, listCases, getCaseAdminDetail };