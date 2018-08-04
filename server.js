#!/usr/bin/env node
require('dotenv').config();

var express = require('express');
var proxy = require('express-http-proxy');
var morgan = require('morgan')

// get port from environment and store in Express
var app = express();

app.use(morgan('combined'));

// set the view engine to ejs
app.set('view engine', 'ejs');

// use res.render to load up an ejs view file
// index page
app.get('/', function (req, res) {
    res.render('pages/index');
});

// about page
app.get('/about', function (req, res) {
    res.render('pages/about');
});

var bLive = (process.env.NODE_ENV == "live");

if (bLive) {
    const path = require("path");
    const webpack = require("webpack");
    const webpackConfig = require("./webpack.config");
    const compiler = webpack(webpackConfig);
    // webpack hmr

    app.use(
        require("webpack-dev-middleware")(compiler, {
            noInfo: true,
            publicPath: webpackConfig.output.publicPath
        })
    );

    app.use(require("webpack-hot-middleware")(compiler));

}
    
app.use("/dist", express.static('dist'));



// Get port from environment and store in Express
var port = process.env.PORT || 3000;
app.listen(port)
console.log('Server is listening on port', port)
