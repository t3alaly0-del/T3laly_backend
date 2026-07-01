const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/code.controller');

// ── Mobile ─────────────────────────────────────
router.post('/activate',              ctrl.activateCode);
router.post('/restore',               ctrl.restoreCode);
router.get('/my-games',               ctrl.getMyGames);

// ── Admin: read ────────────────────────────────
router.get('/game/:game_id',          ctrl.getGameCodes);

// ── Admin: create ──────────────────────────────
router.post('/generate',              ctrl.generateCodes);
router.post('/insert',                ctrl.insertCode);

// ── Admin: update / delete ─────────────────────
router.patch('/details/:id',          ctrl.updateCode);
router.delete('/details/:id',         ctrl.deleteCode);
router.delete('/game/:game_id/used',  ctrl.deleteUsedCodes);

module.exports = router;
