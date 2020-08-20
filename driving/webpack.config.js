const path = require('path');

const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  devtool: 'source-map',

  stats: {
    assetsSort: 'chunks',
    version: false,
    entrypoints: false,
  },

  devServer: {
    publicPath: '/',
    host: '0.0.0.0',
    port: 8000,
    stats: {
      assetsSort: 'chunks',
      excludeAssets: /(^lib|.map$)/,
      colors: true,
      version: false,
      hash: false,
      timings: false,
      cached: false,
      cachedAssets: false,
      chunkModules: false,
      chunks: false,
      entrypoints: false,
      modules: false,
    },
  },

  entry: './src/index.js',

  module: {
    strictExportPresence: true,
    rules: [
      { test: /\.js$/, exclude: /node_modules/, use: ['babel-loader', 'eslint-loader'] },
      { test: /\.s[ac]ss$/i, use: ['style-loader', 'css-loader', 'sass-loader'] },
    ],
  },

  plugins: [new HtmlWebpackPlugin({ template: path.join(process.cwd(), 'src', 'index.html') })],
};
