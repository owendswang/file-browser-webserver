const { DefinePlugin } = require('webpack');
const fs = require('fs');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

function getVersion() {
  const packagePath = path.resolve(__dirname, '..', 'package.json');
  const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));

  const clientPackagePath = path.resolve(__dirname, 'package.json');
  const clientPackageData = JSON.parse(fs.readFileSync(clientPackagePath, 'utf-8'));
  if (clientPackageData.version !== packageData.version) {
    clientPackageData.version = packageData.version;
    fs.writeFileSync(clientPackagePath, JSON.stringify(clientPackageData, null, 2));
  }

  const serverPackagePath = path.resolve(__dirname, '..', 'server', 'package.json');
  const serverPackageData = JSON.parse(fs.readFileSync(serverPackagePath, 'utf-8'));
  if (serverPackageData.version !== packageData.version) {
    serverPackageData.version = packageData.version;
    fs.writeFileSync(serverPackagePath, JSON.stringify(serverPackageData, null, 2));
  }

  return packageData.version;
}

module.exports = {
  entry: './src/index.jsx',
  output: {
    filename: '[name].[contenthash].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    publicPath: '/',
  },
  resolve: {
    extensions: ['.js', '.jsx'],
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      },
      {
        test: /\.css$/,
        // exclude: /node_modules/,
        use: [
          {
            loader: 'style-loader',
          },
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1,
              // modules: true,
            }
          }
        ],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: 'File Browser',
      template: './public/index.html',
    }),
    new DefinePlugin({
      'BUILD_YEAR': JSON.stringify(new Date().getFullYear()),
      'APP_VERSION': JSON.stringify(getVersion()),
    }),
  ],
  watchOptions: {
    ignored: [
      '**/node_modules/**',
      'C:/pagefile.sys',
      'C:/swapfile.sys',
      'C:/System Volume Information',
      'C:/DumpStack.log.tmp'
    ]
  }
};
