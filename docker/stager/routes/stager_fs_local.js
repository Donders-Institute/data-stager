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
            try {
                fs.accessSync(ff, fs.R_OK);

                var lstat = fs.lstatSync(ff);

                switch ( true ) {
                    case lstat.isDirectory():
                        f_data.push( { 'name': f, 'type': 'd', 'size': 0 } );
                        break;

                    case lstat.isSymbolicLink():
                        // resolve symbolic link to the physical location
                        var stat = fs.statSync(fs.realpathSync(ff));
                        if ( stat.isDirectory() ) {
                            f_data.push( { 'name': f, 'type': 'd', 'size': 0 } );
                        } else {
                            f_data.push( { 'name': f, 'type': 'f', 'size': stat.size } );
                        }
                        break;

                    default:
                        f_data.push( { 'name': f, 'type': 'f', 'size': lstat.size } );
                        break;
                }
            } catch(e) {
                console.error('Cannot access file: ' + ff);
                console.error(e);
            }
        });
    } catch(e) {
        console.error('Cannot load directory: ' + dir);
        console.error(e);
    }
    // regain original privilege
    process.seteuid(uid);

    response.contentType('application/json');
    response.send(f_data);
}

module.exports.authenticateUser = _authenticateUser;
module.exports.getDirList = _getDirList;
