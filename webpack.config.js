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
        use: ['coffee-loader'],
      },
      {
        // Replace NoFlo's dynamic loader with a generated one
        test: /noflo\/lib\/loader\/register.js$/,
        use: [
          {
            loader: 'noflo-component-loader',
            options: {
              // Only include components used by this graph
              // Set to NULL if you want all installed components
              graph: 'component-loader-example/InvertAsync',
              // Whether to include the original component sources
              // in the build
              debug: true,
            },
          },
        ],
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
