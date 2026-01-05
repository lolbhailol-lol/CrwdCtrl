## Summary of Changes Made

✅ **Updated Competition Data Service** (`competitionDataService.js`):
- Modified `transformCompetitionData` function to specifically handle "Art Maestro" and "Glamour Nova" competitions
- These competitions now show only "Final Round" instead of multiple rounds
- Updated the rounds description to reflect single-round format
- Applied conditional logic to prevent showing round2 and round3 for these competitions

✅ **Updated Competition View Details Component** (`Competitions-view-details.jsx`):
- Modified mobile round tabs to conditionally render based on available rounds
- Updated desktop round tabs to only show when multiple rounds exist
- Fixed tab layout to hide Round 2 and Round 3 buttons when not needed

## Key Changes:

### 1. Art Maestro Competition:
- **Before**: Shows "Final Round" (was already correct in data)
- **After**: Still shows only "Final Round" but with improved UI that doesn't show unused round tabs

### 2. Glamour Nova Competition:
- **Before**: Shows "Qualifying Round" and "Final Round" 
- **After**: Shows only "Final Round" (Qualifying Round is now hidden)

### 3. Other Competitions:
- **Unchanged**: All other competitions maintain their existing round structure
- InSync, Head Bang, Dastak, etc. still show their multiple rounds as before

## Technical Implementation:
1. **Data Layer**: Modified round generation logic in service to filter rounds for specific competitions
2. **UI Layer**: Updated component to conditionally render round tabs based on available rounds
3. **Preserved**: All other competition data, styling, and functionality remains intact

The changes ensure that only "Art Maestro" and "Glamour Nova" display the Final Round, while maintaining the existing behavior for all other competitions.