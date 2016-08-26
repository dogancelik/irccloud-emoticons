var gulp = require('gulp');
var execa = require('execa');
var jade = require('gulp-jade');
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

gulp.task('jade', function () {
  return gulp.src(pathSrc + 'container.jade')
    .pipe(jade())
    .pipe(gulp.dest(pathDest));
});

gulp.task('stylus', function () {
  return gulp.src(pathSrc + 'style.styl')
    .pipe(stylus({ compress: true }))
    .pipe(gulp.dest(pathDest));
});

gulp.task('meta', ['jade', 'stylus'], function () {
  var branchCmd = 'git rev-parse --abbrev-ref HEAD';
  var branchName = execa.shellSync(branchCmd).stdout || 'master';

  return gulp.src(pathSrc + metaJs)
    .pipe(replace('$user$', userJs))
    .pipe(replace('$meta$', metaJs))
    .pipe(replace('$branch$', branchName))
    .pipe(gulp.dest(pathDest));
});

gulp.task('js', ['meta'], function () {
  return gulp.src(pathSrc + userJs)
    .pipe(replace('$meta$', metaJs))
    .pipe(preprocess())
    .pipe(gulp.dest(pathDest));
});

gulp.task('jshint', function () {
  return gulp.src(pathSrc + userJs)
    .pipe(jshint({ jquery: true }))
    .pipe(jshint.reporter(stylish));
});

gulp.task('build', ['js']);

gulp.task('watch', function () {
  gulp.watch(pathSrc + '*.*', ['build', 'jshint']);
});

gulp.task('default', ['build']);
