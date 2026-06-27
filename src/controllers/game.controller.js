const db = require('../config/db');

// GET /api/game  — get all games with description from game_details
// exports.getAllGames = async (req, res) => {
//   try {
//     const result = await db.query(`
//       SELECT g.id, g.name, g.content_version, g.status, gd.description
//       FROM game g
//       LEFT JOIN game_details gd ON gd.game_id = g.id
//       ORDER BY g.id
//     `);
//     res.json(result.rows);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: 'Server error' });
//   }
// };
exports.getAllGames = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT g.*, gd.description, gd.min_players
       FROM game g
       LEFT JOIN game_details gd ON gd.game_id = g.id
       ORDER BY g.id`
    );
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
    const [gameRes, detailsRes, cardsRes, catBucketRes, judgesRes] = await Promise.all([
      db.query(`SELECT * FROM game WHERE id = $1`, [id]),
      db.query(`SELECT * FROM game_details WHERE game_id = $1`, [id]),
      db.query(
        `SELECT c.*, ct.name AS card_type_name, jc_link.judge_categories_id
         FROM card c
         LEFT JOIN card_type ct ON ct.id = c.card_type_id
         LEFT JOIN judge_card jc_link ON jc_link.card_id = c.id
         WHERE c.game_id = $1
         ORDER BY c.id`,
        [id]
      ),
      db.query(`SELECT id FROM card_categories WHERE game_id = $1`, [id]),
      db.query(
        `SELECT jc.id, jc.name,
           COALESCE(json_agg(jd.description ORDER BY jd.id) FILTER (WHERE jd.status = 'on'), '[]') AS tasks
         FROM judge_categories jc
         LEFT JOIN judge_details jd ON jd.judge_categories_id = jc.id
         WHERE jc.game_id = $1
         GROUP BY jc.id
         ORDER BY jc.id`,
        [id]
      ),
    ]);

    if (gameRes.rows.length === 0)
      return res.status(404).json({ error: 'Game not found' });

    const catDetails = catBucketRes.rows[0]
      ? (await db.query(
          `SELECT ccd.*,
            COALESCE(json_agg(sc.sticker_url) FILTER (WHERE sc.id IS NOT NULL), '[]') AS stickers
           FROM card_categories_details ccd
           LEFT JOIN stickers_categories sc ON sc.card_categories_details_id = ccd.id
           WHERE ccd.categories_id = $1
           GROUP BY ccd.id
           ORDER BY ccd.id`,
          [catBucketRes.rows[0].id]
        )).rows
      : [];

    const judgeCategories = judgesRes.rows;
    const gift_lines = (judgeCategories.find(jc => jc.name === 'reward')?.tasks ?? []);

    res.json({
      game:             gameRes.rows[0],
      details:          detailsRes.rows[0],
      cards:            cardsRes.rows,
      categories:       catDetails,
      judge_categories: judgeCategories,
      gift_lines,
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
if (!['open', 'freeze', 'coming_soon'].includes(status))
    return res.status(400).json({ error: 'Invalid status' });
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
  const { name, score, quantity, detailed_desc, abstract_desc, emoji, is_one_time, card_type_id, judge_categories_id } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO card (name, score, quantity, detailed_desc, abstract_desc, emoji, is_one_time, card_type_id, game_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [name, score, quantity || 10, detailed_desc || '', abstract_desc || '', emoji || '🃏', is_one_time ?? false, card_type_id || null, id]
    );
    const card = result.rows[0];
    if (judge_categories_id) {
      await db.query(
        `INSERT INTO judge_card (card_id, judge_categories_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [card.id, judge_categories_id]
      );
    }
    res.status(201).json({ ...card, judge_categories_id: judge_categories_id || null });
  } catch (err) {
    if (err.code === '23505')
      return res.status(409).json({ error: 'الكارت ده موجود بالفعل ⚠️' });
    res.status(500).json({ error: 'Server error' });
  }
};

// PATCH /api/game/cards/:id
exports.updateGameCard = async (req, res) => {
  const { id } = req.params;
  const { name, score, quantity, detailed_desc, abstract_desc, emoji, is_one_time, card_type_id, judge_categories_id } = req.body;
  try {
    const result = await db.query(
      `UPDATE card SET name=$1, score=$2, quantity=$3, detailed_desc=$4, abstract_desc=$5, emoji=$6, is_one_time=$7, card_type_id=$8
       WHERE id=$9 RETURNING *`,
      [name, score, quantity, detailed_desc || '', abstract_desc || '', emoji || '🃏', is_one_time ?? false, card_type_id || null, id]
    );
    // Replace the judge_card link (delete then insert if provided)
    await db.query(`DELETE FROM judge_card WHERE card_id = $1`, [id]);
    if (judge_categories_id) {
      await db.query(
        `INSERT INTO judge_card (card_id, judge_categories_id) VALUES ($1,$2)`,
        [id, judge_categories_id]
      );
    }
    res.json({ ...result.rows[0], judge_categories_id: judge_categories_id || null });
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