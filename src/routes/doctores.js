const { Router } = require('express');
const controller = require('../controllers/doctoresController');

const router = Router();
router.get('/', controller.listar);

module.exports = router;
