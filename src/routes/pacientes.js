const { Router } = require('express');
const controller = require('../controllers/pacientesController');

const router = Router();
router.get('/', controller.listar);

module.exports = router;
