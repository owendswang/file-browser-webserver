const path = require('path');
const { merge } = require('webpack-merge');
const CopyPlugin = require("copy-webpack-plugin");
const common = require('./webpack.common');

const serverPublickPath = path.resolve(__dirname, '..', 'server', 'public');

module.exports = merge(common, {
  mode: 'production',
  optimization: {
    splitChunks: {
      chunks: 'all',
    },
  },
  plugins: [
    new CopyPlugin({
      patterns: [{
        from: path.resolve(__dirname, 'public', 'favicon.ico'),
      }],
    }),
  ],
});
