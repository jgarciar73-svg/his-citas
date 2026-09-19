const { Router } = require('express');
const controller = require('../controllers/citasController');

const router = Router();
router.get('/', controller.listar);
router.post('/', controller.crear);
router.get('/:id', controller.obtener);
router.put('/:id', controller.reprogramar);
router.patch('/:id/estado', controller.cambiarEstado);

module.exports = router;
