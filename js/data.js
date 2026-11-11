// quit-smoking-bd -- static data (pure ASCII).
// Health milestones: thresholds in hours since the last cigarette, from the
// U.S. Surgeon General's 2004 report (CDC, "Within 20 Minutes of Quitting").
// Text for each milestone lives in js/i18n.js (m1t/m1d ... m8t/m8d).
var MILESTONES = [
  { id: 'm1', hours: 1 / 3 },      // 20 minutes
  { id: 'm2', hours: 12 },         // 12 hours
  { id: 'm3', hours: 336 },        // 2 weeks
  { id: 'm4', hours: 720 },        // 1 month (start of the 1-9 month window)
  { id: 'm5', hours: 8760 },       // 1 year
  { id: 'm6', hours: 43800 },      // 5 years
  { id: 'm7', hours: 87600 },      // 10 years
  { id: 'm8', hours: 131400 },     // 15 years
];
var TRIGGERS = ['stress', 'afterMeal', 'teaCoffee', 'friends', 'boredom', 'alcohol', 'other'];
var APP_ID = 'quit-smoking-bd';
var APP_VERSION = 1;
var STORAGE_KEY = 'quit-smoking-bd-v1';
var CRAVING_SECONDS = 300; // 5-minute craving timer
// 4-7-8 breathing cycle (seconds): inhale 4, hold 7, exhale 8.
var BREATH_PHASES = [
  { key: 'breatheIn', seconds: 4 },
  { key: 'breatheHold', seconds: 7 },
  { key: 'breatheOut', seconds: 8 },
];
if (typeof module !== 'undefined') {
  module.exports = { MILESTONES: MILESTONES, TRIGGERS: TRIGGERS, APP_ID: APP_ID,
    APP_VERSION: APP_VERSION, STORAGE_KEY: STORAGE_KEY,
    CRAVING_SECONDS: CRAVING_SECONDS, BREATH_PHASES: BREATH_PHASES };
}
