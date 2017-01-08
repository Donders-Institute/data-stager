var auth = require('basic-auth');

var _getCollNameByProject = function(request, response) {

    var collType = request.params.collType;
    var projectId = request.params.projectId;

    var collections = require('../config/project2collection.json');

    delete require.cache[require.resolve('../config/project2collection.json')];

    var map = (collections[collType]) ? collections[collType]:{};

    var collNameCatchall = (map['_CATCHALL']) ? map['_CATCHALL'] + '/' + projectId:undefined;
    var collName = (map[projectId]) ? map[projectId]:collNameCatchall;

    if ( collName ) {
        response.json({'collName': collName});
    } else {
        response.status(404);
        response.json({'errmsg': collType + ' not found for project: ' + projectId});
    }
}

module.exports.getCollNameByProject = _getCollNameByProject;
