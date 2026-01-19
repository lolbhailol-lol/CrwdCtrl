# Fest Form Debug Guide

## Issue
The admin FestFormModal is not saving changes to:
- Artists heading ("Artists You'll Love")
- Competition heading ("Competitions") 
- Contacts section

## Debug Steps

### 1. Frontend Debugging
1. Open the admin panel and go to create/edit a fest
2. Open browser Developer Tools (F12)
3. Go to the Console tab
4. Fill out the form and change:
   - Artists heading to "Custom Artists Test"
   - Competitions heading to "Custom Competitions Test"
   - Add a contact with name "Test Contact"
5. Submit the form
6. Check the console logs for:
   ```
   🔍 DEBUG - Key fields in payload:
     - artistsHeading: Custom Artists Test
     - competitionsHeading: Custom Competitions Test
     - contacts: [{name: "Test Contact", ...}]
   ```

### 2. Network Tab Debugging
1. In Developer Tools, go to Network tab
2. Submit the form
3. Find the POST/PUT request to `/admin/fests`
4. Click on it and check the Request payload
5. Verify that artistsHeading, competitionsHeading, and contacts are in the payload

### 3. Backend Debugging
1. Check the backend console logs for:
   ```
   🔍 DEBUG - Key fields in request:
     - artistsHeading: Custom Artists Test
     - competitionsHeading: Custom Competitions Test
     - contacts: [{name: "Test Contact", ...}]
   ```
2. Check for the database save logs:
   ```
   🔍 DEBUG - Fest object before save:
   🔍 DEBUG - Fest object after save:
   ```

### 4. Database Verification
1. Connect to your MongoDB database
2. Find the fest document that was created/updated
3. Check if the fields are present:
   ```javascript
   db.festorganizers.findOne({_id: ObjectId("your-fest-id")}, {
     artistsHeading: 1,
     competitionsHeading: 1,
     contacts: 1
   })
   ```

## Expected Results

### Frontend Console Logs
- Should show the correct values in the payload
- Form state should contain the updated values

### Network Request
- POST/PUT request should contain the fields in the body
- Response should be 200/201 with success message

### Backend Console Logs
- Should receive the correct values in req.body
- Should save the correct values to the database

### Database
- Document should contain the updated field values
- Fields should not be empty or default values

## Common Issues

### Issue 1: Frontend Form State Not Updating
- Check if the input onChange handlers are working
- Verify form state is being updated correctly
- Check for any form validation errors

### Issue 2: Payload Not Sent Correctly
- Check network request payload
- Verify API endpoint is correct
- Check for any request/response errors

### Issue 3: Backend Not Processing Fields
- Check if fields are received in req.body
- Verify database schema allows these fields
- Check for any validation errors

### Issue 4: Database Not Saving Fields
- Check MongoDB connection
- Verify schema definitions
- Check for any database constraints

## Next Steps

Based on the debug results:

1. **If frontend logs show correct values but network request is missing them**: Issue with form submission
2. **If network request has correct values but backend doesn't receive them**: Issue with routing or middleware
3. **If backend receives values but doesn't save them**: Issue with database schema or validation
4. **If database saves but values are lost on retrieval**: Issue with data fetching or serialization

## Quick Fix Attempts

### 1. Force Field Update
Try explicitly setting the fields in the backend:
```javascript
// In adminFestController.js updateFest function
updateData.artistsHeading = req.body.artistsHeading || "Artists You'll Love";
updateData.competitionsHeading = req.body.competitionsHeading || "Competitions";
updateData.contacts = req.body.contacts || [];
```

### 2. Check Schema Validation
Verify the fields are properly defined in the Mongoose schema:
```javascript
// In fest_organizer_model.js
artistsHeading: {
  type: String,
  default: "Artists You'll Love",
  trim: true,
},
competitionsHeading: {
  type: String,
  default: "Competitions", 
  trim: true,
},
contacts: [
  {
    name: String,
    phone: String,
    email: String,
    instagramId: String,
    role: String,
  },
],
```

### 3. Test with Raw MongoDB Update
If Mongoose isn't working, try raw MongoDB update:
```javascript
const { MongoClient } = require('mongodb');
// Direct database update to test if it's a Mongoose issue
```

Run through these debug steps and let me know what you find in the console logs and network requests.