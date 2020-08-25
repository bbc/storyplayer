/* eslint-disable comma-dangle */
const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const JavaScriptObfuscator = require('webpack-obfuscator');


const productionBuild = process.env.NODE_ENV === 'production';

// Source maps are useful for debugging but in some cases they double the time
// required to compile so may not be that *useful*
const SOURCE_MAPS_ENABLED = false && !productionBuild;

const cacheLoaderSourceMapArray = [];

module.exports = env => {
    const config = {
        entry: './src/romper.js',
        devtool: 'source-map',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'romper.js',
            library: 'Romper',
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
                filename: 'romper.css',
            }),
        ],
    };

    if (!productionBuild) {
        console.log('building in dev mode');
        console.log('generating source maps');
        config.module.rules.push({
            test: /\.js$/,
            use: cacheLoaderSourceMapArray.concat([
                'source-map-loader'
            ]),
            enforce: 'pre',
            exclude: [
                /node_modules\/apollo/
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
            filename: 'romper.js',
            library: 'Romper',
            libraryTarget: 'umd'
        }
        config.devtool = undefined;
        if(env.mangle === 'true') {
            config.plugins.push(new JavaScriptObfuscator({rotateUnicodeArray: true}, []))
        }
    }
    return config;
};
