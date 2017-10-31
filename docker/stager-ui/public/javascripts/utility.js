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

htmlEncodeSpace = function(value) {
    return value.replace(/ /g, '\u00a0');
}

htmlDecodeSpace = function(value) {
    return value.replace(/\u00a0/g, ' ');
}
