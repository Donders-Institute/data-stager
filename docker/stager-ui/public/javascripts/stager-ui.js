/**
 * The main javascript module for browser client of the File Stager.
 *
 * @author Hurng-Chun Lee <h.lee@donders.ru.nl>
 */

/**
 * data of historical jobs
 * @var {Object[]} jobsData
 */
var jobsData = [];
var jobTable;

/**
 * Check if the given path is a JSTree directory.
 * @param {string} p - the path
 * @return {boolean}
 */
function isJsTreeDir(p) {
    return p.match('.*(/|\\\\)$')?true:false;
}

/**
 * Display application dialog to show the ERROR message
 * @param {string} html_text - the error message in HTML format
 */
function showAppError(html_text) {
    $("#app_dialog").modal('toggle');
    $("#app_dialog_header").html( 'Error' );
    $("#app_dialog_message").html( html_text );
}

/**
 * Display application dialog to show the INFO message
 * @param {string} html_text - the info message in HTML format
 */
function showAppInfo(html_text) {
    $("#app_dialog").modal('toggle');
    $("#app_dialog_header").html( 'Information' );
    $("#app_dialog_message").html( html_text );
}

/**
 * Display the user login form
 * @param {string} loc - location of the panel, either "local" or "remote"
 * @param {string=} msg - if specified, the message to be shown on the error dialog
 */
function showLoginForm(loc, msg) {
    var ele_actions = ( loc == 'local' ) ? $("#action_local"):$("#action_remote");
    var ele_errmsg = ( loc == 'local' ) ? $("#login_error_local"):$("#login_error_remote");
    var ele_filetree = ( loc == 'local' ) ? $("#filetree_local"):$("#filetree_remote");
    var ele_form = ( loc == 'local' ) ? $("#local_login_form"):$("#remote_login_form");
    var ele_username = ( loc == 'local' ) ? $("#fs_username_local"):$("#fs_username_remote");

    // hide filetree and action buttons
    ele_filetree.hide();
    ele_actions.hide();

    // show login form without username on it
    ele_username.html('');
    ele_form.find('input[name="password"]').val('')
    ele_form.show();

    if ( typeof msg === 'undefined' || msg == '' ) {
        ele_errmsg.hide();
    } else {
        ele_errmsg.text(msg);
        ele_errmsg.show();
    }
}

/**
 * Display the filesystem tree panel
 * @param {string} loc - location of the panel, either "local" or "remote"
 * @param {string} root - the top-level directory of the tree
 */
function showFileSystemTree(loc, root) {
    var ele_actions = ( loc == 'local' ) ? $("#action_local"):$("#action_remote");
    var ele_filetree = ( loc == 'local' ) ? $("#filetree_local"):$("#filetree_remote");
    var ele_form = ( loc == 'local' ) ? $("#local_login_form"):$("#remote_login_form");
    var ajax_script = ( loc == 'local' ) ? params.l_fs_path_getdir:params.r_fs_path_getdir;
    var ele_userbutton = ( loc == 'local' ) ? $("#button_user_local"):$("#button_user_remote");
    var ele_mkdir = ( loc == 'local' ) ? $("#button_mkdir_local"):$("#button_mkdir_remote");
    var ele_username = ( loc == 'local' ) ? $("#fs_username_local"):$("#fs_username_remote");
    var u = ( loc == 'local' ) ? Cookies.get('username_local'):Cookies.get('username_remote');
    var login_path = ( loc == 'local' ) ? params.l_fs_path_login:params.r_fs_path_login;
    var init_root = ( loc == 'local' ) ? params.l_fs_root:params.r_fs_root;
    var mkdir_path = ( loc == 'local' ) ? params.l_fs_path_mkdir:params.r_fs_path_mkdir;

    // decode special html characters of the given path
    root=htmlDecodeSpace(root);
    init_root=htmlDecodeSpace(init_root);

    if ( typeof(u) === 'undefined' && login_path ) {
        showLoginForm(loc, '');
    } else {

        // hide login form
        ele_form.hide();

        // show filetree and action buttons
        ele_actions.show();
        //ele_pathaction.show();
        ele_filetree.show();

        if ( ! login_path ) {
            ele_userbutton.hide();
        } else {
            ele_username.html(u);
            ele_userbutton.show();
        }

        // breadcrumbs
        // split current root into list of folders, and replace the init_root with '/root/'
        var subdirs = root.replace(init_root,'/root/').split('/').filter( function(v) { return v != ''; } );

        // the top folder is presented with a HOME icon
        // the parent folder is presented with a LEVEL-UP icon
        var htmlCnt = '';
        if (subdirs.length == 1) {
            htmlCnt += '<li class="active">' +
            '<i class="fa fa-home" data-toggle="tp-breadcrumbs" title="' + init_root + '"></i></li>';
        } else {
            var dir_init_root=htmlEncodeSpace(init_root);
            htmlCnt += '<li>' + '<a href=# onclick=showFileSystemTree("'+loc+'","'+dir_init_root+'");>' +
            '<i class="fa fa-home" data-toggle="tp-breadcrumbs" title="' + dir_init_root + '"></i></a></li>';

            if ( subdirs.length >= 3 ) {
                // insert link to go to parent folder
                var dir_t = htmlEncodeSpace(init_root + subdirs.slice(1,-1).join('/') + '/');
                htmlCnt += '<li>' + '<a href=# onclick=showFileSystemTree("'+loc+'","'+dir_t+'");>' +
                '<i class="fa fa-level-up" data-toggle="tp-breadcrumbs" title="' + dir_t +'"></i></a></li>';
            }

            // showing the current directory name
            htmlCnt += '<li class="active">';
            if ( subdirs[subdirs.length-1].length > 30 ) {
                htmlCnt += '<span data-toggle="tp-breadcrumbs" title="' + htmlEncodeSpace(subdirs[subdirs.length-1]) + '">' +
                htmlEncodeSpace(subdirs[subdirs.length-1].substr(0,30)) + '&#8230;</span>';
            } else {
                htmlCnt += htmlEncodeSpace(subdirs[subdirs.length-1]);
            }
            htmlCnt += '</li>';
        }

        // display the breadcrumbs
        var domCwd = $(ele_filetree.get(0)).find('#cwd');
        domCwd.html(htmlCnt);
        $('[data-toggle="tp-breadcrumbs"]').tooltip();

        // update params.l_fs_cwd or params.r_fs_cwd
        if ( loc == 'local' ) {
            params.l_fs_cwd = root;
        } else {
            params.r_fs_cwd = root;
        }

        // jsTree
        var domJstree = $(ele_filetree.get(0)).find('#jstree');

        // destroy the existing tree to force the new tree to be reloaded
        domJstree.jstree("destroy");

        // reload the jstree
        domJstree.on('activate_node.jstree', function(err, data) {
            // data.event is 'undefined' if user clicks on the checkbox
            // this is the handle to check whether user is clicking on a checkbox
            // or getting into a folder.
            if ( isJsTreeDir(data.node.id) && typeof data.event != 'undefined') {
                showFileSystemTree(loc, data.node.id);
            }
        }).on('ready.jstree', function(err) {
            // actions when the filesystem tree is ready
            if ( root != init_root && mkdir_path != "") {
                ele_mkdir.removeClass('disabled');
            } else {
                ele_mkdir.addClass('disabled');
            }
        }).jstree({
            core: {
                animation: 0,
                check_callback: true,
                error: function(err) {
                    showAppError(err.reason + ": " + err.data);
                },
                data: {
                    url: ajax_script,
                    data: function(node) {
                        return { 'dir': ( node.id == '#') ? root : node.id,
                                 'isRoot': (node.id == '#') }
                    }
                },
                themes: {
                    name: 'proton',
                    responsive: true
                }
            },
            checkbox: {
                keep_selected_style: false,
                tie_selection: false,
                three_state: false,
                whole_node: false,
                cascade: 'undetermined',
            },
            sort: function(a, b) {
                var na = this.get_node(a);
                var nb = this.get_node(b);

                // sorting by type and file/directory name
                if ( isJsTreeDir(na.id) == isJsTreeDir(nb.id) ) {
                    return ( na.id > nb.id ) ? 1:-1;
                } else {
                    return isJsTreeDir(na.id) ? 1:-1;
                }
                return -1;
            },
            plugins: [ 'checkbox', 'wholerow', 'sort' ]
        });
    }
}

/**
 * Perform user login, on success display the top-level directory tree
 * @param {string} loc - location of the panel, either "local" or "remote"
 * @param {string} user - the username
 * @param {string} credential - the jQuery serialized form data from the login form
 */
function doUserLogin( loc, user, credential ) {
    var login_path = ( loc == 'local' ) ? params.l_fs_path_login:params.r_fs_path_login;
    var init_root = ( loc == 'local' ) ? params.l_fs_root:params.r_fs_root;
    var fs_server = ( loc == 'local' ) ? params.l_fs_server:params.r_fs_server;
    $.post(login_path, credential, function(data) {
        //console.log(data);
    }).done( function() {
        Cookies.set('username_' + loc , user);
        showFileSystemTree(loc, init_root);
    }).fail( function() {
        showAppError('Authentication failure: ' + fs_server);
    });
}

/**
 * Perform user logout, it removes relevent cookie variable
 * @param {string} loc - location of the panel, either "local" or "remote"
 */
function doUserLogout( loc ) {
    var logout_path = ( loc == 'local' ) ? params.l_fs_path_logout:params.r_fs_path_logout;
    var fs_server = ( loc == 'local' ) ? params.l_fs_server:params.r_fs_server;
    $.post(logout_path, function(data) {
        showAppInfo(fs_server + " user logged out");
        Cookies.remove('username_' + loc);
        showLoginForm(loc,'');
    }).fail( function() {
        showAppError('fail logout ' + fs_server + ' user');
    });
}

/**
 * Toggle the dialog for making new directory
 * @param {string} loc - location of the panel, either "local" or "remote"
 */
function showMakeDirDialog(loc) {

    $("#mkdir_dialog_alert").hide();

    var sname = ( loc == 'local' ) ? params.l_fs_server:params.r_fs_server;
    var cwd = ( loc == 'local' ) ? params.l_fs_cwd:params.r_fs_cwd;
    var ajax_script = ( loc == 'local' ) ? params.l_fs_path_mkdir:params.r_fs_path_mkdir;

    if ( ajax_script == "" ) {
        showAppInfo('directory creation not supported');
    } else {
        $("#mkdir_dialog").modal('toggle');
        $("#mkdir_dialog_title").html( 'Create new folder on ' + sname );

        // construct the fixe prefix of this current folder
        cwd_html = '<span>' + cwd + '</span>';

        if ( cwd.length > 20 ) {
            cwd_html = '<span data-toggle="tp-mkdir-dialog" title="' + cwd + '">' +
            cwd.substr(0,8) + '&#8230;' + cwd.substr(cwd.length-8, cwd.length-1) + '</span>';
        }

        $("#mkdir_dialog_cwd_display").html(cwd_html);
        $('[data-toggle="tp-mkdir-dialog"]').tooltip();
        $("#mkdir_dialog_cwd").val(cwd);
        $("#mkdir_dialog_loc").val(loc);
    }
}

/**
 * Toggle period session validity check brackground process.  If the session is
 * expired, it displays an application error.
 */
function checkSessionValidity() {
    setInterval( function() {
        if ( ! Cookies.get('stager-ui.sid') ) {
            // block the whole page with a warning; and ask user to refresh the page
            showAppError('session expired, please <a href="javascript:location.reload();">refresh</a> the page.');
        }
    }, 60 * 1000 );
}

/**
 * Perform selection of all objects on the jsTree panel.
 * @param {string} loc - location of the panel, either "local" or "remote"
 */
function doSelectAll(loc) {
    var ele_filetree = ( loc == 'local' ) ? $("#filetree_local"):$("#filetree_remote");
    if ( ele_filetree != null ) {
        $(ele_filetree.get(0)).find('#jstree').jstree(true).check_all();
    }
}

/**
 * Perform de-selection of all objects on the jsTree panel.
 * @param {string} loc - location of the panel, either "local" or "remote"
 */
function doDeselectAll(loc) {
    var ele_filetree = ( loc == 'local' ) ? $("#filetree_local"):$("#filetree_remote");
    if ( ele_filetree != null ) {
        $(ele_filetree.get(0)).find('#jstree').jstree(true).uncheck_all();
    }
}

/**
 * Perform creation of the new directory.
 * @param {string} loc - location of the panel, either "local" or "remote"
 * @param {string} base - the parent directory in which the new directory to be created
 * @param {string} dirName - the name of the new directory
 */
function doMakeDir(loc, base, dirName) {
    if ( dirName == "" ) {
        // show error on the mkdir dialog
        $("#mkdir_dialog_alert_msg").html('Please specify the name of the new folder');
        $("#mkdir_dialog_alert").show();
    } else {
        var parts = dirName.split('/').filter( function(v) { return v != ''; } );
        if ( parts.length > 1 ) {
            $("#mkdir_dialog_alert_msg").html('sub-folder not supported');
            $("#mkdir_dialog_alert").show();
        } else {
            $("#mkdir_dialog").modal('hide');
            // flush the user input
            $("#mkdir_dialog_dir").val("");
            // now make the directory
            var ajax_script = ( loc == 'local' ) ? params.l_fs_path_mkdir:params.r_fs_path_mkdir;
            var ele_filetree = ( loc == 'local' ) ? $("#filetree_local"):$("#filetree_remote");

            if ( ajax_script == "" ) {
                showAppInfo('directory creation not supported');
            } else {
                var dir = base + '/' + dirName;
                $.ajax({
                    type: 'POST',
                    url: ajax_script,
                    data: {
                        dir: dir
                    },
                    statusCode: {
                        500: function(jqxhr, status, err) {
                            // popup the application error panel
                            showAppError(err);
                        },
                        200: function(data, status, jqxhr) {
                            showAppInfo('folder ' + dir + ' created!');
                            // refresh the filetree view
                            $(ele_filetree.get(0)).find('#jstree').jstree(true).refresh();
                        }
                    }
                }).done( function() {
                    console.log('directory ' + dir + ' created');
                });
            }
        }
    }
}

/**
 * Perform update on the table of historical jobs.
 * @param {Object} table - a jQuery DataTables object, see {@link https://datatables.net|DataTables}
 */
function updateJobHistoryTable(table) {
    $.get("/stager/job/state", function(data) {
        // count totoal amount of jobs
        var idx_t = 0;
        Object.keys(data).forEach(function(k) {
            if ( k.indexOf('Count') >= 0 ) {
                idx_t += data[k];
            }
        });

        // get jobs
        if ( idx_t > 0 ) {
            var url = "/stager/jobs/0-" + idx_t;
            $.get(url, function(data) {
                // feed the data to job history table
                jobsData = data;
                table.ajax.reload();
            });
        }
    }).done( function() {
    }).fail( function() {
        // whenever there is an error, stop the background process
        $('#history-refresh-toggle').bootstrapSwitch('state',false);
        // empty the jobTable (i.e. reset the data of the table)
        jobsData = [];
        table.ajax.reload();
        // raise an error
        showAppError('cannot retrieve history');
    });
}

/**
 * Perform submission of new jobs
 * @param {Object[]} jobs - the job objects
 * @param {string} jobs[].srcURL - the source URL of the job
 * @param {string} jobs[].dstURL - the destniation URL of the job
 */
function submitJobs(jobs) {
    $("#job_confirmation").modal( "hide" );
    $.post('/stager/jobs', {'jobs': JSON.stringify(jobs)}, function(data) {
        showAppInfo('IDs of submitted jobs: ' + data.map(function(j) { return j.id; }).join(', '));
    }).fail( function() {
        showAppError('Job submission failed');
    });
}

/**
 * Display dialog for (re-)starting a stopped/completed/failed job.
 * @param {string} id - the job id
 */
function showJobStartDialog(id) {
    $('#job_action_msg').html('You are about to (re-)start job: ' + id);
    $('#job_action_dialog button#confirm').data('job-action','start');
    $('#job_action_dialog button#confirm').data('job-id',id);
    $('#job_action_dialog').modal('toggle');
}

/**
 * Display dialog for stopping a running job.
 * @param {string} id - the job id
 */
function showJobStopDialog(id) {
    $('#job_action_msg').html('You are about to stop job: ' + id);
    $('#job_action_dialog button#confirm').data('job-action','stop');
    $('#job_action_dialog button#confirm').data('job-id',id);
    $('#job_action_dialog').modal('toggle');
}

/**
 * Display dialog for deleting a job.
 * @param {string} id - the job id
 */
function showJobDeleteDialog(id) {
    $('#job_action_msg').html('You are about to delete job: ' + id);
    $('#job_action_dialog button#confirm').data('job-action','delete');
    $('#job_action_dialog button#confirm').data('job-id',id);
    $('#job_action_dialog').modal('toggle');
}

/**
 * Perform deletion on a job.
 * @param {string} id - the job id
 */
function deleteJob(id) {
    var url = "/stager/job/" + id;
    $.ajax(url, {
        type: 'DELETE',
        success: function(data) {
            if ( data.message ) { showAppInfo(data.message); }
            // remove entry from the jobsData
            var idx = jobsData.map(function(j) { return j.id; }).indexOf(id);
            // make clearn deletion, i.e. no empty slots left over in array
            if ( idx >= 0 ) { jobsData.splice(idx,1); }
            // refresh the jobsTable
            jobTable.ajax.reload();
        },
        error: function(xhr, status, error) {
            showAppError('Job deletion failed: ' + id + ' status: ' + status + ' error: ' + error);
        }
    });
}

/**
 * Perform start or restart on a job.
 * @param {string} id - the job id
 */
function startJob(id) {
    var url = "/stager/job/" + id + '/state/inactive';
    $.ajax(url, {
        type: 'PUT',
        success: function(data) {
            if ( data.message ) { showAppInfo(data.message); }
            refreshJob(id);
        },
        error: function(xhr, status, error) {
            showAppError('Job deletion failed: ' + id + ' status: ' + status + ' error: ' + error);
        }
    });
}

/**
 * Refresh a job's detail.
 * @param {string} id - the job id
 */
function refreshJob(id) {
    var url = "/stager/job/" + id;
    $.get(url, function(data) {
        // update the job detail in the jobsData array
        var idx = jobsData.map(function(j) { return j.id; }).indexOf(id);
        if ( idx >= 0 ) {
            //convert data.id to integer when it is a string
            data.id = (typeof data.id === 'string') ? parseInt(data.id):data.id;
            jobsData[idx] = data;
            // find the row referred with the job id
            var row = jobTable.row( function(idx, data, node) {
                return data.id == id;
            });

            if ( row ) {
                row.child.hide();
                $(row.node()).removeClass('shown');
                row.child( formatJobDetail(data) ).show();
                $(row.node()).addClass('shown');
            }
        }
    });
}

/**
 * Construct detail panel of given job.
 * @param {Object} j - the job data object
 * @param {string} j.id - the job id
 * @param {string} j.state - the job statusCode
 * @param {string} j.data.srcURL - the source URL of the job
 * @param {string} j.data.dstURL - the destination URL of the job
 * @param {long} j.created_at - job creation (epoch) time in seconds
 * @param {long} j.updated_at - job last update (epoch) time in seconds
 * @param {int} j.attempts.made - number of job attempts has been made
 * @return {string} the job detail in HTML format
 */
function formatJobDetail(j) {

    // HTML tag for start button
    var bt_start_html = '<button type="button" class="btn btn-sm btn-default ';
    if ( ['complete','failed'].includes(j.state) ) {
        bt_start_html += 'active" onclick="showJobStartDialog(' + j.id + ')">';
    } else {
        bt_start_html += 'disabled">';
    }
    bt_start_html += '<i data-toggle="tp-job-actions" title="start/restart" class="fa fa-play"></i></button>';

    // HTML tag for stop button
    var bt_stop_html = '<button type="button" class="btn btn-sm btn-default ';
    if ( ['active'].includes(j.state) ) {
        bt_stop_html += 'active" onclick="showJobStopDialog(' + j.id + ')">';
    } else {
        bt_stop_html += 'disabled">';
    }
    bt_stop_html += '<i data-toggle="tp-job-actions" title="stop/cancel" class="fa fa-stop"></i></button>';

    var bt_delete_html = '<button type="button" class="btn btn-sm btn-danger active" onclick="showJobDeleteDialog(' + j.id + ')"><i data-toggle="tp-job-actions" title="delete" class="fa fa-trash"></i></button>';

    var btn_actions = '<div class="btn-group" id="job_action">' +
                      bt_start_html + bt_stop_html + bt_delete_html +
                      '</div>';

    return '<div class="panel panel-default">'
    + '<div class="panel-body">'
    + '<table class="table table-hover">'
    + '<tbody>'
    + '<tr>'
    + '<td>From:</td>'
    + '<td>' + j.data.srcURL + '</td>'
    + '</tr>'
    + '<tr>'
    + '<td>To:</td>'
    + '<td>' + j.data.dstURL + '</td>'
    + '</tr>'
    + '<tr>'
    + '<td>Created at:</td>'
    + '<td>' + new Date(Number(j.created_at)).toISOString() + '</td>'
    + '</tr>'
    + '<tr>'
    + '<td>Updated at:</td>'
    + '<td>' + new Date(Number(j.updated_at)).toISOString() + '</td>'
    + '</tr>'
    + '<tr>'
    + '<td>Attempts:</td>'
    + '<td>' + j.attempts.made + '</td>'
    + '</tr>'
    + '</tbody>'
    + '</table>'
    + '<div class="panel-footer">' + btn_actions + '</div>'
    + '</div>'
    + '</div>';
}

/**
 * Run the main program of the stager UI.
 * @param {Object} params - the application configuration parameters
 */
function runStagerUI(params) {

    var jobTableRefreshId = null;

    // data for new jobs
    var newJobs = [];

    /**
     * the jQuery DataTables object, see {@link https://datatables.net|DataTables}
     */
    jobTable = $('#job_table').DataTable({
        "ajax": function(data, callback, settings) {
            callback({data: jobsData});
        },
        "columnDefs": [
            {
                "render": function(data, type, row) {
                    if ( row.progress_data ) {
                        return data + ' (' + row.progress_data + ')';
                    } else {
                        return data;
                    }
                },
                "targets": 4
            }
        ],
        "columns": [
            {
                "className": 'details-control',
                "orderable": false,
                "data": null,
                "defaultContent": ''
            },
            { "data": "id",
            "className": "dt-body-center"},
            { "data": "data.srcURL",
            "render": $.fn.dataTable.render.ellipsis(20)},
            { "data": "data.dstURL",
            "render": $.fn.dataTable.render.ellipsis(20)},
            { "data": "state",
            "className": "dt-body-left"},
            { "data": "progress",
            "render": $.fn.dataTable.render.percentBar('square','#FFF','#269ABC','#31B0D5','#286090',0)}
        ],
        "order": [[1, 'desc']]
    });

    // function to stop job table refresh task
    function stopJobTableRefresh() {
        if ( jobTableRefreshId != null ) {
            clearInterval(jobTableRefreshId);
            jobTableRefreshId = null;
        }
    };

    // function to start job table refresh task, with iteration delay in seconds
    function startJobTableRefresh(delay) {
        if ( jobTableRefreshId == null ) {
            jobTableRefreshId = setInterval( function() {
                updateJobHistoryTable(jobTable); }, delay * 1000 );
        }
    };

    // toggle for background history refresh
    // action toggle background history refresh
    function setHistoryRefreshMode(e, s) {
        if (s) {
            $('#button_refresh_history').addClass('disabled');
            startJobTableRefresh(10);
        } else {
            $('#button_refresh_history').removeClass('disabled');
            stopJobTableRefresh();
        }
    };

    /* general function for getting checked file/directory items */
    function get_jstree_checked_items( element ) {
        return (element.jstree(true)) ?
        element.jstree(true).get_checked():[];
    };

    /* general function for composing and sending staging jobs */
    function send_staging_job( action, src, dst ) {

        var loc_src = ( action == 'upload' ) ? 'local (left panel)':'remote (right panel)';
        var loc_dst = ( action == 'upload' ) ? 'remote (right panel)':'local (left panel)';

        var purl_src = ( action == 'upload' ) ? params.l_fs_prefix_turl:params.r_fs_prefix_turl;
        var purl_dst = ( action == 'upload' ) ? params.r_fs_prefix_turl:params.l_fs_prefix_turl;

        // check: one of the src/dst is missing
        if ( typeof src === 'undefined' || src.length == 0 ) {
            showAppError('No source: please select ' + loc_src + ' directory/files');
            return false;
        }

        if ( typeof dst === 'undefined' || dst.length == 0 ) {
            // take current directory as the destination if the current directory is not the root
            var root = ( action == 'upload' ) ? params.r_fs_root:params.l_fs_root;
            var cwd = ( action == 'upload' ) ? params.r_fs_cwd:params.l_fs_cwd;
            if ( cwd != root ) {
                dst = [ cwd ];
            } else {
                showAppError('No destination: please select ' + loc_dst + ' directory as destination');
                return false;
            }
        }

        // check if dst is not single and not a directory
        if ( dst.length > 1 ) {
            showAppError('Only one destination is allowd, you selected ' + dst.length);
            return false;
        } else if (! isJsTreeDir(dst[0]) ) {
            showAppError('Destination not a directory: ' + dst[0]);
            return false;
        }

        var srcDirs = [];
        var srcFiles = [];

        src.forEach( function(s) {
            if ( isJsTreeDir(s) ) {
                srcDirs.push(s);
            } else {
                srcFiles.push(s);
            }
        });

        newJobs = [];
        srcFiles.forEach( function(s) {
            var dirs = srcDirs.filter( function(sd) {
                return s.search(sd) >= 0;
            });

            // create a job when there is no parent directory on src list
            if ( dirs.length == 0 ) {
                newJobs.push({ dstURL: purl_dst + dst[0], srcURL: purl_src + s });
            }
        });

        srcDirs.forEach( function(s) {
            var dirs = srcDirs.filter( function(sd) {
                return s != sd && s.search(sd) >= 0;
            });

            // create a job when there is no parent directory on srcDirs list
            if ( dirs.length == 0 ) {
                // extend destination with the directory name of the source
                if ( s.match('.*/$') ) {
                    // *nix way
                    newJobs.push({ dstURL: purl_dst + dst[0] +
                        s.split('/').slice(-2)[0] + '/', srcURL: purl_src + s });
                } else {
                    // Windows way
                    newJobs.push({ dstURL: purl_dst + dst[0] +
                        s.split('\\').slice(-2)[0] + '\\', srcURL: purl_src + s });
                }
            }
        });

        // open up the modal and preview the jobs
        $("#job_confirmation").modal("toggle");
        $("#job_preview_header").html( function() {
            return '<b>' + newJobs.length + '</b> transfer jobs to be submitted.' 
        });
        $("#job_preview").html( function() {
            var html_d = '<table class="table">';
            html_d += '<thead><tr>';
            html_d += '<th>From (srcURL)</th>';
            html_d += '<th>To (dstURL)</th>';
            html_d += '</tr></thead>';
            html_d += '<tbody>';
            newJobs.forEach( function(j) {
                html_d += '<tr>';
                html_d += '<td>' + j.srcURL + '</td>';
                html_d += '<td>' + j.dstURL + '</td>';
                html_d += '</tr>';
            });
            html_d += '</tbody></table>';
            return html_d;
        });

        return true;
    };

    // event listener for opening and closing job detail row
    $('#job_table tbody').on('click', 'td.details-control', function () {
        var tr = $(this).closest('tr');
        var row = jobTable.row( tr );

        if ( row.child.isShown() ) {
            // This row is already open - close it
            row.child.hide();
            tr.removeClass('shown');
        }
        else {
            // Open this row
            row.child( formatJobDetail(row.data()) ).show();
            tr.addClass('shown');
            $('[data-toggle="tp-job-actions"]').tooltip();
        }
    } );

    // event listener for creating a new fs directory
    // !!the event should be handled by the document level as
    //   the #submit_mkdir is a button within the Boostrap modal!!
    $(document).on('click', '#submit_mkdir', function() {
        doMakeDir($("#mkdir_dialog_loc").val(),
                 $("#mkdir_dialog_cwd").val(),
                 $("#mkdir_dialog_dir").val());
    });

    // event listener for closing the dialog for creating a new fs directory
    $(document).on("close.bs.alert", "#mkdir_dialog_alert", function () {
        $("#mkdir_dialog_alert").hide(); //hide the alert
        return false;                    //don't remove it from DOM
    });

    // event listener for toggle and stop background job history update
    $('#history-refresh-toggle').bootstrapSwitch({
        size: "normal",
        onText: "A",
        offText: "M",
        onInit: setHistoryRefreshMode,
        onSwitchChange: setHistoryRefreshMode
    });

    // event listener to disable automatic job history update by default
    $('.navbar-nav a').on('shown.bs.tab', function(event){
        if ( $(event.target).text() == 'History' ) {
            updateJobHistoryTable(jobTable);
            // by-default disable the auto refresh of job history
            $('#history-refresh-toggle').bootstrapSwitch('state',false);
        } else {
            stopJobTableRefresh();
        }
    });

    // event listener for submitting stager jobs
    $("#job_submit").click(function() {
        submitJobs(newJobs);
    });

    // event listener for cancelling stager job submission
    $("#job_cancel").click(function() {
        newJobs = [];
        $("#job_confirmation").modal( "hide" );
    });

    // event listener for upload button
    $('#button_upload').click(function() {
        //src: local
        var checked_src = get_jstree_checked_items($($("#filetree_local").get(0)).find('#jstree'));
        //dst: remote
        var checked_dst = get_jstree_checked_items($($("#filetree_remote").get(0)).find('#jstree'));
        // send staging job
        if ( send_staging_job('upload', checked_src, checked_dst) ) {
            console.log('job submitted');
        }
    });

    // event listener for download button
    $('#button_download').click(function() {
        //src: remote
        var checked_src = get_jstree_checked_items($($("#filetree_remote").get(0)).find('#jstree'));
        //dst: local
        var checked_dst = get_jstree_checked_items($($("#filetree_local").get(0)).find('#jstree'));
        // send staging job
        if ( send_staging_job('download', checked_src, checked_dst) ) {
            console.log('job submitted');
        }
    });

    // event listener for refreshing local fs tree
    $('#button_refresh_local').click(function() {
        $($("#filetree_local").get(0)).find('#jstree').jstree(true).refresh();
    });

    // event listener for logging out local user
    $('#button_logout_local').click(function() {
        doUserLogout('local');
    });

    // event listener for toggling local mkdir dialog
    $('#button_mkdir_local').click(function() {
        showMakeDirDialog('local');
    });

    // event listener for toggling local select all on jstree
    $('#button_selectall_local').click(function() {
        doSelectAll('local');
    });

    // event listener for toggling local deselect all on jstree
    $('#button_deselectall_local').click(function() {
        doDeselectAll('local');
    });

    // event listener for logging in local user
    $('#login_form_local').on( 'submit', function( event ) {
        event.preventDefault();
        doUserLogin('local',
            $(this).find('input[name="username"]').val(),
            $(this).serialize());
    });

    // event listener for refreshing remote fs tree
    $('#button_refresh_remote').click(function() {
        $($("#filetree_remote").get(0)).find('#jstree').jstree(true).refresh();
    });

    // event listener for logging out remote user
    $('#button_logout_remote').click(function() {
        doUserLogout('remote');
    });

    // event listener for toggling remote mkdir dialog
    $('#button_mkdir_remote').click(function() {
        showMakeDirDialog('remote');
    });

    // event listener for toggling remote select all on jstree
    $('#button_selectall_remote').click(function() {
        doSelectAll('remote');
    });

    // event listener for toggling remote deselect all on jstree
    $('#button_deselectall_remote').click(function() {
        doDeselectAll('remote');
    });

    // event listener for logging in remote user
    $('#login_form_remote').on( 'submit', function( event ) {
        event.preventDefault();
        doUserLogin('remote',
            $(this).find('input[name="username"]').val(),
            $(this).serialize());
    });

    // event listener for maunally update job history
    $('#button_refresh_history').click(function() {
        updateJobHistoryTable(jobTable);
    });

    // event listener for job action dialog
    $('#job_action_dialog button#confirm').click( function() {
        var action = $(this).data('job-action');
        var id = $(this).data('job-id');
        switch(action) {
            case 'delete':
                deleteJob(id);
                break;
            case 'start':
                startJob(id);
                break;
            case 'stop':
                break;
            default:
                break;
        }
        
        // hide the job action dialog
        $('#job_action_dialog').modal('hide');
    });

    /* local filetree or login initialisation */
    if ( params.l_fs_view == "login" ) {
        showLoginForm('local','');
    } else {
        showFileSystemTree('local', params.l_fs_root);
    }

    /* remote filetree or login initialisation */
    if ( params.r_fs_view == "login" ) {
        showLoginForm('remote','');
    } else {
        showFileSystemTree('remote', params.r_fs_root);
    }

    // enable periodic check on session validity
    checkSessionValidity();
}
