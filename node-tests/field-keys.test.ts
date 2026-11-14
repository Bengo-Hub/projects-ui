import { test } from 'node:test';
import assert from 'node:assert/strict';

const { canRotate, currentShare, describeRotation, errorCode, errorMessage, fileNameFrom } = await import(
  '../src/lib/security/field-keys.ts'
);

const base = {
  configured: true,
  root_fingerprint: 'abcd1234',
  sealed_values: 10,
  on_current: 4,
  on_older: 6,
  on_root: 2,
  keys: [],
  rotation: { state: 'resealing', key_id: 'k1', resealed: 4, failed: 0, remaining: 6 },
} as const;

test('rotation is refused while a re-seal runs and without a root key', () => {
  assert.equal(canRotate(base as never), false);
  assert.equal(canRotate({ ...base, rotation: { ...base.rotation, state: 'done' } } as never), true);
  assert.equal(canRotate({ ...base, rotation: { ...base.rotation, state: 'idle' } } as never), true);
  assert.equal(canRotate({ ...base, configured: false, rotation: { ...base.rotation, state: 'idle' } } as never), false);
  assert.equal(canRotate(null), false);
});

test('the rotation sentence follows the state', () => {
  assert.match(describeRotation(base as never), /4 moved, 6 left/);
  assert.match(describeRotation({ ...base, rotation: { ...base.rotation, failed: 1 } } as never), /1 value could not be opened/);
  assert.match(describeRotation({ ...base, rotation: { ...base.rotation, remaining: 0 } } as never), /every value is moved/);
  assert.match(describeRotation({ ...base, rotation: { ...base.rotation, state: 'idle' } } as never), /Never rotated/);
  assert.match(describeRotation({ ...base, rotation: { ...base.rotation, state: 'done' } } as never), /older keys are retired/);
});

test('share on the current key', () => {
  assert.equal(currentShare(base as never), 40);
  assert.equal(currentShare({ ...base, sealed_values: 0, on_current: 0 } as never), 100);
});

test('file name comes from the header and never carries a path', () => {
  assert.equal(fileNameFrom('attachment; filename="projects-api-field-keys-abcd1234-20261115.json"'), 'projects-api-field-keys-abcd1234-20261115.json');
  assert.equal(fileNameFrom('attachment; filename="../../etc/passwd"'), 'projects-api-field-keys.json');
  assert.equal(fileNameFrom(null), 'projects-api-field-keys.json');
});

test('error codes are read from JSON and from blob bodies', async () => {
  assert.equal(await errorCode({ response: { data: { code: 'otp_invalid' } } }), 'otp_invalid');
  const blob = new Blob([JSON.stringify({ code: 'rotation_running' })], { type: 'application/json' });
  assert.equal(await errorCode({ response: { data: blob } }), 'rotation_running');
  assert.equal(await errorCode(new Error('network')), undefined);
  assert.match(errorMessage('otp_invalid'), /request a new one/);
  assert.match(errorMessage(undefined), /try again/i);
});
