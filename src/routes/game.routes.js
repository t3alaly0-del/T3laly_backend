const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/game.controller');

router.get('/',                   ctrl.getAllGames);
router.get('/:id',                ctrl.getGameContent);
router.patch('/:id',              ctrl.updateGame);
router.patch('/:id/status',       ctrl.updateGameStatus);
router.patch('/:id/bump-version', ctrl.bumpVersion);

// Card management
router.get('/:id/cards',          ctrl.getGameCards);
router.post('/:id/cards',         ctrl.addGameCard);
router.patch('/cards/:id',        ctrl.updateGameCard);
router.delete('/cards/:id',       ctrl.deleteGameCard);

module.exports = router;