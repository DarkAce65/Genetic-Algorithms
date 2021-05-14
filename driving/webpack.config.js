const path = require('path');

const ESLintPlugin = require('eslint-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

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

  entry: './src/index.ts',

  module: {
    strictExportPresence: true,
    rules: [
      { test: /\.tsx?$/, exclude: /node_modules/, use: ['babel-loader', 'ts-loader'] },
      { test: /\.js$/, exclude: /node_modules/, use: ['babel-loader'] },
      { test: /\.s[ac]ss$/i, use: ['style-loader', 'css-loader', 'sass-loader'] },
    ],
  },

  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    modules: [path.resolve(__dirname, 'node_modules')],
    plugins: [new TsconfigPathsPlugin()],
  },

  plugins: [
    new ESLintPlugin({ extensions: ['js', 'ts'] }),
    new HtmlWebpackPlugin({ template: path.join(process.cwd(), 'src', 'index.html') }),
  ],
};
