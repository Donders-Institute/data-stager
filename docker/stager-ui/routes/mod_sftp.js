var config = require('config');
var Client = require('ssh2').Client;
var path = require('path');
var util = require('../lib/utility');

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

/* logout user by removing corresponding session data */
var _logoutUser = function(request, response) {
    var sess = request.session;
    delete sess.user.sftp;
    delete sess.pass.sftp;
    response.json({'logout': true});
}

/* Get directory content for jsTree */
var _getDirListJsTree = function(request, response) {

    var files = [];

    var dir = request.query.dir;
    var isRoot = request.query.isRoot;
    var sess = request.session;

    var cfg = { host: config.get('sftp.host'),
                port: config.get('sftp.port'),
                username: sess.user.sftp,
                password: sess.pass.sftp };

    var c = new Client();

    try {
        c.on( 'ready', function() {
            c.sftp( function(err, sftp) {
                if (err) throw err;
                sftp.readdir(dir, function(err, list) {
                    if (err) {
                        c.end();
                        console.error(err);
                        util.responsOnError('json',[],response);
                    } else {
                        list.forEach(function(f) {
                            if ( f.longname.substr(0,1) == 'd' ) {
                                files.push({
                                    id: path.join(dir, f.filename) + '/',
                                    parent: isRoot === 'true' ? '#':dir,
                                    text: f.filename,
                                    icon: 'fa fa-folder',
                                    li_attr: {},
                                    children: true
                                });
                            } else if (f.longname.substr(0,1) != 'l') { // ignore symbolic links
                                //var e = f.filename.split('.')[1];
                                files.push({
                                    id: path.join(dir, f.filename),
                                    parent: isRoot === 'true' ? '#':dir,
                                    text: f.filename,
                                    icon: 'fa fa-file-o',
                                    li_attr: {'title': '' + f.attrs.size + ' bytes'},
                                    children: false
                                });
                            }
                        });
                        c.end();
                        response.json(files);
                    }
                });
            });
        }).on( 'error', function(err) {
            console.error(err);
            c.end();
            util.responsOnError('json',[],response);
        }).connect(cfg);
    } catch(err) {
        console.error(err);
        c.end();
        util.responsOnError('json',[],response);
    }
}

/* Get directory content for jqueryFileTree */
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
module.exports.logoutUser = _logoutUser;
module.exports.getDirList = _getDirList;
module.exports.getDirListJsTree = _getDirListJsTree;
