var config = require('config');
var path = require('path');
var RestClient = require('node-rest-client').Client;
var util = require('../lib/utility');

/* Authenticate user to the RDM service via the RESTful interface */
var _authenticateUser = function(request, response) {

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

/* Get directory content for jsTree */
var _getDirListJsTree = function(request, response) {

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

/* Get directory content for jqueryFileTree */
var _getDirList = function(request, response) {

    var sess = request.session;

    var cfg = { user: sess.user['rdm'],
                password: sess.pass['rdm'] };

    var dir = request.body.dir;
    var checkbox = ( typeof request.body.multiSelect !== 'undefined' && request.body.multiSelect ) ? '<input type="checkbox" />':'';

    var r = '<ul class="jqueryFileTree" style="display: none;">';

    var c = new RestClient(cfg);
    var args = { parameters: { listType: 'both', listing: 'True' },
                 headers: { "Accept": "application/json" } };

    c.get(config.get('rdm.irodsRestfulEndpoint') + '/collection' + dir, args, function(data, resp) {
        try {
            r = '<ul class="jqueryFileTree" style="display: none;">';
            console.log('irods-rest response status: ' + resp.statusCode);
            data.children.forEach(function(f){
                if ( f.objectType == 'COLLECTION' ) {
                    var rel_name = f.pathOrName.replace(f.parentPath + '/', '');
                    r += '<li class="directory collapsed">' + checkbox + '<a href="#" rel="' + f.pathOrName + '/">' + rel_name + '</a></li>';
                } else {
                    var e = f.pathOrName.split('.').pop();
                    r += '<li title="' + f.dataSize + ' Bytes" class="file ext_' + e + '">' + checkbox + '<a href="#" rel='+ f.parentPath + '/' + f.pathOrName + '>' + f.pathOrName + '</a></li>';
                }
            });
            r += '</ul>';
            response.send(r);
        } catch(e) {
            console.error(e);
            r += 'Could not load directory: ' + dir;
            r += '</ul>';
            util.responseOnError('html',r,response);
        }
    }).on('error', function(e) {
        console.error(e);
        r += 'Could not load directory: ' + dir;
        r += '</ul>';
        util.responseOnError('html',r,response);
    });
}

module.exports.authenticateUser = _authenticateUser;
module.exports.getDirList = _getDirList;
module.exports.getDirListJsTree = _getDirListJsTree;
