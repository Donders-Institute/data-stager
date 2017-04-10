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
        port: process.env.REDIS_PORT,
        host: process.env.REDIS_HOST
    }
});
var path = require('path');
var mailer = require('./routes/mailer');
var HtmlEncoder = require('node-html-encoder').Encoder;
var emoji = require('node-emoji');

var active_pids = {};

const stager_bindir = path.join(__dirname, 'bin');

// function for retrieving user profile from the data repository
var get_rdm_userprofile = function(uid) {
    var cmd = path.join(stager_bindir, 's-getuserprofile.sh');
    var cmd_args = [uid];
    var cmd_opts = {
        timeout: 60*1000,
        maxBuffer: 10*1024*1024
    };

    try {
        var data = JSON.parse(child_process.execFileSync(cmd, cmd_args, cmd_opts));
        // as the rule always return a profile regardless the user existence,
        // we check on the availability of the homeOrganisation attribute
        if (! data.profile.homeOrganisation) {
            throw new Error('invalid user due to missing "homeOrganisational"');
        } else {
            return data.profile;
        }
    } catch( err ){
        console.error(err.toString());
        return null;
    }
}

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
        // send notification to user
        kue.Job.get( id, function( error, job ) {

            if (error) {
                console.error('[' + new Date().toISOString() + '] cannot retrieve information of job: ' + error);
                return;
            }

            // skip notification email when the user is irods
            if (job.data.rdmUser == 'irods') {
                return;
            }

            // get user profile
            var uprofile = get_rdm_userprofile(job.data.rdmUser);
            if ( ! uprofile ) {
                console.error('[' + new Date().toISOString() + '] cannot retrieve profile of user: ' + job.data.rdmUser);
                return;
            }

            var t_create = new Date(parseInt(job.created_at));
            var t_update = new Date(parseInt(job.updated_at));
            var t_start = new Date(parseInt(job.started_at));
            var msgSubject = emoji.get('ok_hand') + '[INFO] stager job complete';
            var encoder = new HtmlEncoder('entity');
            var msgHtml = '<html>'
            msgHtml += '<style>';
            msgHtml += 'div { width: 100%; padding-top: 10px; padding-bottom: 10px;}';
            msgHtml += 'table { width: 95%; border-collapse: collapse; }';
            msgHtml += 'th { width: 20%; border: 1px solid #ddd; background-color: #f5f5f5; text-align: left; padding: 10px; }';
            msgHtml += 'td { width: 80%; border: 1px solid #ddd; text-align: left; padding: 10px; }';
            msgHtml += '</style>';
            msgHtml += '<body>';
            msgHtml += '<b>Please be informed by the following completed stager job:</b>';
            msgHtml += '<div><table>';
            msgHtml += '<tr><th>id</th><td>' + id + '</td></tr>';
            msgHtml += '<tr><th>state</th><td>' + job.state() + '</td></tr>';
            msgHtml += '<tr><th>owner</th><td>' + job.data.stagerUser + '</td></tr>';
            msgHtml += '<tr><th>repository user</th><td>' + job.data.rdmUser + '</td></tr>';
            msgHtml += '<tr><th>submitted at</th><td>' + t_create.toDateString() + ' ' + t_create.toTimeString() + '</td></tr>';
            msgHtml += '<tr><th>started at</th><td>' + t_start.toDateString() + ' ' + t_start.toTimeString() + '</td></tr>';
            msgHtml += '<tr><th>complete at</th><td>' + t_update.toDateString() + ' ' + t_update.toTimeString() + '</td></tr>';
            msgHtml += '<tr><th>source</th><td>' + encoder.htmlEncode(job.data.srcURL) + '</td></tr>';
            msgHtml += '<tr><th>destination</th><td>' + encoder.htmlEncode(job.data.dstURL) + '</td></tr>';
            msgHtml += '<tr><th>job detail</th><td><pre>' + JSON.stringify(job, null, 2) + '</pre></td></tr>';
            msgHtml += '</div></table>';
            msgHtml += '</html>';

            mailer.sendToAddresses(uprofile.email, false, msgSubject, null, msgHtml, null);
        });

        console.log('[' + new Date().toISOString() + '] job %d complete', id);
    }
}).on( 'job failed attempt', function(id, err, nattempts) {
    if ( cluster.isMaster) {
        console.log('[' + new Date().toISOString() + '] job %d failed, attempt %d', id, nattempts);
    }
}).on( 'job failed' , function(id, err) {
    if ( cluster.isMaster) {
        // send alarm to system admin
        kue.Job.get( id, function( error, job ) {
            if ( error ) {
                console.error('[' + new Date().toISOString() + '] cannot retrieve information of job: ' + error);
                return;
            }

            var t_create = new Date(parseInt(job.created_at));
            var t_failed = new Date(parseInt(job.updated_at));
            var msgSubject = emoji.get('warning') + '[ALARM] stager job failed';
            var encoder = new HtmlEncoder('entity');
            var msgHtml = '<html>'
            msgHtml += '<style>';
            msgHtml += 'div { width: 100%; padding-top: 10px; padding-bottom: 10px;}';
            msgHtml += 'table { width: 95%; border-collapse: collapse; }';
            msgHtml += 'th { width: 20%; border: 1px solid #ddd; background-color: #f5f5f5; text-align: left; padding: 10px; }';
            msgHtml += 'td { width: 80%; border: 1px solid #ddd; text-align: left; padding: 10px; }';
            msgHtml += '</style>';
            msgHtml += '<body>';
            msgHtml += '<b>Please be alamed by the following stager job failure:</b>';
            msgHtml += '<div><table>';
            msgHtml += '<tr><th>id</th><td>' + id + '</td></tr>';
            msgHtml += '<tr><th>state</th><td>' + job.state() + '</td></tr>';
            msgHtml += '<tr><th>owner</th><td>' + job.data.stagerUser + '</td></tr>';
            msgHtml += '<tr><th>repository user</th><td>' + job.data.rdmUser + '</td></tr>';
            msgHtml += '<tr><th>submitted at</th><td>' + t_create.toDateString() + ' ' + t_create.toTimeString() + '</td></tr>';
            msgHtml += '<tr><th>failed at</th><td>' + t_failed.toDateString() + ' ' + t_failed.toTimeString() + '</td></tr>';
            msgHtml += '<tr><th>source</th><td>' + encoder.htmlEncode(job.data.srcURL) + '</td></tr>';
            msgHtml += '<tr><th>destination</th><td>' + encoder.htmlEncode(job.data.dstURL) + '</td></tr>';
            msgHtml += '<tr><th>job detail</th><td><pre>' + JSON.stringify(job, null, 2) + '</pre></td></tr>';
            msgHtml += '</div></table>';
            msgHtml += '</html>';

            mailer.sendToAdmin(msgSubject, null, msgHtml, null);
        });
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
    var prj_map = require('./routes/project2collection');
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
    //var nworkers = require('os').cpus().length - 1;
    var nworkers = 4;
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
                        timeout: 3*60*1000,
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

                        var nattempts = 0;
                        var isOk = false;
                        var irodsA = '';
                        while ( ! isOk ) {
                            nattempts += 1;
                            if ( nattempts < 3 ) {
                                var cmd = stager_bindir + path.sep + 's-otp.sh';
                                var out = child_process.execFileSync( cmd, [u]);
                                var rdmPass = out.toString().split('\n')[0];

                                // call iinit to initialize token
                                cmd = stager_bindir + path.sep + 's-iinit.sh';
                                out = child_process.execFileSync( cmd, [ u, rdmPass ], cmd_opts);
                                irodsA = out.toString().split('\n')[0];
                                try {
                                    isOk = fs.statSync(irodsA).isFile();
                                } catch (err) {}
                            }
                        }

                        valid_auths[u] = { 'path':'', 'validity':0 };
                        if ( isOk ) {
                            console.log( '[' + new Date().toISOString() + '] initiate irods token: ' + u);
                            valid_auths[u].path = irodsA;
                            valid_auths[u].validity = Date.now() + 3600 * 1000;
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

    var irodsA = '';
    var authed = false;

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
                authed = true;
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
                irodsA = '';
                authed = false;
                process.send({'type':'UAUTH',
                              'rdm_user': job.data.rdmUser,
                              'stager_user': (typeof job.data.stagerUser === 'undefined')?'':job.data.stagerUser});

                // set timer to wait until the irodsA is retrieved from the master process
                var authTimer = setInterval( function() {
                    if ( authed ) {
                        clearInterval(authTimer);
                        if ( irodsA == '' ) {
                            return done(new Error('user not successfully authenticated: ' + job.data.rdmUser));
                        }

                        // TODO: make the logic implementation as a plug-in
                        var cmd = '';
                        if ( job.data.clientIF === undefined || job.data.clientIF == 'irods' ) {
                            cmd = path.join(stager_bindir,'s-irsync.sh');
                        } else {
                            cmd = path.join(stager_bindir,'s-duck.sh');
                        }

                        var cmd_args = [ "'"+job.data.srcURL+"'", "'"+job.data.dstURL+"'", job.data.rdmUser, irodsA ];
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
                            var _d = data.toString().trim();
                            if ( new RegExp('^error:.*').exec(_d) ) {
                                // save error line to job log
                                job.log(_d);
                                // kill process
                                child.stdin.pause();
                                kill(child.pid, 'SIGKILL', function(err) {
                                    console.log( '[' + new Date().toISOString() + '] job ' + job.id + ' killed due to error: ' + _d );
                                });
                            } else if ( new RegExp('^progress:[0-9]{1,3}:?.*').exec(_d) ) {
                                var _p = _d.split(':');
                                job.progress(parseInt(_p[1]), 100, _p[2] + '/' + _p[3]);
                                // reset noprogress time counter
                                sec_noprogress = 0;
                            }
                        });

                        // define callback when child process exits
                        child.on( "close", function(code, signal) {
                            // set interal flag indicating the job has been stopped
                            job_stopped = true;
                            // inform master the job has been stopped
                            process.send({'type':'STOP', 'jid': job.id});
                            // interruption handling (null if process is not interrupted)
                            if ( signal != null || code != 0 ) {
                                if ( job_timeout_err === undefined ) {
                                    done(new Error('job terminated by ' + signal + " (ec=" + code + ")"));
                                } else {
                                    done(new Error('job terminated by ' + signal + " (ec=" + code + "): " + job_timeout_err ));
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
