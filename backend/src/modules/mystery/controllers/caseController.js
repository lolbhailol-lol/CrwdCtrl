const mongoose = require('mongoose');
const MysteryCase = require('../models/MysteryCase');
const MysteryEvent = require('../models/MysteryEvent');
const MysteryTeam = require('../models/MysteryTeam');
const EvidenceNode = require('../models/EvidenceNode');
const InvestigationBranch = require('../models/InvestigationBranch');
const FightsBackEvent = require('../models/FightsBackEvent');
const { generateRandomCode } = require('../utils/generateCode');

const createCase = async (req, res) => {
  try {
    const { title, tagline, synopsis, mysteryIdentityName, mysteryIdentityPrompt, difficulty, estimatedMinutes, campusMode, college, correctIdentityTheory } = req.body;
    if (!title || !synopsis) return res.status(400).json({ error: 'title and synopsis are required' });

    const mysteryCase = await MysteryCase.create({
      title, tagline, synopsis, mysteryIdentityName, mysteryIdentityPrompt,
      difficulty, estimatedMinutes, campusMode, college, correctIdentityTheory,
      createdBy: req.user.userId || null,
      createdByEmail: req.user.email || '',
      createdByRole: req.user.role === 'organizer' ? 'self_serve_organizer' : 'admin',
    });
    res.status(201).json(mysteryCase);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create case', detail: err.message });
  }
};

// Add an evidence node (in any world)
const addEvidence = async (req, res) => {
  try {
    const { caseId } = req.params;
    const {
      code, world, title, description, timestampLabel, canonicalOrder, reliability,
      requiresQR, unlockedByEvidenceIds, unlockedByBranchId, unlockedByLeadId,
      connectsToEvidenceIds, points, canBeInvalidated, imageUrl, placementNote,
    } = req.body;

    if (!code || !world || !title || !description || !reliability) {
      return res.status(400).json({ error: 'code, world, title, description and reliability are required' });
    }

    const qrSecret = requiresQR ? generateRandomCode(10) : undefined;

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
      placementNote: placementNote || '',
    });
    res.status(201).json(evidence); // admin view — returns full data (including reliability)
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'This evidence code already exists in this case' });
    res.status(500).json({ error: 'Failed to add evidence', detail: err.message });
  }
};

// Add a "Which lead do you pursue?" decision point
const addBranch = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { order, prompt, leads } = req.body;
    if (!order || !prompt || !Array.isArray(leads) || leads.length < 2) {
      return res.status(400).json({ error: 'order, prompt and at least 2 leads are required' });
    }
    const branch = await InvestigationBranch.create({ caseId, order, prompt, leads });
    res.status(201).json(branch);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add branch', detail: err.message });
  }
};

// Add a "Mystery Fights Back" twist trigger
const addFightsBackEvent = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { triggerAfterEvidenceCount, invalidatedEvidenceId, systemMessage } = req.body;
    if (!triggerAfterEvidenceCount || !invalidatedEvidenceId || !systemMessage) {
      return res.status(400).json({ error: 'triggerAfterEvidenceCount, invalidatedEvidenceId and systemMessage are required' });
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
    if (evidenceCount === 0) return res.status(400).json({ error: 'Add at least one piece of evidence before publishing' });

    const mysteryCase = await MysteryCase.findByIdAndUpdate(caseId, { status: 'published' }, { new: true });
    res.status(200).json(mysteryCase);
  } catch (err) {
    res.status(500).json({ error: 'Failed to publish case', detail: err.message });
  }
};

const listCases = async (req, res) => {
  try {
    const cases = await MysteryCase.find({ status: 'published' })
      .select('title tagline synopsis difficulty estimatedMinutes campusMode college mysteryIdentityPrompt status');
    res.status(200).json(cases);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
};

// Admin list — includes drafts so new cases show up in the case builder
const listAllCasesAdmin = async (req, res) => {
  try {
    const cases = await MysteryCase.find().sort({ createdAt: -1 });
    res.status(200).json(cases);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
};

// Admin detail — full data (including reliability/connections) for authoring
const getCaseAdminDetail = async (req, res) => {
  try {
    const { caseId } = req.params;
    const mysteryCase = await MysteryCase.findById(caseId);
    if (!mysteryCase) return res.status(404).json({ error: 'Case not found' });
    const evidence = await EvidenceNode.find({ caseId }).sort({ world: 1, canonicalOrder: 1 });
    const branches = await InvestigationBranch.find({ caseId }).sort({ order: 1 });
    const fightsBackEvents = await FightsBackEvent.find({ caseId });
    const [eventsUsingCase, teamsUsingCase] = await Promise.all([
      MysteryEvent.countDocuments({ caseId }),
      MysteryTeam.countDocuments({ caseId }),
    ]);
    res.status(200).json({ case: mysteryCase, evidence, branches, fightsBackEvents, usage: { events: eventsUsingCase, teams: teamsUsingCase } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch case' });
  }
};

const CASE_EDITABLE = [
  'title', 'tagline', 'synopsis', 'mysteryIdentityName', 'mysteryIdentityPrompt',
  'difficulty', 'estimatedMinutes', 'college', 'correctIdentityTheory', 'status',
];

const updateCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    if (!mongoose.isValidObjectId(caseId)) return res.status(400).json({ error: 'Invalid case id' });
    const updates = {};
    for (const field of CASE_EDITABLE) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (updates.title !== undefined && !String(updates.title).trim()) return res.status(400).json({ error: 'Title cannot be empty' });
    if (updates.synopsis !== undefined && !String(updates.synopsis).trim()) return res.status(400).json({ error: 'Synopsis cannot be empty' });
    if (updates.status === 'published' && !(await EvidenceNode.exists({ caseId }))) {
      return res.status(400).json({ error: 'Add at least one piece of evidence before publishing' });
    }
    if (updates.status === 'draft' && await MysteryEvent.exists({ caseId, status: { $in: ['registration_open', 'live', 'paused'] } })) {
      return res.status(409).json({ error: 'An event is running on this case — close the event first' });
    }
    const mysteryCase = await MysteryCase.findByIdAndUpdate(caseId, { $set: updates }, { new: true, runValidators: true });
    if (!mysteryCase) return res.status(404).json({ error: 'Case not found' });
    res.status(200).json(mysteryCase);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update case', detail: err.message });
  }
};

const deleteCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    if (!mongoose.isValidObjectId(caseId)) return res.status(400).json({ error: 'Invalid case id' });
    if (await MysteryEvent.exists({ caseId }) || await MysteryTeam.exists({ caseId })) {
      return res.status(409).json({ error: 'This case has events/teams — delete them first' });
    }
    await Promise.all([
      EvidenceNode.deleteMany({ caseId }),
      InvestigationBranch.deleteMany({ caseId }),
      FightsBackEvent.deleteMany({ caseId }),
      MysteryCase.deleteOne({ _id: caseId }),
    ]);
    res.status(200).json({ deletedCaseId: caseId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete case', detail: err.message });
  }
};

const EVIDENCE_EDITABLE = [
  'code', 'world', 'title', 'description', 'timestampLabel', 'canonicalOrder', 'reliability',
  'points', 'canBeInvalidated', 'imageUrl', 'placementNote',
  'unlockedByEvidenceIds', 'unlockedByBranchId', 'unlockedByLeadId', 'connectsToEvidenceIds',
];

const updateEvidence = async (req, res) => {
  try {
    const { caseId, evidenceId } = req.params;
    if (!mongoose.isValidObjectId(evidenceId)) return res.status(400).json({ error: 'Invalid evidence id' });
    const evidence = await EvidenceNode.findOne({ _id: evidenceId, caseId });
    if (!evidence) return res.status(404).json({ error: 'Evidence not found' });

    for (const field of EVIDENCE_EDITABLE) {
      if (req.body[field] !== undefined) evidence[field] = req.body[field];
    }
    if (!evidence.unlockedByBranchId) evidence.unlockedByLeadId = null;
    evidence.unlockedByEvidenceIds = (evidence.unlockedByEvidenceIds || []).filter((id) => String(id) !== String(evidence._id));
    evidence.connectsToEvidenceIds = (evidence.connectsToEvidenceIds || []).filter((id) => String(id) !== String(evidence._id));

    if (req.body.requiresQR !== undefined) {
      evidence.requiresQR = !!req.body.requiresQR;
      if (evidence.requiresQR && !evidence.qrSecret) evidence.qrSecret = generateRandomCode(10);
      if (!evidence.requiresQR) evidence.qrSecret = undefined;
    }
    await evidence.save();
    res.status(200).json(evidence);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'This evidence code already exists in this case' });
    res.status(500).json({ error: 'Failed to update evidence', detail: err.message });
  }
};

const rotateEvidenceQr = async (req, res) => {
  try {
    const { caseId, evidenceId } = req.params;
    const evidence = await EvidenceNode.findOne({ _id: evidenceId, caseId, requiresQR: true });
    if (!evidence) return res.status(404).json({ error: 'QR evidence not found' });
    evidence.qrSecret = generateRandomCode(10);
    await evidence.save();
    res.status(200).json(evidence);
  } catch (err) {
    res.status(500).json({ error: 'Failed to rotate QR', detail: err.message });
  }
};

const deleteEvidence = async (req, res) => {
  try {
    const { caseId, evidenceId } = req.params;
    if (!mongoose.isValidObjectId(evidenceId)) return res.status(400).json({ error: 'Invalid evidence id' });
    const evidence = await EvidenceNode.findOneAndDelete({ _id: evidenceId, caseId });
    if (!evidence) return res.status(404).json({ error: 'Evidence not found' });
    await Promise.all([
      EvidenceNode.updateMany({ caseId }, { $pull: { unlockedByEvidenceIds: evidence._id, connectsToEvidenceIds: evidence._id } }),
      FightsBackEvent.deleteMany({ caseId, invalidatedEvidenceId: evidence._id }),
    ]);
    res.status(200).json({ deletedEvidenceId: evidenceId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete evidence', detail: err.message });
  }
};

const deleteBranch = async (req, res) => {
  try {
    const { caseId, branchId } = req.params;
    if (!mongoose.isValidObjectId(branchId)) return res.status(400).json({ error: 'Invalid branch id' });
    const branch = await InvestigationBranch.findOneAndDelete({ _id: branchId, caseId });
    if (!branch) return res.status(404).json({ error: 'Branch not found' });
    await EvidenceNode.updateMany({ caseId, unlockedByBranchId: branch._id }, { $set: { unlockedByBranchId: null, unlockedByLeadId: null } });
    res.status(200).json({ deletedBranchId: branchId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete branch', detail: err.message });
  }
};

const deleteFightsBack = async (req, res) => {
  try {
    const { caseId, fightsBackId } = req.params;
    if (!mongoose.isValidObjectId(fightsBackId)) return res.status(400).json({ error: 'Invalid id' });
    const deleted = await FightsBackEvent.findOneAndDelete({ _id: fightsBackId, caseId });
    if (!deleted) return res.status(404).json({ error: 'Fights-back event not found' });
    res.status(200).json({ deletedFightsBackId: fightsBackId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete fights-back event', detail: err.message });
  }
};

module.exports = {
  createCase, addEvidence, addBranch, addFightsBackEvent, publishCase, listCases, listAllCasesAdmin, getCaseAdminDetail,
  updateCase, deleteCase, updateEvidence, rotateEvidenceQr, deleteEvidence, deleteBranch, deleteFightsBack,
};