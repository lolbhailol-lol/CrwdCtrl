const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      lowercase: true,
      validate: {
        validator: function (v) {
          // Either email or phone must be provided
          return this.email || this.phoneNumber;
        },
        message: 'Either email or phone number is required'
      }
    },
    phoneNumber: {
      type: String,
      validate: {
        validator: function (v) {
          // Either email or phone must be provided
          return this.email || this.phoneNumber;
        },
        message: 'Either email or phone number is required'
      }
    },
    password: {
      type: String,
      required: function () {
        // Password is not required for social auth users
        return !this.socialAuth || !this.socialAuth.provider;
      }
    },
    role: {
      type: String,
      enum: ["student", "organizer", "sponsor"],
      default: "student",
    },
    college: { type: String },
    profilePic: { type: String },
    dateOfBirth: { type: Date },
    gender: { 
      type: String, 
      enum: ['Male', 'Female', 'Others'], 
      default: 'Male' 
    },
    otp: { type: String },
    otpExpires: { type: Date },
    isVerified: { type: Boolean, default: false },

    // Soft-delete (account deactivation) — keeps booking/registration history intact
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },

    // Firebase Authentication UID (for email verification)
    firebaseUid: { type: String, sparse: true, unique: true },

    // FCM Push Notification tokens
    fcmTokens: [{
      token: { type: String },
      device: { type: String, default: 'web' },
      createdAt: { type: Date, default: Date.now },
    }],

    // Notification preferences
    notificationPreferences: {
      emailReminders: { type: Boolean, default: true },
      pushReminders: { type: Boolean, default: true },
      registrationAlerts: { type: Boolean, default: true },
    },

    // Social Authentication fields
    socialAuth: {
      provider: {
        type: String,
        enum: ['google', 'facebook', 'twitter'],
        default: null
      },
      providerId: {
        type: String,
        default: null
      },
      photoURL: {
        type: String,
        default: null
      }
    }
  },
  { timestamps: true }
);

// Create sparse unique indexes to handle null values properly
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ phoneNumber: 1 }, { unique: true, sparse: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  // Skip password hashing for social auth users without password
  if (!this.password && this.socialAuth && this.socialAuth.provider) {
    return next();
  }

  if (!this.password) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  // Social auth users don't have passwords to compare
  if (!this.password && this.socialAuth && this.socialAuth.provider) {
    return false;
  }

  if (!this.password) {
    return false;
  }

  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
