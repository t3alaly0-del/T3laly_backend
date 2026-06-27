const db     = require('../config/db');
const crypto = require('crypto');

// ── Helpers ────────────────────────────────────────────────────────────────

const ALPHA_CHARS   = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars — no ambiguous 0/O/1/I/l
const NUMERIC_CHARS = '0123456789';

// Cryptographically unbiased random character
function randomChar(charset) {
  const max = Math.floor(256 / charset.length) * charset.length;
  let b;
  do { b = crypto.randomBytes(1)[0]; } while (b >= max);
  return charset[b % charset.length];
}

function generateRaw(length, numericOnly) {
  const charset = numericOnly ? NUMERIC_CHARS : ALPHA_CHARS;
  return Array.from({ length }, () => randomChar(charset)).join('');
}

function formatCode(raw) {
  const n = raw.length;
  if (n === 6)  return `${raw.slice(0,3)}-${raw.slice(3)}`;
  if (n === 8)  return `${raw.slice(0,2)}-${raw.slice(2,6)}-${raw.slice(6)}`;
  if (n === 10) return `${raw.slice(0,3)}-${raw.slice(3,7)}-${raw.slice(7)}`;
  return raw; // fallback — store as-is
}

// Strip leading/trailing whitespace and uppercase — no format restrictions
function normalizeManualCode(raw) {
  const normalized = raw.trim().toUpperCase();
  if (normalized.length === 0) return { error: 'الكود فاضي' };
  return { code: normalized };
}

// Get or create the single code-bucket row for this game
async function getOrCreateBucket(game_id) {
  const existing = await db.query(`SELECT id FROM code WHERE game_id = $1`, [game_id]);
  if (existing.rows.length > 0) return existing.rows[0].id;
  const created = await db.query(
    `INSERT INTO code (game_id) VALUES ($1) RETURNING id`, [game_id]
  );
  return created.rows[0].id;
}

// ── Mobile: activate code ──────────────────────────────────────────────────

exports.activateCode = async (req, res) => {
  const { hash_code, device_identifier } = req.body;
  try {
    const result = await db.query(
      `SELECT cd.*, d.id as device_row_id, d.device_identifier as dev_id, d.device_token, d.restore_code
       FROM code_details cd
       LEFT JOIN device d ON d.code_details_id = cd.id
       WHERE cd.hash_code = $1`,
      [hash_code]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Code not found' });

    const code = result.rows[0];

    if (code.used) {
      if (code.dev_id === device_identifier)
        return res.json({ token: code.device_token, restore_code: code.restore_code });
      return res.status(403).json({ error: 'Code already used by another device' });
    }
    if (code.status === 'close')
      return res.status(403).json({ error: 'Code is closed' });
    if (code.end_date !== null && new Date(code.end_date) <= new Date())
      return res.status(403).json({ error: 'Code expired' });

    const device_token = crypto.randomBytes(32).toString('hex');
    const restore_code = 'RST-' + crypto.randomBytes(6).toString('hex').toUpperCase();

    await db.query(`UPDATE code_details SET used = true WHERE id = $1`, [code.id]);
    // Get game_id from code chain
    const gameResult = await db.query(
      `SELECT c.game_id FROM code c
       JOIN code_details cd ON cd.code_id = c.id
       WHERE cd.id = $1`,
      [code.id]
    );
    const game_id = gameResult.rows[0]?.game_id;

    // Save device
    await db.query(
      `INSERT INTO device 
       (device_identifier, restore_code, code_details_id, device_token, device_token_issued_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [device_identifier, restore_code, code.id, device_token]
    );

    return res.json({ token: device_token, restore_code, game_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ── Mobile: restore after reinstall ───────────────────────────────────────

exports.restoreCode = async (req, res) => {
  const { restore_code, device_identifier } = req.body;
  try {
    const result = await db.query(
      `SELECT * FROM device WHERE restore_code = $1`, [restore_code]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Restore code not found' });
    const device = result.rows[0];
    if (device.device_identifier !== device_identifier)
      return res.status(403).json({ error: 'This restore code belongs to a different device' });
    return res.json({ token: device.device_token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ── Admin: list codes for a game ──────────────────────────────────────────

exports.getGameCodes = async (req, res) => {
  const { game_id } = req.params;
  try {
    const result = await db.query(
      `SELECT cd.id, cd.hash_code, cd.status, cd.used, cd.end_date,
              d.device_identifier, d.device_token_issued_at
       FROM code_details cd
       JOIN code c ON c.id = cd.code_id
       LEFT JOIN device d ON d.code_details_id = cd.id
       WHERE c.game_id = $1
       ORDER BY cd.id DESC`,
      [game_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ── Admin: generate codes ──────────────────────────────────────────────────
// Body: { game_id, count, length (8|10|12), numericOnly (bool) }

exports.generateCodes = async (req, res) => {
  const { game_id, count = 10, length = 6, numericOnly = false } = req.body;

  if (![6, 8, 10].includes(Number(length)))
    return res.status(400).json({ error: 'length must be 6, 8, or 10' });

  const safeCount = Math.min(Math.max(Number(count), 1), 100);

  try {
    const code_id = await getOrCreateBucket(game_id);
    const generated = [];

    for (let i = 0; i < safeCount; i++) {
      let hash_code, inserted;
      let attempts = 0;
      do {
        hash_code = formatCode(generateRaw(Number(length), numericOnly));
        const result = await db.query(
          `INSERT INTO code_details (code_id, hash_code)
           VALUES ($1, $2)
           ON CONFLICT (hash_code) DO NOTHING
           RETURNING id, hash_code`,
          [code_id, hash_code]
        );
        inserted = result.rows.length > 0;
        attempts++;
        if (attempts > 20) throw new Error('Too many collision retries — try again');
      } while (!inserted);

      generated.push({ id: inserted ? undefined : null, hash_code });
      // re-fetch to get the id
      const row = await db.query(
        `SELECT id, hash_code, status, used, end_date FROM code_details WHERE hash_code = $1`,
        [hash_code]
      );
      generated[generated.length - 1] = row.rows[0];
    }

    res.json({ generated, count: generated.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
};

// ── Admin: manually insert a single code ──────────────────────────────────
// Body: { game_id, code, numericOnly? }

exports.insertCode = async (req, res) => {
  const { game_id, code } = req.body;
  if (!code || !game_id)
    return res.status(400).json({ error: 'game_id and code are required' });

  const { code: normalized, error } = normalizeManualCode(code);
  if (error) return res.status(400).json({ error });

  try {
    const code_id = await getOrCreateBucket(game_id);

    const result = await db.query(
      `INSERT INTO code_details (code_id, hash_code)
       VALUES ($1, $2)
       ON CONFLICT (hash_code) DO NOTHING
       RETURNING id, hash_code, status, used, end_date`,
      [code_id, normalized]
    );

    if (result.rows.length === 0)
      return res.status(409).json({ error: 'هذا الكود موجود بالفعل' });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ── Admin: update code status / close ─────────────────────────────────────
// Body: { status? ('open'|'close'), used? (bool), end_date? }

exports.updateCode = async (req, res) => {
  const { id } = req.params;
  const { status, used, end_date } = req.body;

  const fields = [];
  const values = [];
  let idx = 1;
  if (used     !== undefined) { fields.push(`used     = $${idx++}`); values.push(used); }
  if (end_date !== undefined) {
    fields.push(`end_date = $${idx++}`); values.push(end_date);
    if (status === undefined) {
      // close only if end_date is today or in the past; future date keeps it open
      const isExpired = end_date !== null && new Date(end_date) <= new Date();
      fields.push(`status = $${idx++}`); values.push(isExpired ? 'close' : 'open');
    }
  }
  if (status !== undefined) { fields.push(`status = $${idx++}`); values.push(status); }
  if (fields.length === 0)
    return res.status(400).json({ error: 'Nothing to update' });

  values.push(id);
  try {
    const result = await db.query(
      `UPDATE code_details SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ── Admin: delete a single code ───────────────────────────────────────────

exports.deleteCode = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(`DELETE FROM code_details WHERE id = $1`, [id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ── Admin: delete all used codes for a game ───────────────────────────────

exports.deleteUsedCodes = async (req, res) => {
  const { game_id } = req.params;
  try {
    const result = await db.query(
      `DELETE FROM code_details cd
       USING code c
       WHERE cd.code_id = c.id AND c.game_id = $1 AND cd.used = true
       RETURNING cd.id`,
      [game_id]
    );
    res.json({ deleted: result.rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};
