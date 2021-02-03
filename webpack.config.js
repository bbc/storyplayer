const { SCHEMA_VERSION } = require('object-based-media-schema');

const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const JavaScriptObfuscator = require('webpack-obfuscator');
const webpack = require('webpack');
const Package = require('./package.json');

const productionBuild = process.env.NODE_ENV === 'production';

const cacheLoaderSourceMapArray = [];

module.exports = env => {
    const entry = {
        storyplayer: './src/storyplayer.js'
    }

    const config = {
        entry,
        devtool: 'source-map',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: '[name].js',
            library: 'Storyplayer',
            libraryTarget: 'umd'
        },
        mode: productionBuild ? 'production' : 'development',
        module: {
            rules: [{
                test: /\.jsx?$/,
                use: ['babel-loader'],
                exclude: /node_modules/
            },
            {
                test: /\.(scss|sass)$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    'css-loader',
                    {
                        loader: 'sass-loader',
                        options: {
                            sourceMap: true,
                        }
                    }
                ]
            },
            {
                test: /\.(jpe?g|png|gif|svg)$/,
                loader: 'file-loader?name=images/[name].[ext]'
            },
            {
                test: /\.(eot|ttf|woff|woff2)$/,
                loader: 'file-loader?name=fonts/[name].[ext]'
            }
            ]
        },
        plugins: [
            new MiniCssExtractPlugin({
                filename: '[name].css',
            }),
            new webpack.DefinePlugin({
                __PLAYER_VERSION__: `${JSON.stringify(Package.version)}`,
                __LATEST_SCHEMA_VERSION__: `${JSON.stringify(SCHEMA_VERSION)}`,
            }),
        ],
    };

    if (!productionBuild) {
        console.log('generating source maps');
        config.module.rules.push({
            test: /\.js$/,
            use: cacheLoaderSourceMapArray.concat([
                'source-map-loader'
            ]),
            enforce: 'pre',
            exclude: [
                /node_modules\/shaka-player/
            ]
        });
        config.devtool = 'eval-source-map';

    }

    if (env && env.platform === 'electron') {
        config.optimization = {
            minimize: true,
            minimizer: [
                new TerserPlugin({
                    sourceMap: false,
                    extractComments: false, // To avoid separate file with licenses.
                    terserOptions: {
                        // mangle: {
                        //     // properties: true,
                        //     // toplevel: true,
                        // },
                        mangle: true,
                        keep_classnames: false,
                        keep_fnames: false,
                        module: false,
                        toplevel: true,
                        nameCache: null,
                        ie8: false,
                        safari10: false,
                    },
                })
            ],
        }
        config.output = {
            path: path.resolve(__dirname, 'storyplayer-electron', 'src', 'dist'),
            filename: 'storyplayer.js',
            library: 'Storyplayer',
            libraryTarget: 'umd'
        }
        config.devtool = undefined;
        if(env.mangle === 'true') {
            config.plugins.push(new JavaScriptObfuscator({rotateUnicodeArray: true}, []))
        }
    }
    return config;
};
