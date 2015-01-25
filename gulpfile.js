var gulp = require('gulp');
var jade = require('gulp-jade');
var preprocess = require('gulp-preprocess');
var stylus = require('gulp-stylus');
var concat = require('gulp-concat');
var exec = require('child_process').exec;

var pathDest = 'build/';
var pathSrc = 'src/';
var userJs = 'twitch_emoticons.user.js';
var metaJs = 'twitch_emoticons.meta.js';

gulp.task('emote', function (cb) {
  var inputFile = ' ' + pathSrc + 'download_emotes.js';
  var outputFile = ' ' + pathDest + 'emotes.all.json';
  exec('node' + inputFile + outputFile, { cwd: __dirname }, function (err, stdout) {
    console.log(stdout);
    cb(err);
  });
});

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

gulp.task('js', ['jade', 'stylus'], function () {
  return gulp.src(pathSrc + userJs)
    .pipe(preprocess())
    .pipe(gulp.dest(pathDest));
});

gulp.task('concat', ['js'], function () {
  gulp.src(pathSrc + metaJs).pipe(gulp.dest(pathDest));
  
  return gulp.src([pathSrc + metaJs, pathDest + userJs])
    .pipe(concat(userJs))
    .pipe(gulp.dest(pathDest));
});

gulp.task('build', ['concat']);

gulp.task('watch', function () {
  gulp.watch(pathSrc + '*.*', ['build']);
});

gulp.task('default', ['build']);