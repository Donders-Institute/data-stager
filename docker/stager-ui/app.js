var express = require('express');
var session = require('express-session');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var config = require('config');

var routes = require('./routes/index');
var mod_fs = require('./routes/mod_fs');
var mod_sftp = require('./routes/mod_sftp');
var mod_rdm = require('./routes/mod_rdm');
var mod_stager = require('./routes/mod_stager');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

/* session property
   - rolling expiration upon access
   - save newly initiated session right into the store
   - delete session from story when unset
   - cookie age: 4 hours (w/ rolling expiration)
   - session data store: memory on the server
*/
app.use( session({
    secret: 'planet Tatooine',
    resave: true,
    rolling: true,
    saveUninitialized: true,
    unset: 'destroy',
    name: 'stager-ui.sid',
    cookie: {
        httpOnly: false,
        maxAge: 4 * 3600 * 1000
    }
}));

app.use('/', routes);

// AJAX posts
app.get('/fs/dir', mod_fs.getDirListJsTree)

app.post('/rdm/login', mod_rdm.authenticateUser);
app.post('/rdm/logout', mod_rdm.logoutUser);
app.get('/rdm/dir', mod_rdm.getDirListJsTree);

app.post('/sftp/login', mod_sftp.authenticateUser);
app.post('/sftp/logout', mod_sftp.logoutUser);
app.get('/sftp/dir', mod_sftp.getDirListJsTree);

app.post('/stager/login', mod_stager.authenticateUser);
app.post('/stager/logout', mod_stager.logoutUser);
app.get('/stager/dir', mod_stager.getDirListJsTree);

app.post('/stager/jobs', mod_stager.submitJobs);
app.get('/stager/job/state', mod_stager.getJobCount);
app.get('/stager/jobs/:state/:from-:to', mod_stager.getJobsInState);
app.get('/stager/jobs/:from-:to', mod_stager.getJobs);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;
