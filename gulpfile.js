var gulp = require('gulp');
var execa = require('execa');
var pug = require('gulp-pug');
var preprocess = require('gulp-preprocess');
var stylus = require('gulp-stylus');
var replace = require('gulp-replace');
var concat = require('gulp-concat');
var jshint = require('gulp-jshint');
var stylish = require('jshint-stylish');

var pathDest = 'build/';
var pathSrc = 'src/';
var userJs = 'irccloud-emoticons.user.js';
var metaJs = 'irccloud-emoticons.meta.js';

exports.jade = function jade() {
  return gulp.src(pathSrc + 'container.jade')
    .pipe(pug())
    .pipe(gulp.dest(pathDest));
};

exports.css = function css() {
  return gulp.src(pathSrc + 'style.styl')
    .pipe(stylus({ compress: true }))
    .pipe(gulp.dest(pathDest));
};

exports.meta = function () {
  var branchCmd = 'git rev-parse --abbrev-ref HEAD';
  var branchName = execa.shellSync(branchCmd).stdout || 'master';

  return gulp.src(pathSrc + metaJs)
    .pipe(replace('$user$', userJs))
    .pipe(replace('$meta$', metaJs))
    .pipe(replace('$branch$', branchName))
    .pipe(gulp.dest(pathDest));
};

exports.js = function js() {
  return gulp.src(pathSrc + userJs)
    .pipe(replace('$meta$', metaJs))
    .pipe(preprocess())
    .pipe(gulp.dest(pathDest));
};

exports.jshint = function jshint() {
  return gulp.src(pathSrc + userJs)
    .pipe(jshint({ jquery: true }))
    .pipe(jshint.reporter(stylish));
};

exports.watch = function watch() {
  gulp.watch(pathSrc + '*.*', gulp.parallel(exports.default, exports.jshint));
};

exports.default = gulp.series(
  gulp.parallel(exports.jade, exports.css, exports.meta),
  exports.js
);