/* utility function to determine whether a given path is a directory */
function isDir(p) {
    return p.match('.*(/|\\\\)$')?true:false;
}

/* utility function to toggle application dialog for error message */
function appError(html_text) {
    $("#app_dialog").modal('toggle');
    $("#app_dialog_header").html( 'Error' );
    $("#app_dialog_message").html( html_text );
};

/* utility function to toggle application dialog for information */
function appInfo(html_text) {
    $("#app_dialog").modal('toggle');
    $("#app_dialog_header").html( 'Information' );
    $("#app_dialog_message").html( html_text );
}

/* general function for displaying the login form */
function show_login_form(loc, msg) {
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
};

/* general function for displaying the filetree */
function show_filetree(loc, root) {
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
        show_login_form(loc, '');
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
            htmlCnt += '<li>' + '<a href=# onclick=show_filetree("'+loc+'","'+dir_init_root+'");>' +
            '<i class="fa fa-home" data-toggle="tp-breadcrumbs" title="' + dir_init_root + '"></i></a></li>';

            if ( subdirs.length >= 3 ) {
                // insert link to go to parent folder
                var dir_t = htmlEncodeSpace(init_root + subdirs.slice(1,-1).join('/') + '/');
                htmlCnt += '<li>' + '<a href=# onclick=show_filetree("'+loc+'","'+dir_t+'");>' +
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
            if ( isDir(data.node.id) && typeof data.event != 'undefined') {
                show_filetree(loc, data.node.id);
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
                    appError(err.reason + ": " + err.data);
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
                if ( isDir(na.id) == isDir(nb.id) ) {
                    return ( na.id > nb.id ) ? 1:-1;
                } else {
                    return isDir(na.id) ? 1:-1;
                }
                return -1;
            },
            plugins: [ 'checkbox', 'wholerow', 'sort' ]
        });
    }
};

/* general function for user login */
function login_user( loc, user, credential ) {
    var login_path = ( loc == 'local' ) ? params.l_fs_path_login:params.r_fs_path_login;
    var init_root = ( loc == 'local' ) ? params.l_fs_root:params.r_fs_root;
    var fs_server = ( loc == 'local' ) ? params.l_fs_server:params.r_fs_server;
    $.post(login_path, credential, function(data) {
        //console.log(data);
    }).done( function() {
        Cookies.set('username_' + loc , user);
        show_filetree(loc, init_root);
    }).fail( function() {
        appError('Authentication failure: ' + fs_server);
    });
}

/* general function for user logout */
function logout_user( loc ) {
    var logout_path = ( loc == 'local' ) ? params.l_fs_path_logout:params.r_fs_path_logout;
    var fs_server = ( loc == 'local' ) ? params.l_fs_server:params.r_fs_server;
    $.post(logout_path, function(data) {
        appInfo(fs_server + " user logged out");
        Cookies.remove('username_' + loc);
        show_login_form('local','');
    }).fail( function() {
        appError('fail logout ' + fs_server + ' user');
    });
};

/* toggle dialog modal for creating new folder */
function toggle_mkdir_dialog(loc) {

    $("#mkdir_dialog_alert").hide();

    var sname = ( loc == 'local' ) ? params.l_fs_server:params.r_fs_server;
    var cwd = ( loc == 'local' ) ? params.l_fs_cwd:params.r_fs_cwd;
    var ajax_script = ( loc == 'local' ) ? params.l_fs_path_mkdir:params.r_fs_path_mkdir;

    if ( ajax_script == "" ) {
        appInfo('directory creation not supported');
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
};

// function to check session validity every minute
function checkSessionValidity() {
    setInterval( function() {
        if ( ! Cookies.get('stager-ui.sid') ) {
            // block the whole page with a warning; and ask user to refresh the page
            appError('session expired, please <a href="javascript:location.reload();">refresh</a> the page.');
        }
    }, 60 * 1000 );
};

/* action for creating new folder */
function make_dir(loc, base, dirName) {
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
                appInfo('directory creation not supported');
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
                            appError(err);
                        },
                        200: function(data, status, jqxhr) {
                            appInfo('folder ' + dir + ' created!');
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
};

/* job functions */
function job_action(id, action) {
    var msg = '';
    var jf;
    switch(action) {
        case 'start':
            msg = 'You are about to (re-)start job: ' + id;
            jf = start_job;
            break;
        case 'stop':
            msg = 'You are about to stop job: ' + id;
            jf = stop_job;
            break;
        case 'delete':
            msg = 'You are about to delete job: ' + id;
            jf = delete_job;
            break;
        default:
            return;
    }

    $('#job_action_msg').html(msg);
    $('#job_action_dialog').on('click','button.confirm', jf(id));
    $('#job_action_dialog').modal('toggle');
};

function submit_jobs(jobs) {
    $("#job_confirmation").modal( "hide" );
    $.post('/stager/jobs', {'jobs': JSON.stringify(jobs)}, function(data) {
        appInfo('Job submited: ' + JSON.stringify(data));
    }).fail( function() {
        appError('Job submission failed');
    });
};

function start_job(id) {
    $('#job_action_dialog').modal('hide');
};

function stop_job(id) {
    $('#job_action_dialog').modal('hide');
};

function delete_job(id) {
    $('#job_action_dialog').modal('hide');
};

function formatJobDetail(j) {

    var bt_start_state = 'disabled';
    var bt_stop_state = 'disabled';

    if ( ['complete','failed'].includes(j.state) ) {
        bt_start_state = 'active';
    }

    if ( ['active'].includes(j.state) ) {
        bt_stop_state = 'active';
    }

    var btn_actions = '<div class="btn-group" id="job_action">' +
                      '<button type="button" class="btn btn-sm btn-default ' +
                      bt_start_state + '" onclick="job_action(' + j.id + ', \"start\")">' +
                      '<i data-toggle="tp-job-actions" title="start/restart" class="fa fa-play"></i></button>' +
                      '<button type="button" class="btn btn-sm btn-default ' +
                      bt_stop_state + '" onclick="job_action(' + j.id + ', \"stop\")">' +
                      '<i data-toggle="tp-job-actions" title="stop/cancel" class="fa fa-stop"></i></button>' +
                      '<button type="button" class="btn btn-sm btn-danger active" onclick="job_action(' + j.id + ', \"delete\")>' +
                      '<i data-toggle="tp-job-actions" title="delete" class="fa fa-trash"></i></button>' +
                      '</div>';

    ///return '<table width="80%" cellpadding="5" cellspacing="0" border="0" style="padding-left:50px;">'
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
};

/*
The main function of stager-ui
*/
function run_stager_ui(params) {

    // job table initialisation
    var jobsData = [];
    var jobTable = $('#job_table').DataTable({
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

    var jobTableRefreshId = null;

    // data for new jobs
    var newJobs = [];

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
            jobTableRefreshId = setInterval( update_job_history_table, delay * 1000 );
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

    function update_job_history_table() {
        $.get("/stager/job/state", function(data) {
            // count totoal amount of jobs
            var idx_t = -1;
            Object.keys(data).forEach(function(k) {
                if ( k.indexOf('Count') >= 0 ) {
                    idx_t += data[k];
                }
            });

            // get jobs
            if ( idx_t >= 0 ) {
                var url = "/stager/jobs/0-" + idx_t;
                $.get(url, function(data) {
                    // feed the data to job history table
                    jobsData = data;
                    jobTable.ajax.reload();
                });
            }
        }).done( function() {
        }).fail( function() {
            // whenever there is an error, stop the background process
            $('#history-refresh-toggle').bootstrapSwitch('state',false);
            // empty the jobTable (i.e. reset the data of the table)
            jobsData = [];
            jobTable.ajax.reload();
            // raise an error
            appError('cannot retrieve history');
        });
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
            appError('No source: please select ' + loc_src + ' directory/files');
            return false;
        }

        if ( typeof dst === 'undefined' || dst.length == 0 ) {
            // take current directory as the destination if the current directory is not the root
            var root = ( action == 'upload' ) ? params.r_fs_root:params.l_fs_root;
            var cwd = ( action == 'upload' ) ? params.r_fs_cwd:params.l_fs_cwd;
            if ( cwd != root ) {
                dst = [ cwd ];
            } else {
                appError('No destination: please select ' + loc_dst + ' directory as destination');
                return false;
            }
        }

        // check if dst is not single and not a directory
        if ( dst.length > 1 ) {
            appError('Only one destination is allowd, you selected ' + dst.length);
            return false;
        } else if (! isDir(dst[0]) ) {
            appError('Destination not a directory: ' + dst[0]);
            return false;
        }

        var srcDirs = [];
        var srcFiles = [];

        src.forEach( function(s) {
            if ( isDir(s) ) {
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
        make_dir($("#mkdir_dialog_loc").val(),
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
            update_job_history_table();
            // by-default disable the auto refresh of job history
            $('#history-refresh-toggle').bootstrapSwitch('state',false);
        } else {
            stopJobTableRefresh();
        }
    });

    // event listener for submitting stager jobs
    $("#job_submit").click(function() {
        submit_jobs(newJobs);
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
        logout_user('local');
    });

    // event listener for toggling local mkdir dialog
    $('#button_mkdir_local').click(function() {
        toggle_mkdir_dialog('local');
    });

    // event listener for logging in local user
    $('#login_form_local').on( 'submit', function( event ) {
        event.preventDefault();
        login_user('local',
            $(this).find('input[name="username"]').val(),
            $(this).serialize());
    });

    // event listener for refreshing remote fs tree
    $('#button_refresh_remote').click(function() {
        $($("#filetree_remote").get(0)).find('#jstree').jstree(true).refresh();
    });

    // event listener for logging out remote user
    $('#button_logout_remote').click(function() {
        logout_user('remote');
    });

    // event listener for toggling remote mkdir dialog
    $('#button_mkdir_remote').click(function() {
        toggle_mkdir_dialog('remote');
    });

    // event listener for logging in remote user
    $('#login_form_remote').on( 'submit', function( event ) {
        event.preventDefault();
        login_user('remote',
            $(this).find('input[name="username"]').val(),
            $(this).serialize());
    });

    // event listener for maunally update job history
    $('#button_refresh_history').click(function() {
        update_job_history_table();
    });

    /* local filetree or login initialisation */
    if ( params.l_fs_view == "login" ) {
        show_login_form('local','');
    } else {
        show_filetree('local', params.l_fs_root);
    }

    /* remote filetree or login initialisation */
    if ( params.r_fs_view == "login" ) {
        show_login_form('remote','');
    } else {
        show_filetree('remote', params.r_fs_root);
    }

    // enable periodic check on session validity
    checkSessionValidity();
};
