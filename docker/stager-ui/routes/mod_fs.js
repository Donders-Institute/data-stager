var fs = require('fs');
var path = require('path');

/** get directory content for jsTree */
var _getDirListJsTree = function(request, response) {

    var dir = request.query.dir;
    var isRoot = request.query.isRoot;

    var data = [];

    try {
        var files = fs.readdirSync(dir);
        files.forEach(function(f) {
            var ff = path.join(dir, f);
            var stats = fs.statSync(ff)
            data.push({
                id: stats.isDirectory()?ff + path.sep:ff,
                parent: isRoot === 'true' ? '#':dir,
                text: f,
                icon: stats.isDirectory()?'fa fa-folder':'fa fa-file-o',
                li_attr: stats.isDirectory()?{}:{'title':''+stats.size+' bytes'},
                children: stats.isDirectory()?true:false
            });
        });
    } catch(e) {
        console.error(e);
        console.error('cannot open directory: ' + dir);
    }

    response.json(data);
}

/** get directory content for jqueryFileTree */
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

module.exports.getDirListJsTree = _getDirListJsTree;
module.exports.getDirList = _getDirList;
