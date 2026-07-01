const db = require('../config/db');

// GET /api/cards/:game_id — get all card types (with scores) for a game
exports.getCards = async (req, res) => {
  const { game_id } = req.params;
  try {
    const result = await db.query(
      `SELECT id, name, emoji, score, quantity FROM card WHERE game_id = $1 ORDER BY id`,
      [game_id]
    );
    res.json({ details: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
exports.getGameScreenCards = async (req, res) => {
  const { game_id } = req.params;

  try {
    const result = await db.query(
      `
      SELECT
        name,
        emoji,
        score,
        abstract_desc,
        detailed_desc
      FROM card
      WHERE game_id = $1
      `,
      [game_id]
    );

    const response = {};

    result.rows.forEach(card => {
      response[card.name.toLowerCase()] = card;
    });

    res.json(response);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: 'Server error',
    });
  }
};

// PATCH /api/cards/details/:id — admin: update score and/or quantity on card type
exports.updateCardDetail = async (req, res) => {
  const { id } = req.params;
  const { score, quantity, is_one_time } = req.body;

  const fields = [];
  const values = [];
  let idx = 1;
  if (score       !== undefined) { fields.push(`score       = $${idx++}`); values.push(score); }
  if (quantity    !== undefined) { fields.push(`quantity    = $${idx++}`); values.push(quantity); }
  if (is_one_time !== undefined) { fields.push(`is_one_time = $${idx++}`); values.push(is_one_time); }
  if (fields.length === 0)
    return res.status(400).json({ error: 'Nothing to update' });

  values.push(id);
  try {
    const result = await db.query(
      `UPDATE card SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ── GET categories ─────────────────────────
exports.getCategories = async (req, res) => {
  const { game_id } = req.params;
  try {
    const cat = await db.query(
      `SELECT id FROM card_categories WHERE game_id = $1`, [game_id]
    );
    if (!cat.rows[0]) return res.json([]);

    const result = await db.query(
      `SELECT ccd.*,
        COALESCE(json_agg(sc.*) FILTER (WHERE sc.id IS NOT NULL), '[]') as stickers
       FROM card_categories_details ccd
       LEFT JOIN stickers_categories sc ON sc.card_categories_details_id = ccd.id
       WHERE ccd.categories_id = $1
       GROUP BY ccd.id
       ORDER BY ccd.id`,
      [cat.rows[0].id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ── ADD category ───────────────────────────
exports.addCategory = async (req, res) => {
  const { name, emoji, detailed_desc, abstract_desc, game_id } = req.body;
  try {
    let cat = await db.query(
      `SELECT id FROM card_categories WHERE game_id = $1`, [game_id]
    );
    let categories_id;
    if (!cat.rows[0]) {
      const newCat = await db.query(
        `INSERT INTO card_categories (game_id) VALUES ($1) RETURNING id`, [game_id]
      );
      categories_id = newCat.rows[0].id;
    } else {
      categories_id = cat.rows[0].id;
    }

    const result = await db.query(
      `INSERT INTO card_categories_details
       (name, emoji, categories_id)
       VALUES ($1,$2,$3) RETURNING *`,
      [name, emoji || '📌', categories_id]
    );
    res.status(201).json({ ...result.rows[0], stickers: [] });
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ error: 'الكاتيجوري دي موجودة بالفعل ⚠️' });
    res.status(500).json({ error: 'Server error' });
  }
};

// ── UPDATE category ────────────────────────
exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, emoji } = req.body;
  try {
    const result = await db.query(
      `UPDATE card_categories_details
       SET name=$1, emoji=$2
       WHERE id=$3 RETURNING *`,
      [name, emoji || '📌', id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ error: 'الكاتيجوري دي موجودة بالفعل ⚠️' });
    res.status(500).json({ error: 'Server error' });
  }
};

// ── DELETE category ────────────────────────
exports.deleteCategory = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(`DELETE FROM card_categories_details WHERE id = $1`, [id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ── GET stickers ───────────────────────────
exports.getStickers = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT * FROM stickers_categories
       WHERE card_categories_details_id = $1
       ORDER BY created_at`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ── ADD sticker ────────────────────────────
// ── ADD sticker (file upload) ──────────────
exports.addSticker = async (req, res) => {
  const { id } = req.params;
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const sticker_url = req.file.path;
    const sticker_name = req.body.sticker_name || '';

    const result = await db.query(
      `INSERT INTO stickers_categories
       (card_categories_details_id, sticker_url, sticker_name)
       VALUES ($1,$2,$3) RETURNING *`,
      [id, sticker_url, sticker_name]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ── DELETE sticker ─────────────────────────
exports.deleteSticker = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(`DELETE FROM stickers_categories WHERE id = $1`, [id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};