var express = require('express');
var router = express.Router();
var config = require('../config');

/* GET users listing. */
router.get('/:tableId', function(req, res, next) {
  let tableId;
  let displayName = '';
  let thumbUrl = '';

  try {
    tableId = Number(req.params.tableId);
    if (req.user) {
        displayName = req.user.displayName;
        thumbUrl = req.user.photos[0].value;
    } else {
        res.redirect('/');
    }
  } catch (err) {
    res.redirect('/');
  }

  if (1 <= tableId && tableId <= 16) {
    res.render('table',
        {
          title: '人狼オンライン',
          displayName: displayName,
          thumbUrl: thumbUrl,
          ipAddress: config.ipAddress,
          tableId: tableId
        }
    );
  } else {
    res.redirect('/');
  }
});

module.exports = router;
