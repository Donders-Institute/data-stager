var config = require('config');
var path = require('path');
var util = require('../lib/utility');

/* Authenticate user to the RDM service via the webdav interface */
var _authenticateUserWebDav = function(request, response) {

    var sess = request.session;

    var wfs = require("webdav-fs")(
        config.get('rdm.irodsWebDavEndpoint'),
        request.body.username,
        request.body.password
    );

    wfs.readdir('/', function(err, contents) {
        if (!err) {
            // set session data
            if (typeof sess.user === "undefined" ||
                typeof sess.user === "undefined" ) {
                sess.user = {rdm: request.body.username};
                sess.pass = {rdm: request.body.password};
            } else {
                sess.user.rdm = request.body.username;
                sess.pass.rdm = request.body.password;
            }

            response.status(200);
            response.json(contents);
        } else {
            console.error('login error: ' + err);
            response.status(404);
            response.json({'error': err});
        }
    });
}

/* logout user by removing corresponding session data */
var _logoutUser = function(request, response) {
    var sess = request.session;
    delete sess.user.rdm;
    delete sess.pass.rdm;
    response.json({'logout': true});
}

/* Get directory content for jsTree, using the WebDAV interface */
var _getDirListJsTreeWebDav = function(request, response) {

    var files = [];

    var sess = request.session;

    var dir = request.query.dir;
    var isRoot = request.query.isRoot;

    var wfs = require("webdav-fs")(
        config.get('rdm.irodsWebDavEndpoint'),
        sess.user['rdm'],
        sess.pass['rdm']
    );

    wfs.readdir(dir, function(err, contents) {
        if (!err) {
            contents.forEach( function(f) {
                if ( f.isFile() ) {
                    files.push({
                        id: dir.replace(/\/$/,'') + '/' + f.name,
                        type: 'f',
                        parent: isRoot === 'true' ? '#':dir,
                        text: f.name,
                        icon: 'fa fa-file-o',
                        li_attr: {'title':''+f.size+' bytes'},
                        children: false
                    });
                } else {
                    files.push({
                        id: dir.replace(/\/$/,'') + '/' + f.name + '/',
                        type: 'd',
                        parent: isRoot === 'true' ? '#':dir,
                        text: f.name,
                        icon: 'fa fa-folder',
                        li_attr: {},
                        children: true
                    });
                }
            });
            response.json(files);
        } else {
            console.log("Error:", err.message);
            util.responseOnError('json',[],response);
        }
    }, 'stat');
}

/* create new directory via WebDAV */
var _makeDirWebDav = function(request, response) {
    var sess = request.session;

    var dir = request.body.dir;

    var wfs = require("webdav-fs")(
        config.get('rdm.irodsWebDavEndpoint'),
        sess.user['rdm'],
        sess.pass['rdm']
    );

    wfs.mkdir(dir, function(err) {
        if (!err) {
            response.status(200);
            response.json(['OK']);
        } else {
            console.log("WebDAV error:", err.message);
            util.responseOnError('json',[err.message],response);
        }
    });
}

module.exports.authenticateUser = _authenticateUserWebDav;
module.exports.logoutUser = _logoutUser;
module.exports.getDirListJsTree = _getDirListJsTreeWebDav;
module.exports.makeDir = _makeDirWebDav;
