/* utility function to determine whether a given path is a directory */
var isDir = function(p) {
    return p.match('.*(/|\\\\)$')?true:false;
}

/* utility function to toggle application dialog for error message */
var appError = function(html_text) {
    $("#app_dialog").modal('toggle');
    $("#app_dialog_header").html( 'Error' );
    $("#app_dialog_message").html( html_text );
}

/* utility function to toggle application dialog for information */
var appInfo = function(html_text) {
    $("#app_dialog").modal('toggle');
    $("#app_dialog_header").html( 'Information' );
    $("#app_dialog_message").html( html_text );
}

/* general function for displaying the login form */
var show_login_form = function(loc, msg) {
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
var show_filetree = function(loc, root) {
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

/* toggle dialog modal for creating new folder */
var toggle_mkdir_dialog = function(loc) {

    $("#mkdir_dialog_alert").hide();

    var sname = ( loc == 'local' ) ? params.l_fs_server:params.r_fs_server;
    var cwd = ( loc == 'local' ) ? params.l_fs_cwd:params.r_fs_cwd;
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
};

/* receive new directory and trigger make_dir function */
// !!the event should be handled by the document level as
//   the #submit_mkdir is a button within the Boostrap modal!!
$(document).on('click', '#submit_mkdir', function() {

    // retrieve form values from the mkdir_dialog
    var loc = $("#mkdir_dialog_loc").val();
    var cwd = $("#mkdir_dialog_cwd").val();
    var dir = $("#mkdir_dialog_dir").val();

    // close the modal panel from user
    // TODO: close the modal or show error if values are not valid
    if ( dir == "" ) {
        // show error on the mkdir dialog
        $("#mkdir_dialog_alert_msg").html('Please specify the name of the new folder');
        $("#mkdir_dialog_alert").show();
    } else {
        var parts = dir.split('/').filter( function(v) { return v != ''; } );
        if ( parts.length > 1 ) {
            $("#mkdir_dialog_alert_msg").html('sub-folder not supported');
            $("#mkdir_dialog_alert").show();
        } else {
            $("#mkdir_dialog").modal('hide');

            // flush the user input
            $("#mkdir_dialog_dir").val("");

            //appInfo('Creating ' + cwd + dir + ' at ' + loc);

            // now make the directory
            make_dir(loc, cwd, dir);
        }
    }
});

/* make alert reusable */
$(document).on("close.bs.alert", "#mkdir_dialog_alert", function () {
    $("#mkdir_dialog_alert").hide(); //hide the alert
    return false;                    //don't remove it from DOM
});

/* action for creating new folder */
var make_dir = function(loc, base, dirName) {

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
};

/*
The main function of stager-ui
*/
var run_stager_ui = function(params) {

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

    // actions of application error modal panel
    $("#close_app_error").click(function() {
        $("#app_error").modal( "hide" );
    });

    // function of job detail fields
    var formatJobDetail = function(j) {
        return '<table width="80%" cellpadding="5" cellspacing="0" border="0" style="padding-left:50px;">'
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
        + '</table>';
    }

    // Add event listener for opening and closing details
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
        }
    } );

    // function to check session validity every minute
    var checkSessionValidity = function() {
        setInterval( function() {
            if ( ! Cookies.get('stager-ui.sid') ) {
                // block the whole page with a warning; and ask user to refresh the page
                appError('session expired, please <a href="javascript:location.reload();">refresh</a> the page.');
            }
        }, 60 * 1000 );
    }

    // function to stop job table refresh task
    var stopJobTableRefresh = function() {
        if ( jobTableRefreshId != null ) {
            clearInterval(jobTableRefreshId);
            jobTableRefreshId = null;
        }
    }

    // function to start job table refresh task, with iteration delay in seconds
    var startJobTableRefresh = function(delay) {
        if ( jobTableRefreshId == null ) {
            jobTableRefreshId = setInterval( update_job_history_table, delay * 1000 );
        }
    }

    // toggle for background history refresh
    // action toggle background history refresh
    var setHistoryRefreshMode = function(e, s) {
        if (s) {
            $('#button_refresh_history').addClass('disabled');
            startJobTableRefresh(10);
        } else {
            $('#button_refresh_history').removeClass('disabled');
            stopJobTableRefresh();
        }
    };

    $('#history-refresh-toggle').bootstrapSwitch({
        size: "normal",
        onText: "A",
        offText: "M",
        onInit: setHistoryRefreshMode,
        onSwitchChange: setHistoryRefreshMode
    });

    // menu tabs
    $('.navbar-nav a').on('shown.bs.tab', function(event){
        if ( $(event.target).text() == 'History' ) {
            update_job_history_table();
            // by-default disable the auto refresh of job history
            $('#history-refresh-toggle').bootstrapSwitch('state',false);
        } else {
            stopJobTableRefresh();
        }
    });

    var update_job_history_table = function() {
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

    /* remote login action */
    $('#login_form_remote').on( 'submit', function( event ) {
        event.preventDefault();
        var u = $(this).find('input[name="username"]').val();
        $.post(params.r_fs_path_login, $(this).serialize(), function(data) {
            //console.log(data);
        }).done( function() {
            Cookies.set('username_remote', u);
            show_filetree('remote', params.r_fs_root);
        }).fail( function() {
            appError('Authentication failure: ' + params.r_fs_server);
        });
    });

    /* local login action */
    $('#login_form_local').on( 'submit', function( event ) {
        event.preventDefault();
        var u = $(this).find('input[name="username"]').val();
        $.post(params.l_fs_path_login, $(this).serialize(), function(data) {
            //console.log(data);
        }).done( function() {
            Cookies.set('username_local', u);
            show_filetree('local', params.l_fs_root);
        }).fail( function() {
            appError('Authentication failure: ' + params.l_fs_server);
        });
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

    /* general function for getting checked file/directory items */
    var get_checked_items = function( element ) {
        return (element.jstree(true)) ?
        element.jstree(true).get_checked():[];
    };

    /* general function for composing and sending staging jobs */
    var jobData = [];
    var send_staging_job = function( action, src, dst ) {

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

        jobData = [];
        srcFiles.forEach( function(s) {
            var dirs = srcDirs.filter( function(sd) {
                return s.search(sd) >= 0;
            });

            // create a job when there is no parent directory on src list
            if ( dirs.length == 0 ) {
                jobData.push({ dstURL: purl_dst + dst[0], srcURL: purl_src + s });
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
                    jobData.push({ dstURL: purl_dst + dst[0] +
                        s.split('/').slice(-2)[0] + '/', srcURL: purl_src + s });
                } else {
                    // Windows way
                    jobData.push({ dstURL: purl_dst + dst[0] +
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
            jobData.forEach( function(j) {
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

    // action button: submit stager jobs
    $("#job_submit").click(function() {
        $("#job_confirmation").modal( "hide" );
        $.post('/stager/jobs', {'jobs': JSON.stringify(jobData)}, function(data) {
            appInfo('Job submited: ' + JSON.stringify(data));
        }).fail( function() {
            appError('Job submission failed');
        });
    });

    // action button: cancel stager jobs
    $("#job_cancel").click(function() {
        jobData = [];
        $("#job_confirmation").modal( "hide" );
    });

    /* action button: upload */
    $('#button_upload').click(function() {
        //src: local
        var checked_src = get_checked_items($($("#filetree_local").get(0)).find('#jstree'));

        //dst: remote
        var checked_dst = get_checked_items($($("#filetree_remote").get(0)).find('#jstree'));

        // send staging job
        if ( send_staging_job('upload', checked_src, checked_dst) ) {
            console.log('job submitted');
        }
    });

    /* action button: download */
    $('#button_download').click(function() {
        //src: remote
        var checked_src = get_checked_items($($("#filetree_remote").get(0)).find('#jstree'));

        //dst: local
        var checked_dst = get_checked_items($($("#filetree_local").get(0)).find('#jstree'));

        // send staging job
        if ( send_staging_job('download', checked_src, checked_dst) ) {
            console.log('job submitted');
        }
    });

    /* action buttons: local */
    $('#button_refresh_local').click(function() {
        $($("#filetree_local").get(0)).find('#jstree').jstree(true).refresh();
    });

    $('#button_logout_local').click(function() {
        $.post(params.l_fs_path_logout, function(data) {
            appInfo(params.l_fs_server + " user logged out");
            Cookies.remove('username_local');
            show_login_form('local','');
        }).fail( function() {
            appError('fail logout ' + params.l_fs_server + ' user');
        });
    });

    $('#button_mkdir_local').click(function() {
        toggle_mkdir_dialog('local');
    });

    /* action buttons: remote */
    $('#button_refresh_remote').click(function() {
        $($("#filetree_remote").get(0)).find('#jstree').jstree(true).refresh();
    });

    $('#button_logout_remote').click(function() {
        $.post(params.r_fs_path_logout, function(data) {
            appInfo(params.r_fs_server + " user logged out");
            Cookies.remove('username_remote');
            show_login_form('remote','');
        }).fail( function() {
            appError('fail logout ' + params.r_fs_server + ' user');
        });
    });

    $('#button_mkdir_remote').click(function() {
        toggle_mkdir_dialog('remote');
    });

    /* action manual history refresh */
    $('#button_refresh_history').click(function() {
        update_job_history_table();
    });

    // enable periodic check on session validity
    checkSessionValidity();
}
