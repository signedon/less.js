/*!
 * Less - middleware (adapted from the stylus middleware)
 * Copyright(c) 2010 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var less = require('less')
  , fs = require('fs')
  , url = require('url')
  , basename = require('path').basename
  , dirname = require('path').dirname
  , mkdirp = require('mkdirp')
  , join = require('path').join;

/**
 * Import map.
 */

var imports = {};

/**
 * Return Connect middleware with the given `options`.
 *
 * Options:
 *
 *    `force`           Always re-compile
 *    `debug`           Output debugging information
 *    `src`             Source directory used to find .less files
 *    `dest`            Destination directory used to output .css files
 *                      when undefined defaults to `src`.
 *    `compress`        Whether the output .css files should be compressed
 *    `optimization`    The desired value of the less optimization option (0, 1, or 2. 0 is default)
 *
 * Examples:
 *
 * Pass the middleware to Connect, grabbing .less files from this directory
 * and saving .css files to _./public_. Also supplying our custom `compile` function.
 *
 * Following that we have a `staticProvider` layer setup to serve the .css
 * files generated by Less.
 *
 *      var server = connect.createServer(
 *          less.middleware({
 *              src: __dirname + '/public/stylesheets'
 *            , dest: __dirname + '/public/stylesheets'
 *            , compress: true
 *          })
 *        , connect.static(__dirname + '/public')
 *      );
 *
 * @param {Object} options
 * @return {Function}
 * @api public
 */

/**
 * Log a message.
 *
 * @api private
 */

function log(key, val) {
  console.error('  \033[90m%s :\033[0m \033[36m%s\033[0m', key, val);
}


module.exports = function(options){
  options = options || {};

  // Accept src/dest dir
  if ('string' == typeof options) {
    options = { src: options };
  }

  // Force compilation
  var force = options.force;

  // Debug option
  var debug = options.debug;

  // Compress option
  var shouldCompress = options.compress || false;

  // Optimization option
  var optimization = options.optimization || 0;

  // Source dir required
  var src = options.src;
  if (!src) { throw new Error('less.middleware() requires "src" directory'); }

  // Default dest dir to source
  var dest = options.dest ? options.dest : src;

  // Default compile callback
  options.render = options.render || function(str, path, callback) {
    var parser = new less.Parser({
        paths: [options.src],
        filename: path,
        optimization: optimization
    });
    parser.parse(str, function(err, tree) {
        var css = tree.toCSS({ compress: shouldCompress });
        callback(err, css);
    });
  };

  // Middleware
  return function(req, res, next) {
    if ('GET' != req.method && 'HEAD' != req.method) { return next(); }
    var path = url.parse(req.url).pathname;
    if (/\.css$/.test(path)) {
      var cssPath = join(dest, path),
          lessPath = join(src, path.replace('.css', '.less'));

      if (debug) {
        log('source', lessPath);
        log('dest', cssPath);
      }

      // Ignore ENOENT to fall through as 404
      var error = function(err) {
        next('ENOENT' == err.code ? null : err);
      };

      // Compile to cssPath
      var compile = function() {
        if (debug) { log('read', lessPath); }
        fs.readFile(lessPath, 'utf8', function(err, str){
          if (err) { return error(err); }
          options.render(str, lessPath, function(err, css){
            if (err) { return next(err); }
            if (debug) { log('render', lessPath); }
            fs.writeFile(cssPath, css, 'utf8', next);
          });
        });
      };

      // Force
      if (force) { return compile(); }

      // Re-compile on server restart, disregarding
      // mtimes since we need to map imports
      if (!imports[lessPath]) { return compile(); }

      // Compare mtimes
      fs.stat(lessPath, function(err, lessStats){
        if (err) { return error(err); }
        fs.stat(cssPath, function(err, cssStats){
          // CSS has not been compiled, compile it!
          if (err) {
            if ('ENOENT' == err.code) {
              if (debug) { log('not found', cssPath); }
              compile();
            } else {
              next(err);
            }
          } else {
            // Source has changed, compile it
            if (lessStats.mtime > cssStats.mtime) {
              if (debug) { log('modified', cssPath); }
              compile();
            // Already compiled, check imports
            }
          }
        });
      });
    } else {
      next();
    }
  };
};


