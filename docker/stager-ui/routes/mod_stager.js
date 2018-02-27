var config = require('config');
var path = require('path');
var RestClient = require('node-rest-client').Client;
var util = require('../lib/utility');

/* Authenticate user agains the Stager service */
var _authenticateUser = function(request, response) {
    var args = { headers: { "Accept": "application/json" } };

    var c = new RestClient({user: request.body.username,
                            password: request.body.password});

    var req = c.post(config.get('stager.restfulEndpoint') + '/fslogin/stager', args, function(data, resp) {

        try {
            console.log('stager response status: ' + resp.statusCode);
            if ( resp.statusCode == 200 ) {

                // set session data
                var sess = request.session;
                if (typeof sess.user === "undefined" ||
                    typeof sess.user === "undefined" ) {
                    sess.user = {stager: request.body.username};
                    sess.pass = {stager: request.body.password};
                } else {
                    sess.user.stager = request.body.username;
                    sess.pass.stager = request.body.password;
                }
                response.status(200);
                response.json(data);
            } else {
                response.status(404);
                response.json({});
            }
        } catch(e) {
            console.error(e);
            util.responseOnError('json', {}, response);
        }
    }).on('error', function(e) {
        console.error(e);
        util.responseOnError('json', {}, response);
    });
}

/* logout user by removing corresponding session data */
var _logoutUser = function(request, response) {
    var sess = request.session;
    delete sess.user.stager;
    delete sess.pass.stager;
    response.json({'logout': true});
}

/* Get directory content for jsTree */
var _getDirListJsTree = function(request, response) {

  var files = [];
  var sess = request.session;
  var dir = request.query.dir;
  var isRoot = request.query.isRoot;

  var args = { data: { dir: dir },
               headers: { "Accept": "application/json",
                          "Content-Type": "application/json" } };

  var c = new RestClient({user: sess.user.stager,
                          password: sess.pass.stager});

  var req = c.post(config.get('stager.restfulEndpoint') + '/fstree/stager', args, function(data, resp) {

        try {
            console.log('stager response status: ' + resp.statusCode);
            if ( resp.statusCode == 200 ) {
               data.forEach( function(f) {
                   if ( f.type == 'f' ) {
                       files.push({
                           id: path.join(dir, f.name),
                           parent: isRoot === 'true' ? '#':dir,
                           text: f.name,
                           icon: 'fa fa-file-o',
                           li_attr: {'title':''+f.size+' bytes'},
                           children: false
                       });
                   } else {
                       files.push({
                           id: path.join(dir, f.name) + '/',
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
                util.responseOnError('json', [], response);
            }
        } catch(e) {
            console.error(e);
            util.responseOnError('json', [], response);
        }
    }).on('error', function(e) {
        console.error(e);
        util.responseOnError('json', [], response);
    });
}

/* Get transfer-job counts from Stager */
var _getJobCount = function(request, response) {

    var args = { headers: { "Accept": "application/json" } };
    var sess = request.session;
    var c = new RestClient({user: sess.user.stager,
                            password: sess.pass.stager});

    var req = c.get(config.get('stager.restfulEndpoint') + '/stats', args, function(data, resp) {

        try {
            console.log('stager response status: ' + resp.statusCode);
            if ( resp.statusCode == 200 ) {
                response.status(200);
                response.json(data);
            } else {
                response.status(404);
                response.json({});
            }
        } catch(e) {
            console.error(e);
            util.responseOnError('json', {}, response);
        }
    }).on('error', function(e) {
        console.error(e);
        util.responseOnError('json', {}, response);
    });
}

/* Get transfer jobs from stager and show only those belongs to the same user */
var _getJobsInState = function(request, response) {

    var args = { headers: { "Accept": "application/json" } };
    var sess = request.session;
    var c = new RestClient({user: sess.user.stager,
                            password: sess.pass.stager});

    var jobs = {};
    var state  = request.params.state;
    var idx_f = request.params.from;
    var idx_t = request.params.to;
    var url = config.get('stager.restfulEndpoint') + '/jobs/' + state + '/' + idx_f + '..' + idx_t + '/desc';
    var req = c.get(url, args, function(data, resp) {
        try {
            console.log('stager response status: ' + resp.statusCode);
            if ( resp.statusCode == 200 ) {
                response.status(200);
                jobs = data.filter( function(j) {
                    return (typeof j.data !== 'undefined') &&
                           (typeof j.data.stagerUser !== 'undefined') &&
                           (j.data.stagerUser == sess.user.stager);
                });
                response.json(jobs);
            } else {
                response.status(404);
                response.json({});
            }
        } catch(e) {
            console.error(e);
            util.responseOnError('json', {}, response);
        }
    }).on('error', function(e) {
        console.error(e);
        util.responseOnError('json', {}, response);
    });
}

/* Get all transfer jobs from stager and show only those belongs to the same user */
var _getJobs = function(request, response) {

    var args = { headers: { "Accept": "application/json" } };
    var sess = request.session;
    var c = new RestClient({user: sess.user.stager,
                            password: sess.pass.stager});

    var jobs = {};
    var idx_f = request.params.from;
    var idx_t = request.params.to;
    var url = config.get('stager.restfulEndpoint') + '/jobs/' + idx_f + '..' + idx_t + '/desc';
    var req = c.get(url, args, function(data, resp) {
        try {
            console.log('stager response status: ' + resp.statusCode);
            if ( resp.statusCode == 200 ) {
                response.status(200);
                jobs = data.filter( function(j) {
                    return (typeof j.data !== 'undefined') &&
                           (typeof j.data.stagerUser !== 'undefined') &&
                           (j.data.stagerUser == sess.user.stager);
                });
                response.json(jobs);
            } else {
                response.status(404);
                response.json({});
            }
        } catch(e) {
            console.error(e);
            util.responseOnError('json', {}, response);
        }
    }).on('error', function(e) {
        console.error(e);
        util.responseOnError('json', {}, response);
    });
}

/* Get single transfer job by id */
var _getJob = function(request, response) {

    var args = { headers: { "Accept": "application/json" } };
    var sess = request.session;
    var c = new RestClient({user: sess.user.stager,
                            password: sess.pass.stager});

    var job = {};
    var url = config.get('stager.restfulEndpoint') + '/job/' + request.params.id;
    var req = c.get(url, args, function(j, resp) {
        try {
            console.log('stager response status: ' + resp.statusCode);
            if ( resp.statusCode == 200 ) {
                job = (typeof j.data !== 'undefined') && (typeof j.data.stagerUser !== 'undefined') && (j.data.stagerUser == sess.user.stager) ? j:{};
                response.status(200);
                response.json(job);
            } else {
                response.status(404);
                response.json({});
            }
        } catch(e) {
            console.error(e);
            util.responseOnError('json', {}, response);
        }
    }).on('error', function(e) {
        console.error(e);
        util.responseOnError('json', {}, response);
    });
}

/* Submit transfer jobs to stager */
var _submitJobs = function(request, response) {

    var sess = request.session;
    var c = new RestClient({user: sess.user.stager,
                            password: sess.pass.stager});

    var jobs = [];
    if ( typeof request.body.jobs !== 'undefined' ) {
        jobs = JSON.parse(request.body.jobs);
    }

    var stagerJobs = [];
    jobs.forEach( function(j) {
        j.stagerUser = sess.user.stager;
        j.rdmUser = sess.user.rdm;
        j.clientIF = 'irods';
        j.timeout = 86400;
        j.timeout_noprogress = 3600;
        j.title = 'sync to ' + j.dstURL;

        stagerJobs.push( {
            type: 'rdm',
            data: j,
            options: {
                attempts: 5,
                backoff: { delay: 60000, type: 'fixed'}
            }
        });
    });

    if ( stagerJobs.length > 0 ) {
        var args = {headers: {"Accept": "application/json",
                              "Content-Type": "application/json"},
                    data: stagerJobs};

        var url = config.get('stager.restfulEndpoint') + '/job';
        var req = c.post(url, args, function(data, resp) {
            try {
                console.log('stager response status: ' + resp.statusCode);
                if ( resp.statusCode == 200 ) {
                    response.status(200);
                    response.json(data);
                } else {
                    response.status(404);
                    response.json([]);
                }
            } catch(e) {
                console.error(e);
                util.responseOnError('json', [], response);
            }
        }).on('error', function(e) {
            console.error(e);
            util.responseOnError('json', [], response);
        });
    } else {
        console.log('No stager job to submit');
        response.status(200);
        response.json([]);
    }
}

module.exports.authenticateUser = _authenticateUser;
module.exports.logoutUser = _logoutUser;
module.exports.getDirListJsTree = _getDirListJsTree;
module.exports.getJobCount = _getJobCount;
module.exports.getJobs = _getJobs;
module.exports.getJob = _getJob;
module.exports.getJobsInState = _getJobsInState;
module.exports.submitJobs = _submitJobs;
