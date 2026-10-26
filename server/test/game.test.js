const test = require('node:test');
const assert = require('node:assert');
const { Room, randomSeekerCount, pointInPolygon } = require('../game');

const area = [[0, 0], [0, 1], [1, 1], [1, 0]];
const fakeOut = () => {
  const sent = [];
  return { sent, toPlayer: (id, e, d) => sent.push({ id, e, d }), toRoom: (e, d) => sent.push({ id: '*', e, d }), push: (p, t) => sent.push({ id: p.id, e: 'push', d: t }) };
};
const mk = (id) => ({ id, secret: 's' + id, name: 'P' + id, avatar: { emoji: '🦊', color: '#ff0000' } });

function setup(mode, n = 4, extra = {}) {
  const out = fakeOut();
  const r = new Room('ABC', mk('1'), { gameMode: mode, headStartSec: 0, ...extra }, area, out);
  for (let i = 2; i <= n; i++) assert.ok(r.addPlayer(mk(String(i))).ok);
  assert.deepStrictEqual(r.start('1', { random: false, seekerIds: ['1'] }), { ok: true });
  return { r, out };
}

test('random seeker count is 20-25% and at least 1', () => {
  assert.strictEqual(randomSeekerCount(2), 1);
  assert.strictEqual(randomSeekerCount(4), 1);
  for (let i = 0; i < 50; i++) { const c = randomSeekerCount(20); assert.ok(c >= 4 && c <= 5); }
});

test('point in polygon', () => {
  assert.ok(pointInPolygon(0.5, 0.5, area));
  assert.ok(!pointInPolygon(1.5, 0.5, area));
});

test('elimination: tagged hiders are out, last hider wins', () => {
  const { r } = setup('elimination');
  assert.ok(r.reportTagged('2').ok);
  assert.strictEqual(r.players.get('2').role, 'out');
  assert.ok(r.reportTagged('3', '1').ok);
  assert.strictEqual(r.state, 'ended');
  assert.deepStrictEqual(r.result.winnerIds, ['4']);
});

test('infection: confirmed tag turns hider into seeker, needs seeker confirmation', () => {
  const { r, out } = setup('infection');
  assert.strictEqual(r.reportTagged('2').ok, false); // must pick seeker
  const res = r.reportTagged('2', '1');
  assert.ok(res.pending);
  assert.ok(out.sent.some((m) => m.id === '1' && m.e === 'tagRequest'));
  r.confirmTag('1', res.tagId, false);
  assert.strictEqual(r.players.get('2').role, 'hider');
  const res2 = r.reportTagged('2', '1');
  r.confirmTag('1', res2.tagId, true);
  assert.strictEqual(r.players.get('2').role, 'seeker');
  // new seeker 2 tags 3 -> only 4 left -> 4 wins
  const res3 = r.reportTagged('3', '2');
  r.confirmTag('2', res3.tagId, true);
  assert.strictEqual(r.state, 'ended');
  assert.deepStrictEqual(r.result.winnerIds, ['4']);
});

test('swap: roles flip and new seeker is frozen; timer end = hiders win', () => {
  const { r } = setup('swap', 3, { swapFreezeSec: 45 });
  const t = r.reportTagged('2', '1');
  r.confirmTag('1', t.tagId, true);
  assert.strictEqual(r.players.get('2').role, 'seeker');
  assert.strictEqual(r.players.get('1').role, 'hider');
  assert.ok(r.players.get('2').frozenUntil > Date.now() + 40000);
  r.endsAt = Date.now() - 1;
  r.tick();
  assert.strictEqual(r.state, 'ended');
  assert.deepStrictEqual(r.result.winnerIds.sort(), ['1', '3']);
});

test('out of bounds too long = out', () => {
  const { r } = setup('elimination', 3, { outOfBoundsSec: 0 });
  r.updateLocation('2', { lat: 5, lng: 5 });
  assert.ok(r.players.get('2').outOfBoundsSince);
  r.players.get('2').outOfBoundsSince -= 2000;
  r.tick();
  assert.strictEqual(r.players.get('2').role, 'out');
  assert.strictEqual(r.state, 'ended'); // only hider 3 left of 2 starting hiders
});

test('pings: seekers only see hiders at ping time in interval mode', () => {
  const { r } = setup('elimination', 3, { pingIntervalSec: 60 });
  r.updateLocation('2', { lat: 0.5, lng: 0.5, at: Date.now() });
  assert.strictEqual(r.positionsFor('1').length, 0); // start ping happened before location
  r.lastPingAt = Date.now() - 61000;
  r.tick();
  assert.strictEqual(r.positionsFor('1').find((p) => p.id === '2').kind, 'ping');
  assert.strictEqual(r.positionsFor('2').length, 0); // hider sees nobody
});

test('leaving bans rejoin', () => {
  const { r } = setup('elimination', 4);
  r.leave('4');
  assert.strictEqual(r.addPlayer(mk('4')).ok, false);
});
