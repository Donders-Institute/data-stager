var config = require('config');
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

/* Get directory content from the RDM service */
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
