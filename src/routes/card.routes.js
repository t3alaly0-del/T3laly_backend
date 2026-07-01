const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/card.controller');
const upload  = require('../middleware/upload');

// Cards
//Admin
router.get('/:game_id',          ctrl.getCards);
router.patch('/details/:id',     ctrl.updateCardDetail);
//T3alaly
router.get('/game-screen/:game_id', ctrl.getGameScreenCards);
// Categories
router.get('/categories/:game_id',       ctrl.getCategories);
router.post('/categories',               ctrl.addCategory);
router.patch('/categories/:id',          ctrl.updateCategory);
router.delete('/categories/:id',         ctrl.deleteCategory);


// Stickers
router.get('/categories/:id/stickers',   ctrl.getStickers);
router.post('/categories/:id/stickers',  upload.single('sticker'), ctrl.addSticker);
router.delete('/stickers/:id',           ctrl.deleteSticker);

module.exports = router;