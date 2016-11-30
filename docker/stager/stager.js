var config = require('config');
var kue = require('kue');
var cluster = require('cluster');
var kill = require('tree-kill');
var bodyParser = require('body-parser');
var posix = require('posix');
var child_process = require('child_process')
var fs = require('fs')
var queue = kue.createQueue({
    redis: {
        port: 6379,
        host: '127.0.0.1'
    }
});
var path = require('path');

var active_pids = {};

const stager_bindir = __dirname + path.sep + 'bin';

queue.on( 'error', function(err) {
    if ( cluster.isMaster) {
        console.error('Oops... ', err);
    }
}).on( 'job enqueue', function(id, type) {
    if ( cluster.isMaster) {
        console.log('[' + new Date().toISOString() + '] job %d enqueued for %s', id, type);
    }
}).on( 'job complete', function(id, result) {
    if ( cluster.isMaster) {
        console.log('[' + new Date().toISOString() + '] job %d complete', id);
    }
}).on( 'job failed attempt', function(id, err, nattempts) {
    if ( cluster.isMaster) {
        console.log('[' + new Date().toISOString() + '] job %d failed, attempt %d', id, nattempts);
    }
}).on( 'job failed' , function(id, err) {
    if ( cluster.isMaster) {
        console.log('[' + new Date().toISOString() + '] job %d failed', id);
    }
}).on( 'job remove', function(id, err) {
    if ( cluster.isMaster) {
        var pinfo = active_pids[id];
        if ( ! (pinfo === undefined) ) {
            // inform worker to kill the process
            pinfo['worker'].send({'type': 'KILL', 'pid': pinfo['pid'], 'jid': id});
        }
        delete active_pids[id];
        console.log('[' + new Date().toISOString() + '] job %d removed', id);
    }
});

// Master process of the cluster
if (cluster.isMaster) {

    // set up express app
    var express = require('express');
    var app = express();

    // basicAuth
    var auth = require('./routes/auth');
    app.use(auth.basicAuthAD);

    // bodyParser so that FORM data become available in req.body
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));

    // start service for RESTful APIs
    app.use(kue.app);

    // expose stager's local filesystem via SFTP
    //var stager_fs = require('./routes/stager_fs_sftp');
    // expose stager's local filesystem via FS & setuid
    var stager_fs = require('./routes/stager_fs_local');
    app.post('/fslogin/stager', stager_fs.authenticateUser);
    app.post('/fstree/stager', stager_fs.getDirList);

    //var rdm_fs = require('./routes/rdm_fs_restful');
    //app.post('/fslogin/rdm', rdm_fs.authenticateUser);
    //app.post('/fstree/rdm', rdm_fs.getDirList);

    // RESTful interfaces for RDM-specific functions
    // 1. get collecnt namespace for project
    var prj_map = require('./routes/project_map_dccn');
    app.get('/rdm/:collType/project/:projectId', prj_map.getCollNameByProject);

    // RESTful interface for queue management
    // 1. delete complete jobs older than certain age
    var admin = require('./routes/admin');
    app.delete('/queue/:unit/:age', admin.cleanupQueue(queue));

    app.listen(3000);

    // memory cache of paths of irods authentication tokens
    var valid_auths = {};

    var sendMsgToWorker = function(worker, msg) {
        worker.send(msg);
    }

    // fork workers
    var nworkers = require('os').cpus().length - 1;
    for (var i = 0; i < nworkers; i++) {
        var w = cluster.fork();

        // message handling when the master receives message from a worker
        w.on('message', function(msg) {
            switch( msg.type ) {

                case 'START':
                    active_pids[msg['jid']] = {'worker': this, 'pid': msg['pid']};
                    console.log('[' + new Date().toISOString() + '] job %s run by worker %s:%s', msg['jid'], active_pids[msg['jid']]['worker'].id, active_pids[msg['jid']]['pid']);
                    break;

                case 'UAUTH':
                    // check the validity of the auth token for given rdmUser
                    var u = msg['rdm_user'];
                    var su = msg['stager_user'];

                    var cmd_opts = {
                        maxBuffer: 10*1024*1024
                    };

                    if ( su !== "" ) {
                        var proc_user = posix.getpwnam(su.split('@')[0]);
                        cmd_opts.uid = proc_user.uid;
                        cmd_opts.gid = proc_user.gid;
                    }

                    if ( typeof valid_auths[u] === 'undefined' ||
                         typeof valid_auths[u].validity === 'undefined' ||
                         valid_auths[u].validity < Date.now() - 600*1000 ) {

                        valid_auths[u] = { 'path':'', 'validity':0 };
                        // get fresh One-time password for the user
                        var cmd = stager_bindir + path.sep + 's-otp.sh';
                        var out = child_process.execFileSync( cmd, [u]);
                        var rdmPass = out.toString().split('\n')[0];

                        // call iinit to initialize token
                        cmd = stager_bindir + path.sep + 's-iinit.sh';
                        out = child_process.execFileSync( cmd, [ u, rdmPass ], cmd_opts);
                        var irodsA = out.toString().split('\n')[0];
                        var s = fs.statSync(irodsA);
                        if ( s.isFile() ) {
                            console.log( '[' + new Date().toISOString() + '] initiate irods token: ' + u);
                            valid_auths[u].path = irodsA;
                            valid_auths[u].validity = Date.now() + 12 * 3600 * 1000;
                        } else {
                            console.error( '[' + new Date().toISOString() + '] cannot create irods token: ' + u);
                        }
                    } else {
                        console.log( '[' + new Date().toISOString() + '] reuse valid irods token: ' + u);
                    }

                    // send-back the path in which the valid token is stored
                    sendMsgToWorker(this, {'type': 'UAUTH', 'path': valid_auths[u].path });
                    break;

                default:
                    delete active_pids[msg['jid']];
                    break;
            }
        });
    }
}

// Worker process of the cluster
if ( cluster.worker ) {

    var irodsA = undefined;

    // message handling when the worker receives message from the master
    process.on('message', function(msg) {
        switch( msg.type ) {
            case 'KILL':
                kill(msg['pid'], 'SIGKILL', function(err) {
                    console.log( '[' + new Date().toISOString() + '] job ' + msg['jid'] + ' killed upon user removal');
                });
                break;

            case 'UAUTH':
                irodsA = msg.path;
                break;

            default:
                break;
        }
    });

    queue.process("rdm", function(job, done) {

        var domain = require('domain').create();

        domain.on('error', function(err) {
            done(err);
        });

        domain.run( function() {
            if ( job.data.srcURL === undefined || job.data.dstURL === undefined ) {
                console.log('[' + new Date().toISOString() + '] job %d ignored: invalid arguments', job.id);
                done();
            } else {

                // ask master process to retrieve irodsA path
                irodsA = undefined;
                process.send({'type':'UAUTH',
                              'rdm_user': job.data.rdmUser,
                              'stager_user': (typeof job.data.stagerUser === 'undefined')?'':job.data.stagerUser});

                // set timer to wait until the irodsA is retrieved from the master process
                var authTimer = setInterval( function() {
                    if ( typeof irodsA === 'undefined' ) {
                        //console.log('.');
                    } else {
                        clearInterval(authTimer);
                        // TODO: make the logic implementation as a plug-in
                        var cmd = stager_bindir + path.sep;
                        if ( job.data.clientIF === undefined || job.data.clientIF == 'irods' ) {
                            cmd += 's-irsync.sh';
                        } else {
                            cmd += 's-duck.sh';
                        }

                        var cmd_args = [ job.data.srcURL, job.data.dstURL, job.data.rdmUser, irodsA ];
                        var cmd_opts = {
                            shell: '/bin/bash'
                        };

                        if ( typeof job.data.stagerUser !== "undefined" ) {
                            proc_user = posix.getpwnam(job.data.stagerUser.split('@')[0]);
                            cmd_opts.uid = proc_user.uid;
                            cmd_opts.gid = proc_user.gid;
                        }

                        var job_timeout_err;
                        var job_stopped = false;
                        var sec_noprogress = 0;
                        var child = child_process.spawn(cmd, cmd_args, cmd_opts);

                        // inform master the job has been started
                        process.send({'type':'START', 'jid': job.id, 'pid': child.pid});

                        // define callback when data piped to child.stdout
                        child.stdout.on('data', function(data) {
                            // use the child process's output to update job's progress
                            job.progress(parseInt(data.toString().trim()), 100);
                            // reset noprogress time counter
                            sec_noprogress = 0;
                        });

                        // define callback when child process exits
                        child.on( "close", function(code, signal) {
                            // set interal flag indicating the job has been stopped
                            job_stopped = true;
                            // inform master the job has been stopped
                            process.send({'type':'STOP', 'jid': job.id});
                            // interruption handling (null if process is not interrupted)
                            if ( signal != null ) {
                                if ( job_timeout_err === undefined ) {
                                    done(new Error('job terminated by ' + signal));
                                } else {
                                    done(new Error('job terminated by ' + signal + ':' + job_timeout_err ));
                                }
                            } else {
                                done(null, code);
                            }
                        });

                        // determine job timeout
                        var timeout;
                        if ( job.data.timeout === undefined || job.data.timeout <= 0 ) {
                            // no timeout
                            timeout = Number.MAX_SAFE_INTEGER;
                        } else {
                            timeout = job.data.timeout;
                        }

                        var timeout_noprogress;
                        if ( job.data.timeout_noprogress === undefined || job.data.timeout_noprogress <= 0 ) {
                            // no timeout
                            timeout_noprogress = 3600;
                        } else {
                            timeout_noprogress = job.data.timeout_noprogress;
                        }

                        // initiate a monitor loop (timer) for heartbeat check on job status/progress
                        var t_beg = new Date().getTime() / 1000;
                        var timer = setInterval( function() {
                            if ( ! job_stopped ) {
                                if ( sec_noprogress > timeout_noprogress ) {
                                    // job does not have any progress within an expected duration
                                    child.stdin.pause();
                                    kill(child.pid, 'SIGKILL', function(err) {
                                        job_timeout_err = 'no progress for ' + timeout_noprogress + 's';
                                        console.log( '[' + new Date().toISOString() + '] job ' + job.id + ' killed due to no progress for ' + timeout_noprogress + 's' );
                                    });
                                } else if ( new Date().getTime()/1000 - t_beg > timeout ) {
                                    // job is running over the expected duration
                                    child.stdin.pause();
                                    kill(child.pid, 'SIGKILL', function(err) {
                                        job_timeout_err = 'job timeout (> ' + timeout + 's)';
                                        console.log( '[' + new Date().toISOString() + '] job ' + job.id + ' killed due to timout (> ' + timeout + 's)');
                                    });
                                } else {
                                    // job doesn't reach any timeout, continue with nopgress time counter increased by 1 second
                                    sec_noprogress += 1;
                                }
                            } else {
                                // stop the timer if job is stopped
                                clearInterval(timer);
                            }
                        }, 1000 );
                    }
                }, 1000 );
            }
        });
    });
}

// graceful queue shutdown
function shutdown() {
    if ( cluster.isMaster ) {
        queue.shutdown( 60000, function(err) {
            console.log( 'Kue shutdown: ', err||'' );
            process.exit( 0 );
        });
    }
}

process.once( 'SIGTERM', function(sig) { shutdown(sig); } );
process.once( 'SIGINT', function(sig) { shutdown(sig); } );
