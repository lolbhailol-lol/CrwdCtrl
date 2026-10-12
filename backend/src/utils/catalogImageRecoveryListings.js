'use strict';

// Listing types whose dead Cloudinary images can be replaced with one CC0 cover photo.
// `primaryArrays` are refilled with the cover when every entry was dead, so detail
// pages never end up with an empty hero; other galleries simply drop dead entries.
const LISTING_RECOVERY_KINDS = {
  trek: {
    label: 'Trek',
    model: () => require('../model/trek_model'),
    arrays: ['heroImages', 'images'],
    primaryArrays: ['heroImages', 'images'],
    coverFields: [],
  },
  'trek-community': {
    label: 'Trek community',
    model: () => require('../model/trek_community_model'),
    arrays: ['galleryImages'],
    primaryArrays: [],
    coverFields: [],
  },
  sport: {
    label: 'Sport',
    model: () => require('../model/sports_model'),
    arrays: ['images'],
    primaryArrays: ['images'],
    coverFields: [],
  },
  'run-club': {
    label: 'Run club',
    model: () => require('../model/run_club_model'),
    arrays: ['galleryImages'],
    primaryArrays: [],
    coverFields: [],
  },
  'event-show': {
    label: 'Event',
    model: () => require('../model/event_show_model'),
    arrays: ['galleryImages'],
    primaryArrays: [],
    coverFields: ['poster', 'banner'],
  },
};

module.exports = { LISTING_RECOVERY_KINDS };
