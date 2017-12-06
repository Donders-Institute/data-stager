var config = require('config');
var RestClient = require('node-rest-client').Client;

/* return the valida full path by appending mount path to root */
var _expandRoot = function(dir, userName) {
    // the root provided by the client is expected.
    return dir;
}

/* authenticate user's username/password to RDM */
var _authenticateUser = function(request, response) {

    var cfg = {user: request.body.username,
               password: request.body.password};

    var c = new RestClient(cfg);
    var args = { headers: { "Accept": "application/json" } };

    var req = c.get(config.get('RDM.restEndpoint') + '/user/' + request.body.username, args, function(data, resp) {
        try {
            console.log('irods-rest response status: ' + resp.statusCode);
            if ( resp.statusCode == 200 ) {
                response.status(200);
                response.json(data);
            } else {
                response.status(404);
                response.end("User not found or not authenticated: " + request.body.username);
            }
        } catch(e) {
            console.error(e);
            response.status(404);
            response.end("User not found or not authenticated: " + request.body.username);
        }
    });
}

/* list files and directories in a given RDM collection dir */
var _getDirList = function(request, response) {

    var cfg = { user: request.body.rdm_user,
                password: request.body.rdm_pass };

    var dir = request.body.dir;

    var c = new RestClient(cfg);
    var args = { parameters: { listType: 'both', listing: 'True' },
                 headers: { "Accept": "application/json" } };

    var f_data = [];
    c.get(config.get('RDM.restEndpoint') + '/collection' + dir, args, function(data, resp) {

        try {
            console.log('irods-rest response status: ' + resp.statusCode);

            data.children.forEach(function(f){

                if ( f.objectType == 'COLLECTION' ) {
                    var rel_name = f.pathOrName.replace(f.parentPath + '/', '');
                    f_data.push( {'name': rel_name, 'type': 'd', 'size': -1} );
                } else {
                    f_data.push( {'name': f.pathOrName, 'type': 'f', 'size': f.dataSize} );
                }
            });
        } catch(e) {
            console.error(e);
        }

        response.contentType('application/json');
        response.json(f_data);
    });
}

module.exports.expandRoot = _expandRoot;
module.exports.authenticateUser = _authenticateUser;
module.exports.getDirList = _getDirList;
