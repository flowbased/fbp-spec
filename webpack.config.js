module.exports = {
  entry: './webpack.entry.js',
  output: {
    path: __dirname,
    filename: 'browser/fbp-spec.js',
  },
  module: {
    rules: [
      {
        test: /\.coffee$/,
        use: [
          {
            loader: 'coffee-loader',
            options: {
              transpile: {
                presets: ['@babel/preset-env'],
              }
            }
          }
        ]
      },
      {
        test: /\.js$/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
            }
          }
        ]
      },
    ]
  },
  resolve: {
    extensions: [".coffee", ".js"],
  },
  externals: {
  },
  node: {
    child_process: 'empty',
    fs: 'empty',
  },
};
