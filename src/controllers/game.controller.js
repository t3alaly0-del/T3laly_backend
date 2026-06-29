const db = require('../config/db');

// GET /api/game  — get all games with description from game_details
exports.getAllGames = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT g.id, g.name, g.content_version, g.status, gd.description
      FROM game g
      LEFT JOIN game_details gd ON gd.game_id = g.id
      ORDER BY g.id
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/game/:id  — get full game content (app uses this to download everything)
exports.getGameContent = async (req, res) => {
  const { id } = req.params;
  try {
    const game         = await db.query(`SELECT * FROM game WHERE id = $1`, [id]);
    const details      = await db.query(`SELECT * FROM game_details WHERE game_id = $1`, [id]);
    const rules        = await db.query(`SELECT * FROM rules_details WHERE game_id = $1`, [id]);
    const cardRow      = await db.query(`SELECT * FROM card WHERE game_id = $1`, [id]);
    const card_details = await db.query(`SELECT * FROM card_details WHERE card_id = $1`, [cardRow.rows[0]?.id]);
    const categories   = await db.query(`SELECT * FROM card_categories WHERE game_id = $1`, [id]);
    const cat_details  = await db.query(
      `SELECT * FROM card_categories_details WHERE categories_id = $1`,
      [categories.rows[0]?.id]
    );
    const judge_cats   = await db.query(`SELECT * FROM judge_categories WHERE game_id = $1`, [id]);
    const judges       = await db.query(
      `SELECT jd.* FROM judge_details jd
       JOIN judge_categories jc ON jc.id = jd.judge_categories_id
       WHERE jc.game_id = $1 AND jd.status = 'on'`, [id]
    );

    if (game.rows.length === 0)
      return res.status(404).json({ error: 'Game not found' });

    res.json({
      game:            game.rows[0],
      details:         details.rows[0],
      rules:           rules.rows,
      card:            cardRow.rows[0],
      card_details:    card_details.rows,
      categories:      categories.rows[0],
      cat_details:     cat_details.rows,
      judge_categories:judge_cats.rows,
      judges:          judges.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// PATCH /api/game/:id/status  — admin: freeze or open game
// PATCH /api/game/:id
exports.updateGame = async (req, res) => {
  const { id } = req.params;
  const { name, status, min_players } = req.body;
  try {
    // Update game name and status
    const gameResult = await db.query(
      `UPDATE game SET name=$1, status=$2 WHERE id=$3 RETURNING *`,
      [name, status, id]
    );
    // Update min_players in game_details
    await db.query(
      `UPDATE game_details SET min_players=$1 WHERE game_id=$2`,
      [min_players, id]
    );
    const details = await db.query(
      `SELECT * FROM game_details WHERE game_id=$1`, [id]
    );
    res.json({ ...gameResult.rows[0], ...details.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// PATCH /api/game/:id/status
exports.updateGameStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['open', 'freeze'].includes(status))
    return res.status(400).json({ error: 'Status must be open or freeze' });
  try {
    const result = await db.query(
      `UPDATE game SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// PATCH /api/game/:id/bump-version  — admin: bump content version (triggers app re-download)
exports.bumpVersion = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      `UPDATE game SET content_version = content_version + 1 WHERE id = $1 RETURNING *`,
      [id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/game/:id/cards
exports.getGameCards = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT * FROM card WHERE game_id=$1 ORDER BY id`, [id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/game/:id/cards
exports.addGameCard = async (req, res) => {
  const { id } = req.params;
  const { name, score, quantity, detailed_desc, abstract_desc, emoji } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO card (name, score, quantity, detailed_desc, abstract_desc, emoji, game_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, score, quantity || 10, detailed_desc || '', abstract_desc || '', emoji || '🃏', id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ error: 'الكارت ده موجود بالفعل ⚠️' });
    res.status(500).json({ error: 'Server error' });
  }
};

// PATCH /api/game/cards/:id
exports.updateGameCard = async (req, res) => {
  const { id } = req.params;
  const { name, score, quantity, detailed_desc, abstract_desc, emoji } = req.body;
  try {
    const result = await db.query(
      `UPDATE card SET name=$1, score=$2, quantity=$3, detailed_desc=$4, abstract_desc=$5, emoji=$6
       WHERE id=$7 RETURNING *`,
      [name, score, quantity, detailed_desc || '', abstract_desc || '', emoji || '🃏', id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// DELETE /api/game/cards/:id
exports.deleteGameCard = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(`DELETE FROM card WHERE id=$1`, [id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};