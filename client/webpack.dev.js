const path = require('path');
const { merge } = require('webpack-merge');
const common = require('./webpack.common');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    static: {
      directory: path.join(__dirname, 'public'),
    },
    devMiddleware: {
      publicPath: '/',
    },
    compress: true,
    port: 3333,
    hot: true,
    liveReload: true,
    open: false,
    historyApiFallback: {
      disableDotRule: true,
    },
    proxy: [
      {
        context: ['/api', '/download', '/preview', '/play'],
        target: 'http://localhost:3000',
      },
    ],
  },
});
