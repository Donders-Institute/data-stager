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

module.exports.getDirListJsTree = _getDirListJsTree;
