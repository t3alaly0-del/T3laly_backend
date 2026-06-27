const db = require('../config/db');

// ── CARD TYPES ────────────────────────────

// GET /api/admin/card-types
exports.getCardTypes = async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM card_type ORDER BY id`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ── JUDGE CATEGORIES ──────────────────────

// GET /api/admin/judge-categories/:game_id
exports.getJudgeCategories = async (req, res) => {
  const { game_id } = req.params;
  try {
    const result = await db.query(
      `SELECT * FROM judge_categories WHERE game_id = $1 ORDER BY id`,
      [game_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ── JUDGES ────────────────────────────────

// GET /api/admin/judges/:game_id
exports.getJudges = async (req, res) => {
  const { game_id } = req.params;
  try {
    const result = await db.query(
      `SELECT jd.*, jc.name as category_name
       FROM judge_details jd
       JOIN judge_categories jc ON jc.id = jd.judge_categories_id
       WHERE jc.game_id = $1
       ORDER BY jc.name, jd.id`,
      [game_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/admin/judges
exports.addJudge = async (req, res) => {
  const { judge_categories_id, description } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO judge_details (judge_categories_id, description, status)
       VALUES ($1, $2, 'on') RETURNING *`,
      [judge_categories_id, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'الحكم ده موجود بالفعل ⚠️' });
    }
    res.status(500).json({ error: 'Server error' });
  }
};

// PATCH /api/admin/judges/:id
exports.updateJudge = async (req, res) => {
  const { id } = req.params;
  const { description, status } = req.body;
  try {
    const result = await db.query(
      `UPDATE judge_details SET description=$1, status=$2 WHERE id=$3 RETURNING *`,
      [description, status, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ error: 'الحكم ده موجود بالفعل ⚠️' });
    res.status(500).json({ error: 'Server error' });
  }
};

// DELETE /api/admin/judges/:id
exports.deleteJudge = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(`DELETE FROM judge_details WHERE id = $1`, [id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// ── RULES ─────────────────────────────────

// GET /api/admin/rules/:game_id
exports.getRules = async (req, res) => {
  const { game_id } = req.params;
  try {
    const result = await db.query(
      `SELECT * FROM rules_details WHERE game_id = $1`, [game_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/admin/rules
exports.addRule = async (req, res) => {
  const { name, description, game_id } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO rules_details (name, description, game_id)
       VALUES ($1,$2,$3) RETURNING *`,
      [name, description, game_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// PATCH /api/admin/rules/:id
exports.updateRule = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  try {
    const result = await db.query(
      `UPDATE rules_details SET name=$1, description=$2 WHERE id=$3 RETURNING *`,
      [name, description, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// DELETE /api/admin/rules/:id
exports.deleteRule = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(`DELETE FROM rules_details WHERE id = $1`, [id]);
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};