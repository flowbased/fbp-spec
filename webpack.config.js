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
                presets: ['es2015']
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
              presets: ['es2015'],
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
