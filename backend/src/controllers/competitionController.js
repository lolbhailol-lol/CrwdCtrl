const { sendRegistrationThankYouEmail, sendRegistrationConfirmationEmail } = require('../services/emailService');
const CompetitionRegistration = require('../model/competition_registration_model');
const { saveUploadedFile } = require('../utils/fileUpload');

// Handle competition registration
const registerForCompetition = async (req, res) => {
    try {
        // Extract form data from request
        const {
            name,
            instagramId,
            contactNumber,
            email,
            dateOfBirth,
            competitionName,
            numberOfParticipants,
            city,
            collegeName,
            paymentMode,
            transactionId
        } = req.body;

        // Validate required fields
        const requiredFields = [
            'name', 'instagramId', 'contactNumber', 'email',
            'dateOfBirth', 'competitionName', 'city', 'collegeName',
            'paymentMode', 'transactionId'
        ];

        const missingFields = requiredFields.filter(field => !req.body[field] || !req.body[field].toString().trim());

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Validate phone number (more flexible validation)
        const phoneRegex = /^[\+]?[0-9]{10,15}$/;
        const cleanPhone = contactNumber.replace(/\s|-/g, '');
        if (!phoneRegex.test(cleanPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid contact number format. Please use 10-15 digits.'
            });
        }

        // Check if payment screenshot is uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Payment screenshot is required'
            });
        }

        // Check for duplicate registration by email and competition (allow multiple registrations for testing)
        const existingRegistration = await CompetitionRegistration.findOne({
            email: email.trim().toLowerCase(),
            competitionName: competitionName.trim()
        });

        if (existingRegistration) {
            return res.status(400).json({
                success: false,
                message:
                    'You have already registered for this competition. Please check your email for confirmation.',
                data: {
                    existingRegistrationId: existingRegistration.registrationId,
                    status: existingRegistration.status,
                },
            });
        }

        // Generate registration ID
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const registrationId = `REG_${timestamp}_${random}`;

        // Save payment screenshot to file system
        const savedFile = await saveUploadedFile(req.file, registrationId);

        // Prepare data for database
        const registrationData = {
            user: req.user?.userId || null,
            name: name.trim(),
            instagramId: instagramId.trim(),
            contactNumber: contactNumber.trim(),
            email: email.trim().toLowerCase(),
            dateOfBirth: new Date(dateOfBirth),
            competitionName: competitionName.trim(),
            numberOfParticipants: numberOfParticipants ? parseInt(numberOfParticipants) : null,
            city: city.trim(),
            collegeName: collegeName.trim(),
            paymentMode: paymentMode.trim(),
            transactionId: transactionId.trim(),
            registrationId: registrationId,
            paymentScreenshot: savedFile,
            status: 'submitted'
        };

        // Save registration to database
        const registration = new CompetitionRegistration(registrationData);
        await registration.save();

        console.log('✅ Registration saved to database:', {
            registrationId: registration.registrationId,
            email: registration.email,
            competition: registration.competitionName
        });

        // Send email notifications using generalized functions
        try {
            // STEP 1: Send immediate thank you email
            console.log('📧 Sending immediate thank you email for competition...');
            await sendRegistrationThankYouEmail(
                registrationData.email,
                registrationData.name,
                'Competition Registration' // Generic fest name for competitions
            );
            console.log('✅ Thank you email sent successfully');

            // STEP 2: Send async confirmation email with competition details
            setTimeout(async () => {
                try {
                    console.log('📧 Sending async confirmation email for competition...');
                    
                    // Format submission date in Asia/Kolkata timezone
                    const submissionDate = new Date().toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    
                    await sendRegistrationConfirmationEmail(
                        registrationData.email,
                        registrationData.name,
                        'Competition Registration', // Generic fest name
                        registrationData.competitionName, // Competition name
                        registrationData.registrationId,
                        submissionDate,
                        { status: 'pending', method: 'manual' }
                    );
                    
                    console.log('✅ Confirmation email sent successfully');
                } catch (emailError) {
                    console.error('⚠️ Confirmation email failed (non-blocking):', emailError.message);
                }
            }, 3000); // Send after 3 seconds

            // Update registration to mark emails as sent
            registration.isEmailSent = true;
            registration.isConfirmationSent = true;
            await registration.save();

        } catch (emailError) {
            console.error('⚠️ Thank you email failed (non-blocking):', emailError.message);
            // If emails fail, still allow registration but log the error
        }

        res.status(200).json({
            success: true,
            message: 'Competition registration submitted successfully! We will review your application and get back to you soon.',
            data: {
                registrationId: registration.registrationId,
                competitionName: registration.competitionName,
                submittedAt: registration.submittedAt.toISOString(),
                status: registration.status
            }
        });

    } catch (error) {
        console.error('❌ Competition registration error:', error);

        // Provide more specific error messages
        let errorMessage = 'Failed to submit registration. Please try again.';
        let statusCode = 500;

        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            errorMessage = `Validation error: ${validationErrors.join(', ')}`;
            statusCode = 400;
        } else if (error.code === 11000) {
            errorMessage = 'A registration with this email already exists for this competition.';
            statusCode = 400;
        } else if (error.message.includes('Cast to Date failed')) {
            errorMessage = 'Invalid date format. Please use YYYY-MM-DD format.';
            statusCode = 400;
        }

        res.status(statusCode).json({
            success: false,
            message: errorMessage,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get all competition registrations (admin function)
const getAllRegistrations = async (req, res) => {
    try {
        const {
            competition,
            status,
            page = 1,
            limit = 20,
            sortBy = 'submittedAt',
            sortOrder = 'desc'
        } = req.query;

        // Build query
        const query = {};
        if (competition) query.competitionName = competition;
        if (status) query.status = status;

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

        // Execute query with pagination
        const skip = (page - 1) * limit;
        const registrations = await CompetitionRegistration.find(query)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .select('-paymentScreenshot.filePath'); // Exclude file path for security

        const total = await CompetitionRegistration.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                registrations,
                pagination: {
                    current: parseInt(page),
                    pages: Math.ceil(total / limit),
                    total,
                    limit: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Get registrations error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch registrations',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get specific registration by ID
const getRegistrationById = async (req, res) => {
    try {
        const { registrationId } = req.params;

        const registration = await CompetitionRegistration.findOne({
            registrationId: registrationId
        }).select('-paymentScreenshot.filePath');

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: 'Registration not found'
            });
        }

        res.status(200).json({
            success: true,
            data: registration
        });
    } catch (error) {
        console.error('Get registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch registration',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Update registration status (admin function)
const updateRegistrationStatus = async (req, res) => {
    try {
        const { registrationId } = req.params;
        const { status, reviewNotes } = req.body;

        const validStatuses = ['submitted', 'under_review', 'payment_verified', 'approved', 'rejected', 'waitlisted'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        const registration = await CompetitionRegistration.findOne({
            registrationId: registrationId
        });

        if (!registration) {
            return res.status(404).json({
                success: false,
                message: 'Registration not found'
            });
        }

        // Update status using the model method
        await registration.updateStatus(status, reviewNotes, req.user?.id);

        res.status(200).json({
            success: true,
            message: 'Registration status updated successfully',
            data: {
                registrationId: registration.registrationId,
                status: registration.status,
                reviewedAt: registration.reviewedAt,
                reviewNotes: registration.reviewNotes
            }
        });
    } catch (error) {
        console.error('Update status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update registration status',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get registration statistics
const getRegistrationStats = async (req, res) => {
    try {
        const { competition } = req.query;

        const stats = await CompetitionRegistration.getStats(competition);

        // Format the stats
        const formattedStats = {
            total: stats[0]?.total || 0,
            statusBreakdown: {}
        };

        if (stats[0]?.statusCounts) {
            stats[0].statusCounts.forEach(item => {
                formattedStats.statusBreakdown[item.status] = item.count;
            });
        }

        res.status(200).json({
            success: true,
            data: formattedStats
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch registration statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    registerForCompetition,
    getAllRegistrations,
    getRegistrationById,
    updateRegistrationStatus,
    getRegistrationStats
};