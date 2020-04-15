// webpack.config.js
module.exports = [{
    mode: 'development',
    entry: './src/index.ts',
    target: 'electron-main',
    module: {
        rules: [{
            test: /\.ts$/,
            include: /src/,
            use: [{
                loader: 'ts-loader'
            }]
        }]
    },
    output: {
        path: `${__dirname}/src`,
        filename: 'index.js'
    }
}];