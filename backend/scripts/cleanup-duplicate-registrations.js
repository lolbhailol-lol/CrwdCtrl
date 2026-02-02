/**
 * Script to clean up duplicate registrations in MongoDB
 * 
 * This script will:
 * 1. Find all duplicate registrations (same fest + user + competitionId)
 * 2. Keep the FIRST registration (oldest by createdAt)
 * 3. Delete all other duplicates
 * 
 * Run with: node scripts/cleanup-duplicate-registrations.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Get MongoDB URI from environment or use default
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/crwdctrl';

async function cleanupDuplicates() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const registrationsCollection = db.collection('registrations');

    // Find duplicates using aggregation
    console.log('\n🔍 Finding duplicate registrations...');
    
    const duplicates = await registrationsCollection.aggregate([
      {
        // Only consider registrations with competitionId
        $match: {
          competitionId: { $exists: true, $ne: null }
        }
      },
      {
        // Group by fest + user + competitionId
        $group: {
          _id: {
            fest: '$fest',
            user: '$user',
            competitionId: '$competitionId'
          },
          count: { $sum: 1 },
          docs: { 
            $push: { 
              _id: '$_id', 
              createdAt: '$createdAt',
              submittedAt: '$submittedAt',
              status: '$status'
            } 
          }
        }
      },
      {
        // Only keep groups with duplicates
        $match: {
          count: { $gt: 1 }
        }
      }
    ]).toArray();

    if (duplicates.length === 0) {
      console.log('✅ No duplicate registrations found!');
      await mongoose.disconnect();
      return;
    }

    console.log(`\n⚠️ Found ${duplicates.length} sets of duplicate registrations:\n`);

    let totalDeleted = 0;
    const idsToDelete = [];

    for (const dup of duplicates) {
      console.log(`\n📋 Duplicate set (${dup.count} registrations):`);
      console.log(`   Fest: ${dup._id.fest}`);
      console.log(`   User: ${dup._id.user}`);
      console.log(`   Competition: ${dup._id.competitionId}`);
      
      // Sort by createdAt to keep the oldest one
      const sorted = dup.docs.sort((a, b) => 
        new Date(a.createdAt || a.submittedAt) - new Date(b.createdAt || b.submittedAt)
      );
      
      console.log(`\n   📝 Registrations:`);
      sorted.forEach((doc, index) => {
        const isKeeping = index === 0;
        const marker = isKeeping ? '✅ KEEP' : '❌ DELETE';
        console.log(`      ${marker}: ${doc._id} (created: ${doc.createdAt || doc.submittedAt}, status: ${doc.status})`);
        
        if (!isKeeping) {
          idsToDelete.push(doc._id);
        }
      });
    }

    console.log(`\n\n📊 Summary:`);
    console.log(`   Total duplicate sets: ${duplicates.length}`);
    console.log(`   Total to delete: ${idsToDelete.length}`);

    if (idsToDelete.length > 0) {
      // Ask for confirmation (auto-confirm for scripts)
      console.log('\n🗑️ Deleting duplicate registrations...');
      
      const deleteResult = await registrationsCollection.deleteMany({
        _id: { $in: idsToDelete }
      });

      totalDeleted = deleteResult.deletedCount;
      console.log(`\n✅ Successfully deleted ${totalDeleted} duplicate registrations!`);
    }

    // Now create the unique index (this will fail if duplicates still exist)
    console.log('\n🔧 Creating unique index to prevent future duplicates...');
    try {
      await registrationsCollection.createIndex(
        { fest: 1, user: 1, competitionId: 1 },
        { 
          unique: true, 
          partialFilterExpression: { competitionId: { $exists: true, $ne: null } },
          name: 'unique_user_competition_registration'
        }
      );
      console.log('✅ Unique index created successfully!');
    } catch (indexError) {
      if (indexError.code === 11000) {
        console.log('⚠️ Could not create unique index - duplicates still exist');
        console.log('   Run this script again to find remaining duplicates');
      } else {
        console.error('❌ Index creation error:', indexError.message);
      }
    }

    await mongoose.disconnect();
    console.log('\n✅ Cleanup complete!');

  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the cleanup
cleanupDuplicates();
