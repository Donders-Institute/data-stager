var fs = require('fs');

var _getDirList = function(request, response) {
    var dir = request.body.dir;
    var checkbox = ( typeof request.body.multiSelect !== 'undefined' && request.body.multiSelect ) ? '<input type="checkbox" />':'';

    var r = '<ul class="jqueryFileTree" style="display: none;">';
    try {
        r = '<ul class="jqueryFileTree" style="display: none;">';
        var files = fs.readdirSync(dir);
        files.forEach(function(f){
            var ff = dir + f;
            var stats = fs.statSync(ff)
            if (stats.isDirectory()) {
                r += '<li class="directory collapsed">' + checkbox + '<a href="#" rel="' + ff  + '/">' + f + '</a></li>';
            } else {
                var e = f.split('.')[1];
                r += '<li class="file ext_' + e + '">' + checkbox + '<a href="#" rel='+ ff + '>' + f + '</a></li>';
            }
        });

        r += '</ul>';
    } catch(e) {
        r += 'Could not load directory: ' + dir;
        r += '</ul>';
    }

    response.send(r);
}

module.exports.getDirList = _getDirList;
