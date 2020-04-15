/* eslint-disable comma-dangle */
const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const Package = require('./package.json');

const productionBuild = process.env.NODE_ENV === 'production';

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
        rules: [
            {
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
        new webpack.DefinePlugin({
            STORYPLAYER_VERSION: JSON.stringify(Package.version),
        }),
    ]
};

module.exports = config;
