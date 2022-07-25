const path = require("path");
const ejs = require('ejs');
const {version} = require('./package.json');

module.exports = {
  context: __dirname,
  entry: {
    'index': "./src/index.tsx",
    'bootstrap': "./src/bootstrap.tsx",
  },
  output: {
    path: path.join(__dirname, "dist"),
    filename: "[name].js"
  },
  module: {
    rules: [
      {
        exclude: /node_modules/,
        test: /\.tsx?$/,
        use: "ts-loader"
      },
      {
        exclude: /node_modules/,
        test: /\.scss$/,
        use: [
          {
            loader: "style-loader" // Creates style nodes from JS strings
          },
          {
            loader: "css-loader" // Translates CSS into CommonJS
          },
          {
            loader: "sass-loader" // Compiles Sass to CSS
          }
        ]
      }
    ]
  },
  mode: 'production',
  resolve: {
    extensions: [".js", ".ts", ".tsx"]
  }
};

function transformHtml(content) {
  return ejs.render(content.toString(), {
    ...process.env,
  });
}
