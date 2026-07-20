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

app.get('/getMancFixtures',(req,res,next) => {

  https.get('https://www.manchesterbadmintonleague.org.uk/fixtures.php', fixRes => {
    let data = [];
    const headerDate = fixRes.headers && fixRes.headers.date ? fixRes.headers.date : 'no response date';
    fixRes.on('data', chunk => {
      data.push(chunk);
    });
    fixRes.on('end', () => {
      console.log('Response ended: ');
      const fixturesResponse = Buffer.concat(data).toString();
      // console.log(fixturesResponse)
      const $ = cheerio.load(fixturesResponse);
      const fixturesHTML = $('#listfixtures'); 
      const tableData = [];
      fixturesHTML.find('tr').each((i, row) => {
          const rowData = {};
          $(row).find('td, th').each((j, cell) => {
              rowData[j] = $(cell).text();
          });
          tableData.push(rowData);
      });
      const months = Array.from({length: 12}, (item, i) => {
        return new Date(0, i).toLocaleString('en-US', {month: 'short'})
      });
      let HydeFixtures = tableData.filter(row => row[2].indexOf("Hyde") > -1 )
      // console.log(HydeFixtures)
      let mancFixtures = HydeFixtures.map(row => {
        let tempDateArray = row['0'].trim().split(' ')
        let teamsArray = row['2'].trim().split(' v ')
        console.log(teamsArray)
        let opposition = teamsArray[0].indexOf('Hyde') > -1  ? teamsArray[1].trim() : teamsArray[0].trim()
        let homeOrAway = teamsArray[0].indexOf('Hyde') > -1 ? "home" : "away"
        if (months.indexOf(tempDateArray[2]) > 0 ){
          return {"date":tempDateArray[1] + "/" + (months.indexOf(tempDateArray[2])+1) + "/" + tempDateArray[3],"competition":row['1'].trim(),"opposition":opposition,"homeOrAway":homeOrAway,"result":row['3'].trim()}
        }
        else {
          return {"date":"01/08/2024","competition":row['1'].trim(),"opposition":opposition,"homeOrAway":homeOrAway,"result":row['3'].trim()}
        }
        
      })
      https.get('https://tameside-badminton.co.uk/fixtures/club-Hyde', fixRes => {
        let data = []
        fixRes.on('data', chunk => {
          data.push(chunk);
        });
        fixRes.on('end', () => {
          console.log('Response ended: ');
          const newFixturesResponse = Buffer.concat(data).toString();
          // console.log(JSON.parse(newFixturesResponse))
          let tamesideFixtures = JSON.parse(newFixturesResponse).map(row => {
            let fixDate = new Date(row.date).toLocaleDateString('en-GB',{day:'numeric',month:'numeric',year:'numeric'})
            let opposition = row['hometeam'].indexOf('Hyde') > 0 ? row.awayteam : row.hometeam
            let homeOrAway = row['hometeam'].indexOf('Hyde') > 0 ? "home" : "away"
            if (row.homeScore !== null){
              return {"date":fixDate,"competition":"Tameside","opposition":opposition,"homeOrAway":homeOrAway,"result":row.homeScore+"-"+row.awayScore}  
            }
            else{
              return {"date":fixDate,"competition":"Tameside","opposition":opposition,"homeOrAway":homeOrAway,"result":"TBC"}
            }
          })
          let allFixtures = mancFixtures.concat(tamesideFixtures)
          allFixtures.sort(function(a, b){
            var aa = a.date.split('/').reverse().join(),
                bb = b.date.split('/').reverse().join();
            return aa < bb ? -1 : (aa > bb ? 1 : 0);
          });
          res.send(allFixtures)
        })
          
      // console.log(tableData)
      }).on('error', err => {
        console.log('Error: ', err.message);
      });
    });
  }).on('error', err => {
    console.log('Error: ', err.message);
  });
})


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

app.get('/fixtures/:team', (req, res, next) => {
  https.get('https://www.manchesterbadmintonleague.org.uk/fixtures.php', fixRes => {
    let data = [];
    const headerDate = fixRes.headers && fixRes.headers.date ? fixRes.headers.date : 'no response date';
    fixRes.on('data', chunk => {
      data.push(chunk);
    });
    fixRes.on('end', () => {
      console.log('Response ended: ');
      const fixturesResponse = Buffer.concat(data).toString();
      //console.log(fixturesResponse)
      const $ = cheerio.load(fixturesResponse);
      const fixturesHTML = $('#listfixtures'); 
      //console.log(fixturesHTML)
      const tableData = [];
      fixturesHTML.find('tr').each((i, row) => {
          const rowData = {};
          $(row).find('td, th').each((j, cell) => {
              rowData[j] = $(cell).text();
          });
          tableData.push(rowData);
          //console.log(rowData)
      });
      const months = Array.from({length: 12}, (item, i) => {
        return new Date(0, i).toLocaleString('en-US', {month: 'short'})
      });
      const dayNames = Array.from({ length: 7 }, (_, i) => {
        return new Date(0,0,i).toLocaleString('en-US', { weekday: 'short' });
        });
      let HydeFixtures = tableData.filter(row => row[3].indexOf("Hyde") > -1 )
      //console.log(months)
      // console.log(HydeFixtures)
      let mancFixtures = HydeFixtures.map(row => {
        let tempDateArray = row['0'].trim().split('/')
        // console.log(row)
        // console.log(months.indexOf(tempDateArray[2]))
        
        let teamsArray = row['3'].trim().split(' v ')
        
        let opposition = teamsArray[0].indexOf('Hyde') > -1  ? teamsArray[1].trim() : teamsArray[0].trim()
        let team = teamsArray[0].indexOf('Hyde') > -1  ? teamsArray[0].trim() : teamsArray[1].trim()
        let homeOrAway = teamsArray[0].indexOf('Hyde') > -1 ? "home" : "away"
        // console.log(tempDateArray[0] + "/" + tempDateArray[2] + "/" + tempDateArray[1])
        let weekday = new Date(tempDateArray[1] + "/" + tempDateArray[0] + "/" + tempDateArray[2])
        // console.log(weekday)
        weekday = dayNames[weekday.getDay()]
        // if (months.indexOf(tempDateArray[1]) >= 0 ){
        if (row['0'].indexOf('TBA') == -1){
          return {"date":("0" + tempDateArray[0]).slice(-2) + "/" + ("0" + tempDateArray[1]).slice(-2) + "/" + tempDateArray[2],"dotw":weekday,"competition":row['2'].trim(),"team":team,"opposition":opposition,"homeOrAway":homeOrAway,"result":row['4'].trim()}
        }
        else {
          return {"date":"TBA","dotw":weekday,"competition":row['2'].trim(),"team":team,"opposition":opposition,"homeOrAway":homeOrAway,"result":row['4'].trim()}
        }
        
      })
      // console.log(mancFixtures)
      let tamesideTeam = "Hyde High A"
      switch (req.params.team){
        case "Hyde A":
          tamesideTeam = "Hyde High A"
          break;
        case "Hyde B":
          tamesideTeam = "Hyde High B"
          break;
        case "Hyde C":
          tamesideTeam = "Hyde High C"
          break;
        default:
          tamesideTeam = "Hyde High A"
      }
      https.get('https://tameside-badminton.co.uk/fixtures/team-'+tamesideTeam, fixRes => {
        let data = []
        fixRes.on('data', chunk => {
          data.push(chunk);
        });
        fixRes.on('end', () => {
          console.log('Response ended: ');
          const newFixturesResponse = Buffer.concat(data).toString();
          // console.log(JSON.parse(newFixturesResponse))
          let tamesideFixtures = JSON.parse(newFixturesResponse).map(row => {
            let fixDate = new Date(row.date).toLocaleDateString('en-GB',{day:'numeric',month:'numeric',year:'numeric'})
            let opposition = row['homeTeam'].indexOf(tamesideTeam) >= 0 ? row.awayTeam : row.homeTeam
            let team = row['homeTeam'].indexOf(tamesideTeam) >= 0 ? row.homeTeam : row.awayTeam
            let homeOrAway = row['homeTeam'].indexOf(tamesideTeam) >= 0 ? "home" : "away"
            let weekday = new Date(row.date).getDay()
            weekday = dayNames[weekday]
            if (row.homeScore !== null){
              return {"date":fixDate,"dotw":weekday,"competition":"Tameside","team":team,"opposition":opposition,"homeOrAway":homeOrAway,"result":row.homeScore+"-"+row.awayScore}  
            }
            else{
              return {"date":fixDate,"dotw":weekday,"competition":"Tameside","team":team,"opposition":opposition,"homeOrAway":homeOrAway,"result":""}
            }
          })
          // console.log(tamesideFixtures)
          let allFixtures = mancFixtures.concat(tamesideFixtures)
          allFixtures.sort(function(a, b){
            var aa = a.date.split('/').reverse().join(),
                bb = b.date.split('/').reverse().join();
            return aa < bb ? -1 : (aa > bb ? 1 : 0);
          });
          let teamFixtures = []
            switch (req.params.team){
              case "Hyde A":
                teamFixtures = allFixtures.filter(row => (row.team.indexOf("Hyde High A") >= 0 || row.team.indexOf("Hyde 1") >= 0) )
                break;
              case "Hyde B":
                teamFixtures = allFixtures.filter(row => (row.team.indexOf("Hyde High B") >= 0 || row.team.indexOf("Hyde O") >= 0) )
                break;
              case "Hyde C":
                teamFixtures = allFixtures.filter(row => (row.team.indexOf("Hyde High C") >= 0))
                break;
              default:
                teamFixtures = allFixtures
            }
            // console.log(teamFixtures)
            res.render('fixtures',{
                pageHeading:req.params.team + " Fixtures",
                title:req.params.team + " Fixtures",
                result:teamFixtures,
                static_path : "/static" 
            })
        })
          
      // console.log(tableData)
      }).on('error', err => {
        console.log('Error: ', err.message);
      });
    });
  }).on('error', err => {
    console.log('Error: ', err.message);
  });

    
      
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