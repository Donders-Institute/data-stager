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

    if ( typeof map[projectId] ) {
        resp.json({'collName': map[projectId]});
    } else {
        resp.status(404);
        resp.json({'errmsg': collType + ' not found for project: ' + projectId});
    }
}

module.exports.getCollNameByProject = _getCollNameByProject;
