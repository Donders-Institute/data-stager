var config = require('config');
var Client = require('ssh2').Client;

/* Authenticate user agains a FTP server */
var _authenticateUser = function(request, response) {

    var sess = request.session;
    var cfg = {host: config.get('ftp.host'),
               port: config.get('sftp.port'),
               username: request.body.username,
               password: request.body.password};

    var c = new Client();

    var handle_error = function(err) {
        c.end();
        console.error(err);
        response.status(404);
        response.json({});
    };

    try {
        c.on( 'ready', function() {
            c.end();
            // set session data
            var sess = request.session;
            if (typeof sess.user === "undefined" ||
                typeof sess.user === "undefined" ) {
                sess.user = {sftp: request.body.username};
                sess.pass = {sftp: request.body.password};
            } else {
                sess.user.sftp = request.body.username;
                sess.pass.sftp = request.body.password;
            }
            response.status(200);
            response.json({});
        }).on( 'error', function(err) {
            handle_error(err);
        }).connect(cfg);
    } catch(err) {
        handle_error(err);
    }
}

/* Get directory content from a FTP server */
var _getDirList = function(request, response) {

    var sess = request.session;

    var cfg = { host: config.get('sftp.host'),
                port: config.get('sftp.port'),
                username: sess.user.sftp,
                password: sess.pass.sftp };

    var dir = request.body.dir;

    var checkbox = ( typeof request.body.multiSelect !== 'undefined' && request.body.multiSelect ) ? '<input type="checkbox" />':'';

    var r = '<ul class="jqueryFileTree" style="display: none;">';

    var c = new Client();

    var handle_error = function(err) {
        c.end();
        console.error(err);
        r += 'Could not load directory: ' + dir;
        r += '</ul>';
        response.send(r);
    };

    try {
        c.on( 'ready', function() {
            c.sftp( function(err, sftp) {
                if (err) throw err;

                sftp.readdir(dir, function(err, list) {
                    if (err) {
                        handle_error(err);
                    } else {
                        list.forEach(function(f) {
                            if ( f.longname.substr(0,1) == 'd' ) {
                                r += '<li class="directory collapsed">' + checkbox + '<a href="#" rel="' + dir + f.filename + '/">' + f.filename + '</a></li>';
                            } else if (f.longname.substr(0,1) != 'l') { // ignore symbolic links
                                var e = f.filename.split('.')[1];
                                r += '<li title="' + f.attrs.size + ' Bytes" class="file ext_' + e + '">' + checkbox + '<a href="#" rel='+ dir + f.filename + '>' + f.filename + '</a></li>';
                            }
                        });
                        c.end();
                        r += '</ul>';
                        response.send(r);
                    }
                });
            });
        }).on( 'error', function(err) {
            handle_error(err);
        }).connect(cfg);
    } catch(err) {
        handle_error(err);
    }
}

module.exports.authenticateUser = _authenticateUser;
module.exports.getDirList = _getDirList;
