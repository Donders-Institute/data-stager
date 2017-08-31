var config = require('config');
var path = require('path');
var RestClient = require('node-rest-client').Client;
var util = require('../lib/utility');

/* Authenticate user to the RDM service via the irods-rest interface */
var _authenticateUserRest = function(request, response) {

    var sess = request.session;
    var cfg = {user: request.body.username,
               password: request.body.password};

    var c = new RestClient(cfg);
    var args = { headers: { "Accept": "application/json" } };

    var req = c.get(config.get('rdm.irodsRestfulEndpoint') + '/user/' + request.body.username, args, function(data, resp) {
        try {
            console.log('irods-rest response status: ' + resp.statusCode);
            if ( resp.statusCode == 200 ) {
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
                response.json(data);
            } else {
                response.status(404);
                response.json({});
            }
        } catch(e) {
            console.error(e);
            // return status 404 (not found) when login failed
            response.status(404);
            response.json({});
        }
    }).on('error', function(e) {
          console.error(e);
          util.responsOnError('json',{},response);
    });
}

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

/* Get directory content for jsTree, using the irods-rest interface */
var _getDirListJsTreeRest = function(request, response) {

    var files = [];

    var sess = request.session;

    var dir = request.query.dir;
    var isRoot = request.query.isRoot;

    var cfg = { user: sess.user['rdm'],
                password: sess.pass['rdm'] };

    var c = new RestClient(cfg);
    var args = { parameters: { listType: 'both', listing: 'True' },
                 headers: { "Accept": "application/json" } };

    c.get(config.get('rdm.irodsRestfulEndpoint') + '/collection' + dir, args, function(data, resp) {
        try {
            console.log('irods-rest response status: ' + resp.statusCode);
            data.children.forEach(function(f){
                if ( f.objectType == 'COLLECTION' ) {
                    files.push({
                        id: f.pathOrName + '/',
                        type: 'd',
                        parent: isRoot === 'true' ? '#':dir,
                        text: f.pathOrName.replace(f.parentPath + '/', ''),
                        icon: 'fa fa-folder',
                        li_attr: {},
                        children: true
                    });
                } else {
                    //var e = f.pathOrName.split('.').pop();
                    files.push({
                        id: f.parentPath + '/' + f.pathOrName,
                        type: 'f',
                        parent: isRoot === 'true' ? '#':dir,
                        text: f.pathOrName,
                        icon: 'fa fa-file-o',
                        li_attr: {'title':''+f.dataSize+' bytes'},
                        children: false
                    });
                }
            });
            response.json(files);
        } catch(e) {
            console.error(e);
            util.responseOnError('json',[],response);
        }
    }).on('error', function(e) {
        console.error(e);
        util.responseOnError('json',[],response);
    });
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

module.exports.authenticateUser = _authenticateUserWebDav;
module.exports.logoutUser = _logoutUser;
module.exports.getDirListJsTree = _getDirListJsTreeWebDav;
