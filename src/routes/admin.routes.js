const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/admin.controller');

router.get('/card-types',                    ctrl.getCardTypes);
router.get('/judge-categories/:game_id',     ctrl.getJudgeCategories);

router.get('/judges/:game_id',  ctrl.getJudges);
router.post('/judges',          ctrl.addJudge);
router.patch('/judges/:id',     ctrl.updateJudge);
router.delete('/judges/:id',    ctrl.deleteJudge);

router.get('/rules/:game_id',   ctrl.getRules);
router.post('/rules',           ctrl.addRule);
router.patch('/rules/:id',      ctrl.updateRule);
router.delete('/rules/:id',     ctrl.deleteRule);

module.exports = router;