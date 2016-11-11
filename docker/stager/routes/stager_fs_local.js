var fs = require('fs');
var auth = require('basic-auth');

/* authenticate filesystem user */
var _authenticateUser = function(request, response) {

  // dummy response as when this function is called, the authentication is passed
  response.status(200);
  response.json({});
}

/* get files and directories within a filesystem directory */
var _getDirList = function(request, response) {

    var dir = request.body.dir;
    var f_data = [];

    // get the current effective user id
    var uid = process.geteuid();

    // set effective user id to the authenticated user
    process.seteuid(auth(request).name.split('@')[0]);
    try {
        var files = fs.readdirSync(dir);
        files.forEach(function(f){
            var ff = dir + f;

            // only list those readable
            if ( fs.accessSync(ff, fs.constants.R_OK) ) {
                var stats = fs.lstatSync(ff);

                switch ( true ) {
                    case stats.isDirectory():
                        f_data.push( { 'name': f, 'type': 'd', 'size': 0 } );
                        break;

                    case stats.isSymbolicLink():
                        console.log( fs.readlinkSync(ff) );
                        break;

                    default:
                        f_data.push( { 'name': f, 'type': 'f', 'size': stats.size } );
                        break;
                }
            }
        });
    } catch(e) {
        console.error('Could not load directory: ' + dir);
        console.error(e);
    }
    // regain original privilege
    process.seteuid(uid);

    response.contentType('application/json');
    response.send(f_data);
}

module.exports.authenticateUser = _authenticateUser;
module.exports.getDirList = _getDirList;
