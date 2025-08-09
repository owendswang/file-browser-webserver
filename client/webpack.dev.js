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
        context: ['/api', '/download', '/preview'],
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      {
        context: ['/play'],
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true,
      }
    ],
    watchFiles: {
      paths: ['src/**/*'],
      options: {
        ignored: [
          '**/node_modules/**',
          'C:/pagefile.sys',
          'C:/swapfile.sys',
          'C:/System Volume Information',
          'C:/DumpStack.log.tmp'
        ]
      }
    }
  },
  watchOptions: {
    ignored: [
      '**/node_modules/**',
      'C:/pagefile.sys',
      'C:/swapfile.sys',
      'C:/System Volume Information',
      'C:/DumpStack.log.tmp'
    ]
  }
});
