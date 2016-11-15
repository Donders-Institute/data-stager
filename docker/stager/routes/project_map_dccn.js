var config = require('config');
var auth = require('basic-auth');

var _getCollNameByProject = function(request, response) {

    var map = {};

    var collType = request.params.collType;
    var projectId = request.params.projectId;

    switch( collType ) {

        case "DAC":
            map = config.RDM.projectMapDAC;
            break;

        case "RDC":
            map = config.RDM.projectMapRDC;
            break;

        case "DSC":
            map = config.RDM.projectMapDSC;
            break;

        default:
            break;
    }

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
