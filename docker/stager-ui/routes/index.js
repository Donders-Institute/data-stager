var express = require('express');
var config = require('config');
var router = express.Router();

var _getModParams = function(req, mod) {
  var root = ( typeof req.query.local !== 'undefined' ) ? req.query.local:config.get(mod).rootDir;
  var view = "";
  var path_login = "";
  var path_logout = "";
  var hint_login = "";
  var example_login = "";
  if (config.has(mod + '.pathLogin')) {

      if (typeof req.session.user  === 'undefined' ||
          typeof req.session.pass  === 'undefined') {
          view = 'login';
      } else {
          view = (typeof req.session.user[mod] !== 'undefined' &&
                  typeof req.session.pass[mod] !== 'undefined' ) ? '':'login';
      }

      if (config.has(mod + '.hintLogin')) {
          hint_login = config.get(mod + '.hintLogin');
      }

      if (config.has(mod + '.exampleLogin')) {
         example_login = config.get(mod + '.exampleLogin');
      }

      path_login = config.get(mod + '.pathLogin');
      path_logout = config.get(mod + '.pathLogout');
  }
  var path_getdir = config.get(mod + '.pathListDir');
  var display_name = config.get(mod + '.displayName');

  /* prefix of the transportation URL, default is ''
      The prefix is prepended to the user's selections on the JsTree display to
      construct the actual data transfer URL used by the underlying synchronisation
      program, i.e. i-rsync.sh of the stager service.

      TODO: it's arguable if this is a good approach, as it is only needed for
            'irods:/rdm/di'
  */
  var prefix_turl = "";
  if (config.has(mod + '.prefixTurl')) {
      prefix_turl = config.get(mod + '.prefixTurl');
  }

  /* support for creating folder */
  var path_mkdir = "";
  if (config.has(mod + '.pathMakeDir')) {
      path_mkdir = config.get(mod + '.pathMakeDir');
  }

  return { view: view,
           root: root,
           prefix_turl: prefix_turl,
           hint_login: hint_login,
           path_login: path_login,
           path_logout: path_logout,
           path_mkdir: path_mkdir,
           example_login: example_login,
           path_getdir: path_getdir,
           display_name: display_name }
}

/* GET home page. */
router.get('/', function(req, res, next) {

  // get local module parameters
  var params_local = _getModParams(req, config.get('local.module'));

  // get remote module parameters
  var params_remote = _getModParams(req, 'rdm');

  res.render('index', { title: config.get('title'),
                        title_request: 'New request',
                        title_history: 'Request history',
                        website: config.get('website'),
                        helpdesk: config.get('helpdesk'),
                        version: require(__dirname + '/../package').version,
                        fs_root_local: params_local.root,
                        fs_view_local: params_local.view,
                        fs_server_local: params_local.display_name,
                        fs_hint_login_local: params_local.hint_login,
                        fs_path_login_local: params_local.path_login,
                        fs_path_logout_local: params_local.path_logout,
                        fs_example_login_local: params_local.example_login,
                        fs_prefix_turl_local: params_local.prefix_turl,
                        fs_path_getdir_local: params_local.path_getdir,
                        fs_path_mkdir_local: params_local.path_mkdir,
                        fs_root_remote: params_remote.root,
                        fs_view_remote: params_remote.view,
                        fs_server_remote: params_remote.display_name,
                        fs_hint_login_remote: params_remote.hint_login,
                        fs_path_login_remote: params_remote.path_login,
                        fs_path_logout_remote: params_remote.path_logout,
                        fs_example_login_remote: params_remote.example_login,
                        fs_prefix_turl_remote: params_remote.prefix_turl,
                        fs_path_getdir_remote: params_remote.path_getdir,
                        fs_path_mkdir_remote: params_remote.path_mkdir,
                       });
});

module.exports = router;
