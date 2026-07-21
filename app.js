require('dotenv').config()
const express = require('express')
const sass = require('sass')
let path = require('path')
let cheerio = require('cheerio')
const contentful = require('contentful')
let { BLOCKS } = require('@contentful/rich-text-types') 
let { documentToHtmlString } = require('@contentful/rich-text-html-renderer');

const client = contentful.createClient({
  space: process.env.CONTENTFUL_SPACE,
  environment: 'master', // defaults to 'master' if not set
  accessToken: process.env.CONTENTFUL_TOKEN
})

const app = express()
const port = 3000
app.use('/static', express.static(path.join(__dirname,'/static')));
app.use('/scripts', express.static(__dirname + '/node_modules'));
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
// App Engine Standard's runtime filesystem is read-only outside /tmp, so the
// compiled CSS is kept in memory and served directly rather than written to disk.
const { css: compiledCss } = sass.compile(path.join(__dirname, 'bootstrap/style.sass'), {
    syntax: 'scss', // the file has a .sass extension but is written in SCSS syntax
    logger: sass.Logger.silent // silence Bootstrap's own deprecation warnings
})
app.get('/public/style.css', (req, res) => res.type('css').send(compiledCss));

app.get('/', (req, res, next) => {
    client.getEntry('11CRuC0Q5OJb5a8vi4jsjX')
    .then((entry) => {
        // console.log(entry)
        const rawRichTextField = entry.fields.richTextField;
        // console.log(rawRichTextField)
        return documentToHtmlString(rawRichTextField);
      })
      .then((renderedHtml) => {
        res.render('homepage',{
            pageHeading:"Hyde Badminton Club",
            title:"Hyde Badminton Club",
            entry:renderedHtml,
            static_path : "/static" 
        })
      }) 
    .catch(console.error) 
})

app.get('/how-to-find-us', (req, res, next) => {
  client.getEntry('4QOXYKaCKzdOrJAuXhraa')
  .then((entry) => {
      // console.log(entry)
      const rawRichTextField = entry.fields.richTextField;
      // console.log(rawRichTextField)
      return documentToHtmlString(rawRichTextField);
    })
    .then((renderedHtml) => {
      res.render('homepage',{
          pageHeading:"How to Find Us",
          title:"How to Find Us",
          entry:renderedHtml,
          static_path : "/static" 
      })
    }) 
  .catch(console.error) 
})

app.get('/links', (req, res, next) => {
  client.getEntry('5FLeCM0Gnxal5sOQoim0Kx')
  .then((entry) => {
      // console.log(entry)
      const rawRichTextField = entry.fields.richTextField;
      // console.log(rawRichTextField)
      return documentToHtmlString(rawRichTextField);
    })
    .then((renderedHtml) => {
      res.render('homepage',{
          pageHeading:"Links",
          title:"Links",
          entry:renderedHtml.replace(/\n/g, "</br>"),
          static_path : "/static" 
      })
    }) 
  .catch(console.error) 
})

let historyMap = new Map()
historyMap.set("20242025","6zqgsNYG8b3OkkstTMNRJ5")
historyMap.set("20232024","2HJ0ys7FijGzNKTKEkl74r")


app.get('/history/:season', (req, res, next) => {

  if (historyMap.has(req.params.season)){
    client.getEntry(historyMap.get(req.params.season))
    .then((entry) => {
        // console.log(entry)
        const rawRichTextField = entry.fields.richTextField;
        // console.log(rawRichTextField)
        return documentToHtmlString(rawRichTextField);
      })
      .then((renderedHtml) => {
        res.render('homepage',{
            pageHeading:"2024 - 2025 Tables",
            title:"2024 - 2025 Tables",
            entry:renderedHtml.replace(/\n/g, "</br>").replaceAll("<table>","<table class=\"table-responsive table-bordered text-center\">"),
            static_path : "/static" 
        })
      }) 
    .catch(console.error) 
  }
  else {
    res.render('homepage',{
            pageHeading:"2024 - 2025 Tables",
            title:"2024 - 2025 Tables",
            entry:"<p>No history for this season selection</p>",
            static_path : "/static" 
        })
  }
  
})



const https = require('https');
const { computeSeason, seasonLabel } = require('./lib/season');

// Fixtures are scraped out-of-band by scripts/scrape-fixtures.mjs (run on a
// schedule via GitHub Actions) and committed to data/fixtures.json. The app
// just reads that file's raw GitHub URL instead of live-scraping the league
// sites on every request — keeps the request path immune to the leagues'
// sites changing markup or returning something unparseable.
const FIXTURES_JSON_URL = process.env.FIXTURES_JSON_URL || 'https://raw.githubusercontent.com/stockport-badminton/hydewebsite/main/data/fixtures.json';
const FIXTURES_CACHE_TTL_MS = 10 * 60 * 1000;
let fixturesCache = { fixtures: null, fetchedAt: 0 };

async function getFixtures() {
  const isFresh = fixturesCache.fixtures && (Date.now() - fixturesCache.fetchedAt) < FIXTURES_CACHE_TTL_MS;
  if (isFresh) return fixturesCache.fixtures;
  const response = await fetch(FIXTURES_JSON_URL);
  if (!response.ok) throw new Error(`Fixtures fetch failed: ${response.status}`);
  const { fixtures } = await response.json();
  fixturesCache = { fixtures, fetchedAt: Date.now() };
  return fixtures;
}

const dayNames = Array.from({ length: 7 }, (_, i) => new Date(0, 0, i).toLocaleString('en-US', { weekday: 'short' }));

app.get('/gallery', (req, res, next) => {
  client.getEntry('IKaXhRQqSysI0udkAcZXZ')
  .then((entry) => {
      let carouselData = entry.fields.carouselImages.map(image => ({name:image.fields.imageName, caption:image.fields.imageCaption, source:image.fields.imageSource.fields.file.url}))
      // console.log(carouselData)
      res.render('gallery',{
          pageHeading:"Gallery",
          title:"Gallery",
          entry:carouselData,
          static_path : "/static" 
      })
    }) 
  .catch(console.error) 
})

app.get('/tables', async (req, res, next) => {
  try {
    let divisions = [];
    
    // Helper function to promisify https.get
    const fetchData = (url) => {
      return new Promise((resolve, reject) => {
        https.get(url, (response) => {
          let data = [];
          
          response.on('data', chunk => {
            data.push(chunk);
          });
          
          response.on('end', () => {
            const html = Buffer.concat(data).toString();
            resolve(html);
          });
          
          response.on('error', (err) => {
            reject(err);
          });
        }).on('error', (err) => {
          reject(err);
        });
      });
    };
    
    // Fetch data from both URLs concurrently
    const [manchesterHtml, tamesideHtml] = await Promise.all([
      fetchData('https://www.manchesterbadmintonleague.org.uk/tables.php'),
      fetchData('https://tameside-badminton.co.uk/tables/All')
    ]);
    
    // Process Manchester data
    const $manchester = cheerio.load(manchesterHtml);
    const manchesterHTML = $manchester('table.footable');
    const manchesterTableData = [];
    
    manchesterHTML.find('tr').each((i, row) => {
      const rowData = {};
      $manchester(row).find('td, th').each((j, cell) => {
        rowData[j] = $manchester(cell).text();
      });
      manchesterTableData.push(rowData);
    });
    
    let currDivision = [];
    for (const row of manchesterTableData) {
      if (row["0"] && row["0"].indexOf("Division") > -1) {
        if (currDivision.length > 0) {
          let tidyDiv = currDivision.map(row => row.replaceAll('Division',' Manchester'));
          divisions.push(tidyDiv);
        }
        currDivision = [];
      }
      currDivision.push(Object.values(row).join());
    }
    if (currDivision.length > 0) {
      let tidyDiv = currDivision.map(row => row.replaceAll('Open Division','Manchester Open').replaceAll('Division',' Manchester'));
      divisions.push(tidyDiv);
    }
    
    // Process Tameside data
    const $tameside = cheerio.load(tamesideHtml);
    const tamesideHTML = $tameside('table');
    const tamesideTableData = [];
    
    tamesideHTML.find('tr').each((i, row) => {
      const rowData = {};
      $tameside(row).find('td, th').each((j, cell) => {
        rowData[j] = $tameside(cell).text();
      });
      tamesideTableData.push(rowData);
    });
    
    currDivision = [];
    for (const row of tamesideTableData) {
      if (row[0] && row[0].indexOf("Division") > -1) {
        if (currDivision.length > 0) {
          let tidyDiv = currDivision.map(row => row.replaceAll(/\n([\s]{2,})/gi, '').replaceAll('Division',' Tameside'));
          divisions.push(tidyDiv);
        }
        currDivision = [];
      }
      currDivision.push(Object.values(row).join());
    }
    
    // Don't forget the last division
    if (currDivision.length > 0) {
      let tidyDiv = currDivision.map(row => row.replaceAll(/\n([\s]{2,})/gi, '').replaceAll('Division',' Tameside'));
      divisions.push(tidyDiv);
    }
    
    // Filter for Hyde divisions
    const hydeDivisions = divisions.filter(row => row.join().indexOf('Hyde') > -1);
    
    console.log(hydeDivisions);
    res.render('tables',{
        pageHeading:"League Tables",
        title:"League Tables",
        entry:hydeDivisions,
        static_path : "/static" 
    })
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send({ error: 'Failed to fetch table data' });
  }
});

app.get('/fixtures/:team/:season?', async (req, res, next) => {
  try {
    const fixtures = await getFixtures();
    const teamFixtures = fixtures.filter((f) => f.team === req.params.team);

    const seasons = [...new Set(teamFixtures.map((f) => f.season))].sort().reverse();
    const currentSeason = computeSeason(new Date().toISOString());
    const season = req.params.season || (seasons.includes(currentSeason) ? currentSeason : seasons[0]);

    const result = teamFixtures
      .filter((f) => f.season === season)
      .map((f) => {
        const fixtureDate = new Date(f.date);
        return {
          date: fixtureDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          dotw: dayNames[fixtureDate.getDay()],
          competition: f.competition,
          opposition: f.opposition,
          homeOrAway: f.homeOrAway,
          result: f.result,
        };
      });

    res.render('fixtures', {
      pageHeading: req.params.team + " Fixtures",
      title: req.params.team + " Fixtures",
      result,
      static_path: "/static",
      team: req.params.team,
      season,
      seasons: seasons.map((s) => ({ value: s, label: seasonLabel(s) })),
    });
  } catch (err) {
    console.error('Error loading fixtures:', err);
    res.status(500).render('homepage', {
      pageHeading: req.params.team + " Fixtures",
      title: req.params.team + " Fixtures",
      entry: "<p>Sorry, fixtures are temporarily unavailable.</p>",
      static_path: "/static"
    });
  }
})

app.get('/news', (req, res, next) => {
    client.getEntry('4wpiyFP9LOHKkl0x4xfOSi')
    .then((entry) => {
        // console.log(entry)
        let newsField = {}
        let pageHtml = ""
        for (newsItem of entry.fields.newsItems){
            pageHtml += "<div class=\"row\"><p class=\"mb-1\">"
            pageHtml += "<strong>"+ new Date(newsItem.fields.newsDate).toLocaleDateString("en-GB",{
                year: "numeric",
                month: "long",
                day: "numeric",
              })+ "</strong>&nbsp;"
            newsField = newsItem.fields.newsInfo
            // console.log(newsField)
            const options = {
                renderNode: {
                  [BLOCKS.PARAGRAPH]: (node,next) => next(node.content) + "</p>"
                }
              }
            pageHtml += documentToHtmlString(newsField,options);
            pageHtml += "</div>"
            // console.log(pageHtml)
        }
        res.render('homepage',{
          pageHeading:"News",
          title:"News",
          entry:pageHtml,
          static_path : "/static" 
        })
      }) 
    .catch(console.error) 
})

app.get('/contact-us', (req, res, next) => {
  client.getEntry('3iaUrVGwS68yA2R1AlioPL')
  .then((entry) => {
      // console.log(entry)
      const rawRichTextField = entry.fields.richTextField;
      // console.log(rawRichTextField)
      return documentToHtmlString(rawRichTextField);
    })
    .then((renderedHtml) => {
      res.render('homepage',{
          pageHeading:"Contact Us",
          title:"Contact Us",
          entry:renderedHtml.replaceAll("<table>","<table class=\"table-responsive table-bordered text-center\" style=\"max-width: 30rem\">").replaceAll("<td>","<td class=\"w-25\">"),
          static_path : "/static" 
      })
    }) 
  .catch(console.error) 
})


app.use(function(req, res) {
  res.status(404);
  res.render('homepage', {
      pageHeading: "404",
      static_path: "/static",
      title : "Can't find the page your looking for",
      entry : "<p>Sorry can't find that page</p>"
 });
})

module.exports = app