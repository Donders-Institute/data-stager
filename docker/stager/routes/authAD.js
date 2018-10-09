var fs = require('fs');
var config = require('config');
var auth = require('basic-auth');
var ActiveDirectory = require('activedirectory');

var _accept = function(req, res, next) {
    next();
}

var _basicAuthAD = function(req, res, next) {

    // simple authentication aganist ActiveDirectory
    c = config.get('BasicAuth.AD');
    // try to load trusted ca certificate for TLS connection to AD
    if (c.has('cacert') && fs.existsSync(c.get('cacert')) {
        try {
            c.tlsOptions = {
                ca: [ fs.readFileSync(c.get('cacert')) ]
            }
        } catch(e) {
            // catch and ignore certificate loading error
            console.error(e);
        }
    }
    var ad = new ActiveDirectory(c);
    var user = auth(req);

    try {
        if ( typeof user !== 'undefined' ) {
            ad.authenticate(user.name, user.pass, function(err, authenticated) {
                if (err) {
                    console.error(err);
                }

                if (authenticated) {
                    next();
                } else {
                    // check against stager's administrator accounts
                    admins = config.get('Administrator');
                    if ( admins[user.name] === user.pass ) {
                        next();
                    } else {
                        res.statusCode = 401;
                        res.setHeader('WWW-Authenticate', 'Basic realm="DR Stager"');
                        res.end('Unauthorized');
                    }
                }
            });
        } else {
            res.statusCode = 401;
            res.setHeader('WWW-Authenticate', 'Basic realm="DR Stager"');
            res.end('Unauthorized');
        }
    } catch(e) {
        console.error(e);
        res.statusCode = 500;
        res.end('Internal Server Error');
    }
}

module.exports.basicAuth = _basicAuthAD;
