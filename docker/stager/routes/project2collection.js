const child_process = require('child_process');

var _getCollNameByProject = function(request, response) {

    var collType = request.params.collType;
    var projectId = request.params.projectId;

    var collections = require('../config/project2collection.json');

    delete require.cache[require.resolve('../config/project2collection.json')];

    var map = (collections[collType]) ? collections[collType]:{};

    var collNameCatchall = (map['_CATCHALL']) ? map['_CATCHALL'] + '/' + projectId:undefined;
    var collName = (map[projectId]) ? map[projectId]:collNameCatchall;

    // call the external script to get the collection name using irule
    var errmsg = '';
    if ( ! collName ) {
        var abbrTypes = {
            'DAC': 'DATA_ACQUISITION',
            'RDC': 'RESEARCH_DOCUMENTATION',
            'DSC': 'DATA_SHARING'
        };

        var cmd = __dirname + '/../bin/s-getcoll4project.sh';
        var cmd_args = ['DCCN', abbrTypes[collType], projectId];
        var cmd_opts = {
            timeout: 60*1000,
            maxBuffer: 10*1024*1024
        };

        try {
            var data = JSON.parse(child_process.execFileSync(cmd, cmd_args, cmd_opts));
            if ( data.collections.length > 1 ) {
                throw new Error('more than one ' + collType + ' collections found for project ' + projectId);
            } else if ( data.collections.length == 0 ) {
                throw new Error(collType + ' collection not found for project ' + projectId);
            } else {
                collName = data.collections[0]['collName'];
            }
        } catch( err ){
            errmsg = err.toString();
        }
    }

    if ( collName ) {
        response.json({'collName': collName});
    } else {
        response.status(404);
        response.json({'errmsg': errmsg});
    }
}

module.exports.getCollNameByProject = _getCollNameByProject;
