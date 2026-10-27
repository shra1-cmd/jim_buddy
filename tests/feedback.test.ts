import { test } from 'node:test';
import assert from 'node:assert/strict';
import { feedbackMessage, shouldAskFeedback, type FeedbackState } from '../src/lib/feedback.ts';

const base: FeedbackState = { firstOpen: '2026-10-20', activeDays: 3, sent: false, asks: 0, snoozeUntil: null };

test('feedback waits for 3 days since install and 3 active days', () => {
  assert.equal(shouldAskFeedback(base, '2026-10-23'), true);
  assert.equal(shouldAskFeedback(base, '2026-10-22'), false);
  assert.equal(shouldAskFeedback({ ...base, activeDays: 2 }, '2026-10-30'), false);
  assert.equal(shouldAskFeedback({ ...base, firstOpen: null }, '2026-10-30'), false);
});

test('feedback respects snooze, the ask limit and a sent reply', () => {
  assert.equal(shouldAskFeedback({ ...base, asks: 1, snoozeUntil: '2026-10-28' }, '2026-10-27'), false);
  assert.equal(shouldAskFeedback({ ...base, asks: 1, snoozeUntil: '2026-10-28' }, '2026-10-28'), true);
  assert.equal(shouldAskFeedback({ ...base, asks: 2 }, '2026-11-30'), false);
  assert.equal(shouldAskFeedback({ ...base, sent: true }, '2026-11-30'), false);
});

test('feedback message greets with the user name, verdict and note', () => {
  assert.equal(
    feedbackMessage({ name: ' Priya ', rating: 'useful', note: ' Add water tracking ', daysUsed: 5, version: '1.0.0' }),
    "Hi Shravan, I'm Priya 👋\nJimBuddy feels: Really useful 🤩\n\nAdd water tracking\n\n— sent from JimBuddy (v1.0.0 · used 5 days)",
  );
  assert.equal(feedbackMessage({ name: '', rating: 'meh', note: '  ' }), 'Hi Shravan 👋\nJimBuddy feels: Not really interesting 😐');
});
