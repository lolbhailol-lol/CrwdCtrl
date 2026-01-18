// Debug script to test fest form submission
// This will help us identify where the issue is occurring

const API_BASE_URL = 'http://localhost:8080/api';

// Test payload that matches what the form should send
const testPayload = {
  festName: "Test Fest",
  subtitle: "Test Subtitle",
  collegeName: "Test College",
  festType: "cultural",
  festDate: "Dec 10-12, 2025",
  venue: "Test Venue",
  ticketPrice: "500",
  description: "Test description",
  registrationLink: "",
  status: "upcoming",
  coverImage: "",
  galleryImages: [],
  artists: [],
  artistsHeading: "Custom Artists Heading Test",
  contacts: [
    {
      name: "Test Contact",
      phone: "1234567890",
      email: "test@example.com",
      instagramId: "@test",
      role: "Coordinator"
    }
  ],
  sponsors: [],
  competitionsHeading: "Custom Competitions Heading Test",
  registration: {
    mode: "NOT_STARTED",
    externalLink: "",
    paymentQR: "",
    paymentQRMessage: "",
    googleSheetsUrl: "",
    formInstructions: "",
    organizerEmail: "",
    formSchema: []
  }
};

console.log('Test payload:', JSON.stringify(testPayload, null, 2));
console.log('\nKey fields to check:');
console.log('- artistsHeading:', testPayload.artistsHeading);
console.log('- competitionsHeading:', testPayload.competitionsHeading);
console.log('- contacts:', testPayload.contacts);

// Instructions for testing:
console.log('\n=== TESTING INSTRUCTIONS ===');
console.log('1. Open browser dev tools');
console.log('2. Go to admin fest form');
console.log('3. Fill in the required fields');
console.log('4. Change the artistsHeading to "Custom Artists Heading Test"');
console.log('5. Change the competitionsHeading to "Custom Competitions Heading Test"');
console.log('6. Add a contact with name "Test Contact"');
console.log('7. Submit the form');
console.log('8. Check the Network tab for the API request');
console.log('9. Verify the payload contains the custom headings and contacts');
console.log('10. Check the database to see if the values were saved');