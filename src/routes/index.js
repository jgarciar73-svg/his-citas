const { Router } = require('express');

const router = Router();
router.use('/citas', require('./citas'));
router.use('/doctores', require('./doctores'));
router.use('/pacientes', require('./pacientes'));

module.exports = router;
