const express = require('express');
const router = express.Router();
const festOrganizerController = require('../controllers/festOrganizerController');
const devOnly = require('../middleware/devOnly');
const { sanitizePublicCompetition } = require('../utils/publicEntitySanitize');

/**
 * Server-side sanitization: remove duplicated content blocks from descriptions.
 * The admin panel sometimes stores the same content twice — once formatted (with newlines)
 * and once as a flattened single-line paragraph appended at the end.
 */
const sanitizeDescription = (rawDesc) => {
    if (!rawDesc || typeof rawDesc !== 'string') return rawDesc || '';

    let desc = rawDesc.replace(/\r\n/g, '\n').replace(/<br\s*\/?\s*>/gi, '\n');

    // --- Strategy 0: Robust Fingerprint check ---
    // Extract first few prominent words to find where the copy-paste block begins
    const textLines = desc.split('\n').map(l => l.trim()).filter(l => l.length > 3);
    if (textLines.length >= 2) {
        const firstLineWords = (textLines[0] || '').split(/\W+/).filter(w => w.length > 2);
        const secondLineWords = (textLines[1] || '').split(/\W+/).filter(w => w.length > 2).slice(0, 3);
        const words = [...firstLineWords, ...secondLineWords];
        
        if (words.length >= 3) {
            try {
                const regexStr = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s\\W]+');
                const regex = new RegExp(regexStr, 'gi');
                let match;
                let matches = [];
                while ((match = regex.exec(desc)) !== null) {
                    matches.push({ index: match.index, text: match[0] });
                }
                
                if (matches.length >= 2) {
                    const cutIdx = matches[1].index;
                    // Only cut if the duplicate appears in the bottom portion
                    if (cutIdx > desc.length / 4) {
                        const lastNewline = desc.lastIndexOf('\n', cutIdx);
                        if (lastNewline !== -1) {
                            const precedingText = desc.substring(lastNewline, cutIdx);
                            // Cut out the prepended metadata if it's less than 200 chars
                            if (precedingText.length < 200) {
                                desc = desc.substring(0, lastNewline).trim();
                            } else {
                                desc = desc.substring(0, cutIdx).trim();
                            }
                        } else {
                            desc = desc.substring(0, cutIdx).trim();
                        }
                    }
                }
            } catch (e) {
                // Ignore regex errors
            }
        }
    }

    // --- Strategy A: Detect a repeated heading near the tail and chop ---
    const trimRepeatedTrailingSection = (text, headerRegex) => {
        const normalize = (v) => v.toLowerCase().replace(/\s+/g, ' ').trim();
        const cutIfTailRepeatsEarlier = (src, idx, skip = 0) => {
            if (idx < Math.floor(src.length * 0.4)) return src;
            const earlier = normalize(src.substring(0, idx));
            const trailing = normalize(src.substring(idx + skip));
            if (trailing.length < 40) return src;
            const probe = trailing.substring(0, Math.min(200, trailing.length));
            if (probe.length >= 40 && earlier.includes(probe)) {
                return src.substring(0, idx).trimEnd();
            }
            return src;
        };
        const matcher = new RegExp(headerRegex.source, headerRegex.flags.includes('g') ? headerRegex.flags : headerRegex.flags + 'g');
        const first = matcher.exec(text);
        if (!first) return text;
        const second = matcher.exec(text);
        if (second) {
            const trimmed = cutIfTailRepeatsEarlier(text, second.index, 0);
            if (trimmed !== text) return trimmed;
        }
        return cutIfTailRepeatsEarlier(text, first.index, first[0].length);
    };

    desc = trimRepeatedTrailingSection(desc, /\bGUIDELINES\b/gi);
    desc = trimRepeatedTrailingSection(desc, /\bJUDGING\s+CRITERIA\b/gi);

    // --- Strategy B: Find any duplicated significant line ---
    const lines = desc.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const significantLines = [];
    for (const line of lines) {
        const isSig = line.length >= 5 && (
            /^[A-Z\s]{4,}$/.test(line) ||
            /^\d+\.\s/.test(line) ||
            /^[A-Z][^.]*:/.test(line) ||
            /^(GUIDELINES|JUDGING|RULES|CRITERIA|SUBMISSION|No\.|Participation|General|Time\s+Limit)/i.test(line)
        );
        if (isSig) significantLines.push(line);
    }

    const flatDesc = desc.toLowerCase().replace(/\s+/g, '');
    for (const sigLine of significantLines) {
        const sigFlat = sigLine.toLowerCase().replace(/\s+/g, '');
        const firstIdx = flatDesc.indexOf(sigFlat);
        if (firstIdx === -1) continue;
        const secondIdx = flatDesc.indexOf(sigFlat, firstIdx + sigFlat.length);
        if (secondIdx !== -1) {
            const sigWords = sigLine.split(/\s+/).filter(w => w.length > 1);
            if (sigWords.length > 0) {
                const searchStart = Math.floor(desc.length / 3);
                const regexStr = sigWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
                const secondMatch = new RegExp(regexStr, 'i').exec(desc.substring(searchStart));
                if (secondMatch) {
                    desc = desc.substring(0, searchStart + secondMatch.index).trim();
                    break;
                }
            }
        }
    }

    // --- Strategy C: Flattened-repeat tail check ---
    const halfLen = Math.floor(desc.length / 2);
    if (halfLen > 50) {
        const firstPart = desc.substring(0, halfLen);
        const firstPartFlat = firstPart.replace(/\s+/g, '').toLowerCase();
        const checkPoints = [0, 20, 50];
        for (const start of checkPoints) {
            if (firstPartFlat.length < start + 60) continue;
            const prefix = firstPartFlat.substring(start, start + 60);
            const endFlat = desc.substring(halfLen).toLowerCase().replace(/\s+/g, '');
            if (endFlat.indexOf(prefix) !== -1) {
                const words = firstPart.substring(start).split(/\s+/).filter(w => w.length > 2).slice(0, 3);
                if (words.length >= 2) {
                    const regex = new RegExp(words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+'), 'i');
                    const m = regex.exec(desc.substring(halfLen));
                    if (m) {
                        desc = desc.substring(0, halfLen + m.index).trim();
                        return desc;
                    }
                }
            }
        }
    }

    return desc.trim();
};

// ✅ Public routes (no authentication required)

// ✅ Get all public fests with pagination and filtering
router.get('/all', festOrganizerController.getAllFests);

// ✅ Search fests
router.get('/search', festOrganizerController.searchFests);

// ✅ Get upcoming fests
router.get('/upcoming', festOrganizerController.getUpcomingFests);

// ✅ Get single competition details (public view) — before /:id/public
router.get('/competitions/:competitionId/public', async (req, res) => {
    try {
        const { competitionId } = req.params;
        const { findByIdOrSlug } = require('../utils/slug');
        const Competition = require('../model/competition_model');

        const found = await findByIdOrSlug(Competition, competitionId, {
            pickName: (row) => row.name,
        });

        if (!found) {
            return res.status(404).json({ message: 'Competition not found' });
        }

        const competition = await Competition.findById(found._id)
            .populate({
                path: 'fest',
                select: 'festName collegeName isApproved registration',
                options: { strictPopulate: false }
            })
            .lean();

        if (!competition) {
            return res.status(404).json({ message: 'Competition not found' });
        }

        // Only return competitions from approved fests
        if (!competition.fest?.isApproved) {
            return res.status(404).json({ message: 'Competition not found' });
        }

        // Ensure competition has proper registration configuration
        const competitionData = competition;
        
        // ✅ CRITICAL FIX: Ensure fest registration data is always complete
        if (competitionData.fest && competitionData.fest.registration) {
            // Make sure fest registration has all required public fields with proper defaults
            competitionData.fest.registration = {
                mode: competitionData.fest.registration.mode || 'NOT_STARTED',
                externalLink: competitionData.fest.registration.externalLink || '',
                paymentQR: competitionData.fest.registration.paymentQR || '',
                paymentQRMessage: competitionData.fest.registration.paymentQRMessage || '',
                formInstructions: competitionData.fest.registration.formInstructions || '',
                formSchema: competitionData.fest.registration.formSchema || []
            };
        } else if (competitionData.fest) {
            // If fest exists but registration is missing, create default registration object
            console.warn(`⚠️ Fest ${competitionData.fest._id} missing registration data, creating defaults`);
            competitionData.fest.registration = {
                mode: 'NOT_STARTED',
                externalLink: '',
                paymentQR: '',
                paymentQRMessage: '',
                formInstructions: '',
                formSchema: []
            };
        }
        
        // Handle new registration system vs legacy
        if (!competitionData.registrationType) {
            // Legacy competition - set default values
            competitionData.registrationType = 'fest';
            competitionData.registration = competitionData.registration || { status: 'not_started' };
            competitionData.legacyRegistration = { status: 'STARTED' }; // For backward compatibility
        }
        
        // Ensure registration object has proper structure
        if (competitionData.registrationType === 'custom' && competitionData.registration) {
            // Make sure custom registration has all required public fields
            competitionData.registration = {
                status: competitionData.registration.status || 'not_started',
                externalUrl: competitionData.registration.externalUrl || '',
                formSchema: competitionData.registration.formSchema || [],
                formType: competitionData.registration.formType || 'SINGLE_STEP',
                steps: competitionData.registration.steps || [],
                qrCode: competitionData.registration.qrCode || '',
                qrCodeMessage: competitionData.registration.qrCodeMessage || '',
                settings: competitionData.registration.settings || {
                    allowMultipleRegistrations: true,
                    requireEmailVerification: false,
                    autoConfirmation: true,
                    maxRegistrations: null,
                    registrationDeadline: null
                }
            };
        }

        // ✅ SERVER-SIDE SANITIZATION: Clean duplicated description content before sending
        if (competitionData.description) {
            competitionData.description = sanitizeDescription(competitionData.description);
        }
        if (competitionData.subtitle) {
            competitionData.subtitle = sanitizeDescription(competitionData.subtitle);
        }
        if (competitionData.commonRulesMessage) {
            competitionData.commonRulesMessage = sanitizeDescription(competitionData.commonRulesMessage);
        }
        if (Array.isArray(competitionData.rounds)) {
            competitionData.rounds = competitionData.rounds.map(round => ({
                ...round,
                description: round.description ? sanitizeDescription(round.description) : round.description,
                roundRulesMessage: round.roundRulesMessage ? sanitizeDescription(round.roundRulesMessage) : round.roundRulesMessage,
            }));
        }

        console.log('🔍 Competition API Response:', {
            competitionId: competitionData._id,
            festId: competitionData.fest?._id,
            festRegistrationMode: competitionData.fest?.registration?.mode,
            registrationType: competitionData.registrationType
        });

        res.status(200).json(sanitizePublicCompetition(competitionData));
    } catch (err) {
        console.error('Error in public competition fetch:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ✅ Get single fest details (public view)
router.get('/:id/public', festOrganizerController.getPublicFestById);

// Shubharam / stall interest capture (no auth)
const stallLeadCtrl = require('../controllers/festStallLeadController');
const { stallLeadLimiter } = require('../middleware/rateLimiter');
router.get('/:id/stall', stallLeadCtrl.getPublicStallMeta);
router.post('/:id/stall-leads', stallLeadLimiter, stallLeadCtrl.createPublicStallLead);

// Debug route — development only
router.get('/:id/debug', devOnly, async (req, res) => {
    try {
        const { id } = req.params;
        const mongoose = require('mongoose');
        
        console.log(`🔍 DEBUG: Checking fest with ID: ${id}`);
        
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.json({ 
                error: 'Invalid ObjectId format', 
                id,
                message: 'The provided ID is not a valid MongoDB ObjectId format'
            });
        }
        
        const FestOrganizer = require('../model/fest_organizer_model');
        const fest = await FestOrganizer.findById(id);
        
        if (fest) {
            res.json({
                exists: true,
                isApproved: fest.isApproved,
                festName: fest.festName,
                collegeName: fest.collegeName,
                festType: fest.festType,
                id: fest._id,
                hasCompetitions: fest.competitions?.length || 0,
                hasGalleryImages: fest.galleryImages?.length || 0,
                createdAt: fest.createdAt,
                status: 'Fest found in database'
            });
        } else {
            res.json({
                exists: false,
                id,
                status: 'Fest NOT found in database'
            });
        }
    } catch (err) {
        console.error('publicFest debug error:', err.message);
        res.status(500).json({ error: 'Server error', status: 'Database error' });
    }
});

module.exports = router;