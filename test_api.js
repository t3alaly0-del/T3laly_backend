/**
 * T3LALY API — Regression Test Suite
 * Run: node test_api.js
 * Make sure your server is running first!
 */

//const BASE = 'http://192.168.1.10:3000/api';
const BASE = 'https://t3lalybackend-production.up.railway.app/api';


// ── Helpers ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function log(label, ok, detail = '') {
  if (ok) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ' → ' + detail : ''}`);
    failed++;
    failures.push(`${label}${detail ? ': ' + detail : ''}`);
  }
}

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, body: json };
}

// ── Test sections ──────────────────────────────────────────────────────────

async function testHealth() {
  console.log('\n📡 Health Check');
  //const res = await fetch(`http://192.168.1.10:3000/`);
  const res = await fetch(`https://t3lalybackend-production.up.railway.app/`);
  const json = await res.json();
  log('Server is running', res.status === 200 && json.status?.includes('running'));
}

// ── GAMES ──────────────────────────────────────────────────────────────────

async function testGames() {
  console.log('\n🎮 Games');

  // GET all games
  const all = await req('GET', '/game');
  log('GET /game — returns array', all.status === 200 && Array.isArray(all.body));

  const gameId = all.body?.[0]?.id;
  if (!gameId) { log('At least one game exists (needed for next tests)', false, 'No games in DB'); return null; }
  log('Game has id, name, status', all.body[0].id && all.body[0].name && all.body[0].status);

  // GET single game
  const one = await req('GET', `/game/${gameId}`);
  log(`GET /game/${gameId} — 200`, one.status === 200);
  log('Response has game + details keys', one.body?.game && one.body?.details !== undefined);

  // PATCH game
  const original = one.body.game;
  const patch = await req('PATCH', `/game/${gameId}`, {
    name: original.name,
    status: original.status,
    min_players: one.body.details?.min_players ?? 3,
  });
  log('PATCH /game/:id — 200', patch.status === 200);

  // GET /game/:id/cards
  const cards = await req('GET', `/game/${gameId}/cards`);
  log('GET /game/:id/cards — array', cards.status === 200 && Array.isArray(cards.body));

  return gameId;
}

// ── CARDS (admin) ──────────────────────────────────────────────────────────

async function testCards(gameId) {
  console.log('\n🃏 Cards');

  // GET cards for game
  const get = await req('GET', `/cards/${gameId}`);
  log('GET /cards/:game_id — 200', get.status === 200);
  log('Response has details array', Array.isArray(get.body?.details));

  // GET game-screen cards
  const screen = await req('GET', `/cards/game-screen/${gameId}`);
  log('GET /cards/game-screen/:game_id — 200', screen.status === 200);
  log('Game-screen returns object (not array)', screen.body && !Array.isArray(screen.body));

  // Add a temp card to test update/delete
  const add = await req('POST', `/game/${gameId}/cards`, {
    name: '__TEST_CARD__',
    score: 1.0,
    quantity: 5,
    detailed_desc: 'test',
    abstract_desc: 'test',
    emoji: '🧪',
    is_one_time: false,
  });
  log('POST /game/:id/cards — 201', add.status === 201);
  const cardId = add.body?.id;

  if (cardId) {
    // PATCH score
    const patchScore = await req('PATCH', `/cards/details/${cardId}`, { score: 2.0 });
    log('PATCH /cards/details/:id (score) — 200', patchScore.status === 200);

    // PATCH is_one_time
    const patchOneTime = await req('PATCH', `/cards/details/${cardId}`, { is_one_time: true });
    log('PATCH /cards/details/:id (is_one_time) — 200', patchOneTime.status === 200);

    // DELETE card
    const del = await req('DELETE', `/game/cards/${cardId}`);
    log('DELETE /game/cards/:id — 200', del.status === 200);

    // Confirm deleted
    const check = await req('GET', `/game/${gameId}/cards`);
    const stillExists = check.body?.some?.(c => c.id === cardId);
    log('Card is actually deleted', !stillExists);
  }

  // Duplicate card
  await req('POST', `/game/${gameId}/cards`, { name: '__DUP__', score: 1, quantity: 1, emoji: '🔁', detailed_desc: '', abstract_desc: '' });
  const dup = await req('POST', `/game/${gameId}/cards`, { name: '__DUP__', score: 1, quantity: 1, emoji: '🔁', detailed_desc: '', abstract_desc: '' });
  log('Duplicate card returns 409', dup.status === 409);
  // clean up dup
  const allCards = await req('GET', `/game/${gameId}/cards`);
  const dupCard = allCards.body?.find(c => c.name === '__DUP__');
  if (dupCard) await req('DELETE', `/game/cards/${dupCard.id}`);
}

// ── CATEGORIES ─────────────────────────────────────────────────────────────

async function testCategories(gameId) {
  console.log('\n📂 Categories');

  const getAll = await req('GET', `/cards/categories/${gameId}`);
  log('GET /cards/categories/:game_id — 200', getAll.status === 200);
  log('Categories is array', Array.isArray(getAll.body));

  // Add
  const add = await req('POST', '/cards/categories', { name: '__TEST_CAT__', emoji: '🧪', game_id: gameId });
  log('POST /cards/categories — 201', add.status === 201);
  const catId = add.body?.id;

  if (catId) {
    // Update
    const update = await req('PATCH', `/cards/categories/${catId}`, { name: '__TEST_CAT_UPDATED__', emoji: '✏️' });
    log('PATCH /cards/categories/:id — 200', update.status === 200);
    log('Name updated correctly', update.body?.name === '__TEST_CAT_UPDATED__');

    // Duplicate
    const dup = await req('POST', '/cards/categories', { name: '__TEST_CAT_UPDATED__', emoji: '🧪', game_id: gameId });
    log('Duplicate category returns 409', dup.status === 409);

    // Delete
    const del = await req('DELETE', `/cards/categories/${catId}`);
    log('DELETE /cards/categories/:id — 200', del.status === 200);
  }
}

// ── JUDGES ─────────────────────────────────────────────────────────────────

async function testJudges(gameId) {
  console.log('\n⚖️  Judges');

  // GET judge categories
  const cats = await req('GET', `/admin/judge-categories/${gameId}`);
  log('GET /admin/judge-categories/:game_id — 200', cats.status === 200);
  log('Returns array', Array.isArray(cats.body));

  const judgeCatId = cats.body?.[0]?.id;
  if (!judgeCatId) { log('At least one judge category exists', false, 'None found'); return; }

  // GET judges
  const judges = await req('GET', `/admin/judges/${gameId}`);
  log('GET /admin/judges/:game_id — 200', judges.status === 200);

  // ADD judge
  const add = await req('POST', '/admin/judges', {
    judge_categories_id: judgeCatId,
    description: '__TEST_JUDGE__',
  });
  log('POST /admin/judges — 201', add.status === 201);
  const judgeId = add.body?.id;

  if (judgeId) {
    // UPDATE
    const update = await req('PATCH', `/admin/judges/${judgeId}`, {
      description: '__TEST_JUDGE_UPDATED__',
      status: 'on',
    });
    log('PATCH /admin/judges/:id — 200', update.status === 200);

    // DUPLICATE
    const dup = await req('POST', '/admin/judges', {
      judge_categories_id: judgeCatId,
      description: '__TEST_JUDGE_UPDATED__',
    });
    log('Duplicate judge returns 409', dup.status === 409);

    // DELETE
    const del = await req('DELETE', `/admin/judges/${judgeId}`);
    log('DELETE /admin/judges/:id — 200', del.status === 200);
  }
}

// ── RULES ──────────────────────────────────────────────────────────────────

async function testRules(gameId) {
  console.log('\n📜 Rules');

  const get = await req('GET', `/admin/rules/${gameId}`);
  log('GET /admin/rules/:game_id — 200', get.status === 200);
  log('Returns array', Array.isArray(get.body));

  const add = await req('POST', '/admin/rules', {
    name: '__TEST_RULE__',
    description: 'test description',
    game_id: gameId,
  });
  log('POST /admin/rules — 201', add.status === 201);
  const ruleId = add.body?.id;

  if (ruleId) {
    const update = await req('PATCH', `/admin/rules/${ruleId}`, {
      name: '__TEST_RULE_UPDATED__',
      description: 'updated',
    });
    log('PATCH /admin/rules/:id — 200', update.status === 200);

    const del = await req('DELETE', `/admin/rules/${ruleId}`);
    log('DELETE /admin/rules/:id — 200', del.status === 200);
  }
}

// ── CARD TYPES ─────────────────────────────────────────────────────────────

async function testCardTypes() {
  console.log('\n🏷️  Card Types');
  const get = await req('GET', '/admin/card-types');
  log('GET /admin/card-types — 200', get.status === 200);
  log('Returns array', Array.isArray(get.body));
  log('Has at least one type', get.body?.length > 0);
}

// ── CODES ──────────────────────────────────────────────────────────────────

async function testCodes(gameId) {
  console.log('\n🔑 Codes');

  // GET codes
  const get = await req('GET', `/codes/game/${gameId}`);
  log('GET /codes/game/:game_id — 200', get.status === 200);
  log('Returns array', Array.isArray(get.body));

  // GENERATE codes
  const gen = await req('POST', '/codes/generate', {
    game_id: gameId,
    count: 2,
    length: 6,
    numericOnly: false,
  });
  log('POST /codes/generate — 200', gen.status === 200);
  log('Generated array returned', Array.isArray(gen.body?.generated));
  log('Generated count = 2', gen.body?.generated?.length === 2);

  const codeId = gen.body?.generated?.[0]?.id;
  const hashCode = gen.body?.generated?.[0]?.hash_code;

  if (codeId) {
    // UPDATE code status
    const update = await req('PATCH', `/codes/details/${codeId}`, { status: 'close' });
    log('PATCH /codes/details/:id (status) — 200', update.status === 200);
    log('Status updated to close', update.body?.status === 'close');

    // Reopen
    await req('PATCH', `/codes/details/${codeId}`, { status: 'open' });

    // DELETE single code
    const del = await req('DELETE', `/codes/details/${codeId}`);
    log('DELETE /codes/details/:id — 200', del.status === 200);
  }

  // DELETE second generated code
  const codeId2 = gen.body?.generated?.[1]?.id;
  if (codeId2) await req('DELETE', `/codes/details/${codeId2}`);

  // INSERT manual code
  const insert = await req('POST', '/codes/insert', {
    game_id: gameId,
    code: 'TEST-MANUAL-001',
  });
  log('POST /codes/insert — 201', insert.status === 201);
  const insertedId = insert.body?.id;

  // Duplicate insert
  const dup = await req('POST', '/codes/insert', {
    game_id: gameId,
    code: 'TEST-MANUAL-001',
  });
  log('Duplicate code insert returns 409', dup.status === 409);

  if (insertedId) {
    await req('DELETE', `/codes/details/${insertedId}`);
    log('Cleanup: inserted code deleted', true);
  }

  // DELETE used codes (should return count)
  const delUsed = await req('DELETE', `/codes/game/${gameId}/used`);
  log('DELETE /codes/game/:id/used — 200', delUsed.status === 200);
  log('Returns deleted count', typeof delUsed.body?.deleted === 'number');
}

// ── ACTIVATE CODE (mobile flow) ────────────────────────────────────────────

async function testActivation(gameId) {
  console.log('\n📱 Code Activation (mobile flow)');

  // Generate a fresh code for activation test
  const gen = await req('POST', '/codes/generate', {
    game_id: gameId,
    count: 1,
    length: 6,
    numericOnly: false,
  });
  const testCode = gen.body?.generated?.[0];
  if (!testCode) { log('Could not generate code for activation test', false); return; }

  const deviceId = 'test-device-regression-' + Date.now();

  // Activate
  const activate = await req('POST', '/codes/activate', {
    hash_code: testCode.hash_code,
    device_identifier: deviceId,
  });
  log('POST /codes/activate — 200', activate.status === 200);
  log('Returns device_token', !!activate.body?.token);
  log('Returns restore_code', !!activate.body?.restore_code);
  log('Returns game_id', !!activate.body?.game_id);

  const restoreCode = activate.body?.restore_code;

  // Activate again same device → should return same token
  const reactivate = await req('POST', '/codes/activate', {
    hash_code: testCode.hash_code,
    device_identifier: deviceId,
  });
  log('Re-activate same device — 200', reactivate.status === 200);
  log('Returns same token', reactivate.body?.token === activate.body?.token);

  // Activate same code from different device → 403
  const otherDevice = await req('POST', '/codes/activate', {
    hash_code: testCode.hash_code,
    device_identifier: 'another-device-xyz',
  });
  log('Activate used code from different device — 403', otherDevice.status === 403);

  // Restore
  if (restoreCode) {
    const restore = await req('POST', '/codes/restore', {
      restore_code: restoreCode,
      device_identifier: deviceId,
    });
    log('POST /codes/restore — 200', restore.status === 200);
    log('Restore returns token', !!restore.body?.token);

    // Wrong device restore → 403
    const badRestore = await req('POST', '/codes/restore', {
      restore_code: restoreCode,
      device_identifier: 'wrong-device',
    });
    log('Restore wrong device — 403', badRestore.status === 403);
  }

  // Invalid code → 404
  const bad = await req('POST', '/codes/activate', {
    hash_code: 'INVALID-CODE-XYZ',
    device_identifier: deviceId,
  });
  log('Activate invalid code — 404', bad.status === 404);

  // Clean up the test code
  await req('DELETE', `/codes/details/${testCode.id}`);
}

// ── Game-screen endpoint integrity ─────────────────────────────────────────

async function testGameScreenIntegrity(gameId) {
  console.log('\n🖥️  Game Screen Integrity');

  const screen = await req('GET', `/cards/game-screen/${gameId}`);
  log('GET /cards/game-screen/:game_id — 200', screen.status === 200);

  if (screen.body) {
    const keys = Object.keys(screen.body);
    log('Has at least one card key', keys.length > 0);
    const first = screen.body[keys[0]];
    log('Each card has name', !!first?.name);
    log('Each card has score', first?.score !== undefined);
    log('Each card has emoji', !!first?.emoji);
    log('Each card has abstract_desc', first?.abstract_desc !== undefined);
    log('Each card has detailed_desc', first?.detailed_desc !== undefined);
  }
}

// ── Edge cases ─────────────────────────────────────────────────────────────

async function testEdgeCases() {
  console.log('\n⚠️  Edge Cases');

  // Non-existent game
  const bad = await req('GET', '/game/999999');
  log('GET non-existent game — 404', bad.status === 404);

  // Generate codes with invalid length
  const badLen = await req('POST', '/codes/generate', {
    game_id: 1, count: 1, length: 7, numericOnly: false,
  });
  log('Generate codes with invalid length — 400', badLen.status === 400);

  // Insert code without game_id
  const noGame = await req('POST', '/codes/insert', { code: 'ABC123' });
  log('Insert code without game_id — 400', noGame.status === 400);

  // PATCH card with nothing to update
  const noFields = await req('PATCH', '/cards/details/1', {});
  log('PATCH card with no fields — 400', noFields.status === 400);
}

// ── Main ───────────────────────────────────────────────────────────────────

async function run() {
  console.log('═══════════════════════════════════════════════');
  console.log('     T3LALY API — Regression Test Suite');
  console.log('═══════════════════════════════════════════════');
  console.log(`Target: ${BASE}`);
  console.log(`Time:   ${new Date().toLocaleString()}`);

  try {
    await testHealth();
    const gameId = await testGames();

    if (gameId) {
      await testCards(gameId);
      await testCategories(gameId);
      await testJudges(gameId);
      await testRules(gameId);
      await testCardTypes();
      await testCodes(gameId);
      await testActivation(gameId);
      await testGameScreenIntegrity(gameId);
    }

    await testEdgeCases();

  } catch (err) {
    console.error('\n💥 Test runner crashed:', err.message);
    console.error('   Is your server running at', BASE, '?');
  }

  // ── Summary ──────────────────────────────
  const total = passed + failed;
  console.log('\n═══════════════════════════════════════════════');
  console.log(`  Results: ${passed}/${total} passed`);
  if (failed > 0) {
    console.log(`\n  ❌ Failed tests (${failed}):`);
    failures.forEach(f => console.log(`     • ${f}`));
  } else {
    console.log('  🎉 All tests passed!');
  }
  console.log('═══════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

run();