var config = require('config');
var auth = require('basic-auth');
var pam_auth = require('authenticate-pam').authenticate;

var _basicAuthPAM = function(req, res, next) {
    // simple authentication aganist ActiveDirectory
    var user = auth(req);
    pam_auth(user.name, user.pass, function(err) {
        if (err) {
            res.statusCode = 401;
            res.setHeader('WWW-Authenticate', 'Basic realm="DR Stager"');
            res.end('Unauthorized');
        } else {
            next();
        }
    }, {serviceName: config.get('BasicAuth.PAM.serviceName'), remoteHost: 'localhost'});
}

module.exports.basicAuth = _basicAuthPAM;
