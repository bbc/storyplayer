module.exports = function (config) {
    config.set({
        files: [
            '../../node_modules/babel-polyfill/dist/polyfill.js',
            {pattern: '../**/*[sS]pec.js', included: true},
        ],
        exclude: [],
        plugins: [
            'karma-browserify',
            'karma-phantomjs-launcher',
            "karma-jasmine",
            "karma-junit-reporter",
        ],
        frameworks: ['browserify', 'jasmine'],
        reporters: ['progress', 'junit'],
        junitReporter: {
            outputDir: '../../build/js-test-results',
            suite: 'javascript',
        },
        logLevel: config.LOG_WARN,
        preprocessors: {
            '../**/*[sS]pec.js': ['browserify'],
        },
        browsers: ['PhantomJS'],
        browserify: {
            debug: true, // output source maps
            transform: ['babelify'],
        },
    });
};
