require('dotenv').config()
const express = require('express')
const sass = require('sass')
const path = require('path')
const pagesRouter = require('./routes/pages')
const fixturesRouter = require('./routes/fixtures')
const tablesRouter = require('./routes/tables')
const pushRouter = require('./routes/push')

const app = express()
app.use('/static', express.static(path.join(__dirname, '/static')));
app.use('/scripts', express.static(__dirname + '/node_modules'));
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// App Engine Standard's runtime filesystem is read-only outside /tmp, so the
// compiled CSS is kept in memory and served directly rather than written to disk.
const { css: compiledCss } = sass.compile(path.join(__dirname, 'styles/main.scss'), {
  logger: sass.Logger.silent // silence Bootstrap's own deprecation warnings
})
app.get('/public/style.css', (req, res) => res.type('css').send(compiledCss));

// The service worker is only registered on App Engine (GAE_ENV is set there)
// or when ENABLE_SW=1 — locally it would cache pages and confuse nodemon dev.
app.locals.enableServiceWorker = Boolean(process.env.GAE_ENV) || process.env.ENABLE_SW === '1';

app.use(pushRouter)
app.use(pagesRouter)
app.use(fixturesRouter)
app.use(tablesRouter)

// Must be mounted after every router above — an Express Router's own
// catch-all only sees requests that reach that router, but a bare
// app.use(fn) with no path matches everything, so it has to be last.
app.use(function (req, res) {
  res.status(404);
  res.render('homepage', {
    pageHeading: "404",
    static_path: "/static",
    title: "Can't find the page your looking for",
    entry: "<p>Sorry can't find that page</p>"
  });
})

module.exports = app
