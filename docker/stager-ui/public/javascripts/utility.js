jQuery.fn.autoWidth = function(options) {
  var settings = {
        limitWidth   : false
  }

  if(options) {
        jQuery.extend(settings, options);
    };

    var maxWidth = 0;

  this.each(function(){
        if ($(this).width() > maxWidth){
          if(settings.limitWidth && maxWidth >= settings.limitWidth) {
            maxWidth = settings.limitWidth;
          } else {
            maxWidth = $(this).width();
          }
        }
  });

  this.width(maxWidth);
}

htmlEncode = function(value) {
    return value.replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/</g, '&lt;')
                .replace(/ /g, '&nbsp;')
                .replace(/>/g, '&gt;');
}

htmlDecode = function(value) {
    return value.replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&');
}
