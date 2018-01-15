/* eslint-disable comma-dangle */
const path = require('path');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

const extractSass = new ExtractTextPlugin('romper.css');

const config = {
    entry: './src/romper.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'romper.js',
        library: 'Romper',
        libraryTarget: 'umd'
    },
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                use: ['babel-loader'],
                exclude: /node_modules/
            },
            {
                test: /\.scss$/,
                use: extractSass.extract(['css-loader', 'sass-loader'])
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
        extractSass
    ]
};

module.exports = config;
