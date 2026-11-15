import test from 'node:test';
import assert from 'node:assert/strict';
import { isCronAuthorized } from '../src/jobs/cronAuth';

const SECRET = 'test-cron-secret';

test('isCronAuthorized: fail closed when no secret is configured', () => {
  assert.equal(isCronAuthorized({}, ''), false);
  assert.equal(
    isCronAuthorized({ headers: { authorization: 'Bearer anything' } }, ''),
    false,
  );
  assert.equal(isCronAuthorized({ query: { secret: 'anything' } }, ''), false);
});

test('isCronAuthorized: valid Bearer or query secret', () => {
  assert.equal(
    isCronAuthorized({ headers: { authorization: `Bearer ${SECRET}` } }, SECRET),
    true,
  );
  assert.equal(isCronAuthorized({ query: { secret: SECRET } }, SECRET), true);
});

test('isCronAuthorized: wrong or missing credentials are denied', () => {
  assert.equal(
    isCronAuthorized({ headers: { authorization: 'Bearer wrong' } }, SECRET),
    false,
  );
  assert.equal(isCronAuthorized({ query: { secret: 'wrong' } }, SECRET), false);
  assert.equal(isCronAuthorized({}, SECRET), false);
  assert.equal(
    isCronAuthorized({ headers: { authorization: 'Basic abc' } }, SECRET),
    false,
  );
  // A Bearer token with trailing whitespace is trimmed, not rejected.
  assert.equal(
    isCronAuthorized({ headers: { authorization: `Bearer ${SECRET} ` } }, SECRET),
    true,
  );
});
