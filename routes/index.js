var express = require('express');
var router = express.Router();
var config = require('../config');

/* GET home page. */
router.get('/', function(req, res, next) {
    let displayName = '';
    let thumbUrl = '';
    if (req.user) {
        displayName = req.user.displayName;
        thumbUrl = req.user.photos[0].value;
    }
  res.render('index', { title: '人狼オンライン', displayName: displayName, thumbUrl: thumbUrl, ipAddress: config.ipAddress });
});

module.exports = router;
