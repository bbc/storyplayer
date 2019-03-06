const helmet = require('helmet');
const uuid = require('uuid');

module.exports = function configureCsp(app) {
    app.use((req, res, next) => {
        res.locals.csp_nonce = uuid.v4();
        next();
    });

    let cspBaseUrls = [
        "'self'",
        '*.bbci.co.uk',
        '*.bbc.co.uk',
    ];

    if (false) {
        // Enable live-reloading
        cspBaseUrls = cspBaseUrls.concat([
            '*.sandbox.bbc.co.uk:8090',
            'ws://*.sandbox.bbc.co.uk:8090',
            '*.sandbox.bbc.co.uk:5000',
            'unpkg.com',
            'data:',
        ]);
    }

    app.use(helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: cspBaseUrls,
            scriptSrc: cspBaseUrls.concat([
                (req, res) => `'nonce-${res.locals.csp_nonce}'`,
            ]).concat(false ? ["'unsafe-eval'"] : []),
            styleSrc: cspBaseUrls.concat(["'unsafe-inline'"]),
            mediaSrc: ['*', 'blob:'],
            connectSrc: ['*'],
            workerSrc: ['blob:'],
            imgSrc: cspBaseUrls.concat(['*', 'data:']),
        },

    }));
};
